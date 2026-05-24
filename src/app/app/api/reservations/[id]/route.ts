import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/reservations/:id
 * Fetch a single reservation with product/warehouse details.
 * Includes lazy cleanup: releases expired PENDING reservations.
 */
export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      // Lock the row
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          expiresAt: Date;
          productId: string;
          warehouseId: string;
          quantity: number;
        }>
      >`
        SELECT id, status, "expiresAt", "productId", "warehouseId", quantity
        FROM "Reservation"
        WHERE id = ${id}
        FOR UPDATE
      `;

      if (rows.length === 0) return null;

      const row = rows[0];

      // Lazy cleanup: if expired and still pending, release it
      if (row.status === "PENDING" && new Date() > row.expiresAt) {
        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: row.productId,
              warehouseId: row.warehouseId,
            },
          },
          data: { reservedQuantity: { decrement: row.quantity } },
        });

        await tx.reservation.update({
          where: { id: row.id },
          data: { status: "RELEASED" },
        });

        // Re-fetch with updated status
        return tx.reservation.findUnique({
          where: { id },
          include: { product: true, warehouse: true },
        });
      }

      return tx.reservation.findUnique({
        where: { id },
        include: { product: true, warehouse: true },
      });
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error("Failed to fetch reservation:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservation" },
      { status: 500 }
    );
  }
}