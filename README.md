🛒 Allo Inventory — Reservation System

A Next.js application implementing an inventory reservation system for multi-warehouse retail. When a customer enters checkout, units are temporarily held for 10 minutes. If payment succeeds, the reservation is confirmed and stock is permanently decremented. If payment fails or the timer expires, the hold is released.

🌐 Live Demo

https://allo-inventory.vercel.app

⚙️ Tech Stack
•Next.js 15 (App Router, TypeScript)
•Prisma + Neon (Hosted PostgreSQL)
•Upstash Redis (Distributed locking & Idempotency)
•shadcn/ui + Tailwind CSS (UI components)
•Zod (Validation schemas)
•Vercel (Hosting & Cron jobs)

🚀 How to Run Locally
Prerequisites
•Node.js 18+
•A Neon / Supabase / Railway Postgres instance
•An Upstash Redis instance

Steps
1.Clone the repo:
git clone https://github.com/YOUR_USERNAME/allo-inventory.gitcd allo-inventory

2.Install dependencies:
npm install

3.Set up environment variables:
cp .env.example .env
•Fill in DATABASE_URL, DIRECT_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, and CRON_SECRET in the .env file.

4.Run migrations:
npx prisma migrate dev

5.Seed the database:
npm run db:seed

6.Start the dev server:
npm run dev

Visit http://localhost:3000

⏳ Reservation Expiry Mechanism
Three layers ensure expired reservations are always cleaned up:

•Vercel Cron Job (Primary):
Runs every minute via /api/cron/release-expired. Finds all PENDING reservations where expiresAt < now() and releases them using a transaction with SELECT FOR UPDATE to prevent race conditions with concurrent confirmations.
•Lazy Cleanup on Read (Backup):
The GET /api/reservations/:id endpoint checks if a reservation is PENDING and expired when fetched. If so, it releases it inline within a locked transaction. This ensures users see the correct state even if the cron hasn't run yet.
•Client-side Timer (UX):
The reservation page shows a live countdown. When it hits zero, the UI immediately shows "EXPIRED" without waiting for a server round-trip. The actual database release happens via the cron or lazy cleanup.


🔒 Concurrency Safety
The core reserve endpoint is designed to be race-condition-free using a defense-in-depth approach:

•Redis Distributed Lock:
Before touching the database, we acquire a Redis lock on stock:{productId}:{warehouseId} using SET NX PX. This prevents thundering-herd scenarios and provides fast-fail (429) under high contention.
•PostgreSQL SELECT FOR UPDATE:
Inside the transaction, we lock the Stock row with SELECT ... FOR UPDATE. This serializes concurrent transactions at the database level — the second transaction waits until the first commits. This is the ground truth for correctness.
•Atomic Transaction:
The check-and-update happens within a single Prisma interactive transaction. If the available stock is insufficient, we throw an error that rolls back the entire transaction.

🔑 Idempotency (Bonus)
The POST /api/reservations and POST /api/reservations/:id/confirm endpoints support idempotency via the Idempotency-Key header.

How it works:

•On receiving a request with Idempotency-Key, we check Redis for a stored response under idempotency:{key}.
•If found, we return the stored status/body immediately without executing any side effects.
•If not found, we process the request normally, then store the response in Redis with a 1-hour TTL.
•This handles network retries safely — if a client times out and retries with the same key, it gets the original response.

Trade-off: There's a narrow race window between the check and store. A production implementation would use a two-phase approach (acquire lock, check, process, store, release) but for this exercise, the simpler approach is sufficient.

