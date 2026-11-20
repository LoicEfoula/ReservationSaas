import { createHmac, timingSafeEqual } from "node:crypto";

// Hôte lu dans .env. Test : https://sandbox-api.saspay.me/api/v1
// Production : https://api.saspay.me/api/v1, accepté seulement avec SASPAY_ENV=live.
function config() {
  const base = (process.env.SASPAY_API_BASE_URL ?? "").replace(/\/+$/, "");
  const key = process.env.SASPAY_SECRET_KEY ?? "";
  if (!base || !key) throw new Error("SasPay n'est pas configuré (.env).");
  const host = new URL(base).hostname;
  const sandbox = host === "sandbox-api.saspay.me";
  const live = host === "api.saspay.me" && process.env.SASPAY_ENV === "live";
  if (!sandbox && !live) {
    throw new Error("Hôte SasPay refusé : utilise sandbox-api.saspay.me (ou SASPAY_ENV=live).");
  }
  return { base, key, host };
}

type Envelope<T> = { success: boolean; data?: T; error?: unknown; code?: number };

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const { base, key } = config();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  let json: Envelope<T> | null = null;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    // réponse non JSON
  }
  if (!res.ok || !json || !json.success || json.data === undefined) {
    const detail = json?.error ? ` ${JSON.stringify(json.error).slice(0, 200)}` : "";
    throw new Error(`SasPay ${method} ${path} : HTTP ${res.status}${detail}`);
  }
  return json.data;
}

type SessionData = { id?: string; slug: string; checkout_url: string; status: string };
type ListData = { next: string | null; results: { id: string; slug: string }[] };

// La réponse de création ne contient pas toujours l'id : on le retrouve par le slug.
async function findSessionIdBySlug(slug: string): Promise<string> {
  const { base, host } = config();
  const basePath = new URL(base).pathname;
  let path = "/checkout-sessions/";
  for (let page = 0; page < 3; page++) {
    const data = await call<ListData>("GET", path);
    const hit = data.results.find((s) => s.slug === slug);
    if (hit) return hit.id;
    if (!data.next) break;
    const next = new URL(data.next);
    if (next.hostname !== host) break;
    path = next.pathname.replace(basePath, "") + next.search;
  }
  throw new Error("Session SasPay introuvable après création.");
}

export async function createCheckoutSession(input: {
  amountFcfa: number;
  description: string;
  customerEmail: string;
  customerName: string;
  returnUrl?: string;
  metadata?: Record<string, string>;
}) {
  const body: Record<string, unknown> = {
    amount: `${Math.round(input.amountFcfa)}.00`,
    currency: "XAF",
    country: "CM",
    description: input.description,
    customer_email: input.customerEmail,
    customer_name: input.customerName,
  };
  if (input.returnUrl) body.return_url = input.returnUrl;
  if (input.metadata) body.metadata = input.metadata;

  const data = await call<SessionData>("POST", "/checkout-sessions/", body);
  const id = data.id ?? (await findSessionIdBySlug(data.slug));
  return { id, slug: data.slug, checkoutUrl: data.checkout_url };
}

export async function getCheckoutStatus(id: string) {
  const d = await call<{
    status: string;
    transaction_id?: string | null;
    transaction_status?: string | null;
    transaction_reference?: string | null;
  }>("GET", `/checkout-sessions/${encodeURIComponent(id)}/status/`);
  return {
    paid: d.status === "PAID" && d.transaction_status === "SUCCESS",
    status: d.status,
    transactionStatus: d.transaction_status ?? null,
    transactionId: d.transaction_id ?? null,
    reference: d.transaction_reference ?? null,
  };
}

// Pour plus tard (webhook) : HMAC-SHA256 hex de `${horodatage}.${corps brut}`, tolérance 5 minutes.
export function verifyWebhookSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret: string,
  nowMs: number = Date.now(),
): boolean {
  if (!timestamp || !signature || !secret) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}