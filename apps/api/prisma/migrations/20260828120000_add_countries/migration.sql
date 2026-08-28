CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameFa" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "dialCode" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "minLength" INTEGER NOT NULL DEFAULT 4,
    "maxLength" INTEGER NOT NULL DEFAULT 15,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");
CREATE INDEX "Country_active_order_idx" ON "Country"("active", "order");
CREATE INDEX "Country_dialCode_idx" ON "Country"("dialCode");
