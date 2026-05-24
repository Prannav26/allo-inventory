import { prisma } from "@/lib/prisma";
import { ReservationDetails } from "@/components/reservation-details";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      product: true,
      warehouse: true,
    },
  });

  if (!reservation) {
    notFound();
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <ReservationDetails reservation={reservation} />
    </main>
  );
}