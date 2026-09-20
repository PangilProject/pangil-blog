import { prisma } from "@/lib/db/prisma";
import { publicImageUrl } from "@/lib/storage/images";

/**
 * 006 · 이미 올라간 이미지에 캐시 헤더를 다시 입힌다 (Egress).
 *
 *   npm run content:recache-images                    # 리포트만 (기본)
 *   npm run content:recache-images -- --apply         # 실제 재업로드
 *   npm run content:recache-images -- --apply --limit 5             # 몇 개만 시험
 *   npm run content:recache-images -- --apply --skip 900 --limit 900  # 이어서 돌리기
 *
 *   DATABASE_URL='…' NEXT_PUBLIC_SUPABASE_URL='…' SUPABASE_SERVICE_ROLE_KEY='…' \
 *     npm run content:recache-images -- --apply
 *
 * 그 값을 `.env`에 적어 두지 않는다. **`붙은 곳` 줄을 먼저 읽는다.**
 *
 * 배경: Supabase Storage의 기본 `cache-control`은 **`no-cache`**다. 그 값이면 CDN도 브라우저도
 * 아무것도 쥐고 있지 않아 **글을 열 때마다 원본이 다시 나간다.** Vercel 최적화기가 앞에서
 * 받아 주는 동안에는 가려져 있었는데, 그걸 끄자(`next.config.ts`, 402 사고) 하루 만에
 * Egress가 5GB 한도를 넘었다(106%).
 *
 * 새로 올라오는 그림은 이제 헤더를 달고 간다(`lib/storage/images`). 이 스크립트는 그 전에
 * 올라간 것들 몫이다.
 *
 * ## 무엇을 바꾸고 무엇을 안 바꾸는가
 *
 * **경로도 내용도 바꾸지 않는다.** 같은 경로에 같은 바이트를 헤더만 달아 다시 올린다
 * (`x-upsert: true`). 그래서 **본문을 건드릴 일이 없고**, 도중에 멈춰도 깨지는 것이 없다 —
 * 헤더가 아직 안 붙은 파일이 남을 뿐이고, 그건 지금과 같은 상태다.
 *
 * **내려받는 만큼 Egress를 쓴다.** 리포트가 그 양을 먼저 찍는다(prod는 webp로 바꾼 뒤라
 * 약 131MB, dev는 아직 원본이라 그보다 훨씬 크다). 한도에 여유가 있을 때 돌린다 —
 * 한도를 넘긴 주기에 이걸 돌리면 문제를 더 키운다.
 *
 * ## 멱등하지 **않다** — 그렇게 만들 방법이 없었다
 *
 * "이미 헤더가 붙었는가"를 싸게 물어볼 길이 없다. **Supabase는 `HEAD`에도 `Range` 응답에도
 * 저장된 `cache-control`을 싣지 않고 언제나 `no-cache`를 준다** — 실제 값은 온전한 `GET`의
 * 응답에만 온다. 그걸로 확인하면 확인하는 데만 파일 전체를 내려받게 되어, 건너뛰어 아끼려던
 * Egress를 검사가 그대로 써 버린다.
 *
 * 그래서 다시 돌리면 **처음부터 다시 올린다.** 깨지지는 않지만(같은 바이트를 같은 자리에)
 * Egress를 또 쓴다. 중간에 끊겼으면 `--skip`으로 멈춘 자리부터 이어라 — 순서는
 * `createdAt` 오름차순으로 고정이다.
 *
 * 스키마도 DB도 건드리지 않는다. 읽기만 한다(`Asset.storagePath`).
 */

const APPLY = process.argv.includes("--apply");
const LIMIT = numberArg("--limit", Number.POSITIVE_INFINITY);
const SKIP = numberArg("--skip", 0);

function numberArg(flag: string, fallback: number): number {
  const at = process.argv.indexOf(flag);
  if (at === -1) return fallback;
  const value = Number(process.argv[at + 1]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

/** `lib/storage/images`와 같은 값이어야 한다 — 새 업로드와 옛 파일이 달리 캐시될 이유가 없다 */
const IMMUTABLE = "public, max-age=31536000, immutable";

function connectionLabel(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return "(DATABASE_URL 없음)";

  try {
    const url = new URL(raw);
    return `${url.username}@${url.hostname}${url.pathname}`;
  } catch {
    return "(읽을 수 없는 DATABASE_URL)";
  }
}

function storageEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음");
  return { url, key };
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

async function main() {
  const { url: storageUrl, key } = storageEnv();

  const assets = await prisma.asset.findMany({
    select: { storagePath: true, mimeType: true, bytes: true },
    orderBy: { createdAt: "asc" },
  });

  const totalBytes = assets.reduce((sum, a) => sum + (a.bytes ?? 0), 0);

  console.log(`붙은 곳        ${connectionLabel()}`);
  console.log(`저장소         ${new URL(storageUrl).hostname}`);
  console.log(`파일           ${assets.length}개 · ${mb(totalBytes)}`);
  console.log(`입힐 헤더      ${IMMUTABLE}`);
  if (SKIP > 0) console.log(`건너뛸 것     앞에서 ${SKIP}개`);
  if (LIMIT !== Number.POSITIVE_INFINITY) console.log(`이번에 돌릴 것 ${LIMIT}개까지`);

  if (!APPLY) {
    console.log(`\n리포트만 했다. 실제로 다시 올리려면 --apply 를 붙인다.`);
    console.log(
      `내려받는 만큼 Egress를 쓴다 — 약 ${mb(totalBytes)}. 한도에 여유가 있을 때 돌린다.`,
    );
    return;
  }

  let done = 0;
  const failures: { path: string; reason: string }[] = [];
  const batch = assets.slice(SKIP, SKIP === 0 ? LIMIT : SKIP + LIMIT);

  for (const [index, asset] of batch.entries()) {
    const publicUrl = publicImageUrl(asset.storagePath, storageUrl);

    const response = await fetch(publicUrl);
    if (!response.ok) {
      failures.push({ path: asset.storagePath, reason: `내려받기 ${response.status}` });
      continue;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());

    const put = await fetch(`${storageUrl}/storage/v1/object/${asset.storagePath}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": asset.mimeType,
        "cache-control": IMMUTABLE,
        // 같은 경로에 다시 올리는 것이 이 스크립트의 전부다
        "x-upsert": "true",
      },
      body: bytes,
    });

    if (!put.ok) {
      failures.push({ path: asset.storagePath, reason: `올리기 ${put.status}` });
      continue;
    }

    done += 1;
    // 끊겼을 때 어디서 이어야 하는지 알 수 있게, 센 자리를 주기적으로 찍는다
    if ((index + 1) % 100 === 0) process.stdout.write(` ${SKIP + index + 1} `);
    else if ((index + 1) % 10 === 0) process.stdout.write(".");
  }

  console.log(`\n\n다시 올린 것  ${done}개`);
  console.log(`실패          ${failures.length}개`);
  for (const f of failures.slice(0, 10)) console.log(`  ⚠ ${f.path} — ${f.reason}`);
  if (failures.length > 10) console.log(`  … 그리고 ${failures.length - 10}개 더`);

  console.log("\n배포도 무효화도 필요 없다 — 주소가 그대로이고 바뀐 것은 응답 헤더뿐이다.");
  if (SKIP + batch.length < assets.length) {
    console.log(
      `아직 ${assets.length - SKIP - batch.length}개 남았다 — \`--skip ${SKIP + batch.length}\`로 이어라.`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
