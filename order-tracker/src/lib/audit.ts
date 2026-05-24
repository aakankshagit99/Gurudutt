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
  const userId = session?.user?.id;
  
  let validUserId: string | undefined = undefined;
  if (userId) {
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (userExists) {
      validUserId = userId;
    }
  }

  await prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      orderId,
      userId: validUserId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      oldValues: (oldValues as any) ?? undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newValues: (newValues as any) ?? undefined,
    },
  });
}
