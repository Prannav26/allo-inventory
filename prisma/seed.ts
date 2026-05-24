import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean existing data (order matters due to foreign keys)
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // ── Warehouses ──
  const mumbai = await prisma.warehouse.create({
    data: { name: "Mumbai Warehouse", location: "Mumbai, MH" },
  });
  const delhi = await prisma.warehouse.create({
    data: { name: "Delhi Warehouse", location: "Delhi, NCR" },
  });
  const bangalore = await prisma.warehouse.create({
    data: { name: "Bangalore Warehouse", location: "Bangalore, KA" },
  });

  // ── Products ──
  const headphones = await prisma.product.create({
    data: {
      name: "Wireless Headphones",
      description: "Premium noise-cancelling wireless headphones",
      sku: "WH-001",
    },
  });

  const keyboard = await prisma.product.create({
    data: {
      name: "Mechanical Keyboard",
      description: "Cherry MX Blue switches, RGB backlit",
      sku: "MK-002",
    },
  });

  const mouse = await prisma.product.create({
    data: {
      name: "Ergonomic Mouse",
      description: "Vertical ergonomic wireless mouse",
      sku: "EM-003",
    },
  });

  const hub = await prisma.product.create({
    data: {
      name: "USB-C Hub",
      description: "7-in-1 USB-C hub with HDMI and Ethernet",
      sku: "UH-004",
    },
  });

  const stand = await prisma.product.create({
    data: {
      name: "Monitor Stand",
      description: "Adjustable metal monitor stand with USB ports",
      sku: "MS-005",
    },
  });

  // ── Stock levels (total, reserved) ──
  // Wireless Headphones
  await prisma.stock.create({ data: { productId: headphones.id, warehouseId: mumbai.id, totalQuantity: 5, reservedQuantity: 0 } });
  await prisma.stock.create({ data: { productId: headphones.id, warehouseId: delhi.id, totalQuantity: 3, reservedQuantity: 0 } });
  await prisma.stock.create({ data: { productId: headphones.id, warehouseId: bangalore.id, totalQuantity: 2, reservedQuantity: 0 } });

  // Mechanical Keyboard (low stock for demo)
  await prisma.stock.create({ data: { productId: keyboard.id, warehouseId: mumbai.id, totalQuantity: 2, reservedQuantity: 0 } });
  await prisma.stock.create({ data: { productId: keyboard.id, warehouseId: delhi.id, totalQuantity: 1, reservedQuantity: 0 } });
  await prisma.stock.create({ data: { productId: keyboard.id, warehouseId: bangalore.id, totalQuantity: 4, reservedQuantity: 0 } });

  // Ergonomic Mouse (high stock)
  await prisma.stock.create({ data: { productId: mouse.id, warehouseId: mumbai.id, totalQuantity: 10, reservedQuantity: 0 } });
  await prisma.stock.create({ data: { productId: mouse.id, warehouseId: delhi.id, totalQuantity: 8, reservedQuantity: 0 } });
  await prisma.stock.create({ data: { productId: mouse.id, warehouseId: bangalore.id, totalQuantity: 6, reservedQuantity: 0 } });

  // USB-C Hub (very low stock)
  await prisma.stock.create({ data: { productId: hub.id, warehouseId: mumbai.id, totalQuantity: 1, reservedQuantity: 0 } });
  await prisma.stock.create({ data: { productId: hub.id, warehouseId: delhi.id, totalQuantity: 3, reservedQuantity: 0 } });
  await prisma.stock.create({ data: { productId: hub.id, warehouseId: bangalore.id, totalQuantity: 0, reservedQuantity: 0 } });

  // Monitor Stand (zero in Mumbai)
  await prisma.stock.create({ data: { productId: stand.id, warehouseId: mumbai.id, totalQuantity: 0, reservedQuantity: 0 } });
  await prisma.stock.create({ data: { productId: stand.id, warehouseId: delhi.id, totalQuantity: 2, reservedQuantity: 0 } });
  await prisma.stock.create({ data: { productId: stand.id, warehouseId: bangalore.id, totalQuantity: 1, reservedQuantity: 0 } });

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });