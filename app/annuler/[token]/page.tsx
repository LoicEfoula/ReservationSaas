import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { cancelByCustomer } from "@/app/actions/cancel";
import { CANCEL_MIN_NOTICE_MIN, UUID_RE } from "@/lib/cancel";

const fmtLong = (d: Date) =>
  d.toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Douala",
  });

export default function AnnulerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <main className="mx-auto max-w-md p-6">
      <Suspense fallback={<p className="text-sm text-gray-600">Chargement…</p>}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded border p-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-gray-700">{text}</p>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invalid = (
    <Message
      title="Lien invalide"
      text="Ce lien d'annulation n'existe pas ou n'est plus valable."
    />
  );
  if (!UUID_RE.test(token)) return invalid;

  const appt = await prisma.appointment.findUnique({
    where: { cancelToken: token },
    include: { service: true },
  });
  if (!appt) return invalid;

  const provider = await prisma.provider.findUnique({
    where: { id: appt.providerId },
    select: { businessName: true, phone: true },
  });
  const name = provider?.businessName ?? "le salon";
  const now = new Date();

  if (
    appt.status === "CANCELLED_BY_CUSTOMER" ||
    appt.status === "CANCELLED_BY_PROVIDER"
  ) {
    return (
      <Message
        title="Rendez-vous annulé"
        text={`Ce rendez-vous chez ${name} est annulé. Tu peux reprendre rendez-vous quand tu veux.`}
      />
    );
  }

  if (appt.status !== "CONFIRMED" || appt.startsAt <= now) {
    return (
      <Message
        title="Rendez-vous passé"
        text="Ce rendez-vous n'est plus modifiable."
      />
    );
  }

  const limit = new Date(now.getTime() + CANCEL_MIN_NOTICE_MIN * 60_000);
  if (appt.startsAt <= limit) {
    return (
      <Message
        title="Annulation impossible en ligne"
        text={`Le rendez-vous a lieu dans moins de ${CANCEL_MIN_NOTICE_MIN / 60} h. Merci de contacter ${name}${
          provider ? ` au ${provider.phone}` : ""
        }.`}
      />
    );
  }

  return (
    <div className="rounded border p-6">
      <h1 className="text-xl font-semibold">Annuler ton rendez-vous ?</h1>
      <p className="mt-3">{appt.service.name}</p>
      <p className="text-gray-700">{fmtLong(appt.startsAt)}</p>
      <p className="text-sm text-gray-600">{name}</p>
      <form action={cancelByCustomer} className="mt-6">
        <input type="hidden" name="token" value={token} />
        <button className="w-full rounded bg-red-600 p-3 text-white">
          Oui, annuler mon rendez-vous
        </button>
      </form>
    </div>
  );
}