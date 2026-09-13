ALTER TABLE "TestDefinition"
ADD COLUMN "isPlacement" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PlacementResult"
ADD COLUMN "sectionScores" JSONB,
ADD COLUMN "borderline" BOOLEAN NOT NULL DEFAULT false;
