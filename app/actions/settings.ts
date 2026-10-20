"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

/* ---------- Services ---------- */

const serviceSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().optional(),
  durationMin: z.coerce.number().int().min(5).max(480),
  priceFcfa: z.coerce.number().int().min(0).max(10_000_000),
});

export async function createService(formData: FormData) {
  const { providerId } = await requireSession();
  const parsed = serviceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { description, ...rest } = parsed.data;
  await prisma.service.create({
    data: { ...rest, description: description || null, providerId },
  });
  revalidatePath("/tableau-de-bord/services");
}

export async function toggleService(formData: FormData) {
  const { providerId } = await requireSession();
  const id = String(formData.get("id") ?? "");
  const currentlyActive = formData.get("active") === "true";
  await prisma.service.updateMany({
    where: { id, providerId },
    data: { active: !currentlyActive },
  });
  revalidatePath("/tableau-de-bord/services");
}

/* ---------- Horaires ---------- */

function toMin(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string" || !/^\d{2}:\d{2}$/.test(v)) return null;
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}

export type SaveHoursState = { ok: boolean; message: string } | null;

export async function saveHours(
  _prev: SaveHoursState,
  formData: FormData
): Promise<SaveHoursState> {
  const { providerId } = await requireSession();
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
      prisma.openingHour.deleteMany({ where: { providerId } }),
      prisma.openingHour.createMany({
        data: rows.map((r) => ({ ...r, providerId })),
      }),
    ]);
  } catch {
    return { ok: false, message: "Erreur : les horaires n'ont pas pu être enregistrés." };
  }
  revalidatePath("/tableau-de-bord/horaires");
  return { ok: true, message: "Horaires enregistrés avec succès." };
}

/* ---------- Congés ---------- */

export async function addClosure(formData: FormData) {
  const { providerId } = await requireSession();
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "") || from;
  const reason = String(formData.get("reason") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return;
  if (to < from) return;

  // Cameroun = UTC+1 toute l'année
  await prisma.closure.create({
    data: {
      providerId,
      startsAt: new Date(`${from}T00:00:00+01:00`),
      endsAt: new Date(`${to}T23:59:59+01:00`),
      reason: reason || null,
    },
  });
  revalidatePath("/tableau-de-bord/conges");
}

export async function deleteClosure(formData: FormData) {
  const { providerId } = await requireSession();
  const id = String(formData.get("id") ?? "");
  await prisma.closure.deleteMany({ where: { id, providerId } });
  revalidatePath("/tableau-de-bord/conges");
}