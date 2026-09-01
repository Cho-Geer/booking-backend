-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "syncStatus" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "integration_commands" (
    "id" UUID NOT NULL,
    "command_id" VARCHAR(64) NOT NULL,
    "command_type" VARCHAR(32) NOT NULL,
    "appointment_id" UUID,
    "http_status" INTEGER NOT NULL,
    "result_code" VARCHAR(32) NOT NULL,
    "canonical_version" INTEGER NOT NULL,
    "correlation_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_commands_command_id_key" ON "integration_commands"("command_id");

-- CreateIndex
CREATE INDEX "integration_commands_appointment_id_idx" ON "integration_commands"("appointment_id");

-- AddForeignKey
ALTER TABLE "integration_commands" ADD CONSTRAINT "integration_commands_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
