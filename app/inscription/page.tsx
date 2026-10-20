"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/app/actions/auth";

export default function InscriptionPage() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Créer mon compte</h1>
      <form action={action} className="flex flex-col gap-3">
        <input name="businessName" placeholder="Nom du salon" required className="rounded border p-3" />
        <input name="ownerName" placeholder="Votre nom" required className="rounded border p-3"/>
        <input name="email" type="email" placeholder="Email" required className="rounded border p-3" />
        <input name="phone" type="tel" placeholder="Téléphone" required className="rounded border p-3" />
        <input name="password" type="password" placeholder="Mot de passe (8+ caractères)" required className="rounded border p-3" />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending} className="rounded bg-black p-3 text-white disabled:opacity-60">
          {pending ? "Création..." : "S'inscrire"}
        </button>
      </form>
      <p className="text-sm">Déjà inscrit ? <Link href="/connexion" className="underline">Se connecter</Link></p>
    </main>
  );
}