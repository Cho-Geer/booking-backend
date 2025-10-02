-- AlterTable
ALTER TABLE "public"."appointments" ADD COLUMN     "serviceId" UUID;

-- CreateTable
CREATE TABLE "public"."service_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "icon_url" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."services" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "price" DOUBLE PRECISION,
    "image_url" VARCHAR(255) NOT NULL,
    "category_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_name_key" ON "public"."service_categories"("name");

-- CreateIndex
CREATE INDEX "service_categories_is_active_idx" ON "public"."service_categories"("is_active");

-- CreateIndex
CREATE INDEX "service_categories_display_order_idx" ON "public"."service_categories"("display_order");

-- CreateIndex
CREATE INDEX "services_is_active_idx" ON "public"."services"("is_active");

-- CreateIndex
CREATE INDEX "services_category_id_idx" ON "public"."services"("category_id");

-- CreateIndex
CREATE INDEX "services_display_order_idx" ON "public"."services"("display_order");

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
