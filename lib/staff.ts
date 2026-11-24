import "server-only";
import { prisma } from "@/lib/prisma";

export const MAX_STAFF = 5;

// Garantit qu'un salon a au moins un coiffeur (le propriétaire), lié à ses services actifs.
export async function ensureDefaultStaff(providerId: string) {
  const existing = await prisma.staff.findFirst({
    where: { providerId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { ownerName: true },
  });
  const staff = await prisma.staff.create({
    data: { providerId, name: provider?.ownerName ?? "Principal" },
  });
  const services = await prisma.service.findMany({
    where: { providerId, active: true },
    select: { id: true },
  });
  if (services.length > 0) {
    await prisma.staffService.createMany({
      data: services.map((s) => ({ staffId: staff.id, serviceId: s.id })),
      skipDuplicates: true,
    });
  }
  return staff;
}