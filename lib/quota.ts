import { prisma } from "@/lib/prisma";

export const FREE_MONTHLY_LIMIT = 20;

// Début et fin du mois (heure de Douala, UTC+1 toute l'année), exprimés en UTC.
export function monthBoundsUtc(ref: Date) {
  const local = new Date(ref.getTime() + 3_600_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1) - 3_600_000),
    end: new Date(Date.UTC(y, m + 1, 1) - 3_600_000),
  };
}

// Rendez-vous non annulés du mois contenant `ref`.
export async function monthUsage(providerId: string, ref: Date): Promise<number> {
  const { start, end } = monthBoundsUtc(ref);
  return prisma.appointment.count({
    where: {
      providerId,
      startsAt: { gte: start, lt: end },
      status: { in: ["CONFIRMED", "COMPLETED", "NO_SHOW"] },
    },
  });
}

export async function getQuota(providerId: string, plan: string, ref: Date) {
  const used = await monthUsage(providerId, ref);
  const limit = plan === "PRO" ? null : FREE_MONTHLY_LIMIT;
  return { used, limit, full: limit !== null && used >= limit };
}