-- CreateTable
CREATE TABLE "static_operator_mappings" (
    "id" UUID NOT NULL,
    "salesforce_user_id" VARCHAR(64) NOT NULL,
    "booking_user_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "static_operator_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "static_operator_mappings_salesforce_user_id_key" ON "static_operator_mappings"("salesforce_user_id");

-- CreateIndex
CREATE INDEX "static_operator_mappings_booking_user_id_idx" ON "static_operator_mappings"("booking_user_id");

-- AddForeignKey
ALTER TABLE "static_operator_mappings" ADD CONSTRAINT "static_operator_mappings_booking_user_id_fkey" FOREIGN KEY ("booking_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
