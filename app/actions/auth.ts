"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";

const RESERVED = new Set(["connexion", "inscription", "tableau-de-bord", "api", "admin", "annuler"]);

export type FormState = { error?: string } | undefined;

const signupSchema = z.object({
  businessName: z.string().trim().min(2, "Nom du salon trop court"),
  email: z.string().trim().toLowerCase().email("Email invalide"),
  phone: z.string().trim().min(8, "Téléphone invalide"),
  password: z.string().min(8, "Mot de passe : 8 caractères minimum"),
  ownerName: z.string().trim().min(2,"Nom du responsable trop court"), 
});

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function signup(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { businessName, email, phone, password, ownerName } = parsed.data;

  const existing = await prisma.provider.findFirst({ where: {OR: [{email},{phone}]} });
  if (existing) return { error: "Un compte existe déjà avec cet email ou ce numero de telephone" };

  const base = slugify(businessName) || "salon";
  let slug = RESERVED.has(base) ? `${base}-salon` : base; 
  for (let i = 2; await prisma.provider.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }

  const provider = await prisma.provider.create({
    data: {
      businessName,
      email,
      phone,
      slug,
      passwordHash: await hashPassword(password),
      ownerName, 
    },
  });

  await createSession(provider.id);
  redirect("/tableau-de-bord");
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const provider = await prisma.provider.findFirst({ where: { email } });
  const ok = provider && (await verifyPassword(password, provider.passwordHash));
  if (!provider || !ok) return { error: "Email ou mot de passe incorrect" };

  await createSession(provider.id);
  redirect("/tableau-de-bord");
}

export async function logout() {
  await destroySession();
  redirect("/connexion");
}