"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProductWithStocks } from "@/lib/types";

export function ProductCard({ product }: { product: ProductWithStocks }) {
  const router = useRouter();
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReserve = async () => {
    if (!selectedWarehouse) {
      setError("Please select a warehouse");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedWarehouse,
          quantity,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push(`/reservation/${data.id}`);
      } else if (res.status === 409) {
        setError(
          "Not enough stock available. Try a different warehouse or lower quantity."
        );
      } else if (res.status === 429) {
        setError("Too many requests. Please wait and try again.");
      } else {
        setError(data.error || "Failed to reserve. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{product.name}</CardTitle>
        {product.description && (
          <CardDescription>{product.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {/* Stock per warehouse */}
        <div className="space-y-2 mb-5">
          {product.stocks.map((stock) => {
            const available = stock.totalQuantity - stock.reservedQuantity;
            return (
              <div
                key={stock.id}
                className="flex justify-between items-center text-sm"
              >
                <span className="text-muted-foreground">
                  {stock.warehouse.name}
                </span>
                <Badge variant={available > 0 ? "default" : "destructive"}>
                  {available} available
                </Badge>
              </div>
            );
          })}
        </div>

        {/* Reserve form */}
        <div className="space-y-3">
          <Select onValueChange={setSelectedWarehouse} value={selectedWarehouse}>
            <SelectTrigger>
              <SelectValue placeholder="Select warehouse" />
            </SelectTrigger>
            <SelectContent>
              {product.stocks.map((stock) => {
                const available =
                  stock.totalQuantity - stock.reservedQuantity;
                return (
                  <SelectItem
                    key={stock.warehouseId}
                    value={stock.warehouseId}
                    disabled={available === 0}
                  >
                    {stock.warehouse.name} ({available} avail)
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Input
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            placeholder="Quantity"
          />

          <Button
            onClick={handleReserve}
            disabled={loading || !selectedWarehouse}
            className="w-full"
          >
            {loading ? "Reserving…" : "Reserve"}
          </Button>

          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}