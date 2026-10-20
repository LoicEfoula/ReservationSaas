import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/format";
import { createService, toggleService } from "@/app/actions/settings";
import DurationInput from "./duration-input";

export default async function ServicesPage() {
  const { providerId } = await requireSession();
  const services = await prisma.service.findMany({
    where: { providerId },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Mes services</h1>

      <form action={createService} className="mt-4 flex flex-col gap-3 rounded border p-4">
        <input name="name" placeholder="Nom (ex : Tresses)" required className="rounded border p-3" />
        <input name="description" placeholder="Description (facultatif)" className="rounded border p-3" />
        <div className="flex items-start gap-3">
          <DurationInput />
          <input name="priceFcfa" type="number" min={0} step={500} placeholder="Prix (FCFA)" required className="w-1/2 rounded border p-3" />
        </div>
        <button className="rounded bg-black p-3 text-white">Ajouter le service</button>
      </form>

      <ul className="mt-6 flex flex-col gap-3">
        {services.length === 0 && (
          <li className="text-sm text-gray-600">Aucun service pour l'instant.</li>
        )}
        {services.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded border p-4">
            <div className={s.active ? "" : "opacity-50"}>
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-gray-600">
                {formatDuration(s.durationMin)} · {s.priceFcfa.toLocaleString("fr-FR")} FCFA
              </p>
            </div>
            <form action={toggleService}>
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="active" value={String(s.active)} />
              <button className="rounded border px-3 py-1 text-sm">
                {s.active ? "Désactiver" : "Réactiver"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}