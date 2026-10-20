"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

async function setStatus(
  formData: FormData,
  status: "CANCELLED_BY_PROVIDER" | "COMPLETED" | "NO_SHOW"
) {
  const { providerId } = await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.appointment.updateMany({
    where: { id, providerId, status: "CONFIRMED" },
    data: { status },
  });
  revalidatePath("/tableau-de-bord/rendez-vous");
}

export async function cancelAppointment(formData: FormData) {
  await setStatus(formData, "CANCELLED_BY_PROVIDER");
}

export async function completeAppointment(formData: FormData) {
  await setStatus(formData, "COMPLETED");
}

export async function markNoShow(formData: FormData) {
  await setStatus(formData, "NO_SHOW");
}