import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function createAuditLog({
  action,
  entityType,
  entityId,
  orderId,
  oldValues,
  newValues,
}: {
  action: string;
  entityType: string;
  entityId: string;
  orderId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}) {
  const session = await auth();
  await prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      orderId,
      userId: session?.user?.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      oldValues: (oldValues as any) ?? undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newValues: (newValues as any) ?? undefined,
    },
  });
}
