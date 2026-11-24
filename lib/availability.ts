import "server-only";
import { prisma } from "@/lib/prisma";
import { computeSlots, dayBoundsUtc, type Slot } from "@/lib/slots";

export type AvailableSlot = Slot & { staffIds: string[] };

// Créneaux libres pour un service, tous coiffeurs confondus.
// Chaque créneau indique les coiffeurs libres (le premier de la liste est prioritaire).
export async function getAvailableSlots(
  providerId: string,
  serviceId: string,
  date: string
): Promise<AvailableSlot[]> {
  const bounds = dayBoundsUtc(date);
  if (!bounds) return [];

  const service = await prisma.service.findFirst({
    where: { id: serviceId, providerId, active: true },
  });
  if (!service) return [];

  const staffList = await prisma.staff.findMany({
    where: { providerId, active: true, services: { some: { serviceId } } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (staffList.length === 0) return [];
  const staffIds = staffList.map((s) => s.id);

  const [openingHours, closures, appointments] = await Promise.all([
    prisma.openingHour.findMany({
      where: { providerId, OR: [{ staffId: { in: staffIds } }, { staffId: null }] },
    }),
    prisma.closure.findMany({
      where: {
        providerId,
        OR: [{ staffId: { in: staffIds } }, { staffId: null }],
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

  const now = new Date();
  const merged = new Map<number, AvailableSlot>();

  for (const st of staffList) {
    const own = openingHours.filter((h) => h.staffId === st.id);
    const hours = own.length > 0 ? own : openingHours.filter((h) => h.staffId === null);
    const slots = computeSlots({
      date,
      durationMin: service.durationMin,
      openingHours: hours,
      closures: closures.filter((c) => c.staffId === st.id || c.staffId === null),
      appointments: appointments.filter((a) => a.staffId === st.id || a.staffId === null),
      now,
    });
    for (const s of slots) {
      const key = s.startsAt.getTime();
      const existing = merged.get(key);
      if (existing) existing.staffIds.push(st.id);
      else merged.set(key, { ...s, staffIds: [st.id] });
    }
  }

  return [...merged.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}