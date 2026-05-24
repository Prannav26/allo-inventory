import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * Cron endpoint: release all expired PENDING reservations.
 * Called by Vercel Cron every minute.
 * Protected by CRON_SECRET.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
    });

    console.log(`Found ${expiredReservations.length} expired reservations`);

    let released = 0;
    for (const reservation of expiredReservations) {
      try {
        await prisma.$transaction(async (tx) => {
          // Lock the reservation row
          const rows = await tx.$queryRaw<
            Array<{ id: string; status: string }>
          >`
            SELECT id, status FROM "Reservation" WHERE id = ${reservation.id} FOR UPDATE
          `;

          if (rows.length === 0 || rows[0].status !== "PENDING") return;

          // Release reserved stock
          await tx.stock.update({
            where: {
              productId_warehouseId: {
                productId: reservation.productId,
                warehouseId: reservation.warehouseId,
              },
            },
            data: {
              reservedQuantity: { decrement: reservation.quantity },
            },
          });

          // Update reservation status
          await tx.reservation.update({
            where: { id: reservation.id },
            data: { status: "RELEASED" },
          });
        });
        released++;
      } catch (err) {
        console.error(
          `Failed to release reservation ${reservation.id}:`,
          err
        );
      }
    }

    console.log(`Released ${released}/${expiredReservations.length} expired reservations`);
    return NextResponse.json({
      released,
      total: expiredReservations.length,
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}