import { z } from "zod";

export const reserveSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  warehouseId: z.string().min(1, "Warehouse ID is required"),
  quantity: z.number().int().positive().min(1, "Quantity must be at least 1"),
});

export type ReserveInput = z.infer<typeof reserveSchema>;