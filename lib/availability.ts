import "server-only";
import { prisma } from "@/lib/prisma";
import { computeSlots, dayBoundsUtc } from "@/lib/slots";

export async function getAvailableSlots(
  providerId: string,
  serviceId: string,
  date: string
) {
  const bounds = dayBoundsUtc(date);
  if (!bounds) return [];

  const service = await prisma.service.findFirst({
    where: { id: serviceId, providerId, active: true },
  });
  if (!service) return [];

  const [openingHours, closures, appointments] = await Promise.all([
    prisma.openingHour.findMany({ where: { providerId } }),
    prisma.closure.findMany({
      where: {
        providerId,
        startsAt: { lt: bounds.end },
        endsAt: { gt: bounds.start },
      },
    }),
    prisma.appointment.findMany({
      where: {
        providerId,
        status: { in: ["CONFIRMED", "COMPLETED", "NO_SHOW"] },
        startsAt: { lt: bounds.end },
        endsAt: { gt: bounds.start },
      },
    }),
  ]);

  return computeSlots({
    date,
    durationMin: service.durationMin,
    openingHours,
    closures,
    appointments,
    now: new Date(),
  });
}