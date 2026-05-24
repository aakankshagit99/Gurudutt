"use server";

import fs from "fs";
import path from "path";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/audit";
import { calculateOverallStatus, computeAggregatedStages } from "@/lib/utils";
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
  stageNames: z.array(z.string()).min(1),
  drawingNumbers: z.array(z.string()).min(1),
});

const StageSchema = z.object({
  drawingId: z.string(),
  stageName: z.string(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
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

  const [ordersRaw, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        drawings: {
          include: {
            stages: {
              include: { assignedUser: { select: { id: true, name: true } } },
              orderBy: { sequence: "asc" },
            },
          },
          orderBy: { drawingNumber: "asc" },
        },
      },
      orderBy: { deadline: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  const orders = ordersRaw.map((o) => ({
    ...o,
    stages: computeAggregatedStages(o.drawings),
  }));

  return { orders, total, page, pageSize };
}

export async function getOrderById(id: string) {
  await requireAuth();
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true } },
      drawings: {
        include: {
          stages: {
            include: { assignedUser: { select: { id: true, name: true, email: true } } },
            orderBy: { sequence: "asc" },
          },
        },
        orderBy: { drawingNumber: "asc" },
      },
      auditLogs: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!order) return null;

  return {
    ...order,
    stages: computeAggregatedStages(order.drawings),
  };
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
      drawings: {
        create: parsed.drawingNumbers.map((num) => ({
          drawingNumber: num.trim(),
          status: "NOT_STARTED",
          stages: {
            create: parsed.stageNames.map((name, idx) => ({
              stageName: name,
              sequence: idx,
              status: "NOT_STARTED",
            })),
          },
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

export async function updateDrawingStage(data: z.infer<typeof StageSchema>) {
  await requireAuth();
  const parsed = StageSchema.parse(data);

  const existingStage = await prisma.drawingStage.findUnique({
    where: { drawingId_stageName: { drawingId: parsed.drawingId, stageName: parsed.stageName } },
  });

  const stage = await prisma.drawingStage.upsert({
    where: { drawingId_stageName: { drawingId: parsed.drawingId, stageName: parsed.stageName } },
    create: {
      drawingId: parsed.drawingId,
      stageName: parsed.stageName,
      startDate: parsed.startDate ? new Date(parsed.startDate) : null,
      endDate: parsed.endDate ? new Date(parsed.endDate) : null,
      deadline: parsed.deadline ? new Date(parsed.deadline) : null,
      status: parsed.status,
      assignedTo: parsed.assignedTo || null,
      remarks: parsed.remarks || null,
    },
    update: {
      startDate: parsed.startDate ? new Date(parsed.startDate) : null,
      endDate: parsed.endDate ? new Date(parsed.endDate) : null,
      deadline: parsed.deadline ? new Date(parsed.deadline) : null,
      status: parsed.status,
      assignedTo: parsed.assignedTo || null,
      remarks: parsed.remarks || null,
    },
  });

  const allStages = await prisma.drawingStage.findMany({
    where: { drawingId: parsed.drawingId },
    orderBy: { sequence: "asc" },
  });

  const newDrawingStatus = calculateOverallStatus(
    allStages.map((s) => ({ status: s.status, stageName: s.stageName }))
  );

  const drawing = await prisma.drawing.update({
    where: { id: parsed.drawingId },
    data: { status: newDrawingStatus },
  });

  const drawingsInPo = await prisma.drawing.findMany({
    where: { orderId: drawing.orderId },
    include: { stages: { orderBy: { sequence: "asc" } } },
  });

  const aggregatedStages = computeAggregatedStages(drawingsInPo);
  const newOverallStatus = calculateOverallStatus(
    aggregatedStages.map((s) => ({ status: s.status, stageName: s.stageName }))
  );

  await prisma.order.update({
    where: { id: drawing.orderId },
    data: { overallStatus: newOverallStatus },
  });

  await createAuditLog({
    action: "UPDATE_STAGE",
    entityType: "DrawingStage",
    entityId: stage.id,
    orderId: drawing.orderId,
    oldValues: existingStage as Record<string, unknown>,
    newValues: parsed as Record<string, unknown>,
  });

  revalidatePath("/dashboard");
  revalidatePath("/orders");
  revalidatePath(`/orders/${drawing.orderId}`);
  revalidatePath("/kanban");
  return { success: true, stage };
}

export async function createDrawing(orderId: string, drawingNumber: string) {
  await requireAuth();

  const existingDrawing = await prisma.drawing.findFirst({
    where: { orderId },
    include: { stages: { orderBy: { sequence: "asc" } } },
  });

  let stageNames = ["ORDER_RECEIVED", "DESIGN", "PROCUREMENT", "MANUFACTURING", "DISPATCH"];
  if (existingDrawing && existingDrawing.stages.length > 0) {
    stageNames = existingDrawing.stages.map((s) => s.stageName);
  }

  const drawing = await prisma.drawing.create({
    data: {
      orderId,
      drawingNumber: drawingNumber.trim(),
      status: "NOT_STARTED",
      stages: {
        create: stageNames.map((name, idx) => ({
          stageName: name,
          sequence: idx,
          status: "NOT_STARTED",
        })),
      },
    },
  });

  const drawingsInPo = await prisma.drawing.findMany({
    where: { orderId },
    include: { stages: { orderBy: { sequence: "asc" } } },
  });

  const aggregatedStages = computeAggregatedStages(drawingsInPo);
  const newOverallStatus = calculateOverallStatus(
    aggregatedStages.map((s) => ({ status: s.status, stageName: s.stageName }))
  );

  await prisma.order.update({
    where: { id: orderId },
    data: { overallStatus: newOverallStatus },
  });

  await createAuditLog({
    action: "CREATE_DRAWING",
    entityType: "Drawing",
    entityId: drawing.id,
    orderId,
    newValues: { drawingNumber },
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dashboard");
  revalidatePath("/orders");
  revalidatePath("/kanban");
  return { success: true, drawing };
}

export async function deleteDrawing(drawingId: string) {
  await requireAuth();

  const drawing = await prisma.drawing.findUnique({
    where: { id: drawingId },
  });
  if (!drawing) throw new Error("Drawing not found");

  await prisma.drawing.delete({
    where: { id: drawingId },
  });

  const drawingsInPo = await prisma.drawing.findMany({
    where: { orderId: drawing.orderId },
    include: { stages: { orderBy: { sequence: "asc" } } },
  });

  const aggregatedStages = computeAggregatedStages(drawingsInPo);
  const newOverallStatus = calculateOverallStatus(
    aggregatedStages.map((s) => ({ status: s.status, stageName: s.stageName }))
  );

  await prisma.order.update({
    where: { id: drawing.orderId },
    data: { overallStatus: newOverallStatus },
  });

  await createAuditLog({
    action: "DELETE_DRAWING",
    entityType: "Drawing",
    entityId: drawingId,
    orderId: drawing.orderId,
    oldValues: drawing as Record<string, unknown>,
  });

  revalidatePath(`/orders/${drawing.orderId}`);
  revalidatePath("/dashboard");
  revalidatePath("/orders");
  revalidatePath("/kanban");
  return { success: true };
}

export async function addStageToDrawing(drawingId: string, stageName: string) {
  await requireAuth();

  const lastStage = await prisma.drawingStage.findFirst({
    where: { drawingId },
    orderBy: { sequence: "desc" },
  });

  const stage = await prisma.drawingStage.create({
    data: {
      drawingId,
      stageName,
      sequence: (lastStage?.sequence ?? -1) + 1,
      status: "NOT_STARTED",
    },
  });

  const updatedStages = await prisma.drawingStage.findMany({
    where: { drawingId },
    orderBy: { sequence: "asc" },
  });
  const newDrawingStatus = calculateOverallStatus(updatedStages.map((s) => ({ status: s.status, stageName: s.stageName })));

  const drawing = await prisma.drawing.update({
    where: { id: drawingId },
    data: { status: newDrawingStatus },
  });

  const drawingsInPo = await prisma.drawing.findMany({
    where: { orderId: drawing.orderId },
    include: { stages: { orderBy: { sequence: "asc" } } },
  });
  const aggregatedStages = computeAggregatedStages(drawingsInPo);
  const newOverallStatus = calculateOverallStatus(
    aggregatedStages.map((s) => ({ status: s.status, stageName: s.stageName }))
  );
  await prisma.order.update({
    where: { id: drawing.orderId },
    data: { overallStatus: newOverallStatus },
  });

  revalidatePath(`/orders/${drawing.orderId}`);
  return { success: true, stage };
}

export async function removeStageFromDrawing(stageId: string) {
  await requireAuth();

  const stage = await prisma.drawingStage.findUnique({ where: { id: stageId } });
  if (!stage) throw new Error("Stage not found");
  if (stage.status === "COMPLETED") throw new Error("Cannot remove a completed stage");

  await prisma.drawingStage.delete({ where: { id: stageId } });

  const remaining = await prisma.drawingStage.findMany({
    where: { drawingId: stage.drawingId },
    orderBy: { sequence: "asc" },
  });

  for (let i = 0; i < remaining.length; i++) {
    await prisma.drawingStage.update({
      where: { id: remaining[i].id },
      data: { sequence: i },
    });
  }

  const updatedStages = await prisma.drawingStage.findMany({
    where: { drawingId: stage.drawingId },
    orderBy: { sequence: "asc" },
  });
  const newDrawingStatus = calculateOverallStatus(updatedStages.map((s) => ({ status: s.status, stageName: s.stageName })));

  const drawing = await prisma.drawing.update({
    where: { id: stage.drawingId },
    data: { status: newDrawingStatus },
  });

  const drawingsInPo = await prisma.drawing.findMany({
    where: { orderId: drawing.orderId },
    include: { stages: { orderBy: { sequence: "asc" } } },
  });
  const aggregatedStages = computeAggregatedStages(drawingsInPo);
  const newOverallStatus = calculateOverallStatus(
    aggregatedStages.map((s) => ({ status: s.status, stageName: s.stageName }))
  );
  await prisma.order.update({
    where: { id: drawing.orderId },
    data: { overallStatus: newOverallStatus },
  });

  revalidatePath(`/orders/${drawing.orderId}`);
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
    recentOrdersRaw,
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
    prisma.drawingStage.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.order.findMany({
      where: { overallStatus: { notIn: ["COMPLETED", "CANCELLED"] } },
      include: {
        drawings: {
          include: {
            stages: {
              include: { assignedUser: { select: { id: true, name: true } } },
              orderBy: { sequence: "asc" },
            },
          },
          orderBy: { drawingNumber: "asc" },
        },
        customer: { select: { name: true } },
      },
      orderBy: { deadline: "asc" },
      take: 5,
    }),
  ]);

  const recentOrders = recentOrdersRaw.map((o) => ({
    ...o,
    stages: computeAggregatedStages(o.drawings),
  }));

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

export async function moveDrawingToStatus(drawingId: string, targetStatus: string) {
  await requireAuth();

  const drawing = await prisma.drawing.findUnique({
    where: { id: drawingId },
    include: { stages: { orderBy: { sequence: "asc" } } },
  });
  if (!drawing) throw new Error("Drawing not found");

  const availableStages = await getAvailableStages();

  if (targetStatus === "COMPLETED") {
    await prisma.drawingStage.updateMany({
      where: { drawingId },
      data: { status: "COMPLETED", endDate: new Date() },
    });
    await prisma.drawing.update({
      where: { id: drawingId },
      data: { status: "COMPLETED" },
    });

    // Recalculate PO overall status
    const drawingsInPo = await prisma.drawing.findMany({
      where: { orderId: drawing.orderId },
      include: { stages: { orderBy: { sequence: "asc" } } },
    });
    const aggregatedStages = computeAggregatedStages(drawingsInPo);
    const newOverallStatus = calculateOverallStatus(
      aggregatedStages.map((s) => ({ status: s.status, stageName: s.stageName }))
    );
    await prisma.order.update({
      where: { id: drawing.orderId },
      data: { overallStatus: newOverallStatus },
    });

    await createAuditLog({
      action: "UPDATE_STATUS",
      entityType: "Drawing",
      entityId: drawingId,
      orderId: drawing.orderId,
      newValues: { status: "COMPLETED" },
    });

    revalidatePath("/dashboard");
    revalidatePath("/orders");
    revalidatePath("/kanban");
    revalidatePath(`/orders/${drawing.orderId}`);
    return { success: true };
  }

  let targetStage = drawing.stages.find((s) => s.stageName === targetStatus);

  if (!targetStage) {
    const availableIndex = availableStages.indexOf(targetStatus);
    const sequence = availableIndex !== -1 ? availableIndex : drawing.stages.length;

    targetStage = await prisma.drawingStage.create({
      data: {
        drawingId,
        stageName: targetStatus,
        sequence,
        status: "IN_PROGRESS",
        startDate: new Date(),
      },
    });

    drawing.stages = await prisma.drawingStage.findMany({
      where: { drawingId },
      orderBy: { sequence: "asc" },
    });
  }

  for (const stage of drawing.stages) {
    if (stage.stageName === targetStatus) {
      await prisma.drawingStage.update({
        where: { id: stage.id },
        data: { status: "IN_PROGRESS", startDate: stage.startDate || new Date(), endDate: null },
      });
    } else if (stage.sequence < targetStage.sequence) {
      if (stage.status !== "COMPLETED") {
        await prisma.drawingStage.update({
          where: { id: stage.id },
          data: { status: "COMPLETED", endDate: stage.endDate || new Date() },
        });
      }
    } else if (stage.sequence > targetStage.sequence) {
      if (stage.status !== "NOT_STARTED") {
        await prisma.drawingStage.update({
          where: { id: stage.id },
          data: { status: "NOT_STARTED", startDate: null, endDate: null },
        });
      }
    }
  }

  const updatedStages = await prisma.drawingStage.findMany({
    where: { drawingId },
    orderBy: { sequence: "asc" },
  });
  const newDrawingStatus = calculateOverallStatus(updatedStages.map((s) => ({ status: s.status, stageName: s.stageName })));

  await prisma.drawing.update({
    where: { id: drawingId },
    data: { status: newDrawingStatus },
  });

  // Recalculate PO overall status
  const drawingsInPo = await prisma.drawing.findMany({
    where: { orderId: drawing.orderId },
    include: { stages: { orderBy: { sequence: "asc" } } },
  });
  const aggregatedStages = computeAggregatedStages(drawingsInPo);
  const newOverallStatus = calculateOverallStatus(
    aggregatedStages.map((s) => ({ status: s.status, stageName: s.stageName }))
  );
  await prisma.order.update({
    where: { id: drawing.orderId },
    data: { overallStatus: newOverallStatus },
  });

  await createAuditLog({
    action: "UPDATE_STATUS",
    entityType: "Drawing",
    entityId: drawingId,
    orderId: drawing.orderId,
    newValues: { status: newDrawingStatus },
  });

  revalidatePath("/dashboard");
  revalidatePath("/orders");
  revalidatePath("/kanban");
  revalidatePath(`/orders/${drawing.orderId}`);
  return { success: true };
}
