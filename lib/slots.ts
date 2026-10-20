// Fonction pure : aucun accès à la base de données, donc facile à tester.
const TZ_OFFSET_MIN = 60; // Cameroun : UTC+1 toute l'année
const MIN = 60_000;

export type OpeningRange = {
  weekday: number; // 0 = dimanche … 6 = samedi
  opensAtMin: number; // minutes depuis minuit
  closesAtMin: number;
};
export type Busy = { startsAt: Date; endsAt: Date };
export type Slot = { startsAt: Date; endsAt: Date; label: string };

export type ComputeSlotsInput = {
  date: string; // "AAAA-MM-JJ", jour local (Douala)
  durationMin: number;
  openingHours: OpeningRange[];
  closures: Busy[];
  appointments: Busy[]; // RDV qui bloquent le créneau (confirmés, etc.)
  now: Date;
  stepMin?: number; // pas entre deux créneaux (défaut 30)
  minNoticeMin?: number; // délai minimum avant le RDV (défaut 60)
};

function parseDate(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const utc = new Date(Date.UTC(y, mo - 1, d));
  // Rejette les dates impossibles comme 2026-02-31
  if (
    utc.getUTCFullYear() !== y ||
    utc.getUTCMonth() !== mo - 1 ||
    utc.getUTCDate() !== d
  ) {
    return null;
  }
  return utc;
}

/** Début et fin (en UTC) du jour local à Douala. */
export function dayBoundsUtc(date: string): { start: Date; end: Date } | null {
  const utc = parseDate(date);
  if (!utc) return null;
  const start = new Date(utc.getTime() - TZ_OFFSET_MIN * MIN);
  return { start, end: new Date(start.getTime() + 24 * 60 * MIN) };
}

function overlaps(startMs: number, endMs: number, busy: Busy): boolean {
  return startMs < busy.endsAt.getTime() && endMs > busy.startsAt.getTime();
}

function hhmm(totalMin: number): string {
  const h = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const m = String(totalMin % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function computeSlots(input: ComputeSlotsInput): Slot[] {
  const {
    date,
    durationMin,
    openingHours,
    closures,
    appointments,
    now,
    stepMin = 30,
    minNoticeMin = 60,
  } = input;

  const parsed = parseDate(date);
  const bounds = dayBoundsUtc(date);
  if (!parsed || !bounds || durationMin <= 0 || stepMin <= 0) return [];

  const weekday = parsed.getUTCDay();
  const earliestMs = now.getTime() + minNoticeMin * MIN;
  const ranges = openingHours
    .filter((h) => h.weekday === weekday)
    .sort((a, b) => a.opensAtMin - b.opensAtMin);

  const seen = new Set<number>();
  const slots: Slot[] = [];

  for (const r of ranges) {
    for (let t = r.opensAtMin; t + durationMin <= r.closesAtMin; t += stepMin) {
      const startMs = bounds.start.getTime() + t * MIN;
      const endMs = startMs + durationMin * MIN;

      if (seen.has(startMs)) continue;
      if (startMs < earliestMs) continue;
      if (closures.some((c) => overlaps(startMs, endMs, c))) continue;
      if (appointments.some((a) => overlaps(startMs, endMs, a))) continue;

      seen.add(startMs);
      slots.push({
        startsAt: new Date(startMs),
        endsAt: new Date(endMs),
        label: hhmm(t),
      });
    }
  }
  return slots;
}