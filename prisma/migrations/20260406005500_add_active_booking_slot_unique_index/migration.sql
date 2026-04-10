-- Enforce at most one active booking per time slot and date.
-- Active bookings are PENDING / CONFIRMED / COMPLETED; CANCELLED bookings do not occupy the slot.
DROP INDEX IF EXISTS "public"."appointments_timeSlotId_appointmentDate_active_key";

CREATE UNIQUE INDEX "appointments_timeSlotId_appointmentDate_active_key"
ON "public"."appointments"("timeSlotId", "appointmentDate")
WHERE "status" IN ('PENDING', 'CONFIRMED', 'COMPLETED');
