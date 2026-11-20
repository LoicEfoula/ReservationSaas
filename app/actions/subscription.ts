"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { startProCheckout, reconcilePending } from "@/lib/subscription";

// Crée le paiement en attente puis envoie le client sur la page de paiement SasPay.
export async function subscribePro() {
  const { providerId } = await requireSession();
  let url: string;
  try {
    url = await startProCheckout(providerId);
  } catch (e) {
    console.error("Abonnement : impossible de créer le paiement", e);
    redirect("/tableau-de-bord/abonnement?erreur=1");
  }
  redirect(url);
}

// Interroge SasPay et met à jour l'abonnement si le paiement est passé.
export async function refreshSubscription() {
  const { providerId } = await requireSession();
  await reconcilePending(providerId);
  revalidatePath("/tableau-de-bord/abonnement");
}