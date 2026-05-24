import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

const DEFAULT_STAGES = [
  "ORDER_RECEIVED",
  "DESIGN",
  "PROCUREMENT",
  "MANUFACTURING",
  "DISPATCH",
];

async function seed() {
  console.log("🌱 Seeding database...");

  // Create users
  const adminPassword = await bcrypt.hash("admin123", 12);
  const managerPassword = await bcrypt.hash("manager123", 12);
  const engineerPassword = await bcrypt.hash("engineer123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@gurudutt.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@gurudutt.com",
      password: adminPassword,
      role: "ADMIN",
      department: "Management",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@gurudutt.com" },
    update: {},
    create: {
      name: "Production Manager",
      email: "manager@gurudutt.com",
      password: managerPassword,
      role: "MANAGER",
      department: "Production",
    },
  });

  const engineer = await prisma.user.upsert({
    where: { email: "engineer@gurudutt.com" },
    update: {},
    create: {
      name: "Design Engineer",
      email: "engineer@gurudutt.com",
      password: engineerPassword,
      role: "ENGINEER",
      department: "Design",
    },
  });

  console.log("✅ Users created");

  // Create sample customers
  const customers = [
    { name: "Acme Corp", email: "info@acme.com" },
    { name: "TechFab Ltd", email: "contact@techfab.com" },
    { name: "BuildRight Inc", email: "support@buildright.com" },
    { name: "Mech Solutions", email: "sales@mechsol.com" },
    { name: "Global Metals", email: "hello@globalmetals.com" },
  ];

  const customerMap: Record<string, string> = {};
  for (const c of customers) {
    const customer = await prisma.customer.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
    customerMap[c.name] = customer.id;
  }
  console.log("✅ Customers created");

  // Create sample orders
  const sampleOrders = [
    {
      customerName: "Acme Corp",
      projectName: "Steel Frame Assembly",
      poNumber: "PO-2024-001",
      orderDate: new Date("2024-01-10"),
      deadline: new Date("2024-04-30"),
      priority: "HIGH" as const,
      overallStatus: "MANUFACTURING" as const,
      notes: "High priority - client escalation",
    },
    {
      customerName: "TechFab Ltd",
      projectName: "Precision Parts Batch",
      poNumber: "PO-2024-002",
      orderDate: new Date("2024-02-01"),
      deadline: new Date("2024-05-15"),
      priority: "MEDIUM" as const,
      overallStatus: "DESIGN" as const,
      notes: "Standard delivery timeline",
    },
    {
      customerName: "BuildRight Inc",
      projectName: "Custom Enclosures x50",
      poNumber: "PO-2024-003",
      orderDate: new Date("2024-01-20"),
      deadline: new Date("2024-03-31"),
      priority: "URGENT" as const,
      overallStatus: "DISPATCH" as const,
      notes: "Client confirmed ready for dispatch",
    },
    {
      customerName: "Mech Solutions",
      projectName: "Hydraulic Components",
      poNumber: "PO-2024-004",
      orderDate: new Date("2024-02-15"),
      deadline: new Date("2024-06-30"),
      priority: "LOW" as const,
      overallStatus: "ORDER_RECEIVED" as const,
      notes: "Awaiting design approval",
    },
    {
      customerName: "Global Metals",
      projectName: "Sheet Metal Fabrication",
      poNumber: "PO-2024-005",
      orderDate: new Date("2024-01-05"),
      deadline: new Date("2024-02-28"),
      priority: "HIGH" as const,
      overallStatus: "COMPLETED" as const,
      notes: "Delivered on time",
    },
  ];

  for (const o of sampleOrders) {
    const existing = await prisma.order.findUnique({
      where: { poNumber: o.poNumber },
    });
    if (existing) continue;

    const order = await prisma.order.create({
      data: {
        customerId: customerMap[o.customerName],
        projectName: o.projectName,
        poNumber: o.poNumber,
        orderDate: o.orderDate,
        deadline: o.deadline,
        priority: o.priority,
        overallStatus: o.overallStatus,
        notes: o.notes,
      },
    });

    // Create 2 drawings for this PO
    const drawingNumbers = [`${o.poNumber}-DRW-01`, `${o.poNumber}-DRW-02`];
    const statusIndex = [
      "ORDER_RECEIVED",
      "DESIGN",
      "PROCUREMENT",
      "MANUFACTURING",
      "DISPATCH",
      "COMPLETED",
    ].indexOf(o.overallStatus);

    for (let d = 0; d < drawingNumbers.length; d++) {
      const drawingNumber = drawingNumbers[d];
      
      // Let's vary the progress slightly between the two drawings
      // e.g. drawing 2 is slightly behind drawing 1
      const drawingStatusIndex = Math.max(0, statusIndex - d);
      const drawingStatus = DEFAULT_STAGES[Math.min(drawingStatusIndex, DEFAULT_STAGES.length - 1)];

      const drawing = await prisma.drawing.create({
        data: {
          orderId: order.id,
          drawingNumber,
          status: o.overallStatus === "COMPLETED" ? "COMPLETED" : drawingStatus,
          stages: {
            create: DEFAULT_STAGES.map((stageName, idx) => ({
              stageName,
              sequence: idx,
              status: "NOT_STARTED",
            })),
          },
        },
      });

      // Update stages for this drawing
      for (let i = 0; i < DEFAULT_STAGES.length; i++) {
        const stageName = DEFAULT_STAGES[i];
        let status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" = "NOT_STARTED";

        if (o.overallStatus === "COMPLETED") {
          status = "COMPLETED";
        } else if (i < drawingStatusIndex) {
          status = "COMPLETED";
        } else if (i === drawingStatusIndex) {
          status = "IN_PROGRESS";
        }

        // Generate dynamic stage deadline: orderDate + (i + 1) * 14 days
        const stageDeadline = new Date(o.orderDate.getTime() + (i + 1) * 14 * 86400000);

        // If stage is not completed and deadline is in the past, it's DELAYED
        if (status !== "COMPLETED" && stageDeadline < new Date()) {
          status = "DELAYED";
        }

        await prisma.drawingStage.updateMany({
          where: { drawingId: drawing.id, stageName },
          data: {
            status,
            assignedTo: (i + d) % 2 === 0 ? engineer.id : manager.id,
            startDate: i <= drawingStatusIndex ? new Date(o.orderDate.getTime() + i * 7 * 86400000) : null,
            endDate: (i < drawingStatusIndex || o.overallStatus === "COMPLETED") ? new Date(o.orderDate.getTime() + (i + 1) * 7 * 86400000) : null,
            deadline: stageDeadline,
          },
        });
      }
    }

    console.log(`✅ Order created with 2 drawings: ${o.poNumber}`);
  }

  console.log("🎉 Seeding complete!");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
