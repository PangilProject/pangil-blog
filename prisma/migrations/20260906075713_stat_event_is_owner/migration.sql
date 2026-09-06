-- 운영자 본인의 방문인가 (05 §4.1).
--
-- 전에는 옵트아웃 쿠키가 있으면 아예 기록하지 않았다. 그러면 내 방문은 흔적이 없어서
-- "본인 포함하면 몇이야"를 나중에 물을 수 없다 — 버리지 않고 표시해 둔다.
ALTER TABLE "StatEvent" ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false;

-- Prisma가 여기에 `DROP INDEX "Post_searchText_trgm_idx"`를 끼워 넣는다. 그 인덱스는
-- 스키마 밖에서 만든 pg_trgm GIN 인덱스라(05 §4A) Prisma가 자기 것이 아니라고 보고 지운다.
-- 지우면 검색이 조용히 느려지므로 **스키마를 고칠 때마다 이 줄을 손으로 뺀다.**
