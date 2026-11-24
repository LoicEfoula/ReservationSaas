import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ensureDefaultStaff } from "@/lib/staff";
import { HoursForm } from "./hours-form";

const DAYS = [
  { n: 1, label: "Lundi" },
  { n: 2, label: "Mardi" },
  { n: 3, label: "Mercredi" },
  { n: 4, label: "Jeudi" },
  { n: 5, label: "Vendredi" },
  { n: 6, label: "Samedi" },
  { n: 0, label: "Dimanche" },
];

const fmt = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export default async function HorairesPage({
  searchParams,
}: {
  searchParams: Promise<{ coiffeur?: string }>;
}) {
  const { providerId } = await requireSession();
  const { coiffeur } = await searchParams;
  await ensureDefaultStaff(providerId);

  const staffList = await prisma.staff.findMany({
    where: { providerId, active: true },
    orderBy: { createdAt: "asc" },
  });
  const current = staffList.find((s) => s.id === coiffeur) ?? staffList[0];
  if (!current) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-gray-600">Aucun coiffeur actif.</p>
      </main>
    );
  }

  const hours = await prisma.openingHour.findMany({
    where: { providerId, staffId: current.id },
    orderBy: [{ weekday: "asc" }, { opensAtMin: "asc" }],
  });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Horaires d&apos;ouverture</h1>
      <p className="mt-1 text-sm text-gray-600">
        Coche les jours de travail. La pause est facultative.
      </p>

      {staffList.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {staffList.map((s) => (
            <Link
              key={s.id}
              href={`/tableau-de-bord/horaires?coiffeur=${s.id}`}
              className={`rounded border px-3 py-1 ${
                s.id === current.id ? "bg-black text-white" : ""
              }`}
            >
              {s.name}
            </Link>
          ))}
        </div>
      )}
      {staffList.length > 1 && (
        <p className="mt-2 text-sm text-gray-600">
          Horaires de : <strong>{current.name}</strong>
        </p>
      )}

      <HoursForm key={current.id} staffId={current.id}>
        {DAYS.map(({ n, label }) => {
          const rows = hours.filter((h) => h.weekday === n);
          const isOpen = rows.length > 0;
          const from = isOpen ? fmt(rows[0].opensAtMin) : "09:00";
          const to = isOpen ? fmt(rows[rows.length - 1].closesAtMin) : "18:00";
          const hasBreak = rows.length === 2;
          return (
            <div key={n} className="rounded border p-4">
              <label className="flex items-center gap-2 font-medium">
                <input type="checkbox" name={`open_${n}`} defaultChecked={isOpen} />
                {label}
              </label>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <input type="time" name={`from_${n}`} defaultValue={from} className="rounded border p-2" />
                <span>à</span>
                <input type="time" name={`to_${n}`} defaultValue={to} className="rounded border p-2" />
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                <span>Pause :</span>
                <input type="time" name={`bfrom_${n}`} defaultValue={hasBreak ? fmt(rows[0].closesAtMin) : ""} className="rounded border p-2" />
                <span>à</span>
                <input type="time" name={`bto_${n}`} defaultValue={hasBreak ? fmt(rows[1].opensAtMin) : ""} className="rounded border p-2" />
              </div>
            </div>
          );
        })}
      </HoursForm>
    </main>
  );
}