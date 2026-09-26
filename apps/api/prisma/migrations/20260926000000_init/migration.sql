-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('QUOTE_GENERATED', 'MEDICAL_DECLARED', 'PREMIUM_PAID', 'POLICY_ISSUED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "age" INTEGER NOT NULL,
    "has_pre_existing_conditions" BOOLEAN NOT NULL,
    "base_premium" DECIMAL(10,2) NOT NULL,
    "age_loading" DECIMAL(10,2) NOT NULL,
    "condition_loading" DECIMAL(10,2) NOT NULL,
    "total_premium" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "status" "QuoteStatus" NOT NULL DEFAULT 'QUOTE_GENERATED',
    "medical_declaration" JSONB,
    "declared_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "policy_number" TEXT NOT NULL,
    "premium_paid" DECIMAL(10,2) NOT NULL,
    "payment_reference" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "response_status" INTEGER,
    "response_body" JSONB,
    "locked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "quotes_status_expires_at_idx" ON "quotes"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "policies_quote_id_key" ON "policies"("quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "policies_policy_number_key" ON "policies"("policy_number");

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Business invariants enforced by the database
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_age_range" CHECK ("age" BETWEEN 18 AND 99);
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_total_matches" CHECK ("total_premium" = "base_premium" + "age_loading" + "condition_loading");
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_expiry_after_creation" CHECK ("expires_at" > "created_at");
ALTER TABLE "policies" ADD CONSTRAINT "policies_premium_positive" CHECK ("premium_paid" > 0);
