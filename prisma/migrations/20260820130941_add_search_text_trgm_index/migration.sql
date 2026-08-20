-- 검색(05 §4A): pg_trgm 트라이그램 GIN 인덱스.
-- Prisma 스키마로 표현할 수 없어 raw migration으로 둔다(구조 변경 아님).
-- 한국어는 Postgres 기본 FTS가 약해 부분 매칭이 안 되므로 3-gram 유사도 검색을 GIN으로 가속한다.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Post_searchText_trgm_idx"
  ON "Post" USING gin ("searchText" gin_trgm_ops);
