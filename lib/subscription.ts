import { prisma } from "@/lib/prisma";
import { createCheckoutSession, getCheckoutStatus } from "@/lib/saspay";

export const PRO_PRICE_FCFA = 5000;
export const PERIOD_DAYS = 30;

// Date du jour à Douala (UTC+1), à minuit UTC, pour les colonnes de type Date.
export function doualaToday(): Date {
  const l = new Date(Date.now() + 3_600_000);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

// Crée l'abonnement et le paiement en attente, puis renvoie le lien de paiement SasPay.
export async function startProCheckout(providerId: string): Promise<string> {
  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider) throw new Error("Salon introuvable.");

  const email = provider.email || process.env.SASPAY_FALLBACK_EMAIL;
  if (!email) throw new Error("Aucun e-mail disponible pour le paiement.");

  const today = doualaToday();
  const payment = await prisma.payment.create({
    data: {
      amountFcfa: PRO_PRICE_FCFA,
      status: "PENDING",
      subscription: {
        create: {
          providerId,
          plan: "PRO",
          startsOn: today,
          endsOn: addDays(today, PERIOD_DAYS - 1),
          status: "PENDING",
        },
      },
    },
    include: { subscription: true },
  });

  try {
    const base = process.env.APP_URL?.replace(/\/+$/, "");
    const session = await createCheckoutSession({
      amountFcfa: PRO_PRICE_FCFA,
      description: `Abonnement Pro - ${provider.businessName}`.slice(0, 120),
      customerEmail: email,
      customerName: provider.ownerName,
      returnUrl: base ? `${base}/tableau-de-bord/abonnement` : undefined,
      metadata: { payment_id: payment.id, provider_id: providerId },
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { externalRef: session.id },
    });
    return session.checkoutUrl;
  } catch (e) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    await prisma.subscription.update({
      where: { id: payment.subscriptionId },
      data: { status: "CANCELLED" },
    });
    throw e;
  }
}

// Active l'abonnement une seule fois, même si la fonction est appelée deux fois.
async function activate(paymentId: string, subscriptionId: string, providerId: string) {
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (claimed.count === 0) return;

    const today = doualaToday();
    const current = await tx.subscription.findFirst({
      where: { providerId, plan: "PRO", status: "ACTIVE", endsOn: { gte: today } },
      orderBy: { endsOn: "desc" },
    });
    const startsOn = current ? addDays(current.endsOn, 1) : today;
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: { status: "ACTIVE", startsOn, endsOn: addDays(startsOn, PERIOD_DAYS - 1) },
    });
    await tx.provider.update({ where: { id: providerId }, data: { plan: "PRO" } });
  });
}

async function fail(paymentId: string, subscriptionId: string) {
  await prisma.$transaction(async (tx) => {
    const r = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "FAILED" },
    });
    if (r.count === 0) return;
    await tx.subscription.update({ where: { id: subscriptionId }, data: { status: "CANCELLED" } });
  });
}

// Remet le plan du salon en accord avec ses abonnements (expiration comprise).
export async function syncPlan(providerId: string) {
  const today = doualaToday();
  await prisma.subscription.updateMany({
    where: { providerId, status: "ACTIVE", endsOn: { lt: today } },
    data: { status: "EXPIRED" },
  });
  const active = await prisma.subscription.findFirst({
    where: { providerId, plan: "PRO", status: "ACTIVE", startsOn: { lte: today }, endsOn: { gte: today } },
  });
  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider) return;
  if (active && provider.plan !== "PRO") {
    await prisma.provider.update({ where: { id: providerId }, data: { plan: "PRO" } });
  } else if (!active && provider.plan === "PRO") {
    await prisma.provider.update({ where: { id: providerId }, data: { plan: "FREE" } });
  }
}

// Interroge SasPay pour chaque paiement en attente du salon, puis met le plan à jour.
export async function reconcilePending(providerId: string) {
  const pendings = await prisma.payment.findMany({
    where: { status: "PENDING", externalRef: { not: null }, subscription: { providerId } },
  });
  for (const p of pendings) {
    try {
      const st = await getCheckoutStatus(p.externalRef as string);
      if (st.paid) {
        await activate(p.id, p.subscriptionId, providerId);
      } else if (
        st.status === "EXPIRED" ||
        st.status === "CANCELLED" ||
        st.transactionStatus === "FAILED" ||
        st.transactionStatus === "CANCELLED"
      ) {
        await fail(p.id, p.subscriptionId);
      }
    } catch (e) {
      console.error("SasPay : statut illisible pour un paiement", p.id, e);
    }
  }
  await syncPlan(providerId);
}