/*
  Warnings:

  - The values [NO_SHOW] on the enum `AppointmentStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [SUSPENDED,PENDING] on the enum `UserStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [USER,GUEST] on the enum `UserType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `cancelled_count` on the `appointment_statistics` table. All the data in the column will be lost.
  - You are about to drop the column `completed_count` on the `appointment_statistics` table. All the data in the column will be lost.
  - You are about to drop the column `confirmed_count` on the `appointment_statistics` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `appointment_statistics` table. All the data in the column will be lost.
  - You are about to drop the column `total_count` on the `appointment_statistics` table. All the data in the column will be lost.
  - You are about to drop the column `total_revenue` on the `appointment_statistics` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[statDate]` on the table `appointment_statistics` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `statDate` to the `appointment_statistics` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."AppointmentStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
ALTER TABLE "public"."appointments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."appointments" ALTER COLUMN "status" TYPE "public"."AppointmentStatus_new" USING ("status"::text::"public"."AppointmentStatus_new");
ALTER TYPE "public"."AppointmentStatus" RENAME TO "AppointmentStatus_old";
ALTER TYPE "public"."AppointmentStatus_new" RENAME TO "AppointmentStatus";
DROP TYPE "public"."AppointmentStatus_old";
ALTER TABLE "public"."appointments" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."UserStatus_new" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');
ALTER TABLE "public"."users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."users" ALTER COLUMN "status" TYPE "public"."UserStatus_new" USING ("status"::text::"public"."UserStatus_new");
ALTER TYPE "public"."UserStatus" RENAME TO "UserStatus_old";
ALTER TYPE "public"."UserStatus_new" RENAME TO "UserStatus";
DROP TYPE "public"."UserStatus_old";
ALTER TABLE "public"."users" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."UserType_new" AS ENUM ('CUSTOMER', 'ADMIN');
ALTER TABLE "public"."users" ALTER COLUMN "user_type" DROP DEFAULT;
ALTER TABLE "public"."users" ALTER COLUMN "user_type" TYPE "public"."UserType_new" USING ("user_type"::text::"public"."UserType_new");
ALTER TYPE "public"."UserType" RENAME TO "UserType_old";
ALTER TYPE "public"."UserType_new" RENAME TO "UserType";
DROP TYPE "public"."UserType_old";
ALTER TABLE "public"."users" ALTER COLUMN "user_type" SET DEFAULT 'CUSTOMER';
COMMIT;

-- DropIndex
DROP INDEX "public"."appointment_statistics_date_idx";

-- DropIndex
DROP INDEX "public"."appointment_statistics_date_key";

-- AlterTable
ALTER TABLE "public"."appointment_statistics" DROP COLUMN "cancelled_count",
DROP COLUMN "completed_count",
DROP COLUMN "confirmed_count",
DROP COLUMN "date",
DROP COLUMN "total_count",
DROP COLUMN "total_revenue",
ADD COLUMN     "average_lead_time_hours" DOUBLE PRECISION,
ADD COLUMN     "cancelled_appointments" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "completed_appointments" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "confirmed_appointments" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "newUsers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "peakHour" VARCHAR(5),
ADD COLUMN     "returningUsers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "statDate" DATE NOT NULL,
ADD COLUMN     "total_appointments" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."users" ALTER COLUMN "user_type" SET DEFAULT 'CUSTOMER';

-- CreateIndex
CREATE UNIQUE INDEX "appointment_statistics_statDate_key" ON "public"."appointment_statistics"("statDate");

-- CreateIndex
CREATE INDEX "appointment_statistics_statDate_idx" ON "public"."appointment_statistics"("statDate");
