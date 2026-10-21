"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAdmin } from "@/lib/auth";
import {
  APPOINTMENT_STATUSES,
  addDoctor,
  addService,
  setAppointmentStatus,
  setDoctorActive,
  setServiceActive,
  updateDoctorSchedule,
  updateServicePrice,
} from "@/lib/clinic";

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

const Id = z.coerce.number().int().positive();
const Status = z.enum(APPOINTMENT_STATUSES);
const Price = z.coerce.number().int().min(0).max(100_000_000);
const Schedule = z
  .object({
    workDays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Kamida bitta ish kuni"),
    startHour: z.coerce.number().int().min(0).max(23),
    endHour: z.coerce.number().int().min(1).max(24),
    slotMinutes: z.coerce.number().int().refine((v) => [15, 20, 30, 40, 60].includes(v)),
  })
  .refine((v) => v.endHour > v.startHour, "Tugash vaqti boshlanishdan keyin bo'lsin");

export async function setStatusAction(form: FormData): Promise<void> {
  await requireAdmin();
  await setAppointmentStatus(Id.parse(form.get("id")), Status.parse(form.get("from")), Status.parse(form.get("to")));
  revalidatePath("/admin");
}

export async function addDoctorAction(form: FormData): Promise<void> {
  await requireAdmin();
  const base = z
    .object({ departmentId: Id, name: z.string().trim().min(3).max(60), title: z.string().trim().max(80) })
    .parse({ departmentId: form.get("departmentId"), name: form.get("name"), title: form.get("title") ?? "" });
  const schedule = Schedule.parse({
    workDays: form.getAll("workDays"),
    startHour: form.get("startHour"),
    endHour: form.get("endHour"),
    slotMinutes: form.get("slotMinutes"),
  });
  await addDoctor({ ...base, ...schedule });
  revalidatePath("/admin/settings");
  revalidatePath("/");
}

export async function updateScheduleAction(form: FormData): Promise<void> {
  await requireAdmin();
  const schedule = Schedule.parse({
    workDays: form.getAll("workDays"),
    startHour: form.get("startHour"),
    endHour: form.get("endHour"),
    slotMinutes: form.get("slotMinutes"),
  });
  await updateDoctorSchedule(Id.parse(form.get("id")), schedule);
  revalidatePath("/admin/settings");
  revalidatePath("/");
}

export async function toggleDoctorAction(form: FormData): Promise<void> {
  await requireAdmin();
  await setDoctorActive(Id.parse(form.get("id")), form.get("active") === "true");
  revalidatePath("/admin/settings");
  revalidatePath("/");
}

export async function addServiceAction(form: FormData): Promise<void> {
  await requireAdmin();
  const data = z
    .object({ departmentId: Id, name: z.string().trim().min(2).max(80), price: Price })
    .parse({ departmentId: form.get("departmentId"), name: form.get("name"), price: form.get("price") });
  await addService(data.departmentId, data.name, data.price);
  revalidatePath("/admin/settings");
  revalidatePath("/");
}

export async function updatePriceAction(form: FormData): Promise<void> {
  await requireAdmin();
  await updateServicePrice(Id.parse(form.get("id")), Price.parse(form.get("price")));
  revalidatePath("/admin/settings");
  revalidatePath("/");
}

export async function toggleServiceAction(form: FormData): Promise<void> {
  await requireAdmin();
  await setServiceActive(Id.parse(form.get("id")), form.get("active") === "true");
  revalidatePath("/admin/settings");
  revalidatePath("/");
}
