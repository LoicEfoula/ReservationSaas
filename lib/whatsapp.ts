export type TemplateName =
  | "rdv_confirmation"
  | "rdv_rappel_24h"
  | "rdv_rappel_3h"
  | "rdv_annule"
  | "prestataire_nouveau_rdv"
  | "prestataire_rdv_annule";

export type SendResult = {
  ok: boolean;
  simulated: boolean;
  messageId?: string;
  error?: string;
};

// WhatsApp refuse les retours à la ligne, tabulations et espaces multiples dans les variables.
export function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function frDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Douala",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function frTime(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Douala",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export async function sendWhatsApp(
  template: TemplateName,
  to: string,
  params: string[]
): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const digits = to.replace(/\D/g, ""); // +2376XXXXXXXX -> 2376XXXXXXXX
  const values = params.map(clean);

  // Sans jeton : mode simulation, on affiche le message dans le terminal.
  if (!token || !phoneId) {
    console.log(`[WhatsApp simulé] ${template} -> +${digits}`, values);
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: digits,
        type: "template",
        template: {
          name: template,
          language: { code: "fr" },
          components: [
            {
              type: "body",
              parameters: values.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        simulated: false,
        error: data?.error?.message ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, simulated: false, messageId: data?.messages?.[0]?.id };
  } catch (e) {
    return {
      ok: false,
      simulated: false,
      error: e instanceof Error ? e.message : "Erreur inconnue",
    };
  }
}