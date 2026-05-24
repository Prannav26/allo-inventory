import { Prisma } from "@prisma/client";

export type ProductWithStocks = Prisma.ProductGetPayload<{
  include: {
    stocks: { include: { warehouse: true } };
  };
}>;

export type ReservationWithDetails = Prisma.ReservationGetPayload<{
  include: {
    product: true;
    warehouse: true;
  };
}>;