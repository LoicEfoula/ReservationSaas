"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/availability";
import { notify } from "@/lib/notify";
import { frDate, frTime } from "@/lib/whatsapp";
import { cancelUrl } from "@/lib/cancel";

export type SlotItem = { startsAt: string; label: string };
export type BookingResult =
  | { ok: true; startsAt: string; serviceName: string }
  | { ok: false; error: string; refreshSlots?: boolean };

export async function fetchSlots(
  slug: string,
  serviceId: string,
  date: string
): Promise<SlotItem[]> {
  const provider = await prisma.provider.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!provider) return [];
  const slots = await getAvailableSlots(provider.id, serviceId, date);
  return slots.map((s) => ({
    startsAt: s.startsAt.toISOString(),
    label: s.label,
  }));
}

const bookingSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1),
  startsAt: z.string().min(1),
  name: z.string().trim().min(2, "Merci d'indiquer ton nom").max(80),
  phone: z.string().trim(),
  whatsappOptIn: z.boolean().default(false),
});

// Numéros mobiles camerounais : 9 chiffres commençant par 6
function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00237")) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith("237")) digits = digits.slice(3);
  return /^6\d{8}$/.test(digits) ? `+237${digits}` : null;
}

export async function bookAppointment(input: unknown): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { slug, serviceId, startsAt, name, whatsappOptIn } = parsed.data;

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    return { ok: false, error: "Numéro invalide. Exemple : 6 77 12 34 56" };
  }

  const provider = await prisma.provider.findUnique({
    where: { slug },
    select: { id: true, businessName: true, phone: true },
  });
  if (!provider) return { ok: false, error: "Salon introuvable" };

  const service = await prisma.service.findFirst({
    where: { id: serviceId, providerId: provider.id, active: true },
  });
  if (!service) return { ok: false, error: "Ce service n'est plus disponible" };

  const wanted = new Date(startsAt);
  if (Number.isNaN(wanted.getTime())) {
    return { ok: false, error: "Créneau invalide" };
  }

  // On rejoue le calcul : on ne fait jamais confiance au navigateur
  const date = new Date(wanted.getTime() + 60 * 60_000).toISOString().slice(0, 10);
  const slots = await getAvailableSlots(provider.id, service.id, date);
  const slot = slots.find((s) => s.startsAt.getTime() === wanted.getTime());
  if (!slot) {
    return {
      ok: false,
      error: "Ce créneau n'est plus disponible. Choisis-en un autre.",
      refreshSlots: true,
    };
  }

  let appointmentId: string;
  const cancelToken = randomUUID();
  let optedIn: boolean;
  try {
    const customer = await prisma.customer.upsert({
      where: { providerId_phone: { providerId: provider.id, phone } },
      update: { name, whatsappOptIn },
      create: { providerId: provider.id, phone, name, whatsappOptIn },
    });
    const appointment = await prisma.appointment.create({
      data: {
        providerId: provider.id,
        serviceId: service.id,
        customerId: customer.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        cancelToken,
      },
      select: { id: true },
    });
    appointmentId = appointment.id;
    optedIn = customer.whatsappOptIn;
  } catch (e) {
    console.error("Réservation échouée :", e);
    return {
      ok: false,
      error: "Ce créneau vient d'être pris. Choisis-en un autre.",
      refreshSlots: true,
    };
  }

  // Messages WhatsApp envoyés après la réponse : un échec ne bloque jamais la réservation.
  after(async () => {
    const day = frDate(slot.startsAt);
    const time = frTime(slot.startsAt);
    await Promise.allSettled([
      optedIn
        ? notify({
            providerId: provider.id,
            appointmentId,
            kind: "CUSTOMER_CONFIRMATION",
            template: "rdv_confirmation",
            to: phone,
            params: [name, service.name, provider.businessName, day, time, cancelUrl(cancelToken)],
          })
        : Promise.resolve("skipped"),
      notify({
        providerId: provider.id,
        appointmentId,
        kind: "PROVIDER_NEW_BOOKING",
        template: "prestataire_nouveau_rdv",
        to: provider.phone,
        params: [name, phone, service.name, day, time],
      }),
    ]);
  });

  return {
    ok: true,
    startsAt: slot.startsAt.toISOString(),
    serviceName: service.name,
  };
}