-- CreateEnum
CREATE TYPE "public"."UserType" AS ENUM ('ADMIN', 'USER', 'GUEST');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "public"."AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('SMS', 'EMAIL', 'WECHAT', 'PUSH');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."SettingType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "public"."SettingCategory" AS ENUM ('GENERAL', 'SECURITY', 'BUSINESS', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."AppointmentAction" AS ENUM ('CREATE', 'UPDATE', 'CONFIRM', 'CANCEL', 'COMPLETE');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "phone_hash" VARCHAR(64) NOT NULL,
    "email" VARCHAR(255),
    "wechat" VARCHAR(100),
    "verification_code" VARCHAR(6),
    "code_expires_at" TIMESTAMP(3),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "user_type" "public"."UserType" NOT NULL DEFAULT 'USER',
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "login_count" INTEGER NOT NULL DEFAULT 0,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_token" VARCHAR(255) NOT NULL,
    "refresh_token" VARCHAR(255),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_expires_at" TIMESTAMP(3),
    "ip_address" INET,
    "user_agent" TEXT,
    "device_info" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."time_slots" (
    "id" UUID NOT NULL,
    "slotTime" VARCHAR(8) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."appointments" (
    "id" UUID NOT NULL,
    "appointmentNumber" VARCHAR(20) NOT NULL,
    "userId" UUID,
    "appointmentDate" DATE NOT NULL,
    "timeSlotId" UUID NOT NULL,
    "status" "public"."AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "customerName" VARCHAR(100) NOT NULL,
    "customerPhone" VARCHAR(20) NOT NULL,
    "customerEmail" VARCHAR(255),
    "customerWechat" VARCHAR(100),
    "notes" TEXT,
    "ipAddress" INET,
    "userAgent" TEXT,
    "confirmationSent" BOOLEAN NOT NULL DEFAULT false,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."appointment_history" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "previous_status" VARCHAR(20),
    "new_status" VARCHAR(20),
    "changed_by" UUID,
    "change_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_settings" (
    "id" UUID NOT NULL,
    "setting_key" VARCHAR(100) NOT NULL,
    "setting_value" TEXT,
    "setting_type" "public"."SettingType" NOT NULL DEFAULT 'STRING',
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "category" "public"."SettingCategory" NOT NULL DEFAULT 'GENERAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."blocked_time_slots" (
    "id" UUID NOT NULL,
    "blocked_date" DATE NOT NULL,
    "time_slot_id" UUID,
    "reason" TEXT,
    "blocked_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "blocked_time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "appointment_id" UUID,
    "type" "public"."NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "scheduled_for" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."activity_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(50),
    "resource_id" UUID,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_logs" (
    "id" UUID NOT NULL,
    "level" VARCHAR(20) NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "user_id" UUID,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."appointment_statistics" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "confirmed_count" INTEGER NOT NULL DEFAULT 0,
    "cancelled_count" INTEGER NOT NULL DEFAULT 0,
    "completed_count" INTEGER NOT NULL DEFAULT 0,
    "no_show_count" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "public"."users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_hash_key" ON "public"."users"("phone_hash");

-- CreateIndex
CREATE INDEX "users_phone_hash_idx" ON "public"."users"("phone_hash");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "public"."users"("status");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "public"."users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_session_token_key" ON "public"."user_sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_key" ON "public"."user_sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "public"."user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_session_token_idx" ON "public"."user_sessions"("session_token");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "public"."user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "time_slots_isActive_idx" ON "public"."time_slots"("isActive");

-- CreateIndex
CREATE INDEX "time_slots_displayOrder_idx" ON "public"."time_slots"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "time_slots_slotTime_key" ON "public"."time_slots"("slotTime");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_appointmentNumber_key" ON "public"."appointments"("appointmentNumber");

-- CreateIndex
CREATE INDEX "appointments_userId_idx" ON "public"."appointments"("userId");

-- CreateIndex
CREATE INDEX "appointments_appointmentDate_idx" ON "public"."appointments"("appointmentDate");

-- CreateIndex
CREATE INDEX "appointments_timeSlotId_idx" ON "public"."appointments"("timeSlotId");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "public"."appointments"("status");

-- CreateIndex
CREATE INDEX "appointments_appointmentNumber_idx" ON "public"."appointments"("appointmentNumber");

-- CreateIndex
CREATE INDEX "appointment_history_appointment_id_idx" ON "public"."appointment_history"("appointment_id");

-- CreateIndex
CREATE INDEX "appointment_history_created_at_idx" ON "public"."appointment_history"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_setting_key_key" ON "public"."system_settings"("setting_key");

-- CreateIndex
CREATE INDEX "blocked_time_slots_blocked_date_idx" ON "public"."blocked_time_slots"("blocked_date");

-- CreateIndex
CREATE INDEX "blocked_time_slots_is_active_idx" ON "public"."blocked_time_slots"("is_active");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "public"."notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_appointment_id_idx" ON "public"."notifications"("appointment_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "public"."notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "public"."notifications"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "public"."activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "public"."activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_resource_type_resource_id_idx" ON "public"."activity_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "system_logs_level_idx" ON "public"."system_logs"("level");

-- CreateIndex
CREATE INDEX "system_logs_created_at_idx" ON "public"."system_logs"("created_at");

-- CreateIndex
CREATE INDEX "system_logs_user_id_idx" ON "public"."system_logs"("user_id");

-- CreateIndex
CREATE INDEX "appointment_statistics_date_idx" ON "public"."appointment_statistics"("date");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_statistics_date_key" ON "public"."appointment_statistics"("date");

-- AddForeignKey
ALTER TABLE "public"."user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "public"."time_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointment_history" ADD CONSTRAINT "appointment_history_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointment_history" ADD CONSTRAINT "appointment_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."blocked_time_slots" ADD CONSTRAINT "blocked_time_slots_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."blocked_time_slots" ADD CONSTRAINT "blocked_time_slots_blocked_by_fkey" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."system_logs" ADD CONSTRAINT "system_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
