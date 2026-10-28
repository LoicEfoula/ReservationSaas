import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendDueReminders } from "@/lib/reminders";

function safeEqual(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // En développement seulement : ?now=... simule une autre heure pour tester.
  let now: Date | undefined;
  const nowParam = new URL(request.url).searchParams.get("now");
  if (process.env.NODE_ENV !== "production" && nowParam) {
    const d = new Date(nowParam);
    if (!Number.isNaN(d.getTime())) now = d;
  }

  const summary = await sendDueReminders(now);
  return NextResponse.json(summary);
}