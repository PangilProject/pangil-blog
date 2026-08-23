import { execFileSync } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";

import { seedCategories } from "../prisma/categories.mts";
import { PrismaClient } from "../prisma/generated/client.ts";

/**
 * 배포 시 스키마 반영 (08 §2 "배포 시 prod에 prisma migrate deploy").
 *
 * 빌드 안에서 돈다. 별도 파이프라인을 두지 않는 이유는 스키마와 코드가 한 커밋에 있기 때문이다 —
 * 마이그레이션이 실패하면 그 코드는 배포되지 않아야 한다.
 *
 * **production에서만 돈다.** 프리뷰 배포가 prod DB의 스키마를 바꾸면 그게 사고다.
 * 로컬 빌드에서도 아무것도 하지 않는다(dev DB는 `prisma migrate dev`가 담당, 08 §2).
 *
 * 카테고리는 **비어 있을 때만** 넣는다(부트스트랩). 배포마다 upsert하면 나중에 설정 화면에서
 * 바꾼 이름이 되돌아간다.
 */
const vercelEnv = process.env.VERCEL_ENV;

if (!vercelEnv) {
  console.warn("[deploy] 로컬 빌드 — 마이그레이션을 건너뜁니다.");
  process.exit(0);
}

if (vercelEnv !== "production") {
  console.warn(`[deploy] ${vercelEnv} 배포 — 마이그레이션을 건너뜁니다.`);
  process.exit(0);
}

// 여기서부터는 production이다. 값이 없으면 조용히 넘기지 않는다 — 스키마 드리프트가 남는다
for (const key of ["DIRECT_URL", "DATABASE_URL"]) {
  if (!process.env[key]) {
    throw new Error(`[deploy] production 배포에 ${key}가 없습니다 (Vercel 환경변수 확인).`);
  }
}

console.warn("[deploy] prisma migrate deploy");
execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
});

try {
  const result = await seedCategories(prisma, { onlyIfEmpty: true });
  console.warn(
    result.skipped
      ? "[deploy] 카테고리가 이미 있어 시드를 건너뜁니다."
      : `[deploy] 카테고리 부트스트랩: ${result.upserted}건`,
  );
} finally {
  await prisma.$disconnect();
}
