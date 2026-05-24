# 🛒 Allo Inventory — Reservation System

A modern inventory reservation system built for multi-warehouse retail using Next.js, Prisma, PostgreSQL, and Redis.

When a customer enters checkout, inventory units are temporarily reserved for **10 minutes**. If payment succeeds, the reservation is confirmed and stock is permanently decremented. If payment fails or the reservation expires, the held stock is automatically released.

---

# 🌐 Live Demo

🔗 https://allo-inventory.vercel.app

---

# ⚙️ Tech Stack

| Technology | Purpose |
|---|---|
| Next.js 15 | Frontend & API routes |
| TypeScript | Type safety |
| Prisma + PostgreSQL | Database & ORM |
| Upstash Redis | Distributed locking & idempotency |
| Tailwind CSS + shadcn/ui | UI components |
| Zod | Request validation |
| Vercel | Hosting & cron jobs |

---

# ✨ Features

- ✅ Multi-warehouse inventory management
- ✅ Temporary stock reservation system
- ✅ Automatic reservation expiry handling
- ✅ Distributed locking with Redis
- ✅ Database-level concurrency protection
- ✅ Idempotent APIs for safe retries
- ✅ Real-time reservation countdown UI
- ✅ Race-condition-safe stock updates
- ✅ Atomic transactional operations

---

# 🚀 Getting Started

## Prerequisites

Make sure you have:

- Node.js 18+
- A PostgreSQL database instance  
  (Recommended: Neon / Supabase / Railway)
- An Upstash Redis instance

---

# 📦 Installation

## 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/allo-inventory.git
cd allo-inventory
```

---

## 2. Install dependencies

```bash
npm install
```

---

## 3. Configure environment variables

Create a `.env` file:

```bash
cp .env.example .env
```

Fill in the following variables:

```env
DATABASE_URL=
DIRECT_URL=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

CRON_SECRET=
```

---

## 4. Run database migrations

```bash
npx prisma migrate dev
```

---

## 5. Seed the database

```bash
npm run db:seed
```

---

## 6. Start the development server

```bash
npm run dev
```

Visit:

```txt
http://localhost:3000
```

---

# ⏳ Reservation Expiry Mechanism

The system uses a **3-layer cleanup strategy** to guarantee expired reservations are released safely.

## 1. Vercel Cron Job (Primary)

A cron job runs every minute via:

```txt
/api/cron/release-expired
```

It:

- Finds all `PENDING` reservations where `expiresAt < now()`
- Releases stock inside a database transaction
- Uses `SELECT FOR UPDATE` to prevent race conditions with concurrent confirmations

---

## 2. Lazy Cleanup on Read (Backup)

Endpoint:

```txt
GET /api/reservations/:id
```

When fetching a reservation:

- If the reservation is expired and still `PENDING`
- The API releases it inline inside a locked transaction

This guarantees users always see the correct reservation state even if the cron job hasn't executed yet.

---

## 3. Client-side Timer (UX Layer)

The reservation page displays a live countdown timer.

When the timer reaches zero:

- The UI immediately updates the reservation state to `EXPIRED`
- No server round-trip is required for the visual update

The actual database release still happens through:
- Cron cleanup
- Lazy cleanup

---

# 🔒 Concurrency & Race Condition Safety

The reservation system uses a **defense-in-depth concurrency model**.

## Redis Distributed Lock

Before modifying stock:

```txt
stock:{productId}:{warehouseId}
```

A Redis lock is acquired using:

```txt
SET NX PX
```

Benefits:

- Prevents thundering-herd scenarios
- Fast-fail behavior under high contention
- Returns `429` when lock acquisition fails

---

## PostgreSQL Row Locking

Inside the transaction:

```sql
SELECT ... FOR UPDATE
```

is used to lock the stock row.

This ensures:

- Concurrent transactions are serialized
- Only one reservation can modify stock at a time
- Database consistency is preserved

---

## Atomic Database Transaction

The reserve flow executes within a single Prisma interactive transaction.

The sequence:

1. Lock stock row
2. Validate available quantity
3. Decrement available stock
4. Create reservation

If any step fails:

- The entire transaction rolls back automatically

---

# 🔑 Idempotency Support

The following endpoints support idempotency:

```txt
POST /api/reservations
POST /api/reservations/:id/confirm
```

Using the header:

```txt
Idempotency-Key
```

---

## How It Works

### Step 1 — Check Redis

The API checks Redis for:

```txt
idempotency:{key}
```

If found:

- The stored response is returned immediately
- No side effects are executed again

---

### Step 2 — Process Request

If the key does not exist:

- The request is processed normally
- Reservation/confirmation logic executes

---

### Step 3 — Cache Response

The response is stored in Redis with:

- Status code
- Response body
- 1-hour TTL

---

## Why This Matters

This protects against:

- Client retries
- Network timeouts
- Duplicate payments
- Duplicate reservations

If a client retries using the same key, it safely receives the original response.

---

## Trade-off

This implementation intentionally keeps the idempotency logic lightweight.

There is a small race window between:

1. Checking Redis
2. Storing the response

A production-grade implementation would use:

- Two-phase locking
- Request state tracking
- Atomic lock + store workflow

For this project scope, the simpler implementation is sufficient and practical.

---


# 🧪 Future Improvements

- WebSocket-based real-time inventory updates
- Reservation analytics dashboard
- Multi-region Redis failover
- Dead-letter queue for failed cleanup jobs
- Optimistic UI updates
- Payment gateway integration
- Inventory event sourcing

