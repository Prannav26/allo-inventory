import { prisma } from "@/lib/prisma";
import { acquireLock, releaseLock } from "@/lib/lock";
import {
  getIdempotentResponse,
  setIdempotentResponse,
} from "@/lib/idempotency";
import { reserveSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

/**
 * POST /api/reservations
 * Reserve units for a product/warehouse.
 * Concurrency-safe: uses Redis distributed lock + DB SELECT FOR UPDATE.
 * Returns 409 if insufficient stock.
 */
export async function POST(request: Request) {
  // ── Idempotency check ──
  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(idempotencyKey);
    if (cached) {
      return NextResponse.json(cached.body, { status: cached.status });
    }
  }

  // ── Validate input ──
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = reserveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { productId, warehouseId, quantity } = parsed.data;

  // ── Redis distributed lock ──
  const lockKey = `stock:${productId}:${warehouseId}`;
  const lockValue = await acquireLock(lockKey);

  if (!lockValue) {
    return NextResponse.json(
      { error: "Too many concurrent requests. Please try again." },
      { status: 429 }
    );
  }

  try {
    // ── DB transaction with row-level lock ──
    const reservation = await prisma.$transaction(async (tx) => {
      // Lock the stock row to prevent concurrent modifications
      const stocks = await tx.$queryRaw<
        Array<{
          id: string;
          totalQuantity: number;
          reservedQuantity: number;
        }>
      >`
        SELECT id, "totalQuantity", "reservedQuantity"
        FROM "Stock"
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      if (stocks.length === 0) {
        throw new Error("STOCK_NOT_FOUND");
      }

      const stock = stocks[0];
      const available = stock.totalQuantity - stock.reservedQuantity;

      if (available < quantity) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      // Increment reserved quantity (Prisma handles updatedAt)
      await tx.stock.update({
        where: { id: stock.id },
        data: { reservedQuantity: { increment: quantity } },
      });

      // Create the reservation (expires in 10 minutes)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          expiresAt,
          status: "PENDING",
        },
      });

      return reservation;
    });

    const response = NextResponse.json(reservation, { status: 201 });

    if (idempotencyKey) {
      await setIdempotentResponse(idempotencyKey, 201, reservation);
    }

    return response;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    if (message === "INSUFFICIENT_STOCK") {
      const errorBody = { error: "Not enough stock available" };
      if (idempotencyKey) {
        await setIdempotentResponse(idempotencyKey, 409, errorBody);
      }
      return NextResponse.json(errorBody, { status: 409 });
    }

    if (message === "STOCK_NOT_FOUND") {
      const errorBody = {
        error: "Stock not found for this product/warehouse combination",
      };
      return NextResponse.json(errorBody, { status: 404 });
    }

    console.error("Reservation failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await releaseLock(lockKey, lockValue);
  }
}