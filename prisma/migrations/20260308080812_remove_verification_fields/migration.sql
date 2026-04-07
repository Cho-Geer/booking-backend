/*
  Warnings:

  - You are about to drop the column `code_expires_at` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `verification_code` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."users" DROP COLUMN "code_expires_at",
DROP COLUMN "verification_code";
