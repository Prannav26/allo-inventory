"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ReservationWithDetails } from "@/lib/types";

function calculateTimeLeft(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { total: 0, minutes: 0, seconds: 0 };
  return {
    total: diff,
    minutes: Math.floor((diff / 1000 / 60) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

type UIStatus =
  | "PENDING"
  | "CONFIRMED"
  | "RELEASED"
  | "EXPIRED";

export function ReservationDetails({
  reservation,
}: {
  reservation: ReservationWithDetails;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<UIStatus>(
    reservation.status === "PENDING" && new Date() > reservation.expiresAt
      ? "EXPIRED"
      : (reservation.status as UIStatus)
  );
  const [timeLeft, setTimeLeft] = useState(
    calculateTimeLeft(reservation.expiresAt.toISOString())
  );
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (status !== "PENDING") return;

    const interval = setInterval(() => {
      const left = calculateTimeLeft(reservation.expiresAt.toISOString());
      setTimeLeft(left);
      if (left.total <= 0) {
        setStatus("EXPIRED");
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservation.expiresAt, status]);

  const handleConfirm = useCallback(async () => {
    setConfirming(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/reservations/${reservation.id}/confirm`,
        { method: "POST" }
      );
      const data = await res.json();

      if (res.ok) {
        setStatus("CONFIRMED");
      } else if (res.status === 410) {
        setStatus("EXPIRED");
        setError(
          data.error ||
            "Your reservation has expired. Items released back to inventory."
        );
      } else {
        setError(data.error || "Failed to confirm reservation.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setConfirming(false);
    }
  }, [reservation.id]);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/reservations/${reservation.id}/release`,
        { method: "POST" }
      );
      const data = await res.json();

      if (res.ok) {
        setStatus("RELEASED");
      } else {
        setError(data.error || "Failed to cancel reservation.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCancelling(false);
    }
  }, [reservation.id]);

  const statusBadge = () => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="outline" className="text-yellow-700 border-yellow-400">
            Pending
          </Badge>
        );
      case "CONFIRMED":
        return <Badge className="bg-green-600">Confirmed</Badge>;
      case "RELEASED":
        return <Badge variant="secondary">Released</Badge>;
      case "EXPIRED":
        return <Badge variant="destructive">Expired</Badge>;
    }
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Reservation Details
          {statusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <span className="text-muted-foreground">Product</span>
          <span className="font-medium">{reservation.product.name}</span>

          <span className="text-muted-foreground">Warehouse</span>
          <span className="font-medium">{reservation.warehouse.name}</span>

          <span className="text-muted-foreground">Quantity</span>
          <span className="font-medium">{reservation.quantity}</span>

          <span className="text-muted-foreground">Status</span>
          <span>{statusBadge()}</span>
        </div>

        {/* Countdown timer */}
        {status === "PENDING" && (
          <div className="text-center py-4 border rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">
              Time remaining
            </p>
            <span className="font-mono text-3xl font-bold tracking-widest">
              {String(timeLeft.minutes).padStart(2, "0")}:
              {String(timeLeft.seconds).padStart(2, "0")}
            </span>
          </div>
        )}

        {/* Error alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success messages */}
        {status === "CONFIRMED" && (
          <Alert>
            <AlertTitle>Purchase Confirmed!</AlertTitle>
            <AlertDescription>
              Your reservation has been confirmed and stock has been
              permanently decremented.
            </AlertDescription>
          </Alert>
        )}

        {status === "RELEASED" && (
          <Alert>
            <AlertTitle>Reservation Cancelled</AlertTitle>
            <AlertDescription>
              Your reservation has been released and the items are available
              for other shoppers.
            </AlertDescription>
          </Alert>
        )}

        {status === "EXPIRED" && !error && (
          <Alert variant="destructive">
            <AlertTitle>Reservation Expired</AlertTitle>
            <AlertDescription>
              Your reservation has expired and the items have been released
              back to inventory.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex gap-3">
        {status === "PENDING" && (
          <>
            <Button
              onClick={handleConfirm}
              disabled={confirming}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {confirming ? "Confirming…" : "Confirm Purchase"}
            </Button>
            <Button
              onClick={handleCancel}
              disabled={cancelling}
              variant="destructive"
              className="flex-1"
            >
              {cancelling ? "Cancelling…" : "Cancel"}
            </Button>
          </>
        )}

        <Button
          variant="outline"
          onClick={() => router.push("/")}
          className={status === "PENDING" ? "" : "flex-1"}
        >
          ← Back to Products
        </Button>
      </CardFooter>
    </Card>
  );
}