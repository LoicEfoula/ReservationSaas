import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BookingForm from "./booking-form";

export default function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-600">Chargement…</p>}>
      <Salon params={params} />
    </Suspense>
  );
}

async function Salon({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const provider = await prisma.provider.findUnique({
    where: { slug },
    select: { businessName: true },
  });
  if (!provider) notFound();

  const services = await prisma.service.findMany({
    where: { provider: { slug }, active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      durationMin: true,
      priceFcfa: true,
    },
  });

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-2xl font-semibold">{provider.businessName}</h1>
      <p className="mb-6 mt-1 text-sm text-gray-600">Réserve ton rendez-vous en ligne</p>
      <BookingForm slug={slug} services={services} />
    </main>
  );
}