-- Additive translation storage; no existing bilingual content is changed.
CREATE TABLE "LocalizedContent" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LocalizedContent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LocalizedContent_entityType_entityId_field_locale_key" ON "LocalizedContent"("entityType", "entityId", "field", "locale");
CREATE INDEX "LocalizedContent_entityType_entityId_idx" ON "LocalizedContent"("entityType", "entityId");
CREATE INDEX "LocalizedContent_locale_idx" ON "LocalizedContent"("locale");
