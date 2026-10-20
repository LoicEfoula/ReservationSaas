import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
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

export default async function HorairesPage() {
  const { providerId } = await requireSession();
  const hours = await prisma.openingHour.findMany({
    where: { providerId },
    orderBy: [{ weekday: "asc" }, { opensAtMin: "asc" }],
  });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Horaires d'ouverture</h1>
      <p className="mt-1 text-sm text-gray-600">
        Coche les jours d'ouverture. La pause est facultative.
      </p>

      <HoursForm>
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