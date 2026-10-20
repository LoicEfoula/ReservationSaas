import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { addClosure, deleteClosure } from "@/app/actions/settings";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("fr-FR", { timeZone: "Africa/Douala" });

export default async function CongesPage() {
  const { providerId } = await requireSession();
  const closures = await prisma.closure.findMany({
    where: { providerId, endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
  });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Congés et fermetures</h1>

      <form action={addClosure} className="mt-4 flex flex-col gap-3 rounded border p-4">
        <div className="flex gap-3">
          <label className="w-1/2 text-sm">
            Du
            <input type="date" name="from" required className="mt-1 w-full rounded border p-3" />
          </label>
          <label className="w-1/2 text-sm">
            Au (inclus)
            <input type="date" name="to" className="mt-1 w-full rounded border p-3" />
          </label>
        </div>
        <input name="reason" placeholder="Motif (facultatif)" className="rounded border p-3" />
        <button className="rounded bg-black p-3 text-white">Ajouter la fermeture</button>
      </form>

      <ul className="mt-6 flex flex-col gap-3">
        {closures.length === 0 && (
          <li className="text-sm text-gray-600">Aucune fermeture à venir.</li>
        )}
        {closures.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded border p-4">
            <div>
              <p className="font-medium">
                {fmtDate(c.startsAt)} → {fmtDate(c.endsAt)}
              </p>
              {c.reason && <p className="text-sm text-gray-600">{c.reason}</p>}
            </div>
            <form action={deleteClosure}>
              <input type="hidden" name="id" value={c.id} />
              <button className="rounded border px-3 py-1 text-sm">Supprimer</button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}