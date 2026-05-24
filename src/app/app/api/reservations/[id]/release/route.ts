import { prisma } from "@/lib/prisma";
import {
  getIdempotentResponse,
  setIdempotentResponse,
} from "@/lib/idempotency";
import { NextResponse } from "next/server";

/**
 * POST /api/reservations/:id/release
 * Release the reservation early (payment failed or user cancelled).
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  // ── Idempotency check ──
  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(idempotencyKey);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status });
    }
  }

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      // Lock the reservation row
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          productId: string;
          warehouseId: string;
          quantity: number;
          status: string;
        }>
      >`
        SELECT id, "productId", "warehouseId", quantity, status
        FROM "Reservation"
        WHERE id = ${id}
        FOR UPDATE
      `;

      if (rows.length === 0) {
        throw new Error("NOT_FOUND");
      }

      const row = rows[0];

      // Already released — idempotent success
      if (row.status === "RELEASED") {
        return tx.reservation.findUnique({ where: { id } });
      }

      // Already confirmed — can't release
      if (row.status === "CONFIRMED") {
        throw new Error("ALREADY_CONFIRMED");
      }

      // Release: decrement reservedQuantity
      await tx.stock.update({
        where: {
          productId_warehouseId: {
            productId: row.productId,
            warehouseId: row.warehouseId,
          },
        },
        data: { reservedQuantity: { decrement: row.quantity } },
      });

      const updated = await tx.reservation.update({
        where: { id },
        data: { status: "RELEASED" },
      });

      return updated;
    });

    const response = NextResponse.json(reservation);
    if (idempotencyKey) {
      await setIdempotentResponse(idempotencyKey, 200, reservation);
    }
    return response;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    if (message === "NOT_FOUND") {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    if (message === "ALREADY_CONFIRMED") {
      const errorBody = {
        error: "Reservation has already been confirmed and cannot be released.",
      };
      if (idempotencyKey) {
        await setIdempotentResponse(idempotencyKey, 409, errorBody);
      }
      return NextResponse.json(errorBody, { status: 409 });
    }

    console.error("Release failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}