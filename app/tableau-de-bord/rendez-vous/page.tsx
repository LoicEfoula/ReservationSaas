import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  cancelAppointment,
  completeAppointment,
  markNoShow,
} from "@/app/actions/appointments";

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmé",
  CANCELLED_BY_CUSTOMER: "Annulé par le client",
  CANCELLED_BY_PROVIDER: "Annulé par vous",
  COMPLETED: "Terminé",
  NO_SHOW: "Absent",
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Africa/Douala",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

type Item = {
  id: string;
  startsAt: Date;
  status: string;
  service: { name: string; priceFcfa: number };
  customer: { name: string; phone: string };
};

function Row({
  a,
  actions,
}: {
  a: Item;
  actions?: "upcoming" | "close";
}) {
  return (
    <li className="rounded border p-4">
      <p className="font-medium capitalize">{dateFmt.format(a.startsAt)}</p>
      <p className="text-sm">
        {a.service.name} · {a.service.priceFcfa.toLocaleString("fr-FR")} FCFA
      </p>
      <p className="text-sm text-gray-600">
        {a.customer.name} ·{" "}
        <a href={`tel:${a.customer.phone}`} className="underline">
          {a.customer.phone}
        </a>
      </p>
      <p className="mt-1 text-xs text-gray-500">{STATUS_LABEL[a.status] ?? a.status}</p>

      {actions === "upcoming" && (
        <form action={cancelAppointment} className="mt-3">
          <input type="hidden" name="id" value={a.id} />
          <button className="rounded border border-red-300 px-3 py-1 text-sm text-red-700">
            Annuler
          </button>
        </form>
      )}

      {actions === "close" && (
        <div className="mt-3 flex gap-2">
          <form action={completeAppointment}>
            <input type="hidden" name="id" value={a.id} />
            <button className="rounded bg-black px-3 py-1 text-sm text-white">
              Terminé
            </button>
          </form>
          <form action={markNoShow}>
            <input type="hidden" name="id" value={a.id} />
            <button className="rounded border px-3 py-1 text-sm">Absent</button>
          </form>
        </div>
      )}
    </li>
  );
}

export default async function RendezVousPage() {
  const { providerId } = await requireSession();
  const now = new Date();
  const since = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const all = await prisma.appointment.findMany({
    where: { providerId, startsAt: { gte: since } },
    include: { service: true, customer: true },
    orderBy: { startsAt: "asc" },
  });

  const upcoming = all.filter((a) => a.status === "CONFIRMED" && a.endsAt > now);
  const toClose = all.filter((a) => a.status === "CONFIRMED" && a.endsAt <= now);
  const history = all
    .filter((a) => a.status !== "CONFIRMED")
    .reverse()
    .slice(0, 30);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Rendez-vous</h1>

      {toClose.length > 0 && (
        <section className="mt-6">
          <h2 className="font-medium">À clôturer ({toClose.length})</h2>
          <p className="text-sm text-gray-600">
            Ces rendez-vous sont passés : indique si le client est venu.
          </p>
          <ul className="mt-2 flex flex-col gap-3">
            {toClose.map((a) => (
              <Row key={a.id} a={a} actions="close" />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-medium">À venir ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">Aucun rendez-vous à venir.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {upcoming.map((a) => (
              <Row key={a.id} a={a} actions="upcoming" />
            ))}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <section className="mt-6">
          <h2 className="font-medium">Historique récent</h2>
          <ul className="mt-2 flex flex-col gap-3">
            {history.map((a) => (
              <Row key={a.id} a={a} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}