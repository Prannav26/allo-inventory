import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        stocks: {
          include: {
            warehouse: true,
          },
          orderBy: { warehouseId: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = products.map((product) => ({
      ...product,
      stocks: product.stocks.map((stock) => ({
        ...stock,
        availableQuantity: stock.totalQuantity - stock.reservedQuantity,
      })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}