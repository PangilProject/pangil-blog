-- CreateTable
CREATE TABLE "Nit" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "Nit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Nit_doneAt_createdAt_idx" ON "Nit"("doneAt", "createdAt");

-- 검색 인덱스 유지 (05 §4A).
--
-- migrate dev는 이 마이그레이션에 `DROP INDEX "Post_searchText_trgm_idx"`를 넣는다. 그 인덱스는
-- 스키마로 표현할 수 없어 raw migration으로 만든 것이고(20260820130941), Prisma는 스키마에 없는
-- 인덱스를 drift로 보고 지운다 — ADR-002 수용 #4가 예고한 그 지점이다.
--
-- 그래서 DROP을 지우고 멱등한 재생성을 남긴다. **앞으로 스키마를 바꿀 때마다 같은 DROP이
-- 생기므로 매번 지워야 한다.** 놓치면 검색이 고장나지 않고 조용히 순차 스캔으로 떨어진다 —
-- 아무도 모르는 종류의 회귀다.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Post_searchText_trgm_idx"
  ON "Post" USING gin ("searchText" gin_trgm_ops);
