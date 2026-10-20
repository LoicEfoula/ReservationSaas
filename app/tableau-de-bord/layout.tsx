import Link from "next/link";
import { requireSession } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  return (
    <div>
      <nav className="flex gap-4 overflow-x-auto border-b p-4 text-sm">
        <Link href="/tableau-de-bord">Accueil</Link>
        <Link href="/tableau-de-bord/rendez-vous">Rendez-vous</Link>
        <Link href="/tableau-de-bord/services">Services</Link>
        <Link href="/tableau-de-bord/horaires">Horaires</Link>
        <Link href="/tableau-de-bord/conges">Congés</Link>
      </nav>
      {children}
    </div>
  );
}