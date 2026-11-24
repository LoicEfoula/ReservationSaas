"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { MAX_STAFF, ensureDefaultStaff } from "@/lib/staff";
import type { SaveHoursState } from "@/app/actions/settings";

const nameSchema = z.string().trim().min(2).max(60);

export async function createStaff(formData: FormData) {
  const { providerId } = await requireSession();
  const name = nameSchema.safeParse(formData.get("name"));
  if (!name.success) return;

  await ensureDefaultStaff(providerId);
  const activeCount = await prisma.staff.count({ where: { providerId, active: true } });
  if (activeCount >= MAX_STAFF) return;

  const first = await prisma.staff.findFirst({
    where: { providerId, active: true },
    orderBy: { createdAt: "asc" },
  });
  const services = await prisma.service.findMany({
    where: { providerId, active: true },
    select: { id: true },
  });
  const hours = first
    ? await prisma.openingHour.findMany({ where: { providerId, staffId: first.id } })
    : [];

  await prisma.$transaction(async (tx) => {
    const s = await tx.staff.create({ data: { providerId, name: name.data } });
    if (services.length > 0) {
      await tx.staffService.createMany({
        data: services.map((sv) => ({ staffId: s.id, serviceId: sv.id })),
      });
    }
    if (hours.length > 0) {
      await tx.openingHour.createMany({
        data: hours.map((h) => ({
          providerId,
          staffId: s.id,
          weekday: h.weekday,
          opensAtMin: h.opensAtMin,
          closesAtMin: h.closesAtMin,
        })),
      });
    }
  });
  revalidatePath("/tableau-de-bord/equipe");
}

export async function toggleStaff(formData: FormData) {
  const { providerId } = await requireSession();
  const id = String(formData.get("id") ?? "");
  const currentlyActive = formData.get("active") === "true";
  const activeCount = await prisma.staff.count({ where: { providerId, active: true } });
  if (currentlyActive && activeCount <= 1) return; // au moins un coiffeur actif
  if (!currentlyActive && activeCount >= MAX_STAFF) return;
  await prisma.staff.updateMany({
    where: { id, providerId },
    data: { active: !currentlyActive },
  });
  revalidatePath("/tableau-de-bord/equipe");
}

export async function saveStaffServices(formData: FormData) {
  const { providerId } = await requireSession();
  const staffId = String(formData.get("id") ?? "");
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, providerId },
    select: { id: true },
  });
  if (!staff) return;

  const wanted = formData.getAll("service").map(String);
  const valid = await prisma.service.findMany({
    where: { id: { in: wanted }, providerId, active: true },
    select: { id: true },
  });
  if (valid.length === 0) return; // au moins un service par coiffeur

  await prisma.$transaction([
    prisma.staffService.deleteMany({ where: { staffId, service: { active: true } } }),
    prisma.staffService.createMany({
      data: valid.map((s) => ({ staffId, serviceId: s.id })),
    }),
  ]);
  revalidatePath("/tableau-de-bord/equipe");
}

function toMin(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string" || !/^\d{2}:\d{2}$/.test(v)) return null;
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}

export async function saveStaffHours(
  _prev: SaveHoursState,
  formData: FormData
): Promise<SaveHoursState> {
  const { providerId } = await requireSession();
  const staffId = String(formData.get("staffId") ?? "");
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, providerId },
    select: { id: true },
  });
  if (!staff) return { ok: false, message: "Coiffeur introuvable." };

  const rows: { weekday: number; opensAtMin: number; closesAtMin: number }[] = [];
  for (let d = 0; d < 7; d++) {
    if (formData.get(`open_${d}`) !== "on") continue;
    const o = toMin(formData.get(`from_${d}`));
    const c = toMin(formData.get(`to_${d}`));
    if (o === null || c === null || o >= c) continue;

    const bs = toMin(formData.get(`bfrom_${d}`));
    const be = toMin(formData.get(`bto_${d}`));
    if (bs !== null && be !== null && o < bs && bs < be && be < c) {
      rows.push({ weekday: d, opensAtMin: o, closesAtMin: bs });
      rows.push({ weekday: d, opensAtMin: be, closesAtMin: c });
    } else {
      rows.push({ weekday: d, opensAtMin: o, closesAtMin: c });
    }
  }

  try {
    await prisma.$transaction([
      prisma.openingHour.deleteMany({ where: { providerId, staffId } }),
      prisma.openingHour.createMany({
        data: rows.map((r) => ({ ...r, providerId, staffId })),
      }),
    ]);
  } catch {
    return { ok: false, message: "Erreur : les horaires n'ont pas pu être enregistrés." };
  }
  revalidatePath("/tableau-de-bord/horaires");
  return { ok: true, message: "Horaires enregistrés avec succès." };
}