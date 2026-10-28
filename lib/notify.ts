import { prisma } from "@/lib/prisma";
import { sendWhatsApp, type TemplateName } from "@/lib/whatsapp";

type Kind =
  | "CUSTOMER_CONFIRMATION"
  | "PROVIDER_NEW_BOOKING"
  | "REMINDER_24H"
  | "REMINDER_3H"
  | "CANCELLATION";

export async function notify(opts: {
  providerId: string;
  appointmentId: string;
  kind: Kind;
  template: TemplateName;
  to: string;
  params: string[];
}): Promise<"sent" | "failed" | "skipped"> {
  const { providerId, appointmentId, kind, template, to, params } = opts;
  try {
    const existing = await prisma.notification.findUnique({
      where: { appointmentId_kind: { appointmentId, kind } },
    });

    // Déjà envoyé, ou trop d'échecs : on n'envoie pas deux fois.
    if (existing && (existing.status !== "FAILED" || existing.attempts >= 3)) {
      return "skipped";
    }

    let id: string;
    if (existing) {
      id = existing.id;
    } else {
      try {
        const row = await prisma.notification.create({
          data: {
            providerId,
            appointmentId,
            kind,
            channel: "WHATSAPP",
            status: "PENDING",
            scheduledAt: new Date(),
          },
          select: { id: true },
        });
        id = row.id;
      } catch (e) {
        // Deux envois simultanés : l'autre a gagné.
        if (typeof e === "object" && e && "code" in e && e.code === "P2002") {
          return "skipped";
        }
        throw e;
      }
    }

    const result = await sendWhatsApp(template, to, params);

    await prisma.notification.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        status: result.ok ? "SENT" : "FAILED",
        sentAt: result.ok ? new Date() : null,
        providerRef: result.messageId ?? null,
        lastError: result.error ?? null,
      },
    });
    return result.ok ? "sent" : "failed";
  } catch (e) {
    console.error("[notify] erreur", e);
    return "failed";
  }
}