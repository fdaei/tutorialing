CREATE TABLE "PlacementResult" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "testId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "level" TEXT NOT NULL,
  "correctAnswers" INTEGER NOT NULL,
  "totalQuestions" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlacementResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlacementResult_userId_completedAt_idx" ON "PlacementResult"("userId", "completedAt");
CREATE INDEX "PlacementResult_testId_completedAt_idx" ON "PlacementResult"("testId", "completedAt");
ALTER TABLE "PlacementResult" ADD CONSTRAINT "PlacementResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlacementResult" ADD CONSTRAINT "PlacementResult_testId_fkey" FOREIGN KEY ("testId") REFERENCES "TestDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
