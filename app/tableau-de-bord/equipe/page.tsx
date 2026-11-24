import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ensureDefaultStaff, MAX_STAFF } from "@/lib/staff";
import { createStaff, toggleStaff, saveStaffServices } from "@/app/actions/staff";

export default async function EquipePage() {
  const { providerId } = await requireSession();
  await ensureDefaultStaff(providerId);

  const [staff, services] = await Promise.all([
    prisma.staff.findMany({
      where: { providerId },
      orderBy: { createdAt: "asc" },
      include: { services: true },
    }),
    prisma.service.findMany({
      where: { providerId, active: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const activeCount = staff.filter((s) => s.active).length;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Équipe</h1>
      <p className="mt-1 text-sm text-gray-600">
        Chaque coiffeur a ses services et ses horaires. Un client est affecté
        automatiquement au premier coiffeur libre. Maximum {MAX_STAFF} coiffeurs actifs.
      </p>

      {activeCount < MAX_STAFF ? (
        <form action={createStaff} className="mt-4 flex gap-3 rounded border p-4">
          <input
            name="name"
            required
            minLength={2}
            maxLength={60}
            placeholder="Nom du coiffeur"
            className="w-full rounded border p-3"
          />
          <button className="rounded bg-black px-4 text-white">Ajouter</button>
        </form>
      ) : (
        <p className="mt-4 rounded border p-3 text-sm text-gray-600">
          Limite de {MAX_STAFF} coiffeurs actifs atteinte.
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-4">
        {staff.map((s) => {
          const linked = new Set(s.services.map((x) => x.serviceId));
          return (
            <li key={s.id} className="rounded border p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {s.name}
                  {!s.active && (
                    <span className="ml-2 text-sm text-gray-600">(inactif)</span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/tableau-de-bord/horaires?coiffeur=${s.id}`}
                    className="rounded border px-3 py-1 text-sm"
                  >
                    Horaires
                  </Link>
                  <form action={toggleStaff}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="active" value={String(s.active)} />
                    <button className="rounded border px-3 py-1 text-sm">
                      {s.active ? "Désactiver" : "Réactiver"}
                    </button>
                  </form>
                </div>
              </div>

              <form action={saveStaffServices} className="mt-3 flex flex-col gap-2">
                <input type="hidden" name="id" value={s.id} />
                <p className="text-sm text-gray-600">Services réalisés :</p>
                {services.length === 0 && (
                  <p className="text-sm text-gray-600">Aucun service actif.</p>
                )}
                {services.map((sv) => (
                  <label key={sv.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="service"
                      value={sv.id}
                      defaultChecked={linked.has(sv.id)}
                    />
                    {sv.name}
                  </label>
                ))}
                {services.length > 0 && (
                  <button className="mt-1 rounded border px-3 py-2 text-sm">
                    Enregistrer les services
                  </button>
                )}
              </form>
            </li>
          );
        })}
      </ul>
    </main>
  );
}