"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import {
  bookAppointment,
  fetchSlots,
  type SlotItem,
} from "@/app/actions/booking";
import { formatDuration } from "@/lib/format";

type ServiceItem = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceFcfa: number;
};

// Date du jour à Douala (UTC+1), format AAAA-MM-JJ
function doualaDate(offsetDays = 0) {
  return new Date(Date.now() + 3_600_000 + offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

const fmtLong = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Douala",
  });

export default function BookingForm({
  slug,
  services,
}: {
  slug: string;
  services: ServiceItem[];
}) {
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<SlotItem[] | null>(null);
  const [slot, setSlot] = useState<SlotItem | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ startsAt: string; serviceName: string } | null>(null);
  const [loadingSlots, startLoading] = useTransition();
  const [booking, startBooking] = useTransition();
  const requestId = useRef(0);

  function loadSlots(nextServiceId: string, nextDate: string) {
    setSlot(null);
    setError("");
    if (!nextServiceId || !nextDate) {
      setSlots(null);
      return;
    }
    const id = ++requestId.current;
    startLoading(async () => {
      const result = await fetchSlots(slug, nextServiceId, nextDate);
      if (id === requestId.current) setSlots(result);
    });
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slot) return;
    setError("");
    startBooking(async () => {
      const res = await bookAppointment({
        slug,
        serviceId,
        startsAt: slot.startsAt,
        name,
        phone,
      });
      if (res.ok) {
        setDone({ startsAt: res.startsAt, serviceName: res.serviceName });
      } else {
        setError(res.error);
        if (res.refreshSlots) loadSlots(serviceId, date);
      }
    });
  }

  if (done) {
    return (
      <div className="rounded border p-6 text-center">
        <p className="text-xl font-semibold">Rendez-vous confirmé ✅</p>
        <p className="mt-2">{done.serviceName}</p>
        <p className="text-gray-700">{fmtLong(done.startsAt)}</p>
        <button
          type="button"
          className="mt-4 rounded border px-4 py-2 text-sm"
          onClick={() => {
            setDone(null);
            setSlot(null);
            setSlots(null);
            setDate("");
            setServiceId("");
          }}
        >
          Prendre un autre rendez-vous
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">1. Choisis un service</legend>
        {services.length === 0 && (
          <p className="text-sm text-gray-600">
            Aucun service disponible pour le moment.
          </p>
        )}
        {services.map((s) => (
          <label
            key={s.id}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded border p-3 ${
              serviceId === s.id ? "border-black bg-gray-50" : ""
            }`}
          >
            <span>
              <input
                type="radio"
                name="service"
                value={s.id}
                checked={serviceId === s.id}
                onChange={() => {
                  setServiceId(s.id);
                  loadSlots(s.id, date);
                }}
                className="mr-2"
              />
              {s.name}
              {s.description && (
                <span className="block text-sm text-gray-600">
                  {s.description}
                </span>
              )}
            </span>
            <span className="text-right text-sm text-gray-600">
              {formatDuration(s.durationMin)}
              <br />
              {s.priceFcfa.toLocaleString("fr-FR")} FCFA
            </span>
          </label>
        ))}
      </fieldset>

      {serviceId && (
        <div>
          <label className="mb-1 block font-medium" htmlFor="date">
            2. Choisis un jour
          </label>
          <input
            id="date"
            type="date"
            value={date}
            min={doualaDate()}
            max={doualaDate(60)}
            onChange={(e) => {
              setDate(e.target.value);
              loadSlots(serviceId, e.target.value);
            }}
            className="w-full rounded border p-3"
          />
        </div>
      )}

      {serviceId && date && (
        <div>
          <p className="mb-2 font-medium">3. Choisis une heure</p>
          {loadingSlots && <p className="text-sm text-gray-600">Chargement…</p>}
          {!loadingSlots && slots && slots.length === 0 && (
            <p className="text-sm text-gray-600">
              Aucun créneau libre ce jour-là. Essaie une autre date.
            </p>
          )}
          {!loadingSlots && slots && slots.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => (
                <button
                  key={s.startsAt}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={`rounded border p-2 text-sm ${
                    slot?.startsAt === s.startsAt
                      ? "border-black bg-black text-white"
                      : ""
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {slot && (
        <div className="flex flex-col gap-3">
          <p className="font-medium">4. Tes coordonnées</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ton nom"
            required
            className="rounded border p-3"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            placeholder="Téléphone (ex : 677 12 34 56)"
            required
            className="rounded border p-3"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={booking}
            className="rounded bg-black p-3 text-white disabled:opacity-60"
          >
            {booking ? "Réservation…" : "Confirmer le rendez-vous"}
          </button>
        </div>
      )}

      {!slot && error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}