import { prisma } from "@/lib/prisma";

// Quotas mensuels de rendez-vous par plan.
export const PLAN_LIMITS: Record<string, number> = {
  FREE: 20,
  STARTER: 150,
  PRO: 500,
};

export const FREE_MONTHLY_LIMIT = PLAN_LIMITS.FREE;

// Debut et fin du mois (heure de Douala, UTC+1 toute l'annee), exprimes en UTC.
export function monthBoundsUtc(ref: Date) {
  const local = new Date(ref.getTime() + 3_600_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1) - 3_600_000),
    end: new Date(Date.UTC(y, m + 1, 1) - 3_600_000),
  };
}

// Rendez-vous non annules du mois contenant `ref`.
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
  const limit = PLAN_LIMITS[plan] ?? FREE_MONTHLY_LIMIT;
  return { used, limit, full: used >= limit };
}