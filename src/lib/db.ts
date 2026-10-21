import "server-only";
import { Pool } from "pg";
import type { PGlite } from "@electric-sql/pglite";

export interface Queryable {
  query<T extends object>(text: string, params?: readonly unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  transaction<R>(fn: (tx: Queryable) => Promise<R>): Promise<R>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  work_days TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
  start_hour INTEGER NOT NULL DEFAULT 9 CHECK (start_hour BETWEEN 0 AND 23),
  end_hour INTEGER NOT NULL DEFAULT 17 CHECK (end_hour BETWEEN 1 AND 24),
  slot_minutes INTEGER NOT NULL DEFAULT 30 CHECK (slot_minutes IN (15, 20, 30, 40, 60)),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (end_hour > start_hour)
);
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id),
  starts_at TIMESTAMPTZ NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 30 CHECK (duration_min > 0),
  patient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  birth_year INTEGER,
  complaint TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'arrived', 'done', 'no_show', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot_uniq ON appointments (doctor_id, starts_at) WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS appointments_starts_idx ON appointments (starts_at);
`;

interface SeedDepartment {
  name: string;
  doctors: ReadonlyArray<{ name: string; title: string; days: string; start: number; end: number; slot: number }>;
  services: ReadonlyArray<readonly [name: string, price: number]>;
}

const SEED: readonly SeedDepartment[] = [
  {
    name: "Terapiya",
    doctors: [
      { name: "Dilnoza Karimova", title: "Terapevt, 12 yil tajriba", days: "1,2,3,4,5,6", start: 8, end: 14, slot: 30 },
      { name: "Anvar Tursunov", title: "Terapevt, 7 yil tajriba", days: "1,2,3,4,5", start: 13, end: 18, slot: 30 },
    ],
    services: [["Terapevt ko'rigi", 120000], ["Takroriy ko'rik", 80000], ["Uyga chaqirish", 250000]],
  },
  {
    name: "Stomatologiya",
    doctors: [{ name: "Sherzod Aliyev", title: "Stomatolog-terapevt, 9 yil tajriba", days: "1,2,3,4,5,6", start: 9, end: 17, slot: 60 }],
    services: [["Stomatolog ko'rigi", 100000], ["Tish plombasi", 350000], ["Tish tozalash", 300000]],
  },
  {
    name: "Pediatriya",
    doctors: [{ name: "Nodira Rasulova", title: "Pediatr, 15 yil tajriba", days: "1,2,3,4,5,6", start: 8, end: 13, slot: 20 }],
    services: [["Pediatr ko'rigi", 110000], ["Emlashdan oldingi ko'rik", 90000]],
  },
  {
    name: "Diagnostika",
    doctors: [{ name: "Bobur Xolmatov", title: "UZI shifokori, 10 yil tajriba", days: "1,2,3,4,5", start: 9, end: 16, slot: 30 }],
    services: [["Qorin bo'shlig'i UZI", 150000], ["Qalqonsimon bez UZI", 120000], ["EKG", 70000]],
  },
];

function wrapPg(client: { query: Pool["query"] }): Queryable {
  return {
    async query<T extends object>(text: string, params: readonly unknown[] = []) {
      const res = await client.query(text, [...params]);
      return res.rows as T[];
    },
  };
}

function wrapLite(lite: Pick<PGlite, "query">): Queryable {
  return {
    async query<T extends object>(text: string, params: readonly unknown[] = []) {
      const res = await lite.query<T>(text, [...params]);
      return res.rows;
    },
  };
}

/** Jadval yaratish va boshlang'ich ma'lumot. Bir vaqtda ishga tushgan serverlar ikki marta yozmasligi uchun qulf ostida. */
async function migrate(tx: Queryable, runSchema: (sql: string) => Promise<void>): Promise<void> {
  await runSchema(SCHEMA);
  const rows = await tx.query<{ count: string }>("SELECT count(*)::text AS count FROM departments");
  if (rows[0]?.count !== "0") return;
  for (const [i, dep] of SEED.entries()) {
    const [row] = await tx.query<{ id: number }>("INSERT INTO departments (name, sort) VALUES ($1, $2) RETURNING id", [dep.name, i]);
    if (!row) throw new Error("Bo'lim yaratilmadi");
    for (const d of dep.doctors) {
      await tx.query(
        `INSERT INTO doctors (department_id, name, title, work_days, start_hour, end_hour, slot_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [row.id, d.name, d.title, d.days, d.start, d.end, d.slot],
      );
    }
    for (const [name, price] of dep.services) {
      await tx.query("INSERT INTO services (department_id, name, price) VALUES ($1, $2, $3)", [row.id, name, price]);
    }
  }
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

  if (url) {
    const pool = new Pool({ connectionString: url, max: 3, ssl: url.includes("localhost") ? false : { rejectUnauthorized: false } });
    const db: Db = {
      ...wrapPg(pool),
      async transaction(fn) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn(wrapPg(client));
          await client.query("COMMIT");
          return result;
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      },
    };
    await db.transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(7313)");
      await migrate(tx, async (sql) => {
        await tx.query(sql);
      });
    });
    return db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const lite = await PGlite.create(process.env.PGLITE_DIR ?? "memory://");
  const db: Db = {
    ...wrapLite(lite),
    transaction: (fn) => lite.transaction((tx) => fn(wrapLite(tx))),
  };
  await migrate(db, async (sql) => {
    await lite.exec(sql);
  });
  return db;
}

const globalForDb = globalThis as unknown as { __klinikaDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__klinikaDb) {
    globalForDb.__klinikaDb = createDb().catch((err: unknown) => {
      // Ulanish xatosi keshda qolib ketmasin — keyingi so'rov qayta urinadi
      globalForDb.__klinikaDb = undefined;
      throw err;
    });
  }
  return globalForDb.__klinikaDb;
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "23505";
}
