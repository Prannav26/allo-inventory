import { prisma } from "@/lib/prisma";
import {
  getIdempotentResponse,
  setIdempotentResponse,
} from "@/lib/idempotency";
import { NextResponse } from "next/server";

/**
 * POST /api/reservations/:id/confirm
 * Confirm the reservation (payment succeeded).
 * Returns 410 if the reservation has expired.
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
          expiresAt: Date;
        }>
      >`
        SELECT id, "productId", "warehouseId", quantity, status, "expiresAt"
        FROM "Reservation"
        WHERE id = ${id}
        FOR UPDATE
      `;

      if (rows.length === 0) {
        throw new Error("NOT_FOUND");
      }

      const row = rows[0];

      // Already confirmed — idempotent success
      if (row.status === "CONFIRMED") {
        return tx.reservation.findUnique({ where: { id } });
      }

      // Already released — can't confirm
      if (row.status === "RELEASED") {
        throw new Error("ALREADY_RELEASED");
      }

      // Pending but expired
      if (new Date() > row.expiresAt) {
        // Release it first
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
          where: { id },
          data: { status: "RELEASED" },
        });
        throw new Error("EXPIRED");
      }

      // Confirm: permanently decrement total and reserved
      await tx.stock.update({
        where: {
          productId_warehouseId: {
            productId: row.productId,
            warehouseId: row.warehouseId,
          },
        },
        data: {
          totalQuantity: { decrement: row.quantity },
          reservedQuantity: { decrement: row.quantity },
        },
      });

      const updated = await tx.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
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

    if (message === "EXPIRED") {
      const errorBody = {
        error: "Reservation has expired. The items have been released back to inventory.",
      };
      if (idempotencyKey) {
        await setIdempotentResponse(idempotencyKey, 410, errorBody);
      }
      return NextResponse.json(errorBody, { status: 410 });
    }

    if (message === "ALREADY_RELEASED") {
      const errorBody = {
        error: "Reservation has been released and cannot be confirmed.",
      };
      if (idempotencyKey) {
        await setIdempotentResponse(idempotencyKey, 409, errorBody);
      }
      return NextResponse.json(errorBody, { status: 409 });
    }

    console.error("Confirm failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}