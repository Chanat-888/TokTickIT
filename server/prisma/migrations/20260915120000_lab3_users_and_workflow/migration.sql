-- Lab 3: Users, roles, sessions, IT Staff workflow, comments/notes.
--
-- Hand-written (not the raw `prisma migrate diff` output) to rename
-- RequesterUser -> User instead of dropping and recreating it, per
-- docs/lab-03/specification.md §7 "Migration plan". A Postgres table
-- rename preserves row ids and automatically repoints every foreign key
-- that references it (Ticket_requesterId_fkey keeps its name and target
-- with zero changes needed), so existing Ticket ownership survives with
-- no data rewriting. Indexes/constraints owned by the renamed table
-- itself (its own pkey/unique index/sequence) are explicitly renamed
-- below to match what a fresh `prisma migrate diff` would name them, so
-- later migrations don't see spurious drift.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

-- AlterEnum: one ADD VALUE per statement (required on Postgres < 12; kept
-- one-per-statement here for portability even though this project runs
-- Postgres 17). None of these new values are referenced later in this
-- same migration.
ALTER TYPE "TicketStatus" ADD VALUE 'OPEN';
ALTER TYPE "TicketStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE 'RESOLVED';
ALTER TYPE "TicketStatus" ADD VALUE 'CLOSED';
ALTER TYPE "TicketStatus" ADD VALUE 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE 'CANCELLED';

-- RenameTable: RequesterUser -> User (preserves ids; Ticket_requesterId_fkey
-- keeps its name and now points at "User" automatically).
ALTER TABLE "RequesterUser" RENAME TO "User";
ALTER TABLE "User" RENAME CONSTRAINT "RequesterUser_pkey" TO "User_pkey";
ALTER INDEX "RequesterUser_email_key" RENAME TO "User_email_key";
ALTER SEQUENCE "RequesterUser_id_seq" RENAME TO "User_id_seq";

-- AlterTable: add Lab 3 User columns. passwordHash/updatedAt start
-- nullable so every migrated Lab 2 Requester can be backfilled below,
-- then both are made NOT NULL once every row has a value.
ALTER TABLE "User"
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "role" "Role" NOT NULL DEFAULT 'REQUESTER',
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Backfill every migrated Lab 2 Requester with the documented local-dev
-- seed password "ChangeMe123!" (bcrypt, cost 12 — see README and
-- prisma/seed.ts; not a real secret, specification.md §11.9).
-- role stays REQUESTER (the column default), matching every migrated row.
UPDATE "User"
SET "passwordHash" = '$2b$12$yE2PZvXJeJrRkZ6EnSdDde.pteY1tudqo9weYoXm7YtG5ADoiYCjy',
    "updatedAt" = "createdAt"
WHERE "passwordHash" IS NULL;

ALTER TABLE "User"
  ALTER COLUMN "passwordHash" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable: Ticket gains ownerId/requesterIndicatedResolvedAt (both
-- correctly nullable for existing rows) and itPriority, which needs a
-- backfill before it can be made NOT NULL.
ALTER TABLE "Ticket"
  ADD COLUMN "itPriority" "Priority",
  ADD COLUMN "ownerId" INTEGER,
  ADD COLUMN "requesterIndicatedResolvedAt" TIMESTAMP(3);

-- Every existing Lab 2 Ticket starts IT Priority equal to its Requested
-- Priority (specification.md BR-17).
UPDATE "Ticket" SET "itPriority" = "requestedPriority" WHERE "itPriority" IS NULL;

ALTER TABLE "Ticket" ALTER COLUMN "itPriority" SET NOT NULL;

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicComment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "PublicComment_ticketId_idx" ON "PublicComment"("ticketId");

-- CreateIndex
CREATE INDEX "InternalNote_ticketId_idx" ON "InternalNote"("ticketId");

-- CreateIndex
CREATE INDEX "Ticket_ownerId_idx" ON "Ticket"("ownerId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
