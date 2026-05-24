"use client";

import { ProductCard } from "./product-card";
import { ProductWithStocks } from "@/lib/types";

export function ProductGrid({
  products,
}: {
  products: ProductWithStocks[];
}) {
  if (products.length === 0) {
    return (
      <p className="text-muted-foreground">
        No products available. Seed the database.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}