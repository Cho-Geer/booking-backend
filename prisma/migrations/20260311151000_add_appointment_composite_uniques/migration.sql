ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_userId_appointmentDate_timeSlotId_key"
UNIQUE ("userId", "appointmentDate", "timeSlotId");

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_serviceId_appointmentDate_timeSlotId_key"
UNIQUE ("serviceId", "appointmentDate", "timeSlotId");
