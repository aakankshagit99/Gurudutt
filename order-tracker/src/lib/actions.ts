"use server";

import fs from "fs";
import path from "path";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { calculateOverallStatus } from "@/lib/utils";
import { z } from "zod";
import { Priority, StageStatus } from "@prisma/client";

// Dynamic Stage Management
export async function getAvailableStages(): Promise<string[]> {
  const configPath = path.join(process.cwd(), "src/config/stages.json");
  try {
    const data = fs.readFileSync(configPath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to load stages config:", err);
    return ["ORDER_RECEIVED", "DESIGN", "PROCUREMENT", "MANUFACTURING", "DISPATCH"];
  }
}

const OrderSchema = z.object({
  customerId: z.string().min(1),
  projectName: z.string().min(1),
  poNumber: z.string().min(1),
  orderDate: z.string(),
  deadline: z.string(),
  priority: z.nativeEnum(Priority),
  notes: z.string().optional(),
  stageNames: z.array(z.string()).min(1), // Required stages for this order
});

const StageSchema = z.object({
  orderId: z.string(),
  stageName: z.string(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z.nativeEnum(StageStatus),
  assignedTo: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

export async function getOrders(params?: {
  search?: string;
  status?: string;
  priority?: string;
  page?: number;
  pageSize?: number;
}) {
  await requireAuth();
  const { search, status, priority, page = 1, pageSize = 20 } = params || {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (search) {
    where.OR = [
      { projectName: { contains: search, mode: "insensitive" } },
      { poNumber: { contains: search, mode: "insensitive" } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (status) where.overallStatus = status;
  if (priority) where.priority = priority as any;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        stages: {
          include: { assignedUser: { select: { id: true, name: true } } },
          orderBy: { sequence: "asc" },
        },
      },
      orderBy: { deadline: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, pageSize };
}

export async function getOrderById(id: string) {
  await requireAuth();
  return prisma.order.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true } },
      stages: {
        include: { assignedUser: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      auditLogs: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
}

export async function createOrder(data: z.infer<typeof OrderSchema>) {
  await requireAuth();
  const parsed = OrderSchema.parse(data);

  const order = await prisma.order.create({
    data: {
      customerId: parsed.customerId,
      projectName: parsed.projectName,
      poNumber: parsed.poNumber,
      orderDate: new Date(parsed.orderDate),
      deadline: new Date(parsed.deadline),
      priority: parsed.priority,
      notes: parsed.notes,
      stages: {
        create: parsed.stageNames.map((name, idx) => ({
          stageName: name,
          sequence: idx,
          status: "NOT_STARTED",
        })),
      },
    },
  });

  await createAuditLog({
    action: "CREATE",
    entityType: "Order",
    entityId: order.id,
    orderId: order.id,
    newValues: parsed as Record<string, unknown>,
  });

  revalidatePath("/dashboard");
  revalidatePath("/orders");
  return { success: true, order };
}

export async function updateOrder(id: string, data: Partial<z.infer<typeof OrderSchema>>) {
  await requireAuth();

  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) throw new Error("Order not found");

  const order = await prisma.order.update({
    where: { id },
    data: {
      ...(data.customerId && { customerId: data.customerId }),
      ...(data.projectName && { projectName: data.projectName }),
      ...(data.poNumber && { poNumber: data.poNumber }),
      ...(data.orderDate && { orderDate: new Date(data.orderDate) }),
      ...(data.deadline && { deadline: new Date(data.deadline) }),
      ...(data.priority && { priority: data.priority }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });

  await createAuditLog({
    action: "UPDATE",
    entityType: "Order",
    entityId: id,
    orderId: id,
    oldValues: existing as Record<string, unknown>,
    newValues: data as Record<string, unknown>,
  });

  revalidatePath("/dashboard");
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  return { success: true, order };
}

export async function deleteOrder(id: string) {
  const session = await requireAuth();
  if (((session.user as unknown) as { role?: string }).role !== "ADMIN") throw new Error("Forbidden");

  await prisma.order.delete({ where: { id } });

  await createAuditLog({
    action: "DELETE",
    entityType: "Order",
    entityId: id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/orders");
  return { success: true };
}

export async function updateStage(data: z.infer<typeof StageSchema>) {
  await requireAuth();
  const parsed = StageSchema.parse(data);

  const existingStage = await prisma.orderStage.findUnique({
    where: { orderId_stageName: { orderId: parsed.orderId, stageName: parsed.stageName } },
  });

  const stage = await prisma.orderStage.upsert({
    where: { orderId_stageName: { orderId: parsed.orderId, stageName: parsed.stageName } },
    create: {
      orderId: parsed.orderId,
      stageName: parsed.stageName,
      startDate: parsed.startDate ? new Date(parsed.startDate) : null,
      endDate: parsed.endDate ? new Date(parsed.endDate) : null,
      status: parsed.status,
      assignedTo: parsed.assignedTo || null,
      remarks: parsed.remarks || null,
    },
    update: {
      startDate: parsed.startDate ? new Date(parsed.startDate) : null,
      endDate: parsed.endDate ? new Date(parsed.endDate) : null,
      status: parsed.status,
      assignedTo: parsed.assignedTo || null,
      remarks: parsed.remarks || null,
    },
  });

  const allStages = await prisma.orderStage.findMany({ 
    where: { orderId: parsed.orderId },
    orderBy: { sequence: "asc" } 
  });
  const newOverallStatus = calculateOverallStatus(allStages.map((s: { status: StageStatus; stageName: string }) => ({ status: s.status, stageName: s.stageName })));

  await prisma.order.update({ where: { id: parsed.orderId }, data: { overallStatus: newOverallStatus } });

  await createAuditLog({
    action: "UPDATE_STAGE",
    entityType: "OrderStage",
    entityId: stage.id,
    orderId: parsed.orderId,
    oldValues: existingStage as Record<string, unknown>,
    newValues: parsed as Record<string, unknown>,
  });

  revalidatePath("/dashboard");
  revalidatePath("/orders");
  revalidatePath(`/orders/${parsed.orderId}`);
  return { success: true, stage };
}

export async function addStageToOrder(orderId: string, stageName: string) {
  await requireAuth();
  
  const lastStage = await prisma.orderStage.findFirst({
    where: { orderId },
    orderBy: { sequence: "desc" },
  });

  const stage = await prisma.orderStage.create({
    data: {
      orderId,
      stageName,
      sequence: (lastStage?.sequence ?? -1) + 1,
      status: "NOT_STARTED",
    },
  });

  await createAuditLog({
    action: "ADD_STAGE",
    entityType: "OrderStage",
    entityId: stage.id,
    orderId,
    newValues: { stageName },
  });

  revalidatePath(`/orders/${orderId}`);
  return { success: true, stage };
}

export async function removeStageFromOrder(stageId: string) {
  await requireAuth();

  const stage = await prisma.orderStage.findUnique({ where: { id: stageId } });
  if (!stage) throw new Error("Stage not found");
  if (stage.status === "COMPLETED") throw new Error("Cannot remove a completed stage");

  await prisma.orderStage.delete({ where: { id: stageId } });

  await createAuditLog({
    action: "REMOVE_STAGE",
    entityType: "OrderStage",
    entityId: stageId,
    orderId: stage.orderId,
    oldValues: stage as Record<string, unknown>,
  });

  // Re-order remaining stages
  const remaining = await prisma.orderStage.findMany({
    where: { orderId: stage.orderId },
    orderBy: { sequence: "asc" },
  });

  for (let i = 0; i < remaining.length; i++) {
    await prisma.orderStage.update({
      where: { id: remaining[i].id },
      data: { sequence: i },
    });
  }

  revalidatePath(`/orders/${stage.orderId}`);
  return { success: true };
}

export async function getDashboardStats() {
  await requireAuth();

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    totalOrders,
    nearingDeadline,
    delayedOrders,
    completedOrders,
    stageStats,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count({ where: { overallStatus: { notIn: ["COMPLETED", "CANCELLED"] } } }),
    prisma.order.count({
      where: {
        deadline: { gte: now, lte: sevenDaysFromNow },
        overallStatus: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    }),
    prisma.order.count({
      where: {
        deadline: { lt: now },
        overallStatus: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    }),
    prisma.order.count({ where: { overallStatus: "COMPLETED" } }),
    prisma.orderStage.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.order.findMany({
      where: { overallStatus: { notIn: ["COMPLETED", "CANCELLED"] } },
      include: { stages: { orderBy: { sequence: "asc" } }, customer: { select: { name: true } } },
      orderBy: { deadline: "asc" },
      take: 5,
    }),
  ]);

  return {
    totalOrders,
    nearingDeadline,
    delayedOrders,
    completedOrders,
    stageStats,
    recentOrders,
  };
}

export async function getUsers() {
  await requireAuth();
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, department: true },
    orderBy: { name: "asc" },
  });
}

export async function getAuditLogs(orderId?: string) {
  await requireAuth();
  return prisma.auditLog.findMany({
    where: orderId ? { orderId } : undefined,
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getCustomers() {
  await requireAuth();
  return prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { orders: true } },
    },
  });
}

const CustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export async function createCustomer(data: z.infer<typeof CustomerSchema>) {
  await requireAuth();
  const parsed = CustomerSchema.parse(data);
  const customer = await prisma.customer.create({ data: parsed });
  revalidatePath("/customers");
  return { success: true, customer };
}

export async function updateCustomer(id: string, data: Partial<z.infer<typeof CustomerSchema>>) {
  await requireAuth();
  const customer = await prisma.customer.update({ where: { id }, data });
  revalidatePath("/customers");
  return { success: true, customer };
}

export async function deleteCustomer(id: string) {
  const session = await requireAuth();
  if (((session.user as unknown) as { role?: string }).role !== "ADMIN") throw new Error("Forbidden");
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/customers");
  return { success: true };
}

export async function addAvailableStage(name: string) {
  await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Stage name cannot be empty");

  const configPath = path.join(process.cwd(), "src/config/stages.json");
  let stages: string[] = [];
  try {
    const data = fs.readFileSync(configPath, "utf8");
    stages = JSON.parse(data);
  } catch (err) {
    stages = ["ORDER_RECEIVED", "DESIGN", "PROCUREMENT", "MANUFACTURING", "DISPATCH"];
  }

  const exists = stages.some((s) => s.toLowerCase() === trimmed.toLowerCase());
  if (!exists) {
    stages.push(trimmed);
    fs.writeFileSync(configPath, JSON.stringify(stages), "utf8");
  }

  revalidatePath("/dashboard");
  revalidatePath("/orders");
  revalidatePath("/kanban");
  return stages;
}

export async function moveOrderToStatus(orderId: string, targetStatus: string) {
  await requireAuth();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { stages: { orderBy: { sequence: "asc" } } },
  });
  if (!order) throw new Error("Order not found");

  const availableStages = await getAvailableStages();

  if (targetStatus === "COMPLETED") {
    await prisma.orderStage.updateMany({
      where: { orderId },
      data: { status: "COMPLETED", endDate: new Date() },
    });
    await prisma.order.update({
      where: { id: orderId },
      data: { overallStatus: "COMPLETED" },
    });

    await createAuditLog({
      action: "UPDATE_STATUS",
      entityType: "Order",
      entityId: orderId,
      orderId,
      newValues: { overallStatus: "COMPLETED" },
    });

    revalidatePath("/dashboard");
    revalidatePath("/orders");
    revalidatePath("/kanban");
    revalidatePath(`/orders/${orderId}`);
    return { success: true };
  }

  let targetStage = order.stages.find((s) => s.stageName === targetStatus);

  if (!targetStage) {
    const availableIndex = availableStages.indexOf(targetStatus);
    const sequence = availableIndex !== -1 ? availableIndex : order.stages.length;

    targetStage = await prisma.orderStage.create({
      data: {
        orderId,
        stageName: targetStatus,
        sequence,
        status: "IN_PROGRESS",
        startDate: new Date(),
      },
    });

    order.stages = await prisma.orderStage.findMany({
      where: { orderId },
      orderBy: { sequence: "asc" },
    });
  }

  for (const stage of order.stages) {
    if (stage.stageName === targetStatus) {
      await prisma.orderStage.update({
        where: { id: stage.id },
        data: { status: "IN_PROGRESS", startDate: stage.startDate || new Date(), endDate: null },
      });
    } else if (stage.sequence < targetStage.sequence) {
      if (stage.status !== "COMPLETED") {
        await prisma.orderStage.update({
          where: { id: stage.id },
          data: { status: "COMPLETED", endDate: stage.endDate || new Date() },
        });
      }
    } else if (stage.sequence > targetStage.sequence) {
      if (stage.status !== "NOT_STARTED") {
        await prisma.orderStage.update({
          where: { id: stage.id },
          data: { status: "NOT_STARTED", startDate: null, endDate: null },
        });
      }
    }
  }

  const updatedStages = await prisma.orderStage.findMany({
    where: { orderId },
    orderBy: { sequence: "asc" },
  });
  const newOverallStatus = calculateOverallStatus(updatedStages.map((s) => ({ status: s.status, stageName: s.stageName })));

  await prisma.order.update({
    where: { id: orderId },
    data: { overallStatus: newOverallStatus },
  });

  await createAuditLog({
    action: "UPDATE_STATUS",
    entityType: "Order",
    entityId: orderId,
    orderId,
    newValues: { overallStatus: newOverallStatus },
  });

  revalidatePath("/dashboard");
  revalidatePath("/orders");
  revalidatePath("/kanban");
  revalidatePath(`/orders/${orderId}`);
  return { success: true };
}
