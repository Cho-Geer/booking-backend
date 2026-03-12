/*
  Warnings:

  - A unique constraint covering the columns `[timeSlotId,appointmentDate]` on the table `appointments` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
ALTER TABLE "public"."appointments" DROP CONSTRAINT IF EXISTS "appointments_serviceId_appointmentDate_timeSlotId_key";
DROP INDEX IF EXISTS "public"."appointments_serviceId_appointmentDate_timeSlotId_key";

-- DropIndex
ALTER TABLE "public"."appointments" DROP CONSTRAINT IF EXISTS "appointments_userId_appointmentDate_timeSlotId_key";
DROP INDEX IF EXISTS "public"."appointments_userId_appointmentDate_timeSlotId_key";

-- CreateIndex
CREATE UNIQUE INDEX "appointments_timeSlotId_appointmentDate_key" ON "public"."appointments"("timeSlotId", "appointmentDate");
