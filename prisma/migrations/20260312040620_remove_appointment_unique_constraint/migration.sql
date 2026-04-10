-- DropIndex
DROP INDEX "public"."appointments_timeSlotId_appointmentDate_key";

-- CreateIndex
CREATE INDEX "appointments_timeSlotId_appointmentDate_idx" ON "public"."appointments"("timeSlotId", "appointmentDate");
