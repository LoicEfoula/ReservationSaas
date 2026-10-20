import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSlots, type OpeningRange } from "./slots";

// 2026-10-19 est un lundi, 2026-10-18 un dimanche.
const hours: OpeningRange[] = [
  { weekday: 1, opensAtMin: 540, closesAtMin: 780 }, // 09:00-13:00
  { weekday: 1, opensAtMin: 840, closesAtMin: 1080 }, // 14:00-18:00
];
const now = new Date("2026-10-18T08:00:00+01:00");
const base = {
  date: "2026-10-19",
  durationMin: 60,
  openingHours: hours,
  closures: [],
  appointments: [],
  now,
};
const labels = (r: ReturnType<typeof computeSlots>) => r.map((s) => s.label);

test("jour ouvert : créneaux du matin et de l'après-midi, sans la pause", () => {
  const r = computeSlots(base);
  assert.equal(r.length, 14);
  assert.equal(r[0].label, "09:00");
  assert.equal(r[r.length - 1].label, "17:00");
  assert.ok(!labels(r).includes("13:00"));
  assert.ok(!labels(r).includes("13:30"));
});

test("jour fermé (dimanche) : aucun créneau", () => {
  assert.deepEqual(computeSlots({ ...base, date: "2026-10-18" }), []);
});

test("un RDV bloque les créneaux qui le chevauchent, pas ceux qui le touchent", () => {
  const r = computeSlots({
    ...base,
    appointments: [
      {
        startsAt: new Date("2026-10-19T10:00:00+01:00"),
        endsAt: new Date("2026-10-19T11:00:00+01:00"),
      },
    ],
  });
  const l = labels(r);
  assert.ok(l.includes("09:00"));
  assert.ok(!l.includes("09:30"));
  assert.ok(!l.includes("10:00"));
  assert.ok(!l.includes("10:30"));
  assert.ok(l.includes("11:00"));
});

test("une journée de congé supprime tous les créneaux", () => {
  const r = computeSlots({
    ...base,
    closures: [
      {
        startsAt: new Date("2026-10-19T00:00:00+01:00"),
        endsAt: new Date("2026-10-19T23:59:59+01:00"),
      },
    ],
  });
  assert.deepEqual(r, []);
});

test("délai minimum avant le RDV", () => {
  const r = computeSlots({
    ...base,
    now: new Date("2026-10-19T08:30:00+01:00"),
  });
  assert.equal(r[0].label, "09:30");
});

test("journée déjà passée : aucun créneau", () => {
  const r = computeSlots({
    ...base,
    now: new Date("2026-10-19T20:00:00+01:00"),
  });
  assert.deepEqual(r, []);
});

test("service plus long que la plage d'ouverture : aucun créneau", () => {
  assert.deepEqual(computeSlots({ ...base, durationMin: 300 }), []);
});

test("date invalide : aucun créneau", () => {
  assert.deepEqual(computeSlots({ ...base, date: "2026-02-31" }), []);
  assert.deepEqual(computeSlots({ ...base, date: "n'importe quoi" }), []);
});

test("fuseau : 09:00 à Douala = 08:00 UTC", () => {
  const r = computeSlots(base);
  assert.equal(r[0].startsAt.toISOString(), "2026-10-19T08:00:00.000Z");
});