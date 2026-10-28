import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { frTime } from "@/lib/whatsapp";
import { cancelUrl } from "@/lib/cancel";

type Rule = {
  kind: "REMINDER_24H" | "REMINDER_3H";
  template: "rdv_rappel_24h" | "rdv_rappel_3h";
  leadMin: number; // combien de minutes avant le rendez-vous
  windowMin: number; // durée de la fenêtre d'envoi
};

const RULES: Rule[] = [
  { kind: "REMINDER_24H", template: "rdv_rappel_24h", leadMin: 24 * 60, windowMin: 90 },
  { kind: "REMINDER_3H", template: "rdv_rappel_3h", leadMin: 3 * 60, windowMin: 45 },
];

export type ReminderSummary = {
  now: string;
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
};

export async function sendDueReminders(
  now: Date = new Date()
): Promise<ReminderSummary> {
  const summary: ReminderSummary = {
    now: now.toISOString(),
    checked: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const rule of RULES) {
    const from = new Date(now.getTime() + (rule.leadMin - rule.windowMin) * 60_000);
    const to = new Date(now.getTime() + rule.leadMin * 60_000);

    const rows = await prisma.appointment.findMany({
      where: {
        status: "CONFIRMED",
        startsAt: { gt: from, lte: to },
        customer: { whatsappOptIn: true },
      },
      include: { customer: true, service: true },
      take: 500,
    });

    // Pas de rappel si le rendez-vous a été pris après l'heure prévue du rappel.
    const due = rows.filter(
      (a) => a.createdAt.getTime() <= a.startsAt.getTime() - rule.leadMin * 60_000
    );
    if (due.length === 0) continue;

    const providers = await prisma.provider.findMany({
      where: { id: { in: [...new Set(due.map((a) => a.providerId))] } },
      select: { id: true, businessName: true },
    });
    const names = new Map(providers.map((p) => [p.id, p.businessName]));

    for (const a of due) {
      summary.checked++;
      const salon = names.get(a.providerId) ?? "votre salon";
      const params =
        rule.kind === "REMINDER_24H"
          ? [a.customer.name, frTime(a.startsAt), salon, a.service.name, cancelUrl(a.cancelToken)]
          : [a.customer.name, salon, frTime(a.startsAt)];

      const result = await notify({
        providerId: a.providerId,
        appointmentId: a.id,
        kind: rule.kind,
        template: rule.template,
        to: a.customer.phone,
        params,
      });
      summary[result]++;
    }
  }

  return summary;
}