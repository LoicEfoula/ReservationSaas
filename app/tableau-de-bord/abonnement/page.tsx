import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getQuota } from "@/lib/quota";
import {
  PRO_PRICE_FCFA,
  PERIOD_DAYS,
  doualaToday,
  reconcilePending,
} from "@/lib/subscription";
import { subscribePro, refreshSubscription } from "@/app/actions/subscription";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("fr-FR", { timeZone: "Africa/Douala" });

const PLAN_LABEL: Record<string, string> = {
  FREE: "Gratuit",
  STARTER: "Essentiel",
  PRO: "Pro",
};

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "En attente",
  PAID: "Payé",
  FAILED: "Échoué",
};

export default async function AbonnementPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { providerId } = await requireSession();
  const { erreur } = await searchParams;

  try {
    await reconcilePending(providerId);
  } catch (e) {
    console.error("Abonnement : vérification impossible", e);
  }

  const provider = await prisma.provider.findUniqueOrThrow({
    where: { id: providerId },
  });
  const quota = await getQuota(providerId, provider.plan, new Date());
  const active = await prisma.subscription.findFirst({
    where: {
      providerId,
      plan: "PRO",
      status: "ACTIVE",
      endsOn: { gte: doualaToday() },
    },
    orderBy: { endsOn: "desc" },
  });
  const payments = await prisma.payment.findMany({
    where: { subscription: { providerId } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const hasPending = payments.some((p) => p.status === "PENDING");

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Abonnement</h1>

      {erreur && (
        <p className="mt-4 rounded border border-red-300 p-3 text-sm text-red-700">
          Le paiement n&apos;a pas pu être préparé. Réessayez dans un instant.
        </p>
      )}

      <section className="mt-4 rounded border p-4">
        <p className="text-sm text-gray-600">Plan actuel</p>
        <p className="text-xl font-semibold">
          {PLAN_LABEL[provider.plan] ?? provider.plan}
        </p>
        {active && (
          <p className="mt-1 text-sm text-gray-600">
            Valable jusqu&apos;au {fmtDate(active.endsOn)}
          </p>
        )}
        <p className="mt-3 text-sm">
          Rendez-vous ce mois-ci : <strong>{quota.used}</strong>
          {quota.limit === null ? " (illimité)" : ` / ${quota.limit}`}
        </p>
      </section>

      <section className="mt-4 rounded border p-4">
        <p className="text-lg font-semibold">Plan Pro</p>
        <p className="text-sm text-gray-600">
          {PRO_PRICE_FCFA.toLocaleString("fr-FR")} FCFA pour {PERIOD_DAYS} jours,
          rendez-vous illimités.
        </p>
        <form action={subscribePro} className="mt-3">
          <button className="w-full rounded bg-black p-3 text-white">
            {active
              ? `Renouveler (+${PERIOD_DAYS} jours)`
              : "Passer au plan Pro"}
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-600">
          Paiement sécurisé par Mobile Money (MTN ou Orange), sur la page de
          paiement SasPay.
        </p>
      </section>

      {hasPending && (
        <section className="mt-4 rounded border p-4">
          <p className="text-sm">
            Un paiement est en attente. Si vous venez de payer, cliquez ci-dessous
            pour mettre à jour votre abonnement.
          </p>
          <form action={refreshSubscription} className="mt-3">
            <button className="rounded border px-3 py-2 text-sm">
              Vérifier mon paiement
            </button>
          </form>
        </section>
      )}

      <h2 className="mt-6 text-lg font-semibold">Historique des paiements</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {payments.length === 0 && (
          <li className="text-sm text-gray-600">Aucun paiement pour le moment.</li>
        )}
        {payments.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded border p-4"
          >
            <div>
              <p className="font-medium">
                {p.amountFcfa.toLocaleString("fr-FR")} FCFA
              </p>
              <p className="text-sm text-gray-600">{fmtDate(p.createdAt)}</p>
            </div>
            <span className="text-sm">
              {PAYMENT_LABEL[p.status] ?? p.status}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}