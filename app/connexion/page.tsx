"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";

export default function ConnexionPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Connexion</h1>
      <form action={action} className="flex flex-col gap-3">
        <input name="email" type="email" placeholder="Email" required className="rounded border p-3" />
        <input name="password" type="password" placeholder="Mot de passe" required className="rounded border p-3" />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending} className="rounded bg-black p-3 text-white disabled:opacity-60">
          {pending ? "Connexion..." : "Se connecter"}
        </button>
      </form>
      <p className="text-sm">Pas de compte ? <Link href="/inscription" className="underline">S'inscrire</Link></p>
    </main>
  );
}