import "server-only";
import { randomBytes } from "node:crypto";
import { getDb, isUniqueViolation } from "./db";
import {
  SCHEDULE,
  addDays,
  localDateTime,
  minutesToTime,
  parseWorkDays,
  todayLocal,
  weekday,
} from "./schedule";

export interface Department {
  id: number;
  name: string;
}

export interface Doctor {
  id: number;
  departmentId: number;
  departmentName: string;
  name: string;
  title: string;
  workDays: number[];
  startHour: number;
  endHour: number;
  slotMinutes: number;
  active: boolean;
}

export interface Service {
  id: number;
  departmentId: number;
  name: string;
  price: number;
  active: boolean;
}

export const APPOINTMENT_STATUSES = ["booked", "arrived", "done", "no_show", "cancelled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface Appointment {
  id: number;
  code: string;
  doctorId: number;
  doctorName: string;
  doctorTitle: string;
  departmentName: string;
  startsAt: Date;
  patientName: string;
  phone: string;
  birthYear: number | null;
  complaint: string;
  status: AppointmentStatus;
}

export class AppointmentError extends Error {
  constructor(
    message: string,
    readonly code: "slot_taken" | "invalid" | "too_late",
  ) {
    super(message);
    this.name = "AppointmentError";
  }
}

interface DoctorRow {
  id: number;
  department_id: number;
  department_name: string;
  name: string;
  title: string;
  work_days: string;
  start_hour: number;
  end_hour: number;
  slot_minutes: number;
  active: boolean;
}

interface AppointmentRow {
  id: number;
  code: string;
  doctor_id: number;
  doctor_name: string;
  doctor_title: string;
  department_name: string;
  starts_at: Date | string;
  patient_name: string;
  phone: string;
  birth_year: number | null;
  complaint: string;
  status: string;
}

function toDoctor(r: DoctorRow): Doctor {
  return {
    id: r.id,
    departmentId: r.department_id,
    departmentName: r.department_name,
    name: r.name,
    title: r.title,
    workDays: parseWorkDays(r.work_days),
    startHour: r.start_hour,
    endHour: r.end_hour,
    slotMinutes: r.slot_minutes,
    active: r.active,
  };
}

function isStatus(s: string): s is AppointmentStatus {
  return (APPOINTMENT_STATUSES as readonly string[]).includes(s);
}

function toAppointment(r: AppointmentRow): Appointment {
  return {
    id: r.id,
    code: r.code,
    doctorId: r.doctor_id,
    doctorName: r.doctor_name,
    doctorTitle: r.doctor_title,
    departmentName: r.department_name,
    startsAt: new Date(r.starts_at),
    patientName: r.patient_name,
    phone: r.phone,
    birthYear: r.birth_year,
    complaint: r.complaint,
    status: isStatus(r.status) ? r.status : "booked",
  };
}

const DOCTOR_SELECT = `SELECT d.id, d.department_id, dep.name AS department_name, d.name, d.title, d.work_days,
  d.start_hour, d.end_hour, d.slot_minutes, d.active
  FROM doctors d JOIN departments dep ON dep.id = d.department_id`;

const APPOINTMENT_SELECT = `SELECT a.id, a.code, a.doctor_id, d.name AS doctor_name, d.title AS doctor_title,
  dep.name AS department_name, a.starts_at, a.patient_name, a.phone, a.birth_year, a.complaint, a.status
  FROM appointments a JOIN doctors d ON d.id = a.doctor_id JOIN departments dep ON dep.id = d.department_id`;

export async function listDepartments(): Promise<Department[]> {
  const db = await getDb();
  return db.query<Department>("SELECT id, name FROM departments ORDER BY sort, id");
}

export async function listDoctors(includeInactive = false): Promise<Doctor[]> {
  const db = await getDb();
  const rows = await db.query<DoctorRow>(
    `${DOCTOR_SELECT} ${includeInactive ? "" : "WHERE d.active"} ORDER BY dep.sort, d.id`,
  );
  return rows.map(toDoctor);
}

export async function getDoctor(id: number): Promise<Doctor | null> {
  const db = await getDb();
  const [row] = await db.query<DoctorRow>(`${DOCTOR_SELECT} WHERE d.id = $1`, [id]);
  return row ? toDoctor(row) : null;
}

export async function listServices(includeInactive = false): Promise<Service[]> {
  const db = await getDb();
  const rows = await db.query<{ id: number; department_id: number; name: string; price: number; active: boolean }>(
    `SELECT id, department_id, name, price, active FROM services ${includeInactive ? "" : "WHERE active"} ORDER BY id`,
  );
  return rows.map((r) => ({ id: r.id, departmentId: r.department_id, name: r.name, price: r.price, active: r.active }));
}

/** Shifokorning shu kundagi barcha qabul vaqtlari (daqiqada). Ish kuni bo'lmasa — bo'sh. */
export function doctorDaySlots(doctor: Doctor, date: string): number[] {
  if (!doctor.workDays.includes(weekday(date))) return [];
  const out: number[] = [];
  for (let m = doctor.startHour * 60; m + doctor.slotMinutes <= doctor.endHour * 60; m += doctor.slotMinutes) out.push(m);
  return out;
}

/** Bo'sh vaqtlar ("HH:MM"): ish vaqti ichida, band bo'lmagan va kamida 30 daqiqa keyin. */
export async function getAvailableTimes(doctorId: number, date: string, now = new Date()): Promise<string[]> {
  const doctor = await getDoctor(doctorId);
  if (!doctor || !doctor.active) return [];
  const today = todayLocal(now);
  if (date < today || date > addDays(today, SCHEDULE.daysAhead)) return [];

  const db = await getDb();
  const taken = await db.query<{ starts_at: Date | string; duration_min: number }>(
    `SELECT starts_at, duration_min FROM appointments
      WHERE doctor_id = $1 AND status <> 'cancelled' AND starts_at >= $2 AND starts_at < $3`,
    [doctorId, localDateTime(date, 0), localDateTime(date, 24 * 60)],
  );
  // Band oraliqlar: jadval keyin o'zgarsa ham, avvalgi uzunroq qabul ustiga yozilmaydi
  const busy = taken.map((r) => {
    const start = new Date(r.starts_at).getTime();
    return [start, start + r.duration_min * 60_000] as const;
  });
  const earliest = now.getTime() + SCHEDULE.minLeadMinutes * 60_000;
  const slotMs = doctor.slotMinutes * 60_000;

  return doctorDaySlots(doctor, date)
    .filter((m) => {
      const t = localDateTime(date, m).getTime();
      return t >= earliest && !busy.some(([s, e]) => t < e && t + slotMs > s);
    })
    .map(minutesToTime);
}

function newCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (const b of randomBytes(10)) out += alphabet[b % alphabet.length];
  return out;
}

export interface NewAppointment {
  doctorId: number;
  date: string;
  time: string;
  patientName: string;
  phone: string;
  birthYear: number | null;
  complaint: string;
}

export async function createAppointment(input: NewAppointment, now = new Date()): Promise<{ code: string; doctor: Doctor; startsAt: Date }> {
  const available = await getAvailableTimes(input.doctorId, input.date, now);
  if (!available.includes(input.time)) {
    throw new AppointmentError("Bu vaqt band yoki mavjud emas. Boshqa vaqtni tanlang.", "slot_taken");
  }
  const doctor = await getDoctor(input.doctorId);
  if (!doctor) throw new AppointmentError("Shifokor topilmadi.", "invalid");

  const [hh, mm] = input.time.split(":").map(Number) as [number, number];
  const startsAt = localDateTime(input.date, hh * 60 + mm);
  const db = await getDb();
  try {
    const [row] = await db.query<{ code: string }>(
      `INSERT INTO appointments (code, doctor_id, starts_at, duration_min, patient_name, phone, birth_year, complaint)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING code`,
      [newCode(), doctor.id, startsAt, doctor.slotMinutes, input.patientName, input.phone, input.birthYear, input.complaint],
    );
    if (!row) throw new Error("Qabul saqlanmadi");
    return { code: row.code, doctor, startsAt };
  } catch (err) {
    // Unikal indeks: ikki bemor bir vaqtda bossa, faqat bittasi yoziladi
    if (isUniqueViolation(err)) {
      throw new AppointmentError("Bu vaqtni hozirgina boshqa bemor band qildi. Boshqa vaqtni tanlang.", "slot_taken");
    }
    throw err;
  }
}

export async function getAppointmentByCode(code: string): Promise<Appointment | null> {
  const db = await getDb();
  const [row] = await db.query<AppointmentRow>(`${APPOINTMENT_SELECT} WHERE a.code = $1`, [code]);
  return row ? toAppointment(row) : null;
}

export function canPatientCancel(a: Appointment, now = new Date()): boolean {
  return a.status === "booked" && a.startsAt.getTime() - now.getTime() >= SCHEDULE.cancelBeforeHours * 3_600_000;
}

/** Bemor o'zi bekor qiladi — faqat "booked" holatda va qabulgacha kamida 2 soat bo'lsa. */
export async function cancelByPatient(code: string, now = new Date()): Promise<{ appointment: Appointment; changed: boolean }> {
  const appt = await getAppointmentByCode(code);
  if (!appt) throw new AppointmentError("Qabul topilmadi.", "invalid");
  // Qayta bosilsa ham xato emas — natija bir xil
  if (appt.status === "cancelled") return { appointment: appt, changed: false };
  if (appt.status !== "booked") {
    throw new AppointmentError("Bu qabul allaqachon boshlangan yoki yakunlangan, uni bekor qilib bo'lmaydi.", "too_late");
  }
  if (!canPatientCancel(appt, now)) {
    throw new AppointmentError(
      `Qabulni ${SCHEDULE.cancelBeforeHours} soatdan kam vaqt qolganda bekor qilib bo'lmaydi. Klinikaga qo'ng'iroq qiling.`,
      "too_late",
    );
  }
  const db = await getDb();
  const rows = await db.query<{ id: number }>(
    "UPDATE appointments SET status = 'cancelled' WHERE code = $1 AND status = 'booked' RETURNING id",
    [code],
  );
  return { appointment: { ...appt, status: "cancelled" }, changed: rows.length > 0 };
}

export async function listDay(date: string): Promise<Appointment[]> {
  const db = await getDb();
  const rows = await db.query<AppointmentRow>(
    `${APPOINTMENT_SELECT} WHERE a.starts_at >= $1 AND a.starts_at < $2 ORDER BY dep.sort, d.id, a.starts_at`,
    [localDateTime(date, 0), localDateTime(date, 24 * 60)],
  );
  return rows.map(toAppointment);
}

/** Admin bosqichlari: qaysi holatdan qaysiga o'tish mumkin */
const TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  booked: ["arrived", "no_show", "cancelled"],
  arrived: ["done", "cancelled"],
  done: [],
  no_show: ["booked"],
  cancelled: [],
};

export function allowedNext(status: AppointmentStatus): readonly AppointmentStatus[] {
  return TRANSITIONS[status];
}

/** Holatni o'zgartiradi, faqat ruxsat etilgan o'tishda. Bekor qilingan vaqt yana bo'shaydi. */
export async function setAppointmentStatus(id: number, from: AppointmentStatus, to: AppointmentStatus): Promise<boolean> {
  if (!TRANSITIONS[from].includes(to)) return false;
  const db = await getDb();
  try {
    const rows = await db.query<{ id: number }>(
      "UPDATE appointments SET status = $3 WHERE id = $1 AND status = $2 RETURNING id",
      [id, from, to],
    );
    return rows.length > 0;
  } catch (err) {
    // "Kelmadi"ni qaytarishda vaqt allaqachon boshqaga berilgan bo'lishi mumkin
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}

export interface DayStats {
  total: number;
  seen: number;
  noShow: number;
  waiting: number;
  weekTotal: number;
}

export async function dayStats(date: string): Promise<DayStats> {
  const db = await getDb();
  const [day] = await db.query<{ total: number; seen: number; no_show: number; waiting: number }>(
    `SELECT count(*) FILTER (WHERE status <> 'cancelled')::int AS total,
            count(*) FILTER (WHERE status IN ('arrived', 'done'))::int AS seen,
            count(*) FILTER (WHERE status = 'no_show')::int AS no_show,
            count(*) FILTER (WHERE status = 'booked')::int AS waiting
       FROM appointments WHERE starts_at >= $1 AND starts_at < $2`,
    [localDateTime(date, 0), localDateTime(date, 24 * 60)],
  );
  const weekStart = addDays(date, -((weekday(date) + 6) % 7));
  const [week] = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM appointments WHERE status <> 'cancelled' AND starts_at >= $1 AND starts_at < $2`,
    [localDateTime(weekStart, 0), localDateTime(addDays(weekStart, 7), 0)],
  );
  return {
    total: day?.total ?? 0,
    seen: day?.seen ?? 0,
    noShow: day?.no_show ?? 0,
    waiting: day?.waiting ?? 0,
    weekTotal: week?.n ?? 0,
  };
}

// ---- Admin: shifokorlar va xizmatlar ----

export interface DoctorInput {
  departmentId: number;
  name: string;
  title: string;
  workDays: number[];
  startHour: number;
  endHour: number;
  slotMinutes: number;
}

export async function addDoctor(input: DoctorInput): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO doctors (department_id, name, title, work_days, start_hour, end_hour, slot_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [input.departmentId, input.name, input.title, input.workDays.join(","), input.startHour, input.endHour, input.slotMinutes],
  );
}

export async function updateDoctorSchedule(
  id: number,
  input: Pick<DoctorInput, "workDays" | "startHour" | "endHour" | "slotMinutes">,
): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE doctors SET work_days = $2, start_hour = $3, end_hour = $4, slot_minutes = $5 WHERE id = $1", [
    id,
    input.workDays.join(","),
    input.startHour,
    input.endHour,
    input.slotMinutes,
  ]);
}

export async function setDoctorActive(id: number, active: boolean): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE doctors SET active = $2 WHERE id = $1", [id, active]);
}

export async function addService(departmentId: number, name: string, price: number): Promise<void> {
  const db = await getDb();
  await db.query("INSERT INTO services (department_id, name, price) VALUES ($1, $2, $3)", [departmentId, name, price]);
}

export async function updateServicePrice(id: number, price: number): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE services SET price = $2 WHERE id = $1", [id, price]);
}

export async function setServiceActive(id: number, active: boolean): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE services SET active = $2 WHERE id = $1", [id, active]);
}

/** Admin kun tanlaganda chiqadigan oraliq (bugundan 14 kun oldin va keyin) */
export function adminDateRange(now = new Date()): { min: string; max: string; today: string } {
  const today = todayLocal(now);
  return { min: addDays(today, -60), max: addDays(today, SCHEDULE.daysAhead), today };
}

