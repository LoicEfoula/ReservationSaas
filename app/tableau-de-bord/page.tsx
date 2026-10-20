import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logout } from "@/app/actions/auth";

export default async function TableauDeBordPage() {
  const { providerId } = await requireSession();
  const provider = await prisma.provider.findUniqueOrThrow(
    {where: {id: providerId},
  }); 

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Bonjour, {provider.businessName}</h1>
      <p className="mt-2 text-sm text-gray-600">
        Ta page de réservation : /{provider.slug}
      </p>
      <form action={logout} className="mt-6">
        <button className="rounded border px-4 py-2">Se déconnecter</button>
      </form>
    </main>
  );
}