"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { frDate, frTime } from "@/lib/whatsapp";
import { CANCEL_MIN_NOTICE_MIN, UUID_RE } from "@/lib/cancel";

export async function cancelByCustomer(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!UUID_RE.test(token)) return;

  const appt = await prisma.appointment.findUnique({
    where: { cancelToken: token },
    include: { customer: true, service: true },
  });
  if (!appt) return;

  // Même règle que la page : confirmé, et assez longtemps avant le rendez-vous.
  const limit = new Date(Date.now() + CANCEL_MIN_NOTICE_MIN * 60_000);
  const { count } = await prisma.appointment.updateMany({
    where: { id: appt.id, status: "CONFIRMED", startsAt: { gt: limit } },
    data: { status: "CANCELLED_BY_CUSTOMER" },
  });

  revalidatePath(`/annuler/${token}`);
  revalidatePath("/tableau-de-bord/rendez-vous");
  if (count === 0) return;

  const provider = await prisma.provider.findUnique({
    where: { id: appt.providerId },
    select: { phone: true },
  });
  if (!provider) return;

  // Envoyé après la réponse : un échec WhatsApp ne bloque jamais l'annulation.
  after(async () => {
    await notify({
      providerId: appt.providerId,
      appointmentId: appt.id,
      kind: "CANCELLATION",
      template: "prestataire_rdv_annule",
      to: provider.phone,
      params: [
        appt.customer.name,
        appt.service.name,
        frDate(appt.startsAt),
        frTime(appt.startsAt),
      ],
    });
  });
}