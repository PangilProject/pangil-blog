import { nanoid } from "nanoid";
import sharp from "sharp";

import { prisma } from "@/lib/db/prisma";
import { publicImageUrl } from "@/lib/storage/images";
import type { Prisma } from "@/prisma/generated/client";
import { collectImageSrcs, rewriteImageSrcs } from "@/scripts/migrate-tistory/imageNodes";

/**
 * 005 · 올라가 있는 PNG·JPEG를 webp로 바꾼다 (04 §3.3 · 저장소 용량).
 *
 *   npm run content:images-webp                    # 리포트만 (기본)
 *   npm run content:images-webp -- --apply         # 실제 변환·업로드·본문 갱신
 *   npm run content:images-webp -- --apply --limit 200   # 나눠 돌리기
 *   npm run content:images-webp -- --sweep         # 아무도 안 가리키는 파일 삭제
 *
 * **로컬 `.env`는 dev를 가리킨다.** 프로덕션에 적용하려면 그때만 값을 넣어 돌린다:
 *
 *   DATABASE_URL='…' NEXT_PUBLIC_SUPABASE_URL='…' SUPABASE_SERVICE_ROLE_KEY='…' \
 *     npm run content:images-webp -- --apply
 *
 * 그 값을 `.env`에 적어 두지 않는다 — 프로덕션 자격증명을 로컬에 남기지 않는 것이 규칙이다.
 * **`붙은 곳` 줄을 먼저 읽는다**: 002에서 dev에 대고 돌려 헛돈 적이 있다(003 주석).
 *
 * 배경: PNG 1753장이 이미지 전체 688MB의 **94%**인 646.9MB를 쓰고 있었다. 사진과 그림을
 * 무손실로 담는 PNG의 성질 탓이지 누가 실수한 게 아니다 — 형식이 용도와 안 맞았다.
 * 무작위 40장으로 재보니 q=90 webp가 **83% 줄인다**(13.0MB → 2.2MB).
 *
 * 새로 올라오는 그림은 이미 webp로 담긴다(`lib/images/transcode`). 이 스크립트는 그 전에
 * 쌓인 것들 몫이다.
 *
 * ## 되돌릴 수 있게 만든 것
 *
 * **옛 파일을 지우지 않는다.** 새 파일을 올리고 본문 주소만 갈아끼우므로, 잘못되면 본문을
 * 되돌리는 것만으로 옛 그림이 그대로 보인다. 지우는 일은 눈으로 확인한 뒤 `--sweep`으로
 * 따로 한다 — 되돌릴 여지를 남기지 않는 일괄 변경은 하지 않는다.
 *
 * **글 하나가 한 단위다.** 한 글의 이미지를 전부 올린 뒤 본문과 `Asset`을 한 트랜잭션으로
 * 바꾼다. 도중에 실패하면 그 글은 **옛 주소 그대로 멀쩡히 남고**, 다시 돌리면 그 글만
 * 다시 시도한다. 반쯤 바뀐 글은 생기지 않는다.
 *
 * 멱등하다. 이미 webp인 것은 세기만 하고 건너뛴다.
 *
 * ## 돌리기 전에
 *
 * **이미지 주소는 본문의 `image` 노드에만 있다.** dev에서 실측했다 — content 안의 storage
 * 주소 1892회가 이미지 노드 src 1892회와 정확히 같았고, `thumbnailUrl`·`excerpt`에는 0편이다.
 * 링크 `href`에 우리 주소가 박힌 글은 없다. prod에서도 같은 수를 먼저 보는 편이 안전하다.
 *
 * **관리 화면의 열린 초안을 닫아 둔다.** 에디터는 content를 localStorage에도 미러한다
 * (`lib/editor/localMirror` — `draft:{type}:{id}`). 바꾼 뒤 그 글을 열어 옛 스냅샷이 복구되면
 * **옛 주소가 되살아난다.**
 *
 * **끝나면 배포한다.** 상세 지면이 통째로 `use cache`라(ADR-003) 캐시된 HTML이 옛 주소를 계속
 * 가리킨다. `updateTag`는 Server Action 전용이라 스크립트에서 못 부른다 — 001·002·003이
 * 모두 같은 문장으로 끝난다.
 *
 * 스키마를 건드리지 않으므로 마이그레이션이 아니다. trgm 인덱스도 그대로다.
 */

const APPLY = process.argv.includes("--apply");
const SWEEP = process.argv.includes("--sweep");
const LIMIT = limitArg();

/** 사진·그림에서 눈에 안 보이는 선 — 업로드 경로와 같은 값을 쓴다(`lib/images/transcode`) */
const QUALITY = 90;

/** 손대지 않는 형식. gif는 움직이고, webp·avif는 이미 줄어 있다 */
const KEEP_AS_IS = new Set(["image/gif", "image/webp", "image/avif"]);

const BUCKET = "post-images";

function limitArg(): number {
  const at = process.argv.indexOf("--limit");
  if (at === -1) return Number.POSITIVE_INFINITY;
  const value = Number(process.argv[at + 1]);
  return Number.isInteger(value) && value > 0 ? value : Number.POSITIVE_INFINITY;
}

/** 붙은 DB를 먼저 말한다 — 002에서 dev에 대고 돌려 헛돈 적이 있다. 비밀번호는 찍지 않는다 */
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

/**
 * 저장소 호스트. **DB와 짝이 맞아야 한다.**
 *
 * 본문에는 절대 URL이 박혀 있다(`https://{프로젝트}.supabase.co/storage/…`). dev DB를 보면서
 * prod 저장소에 올리면 본문이 남의 호스트를 가리키게 된다 — 둘을 함께 찍어 눈으로 맞춘다.
 */
function storageEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음");
  return { url, key };
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

type Convertible = {
  id: string;
  storagePath: string;
  mimeType: string;
  bytes: number | null;
  postId: string;
};

/** 옛 주소 → 새 주소. 본문 치환과 Asset 갱신이 같은 값을 본다 */
type Converted = { asset: Convertible; newPath: string; newBytes: number };

async function downloadAndConvert(
  asset: Convertible,
  baseUrl: string,
): Promise<{ bytes: Buffer; width: number; height: number } | { error: string }> {
  const response = await fetch(publicImageUrl(asset.storagePath, baseUrl));
  if (!response.ok) return { error: `내려받기 ${response.status}` };

  const original = Buffer.from(await response.arrayBuffer());

  try {
    const image = sharp(original);
    const meta = await image.metadata();
    const bytes = await image.webp({ quality: QUALITY, effort: 6 }).toBuffer();

    // 커지면 바꿀 이유가 없다. 이미 눌린 그림이 png 이름을 달고 있을 수 있다
    if (bytes.byteLength >= original.byteLength) return { error: "줄지 않음" };

    return { bytes, width: meta.width ?? 0, height: meta.height ?? 0 };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function upload(path: string, bytes: Buffer): Promise<string | null> {
  const { url, key } = storageEnv();

  const response = await fetch(`${url}/storage/v1/object/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "image/webp",
      "x-upsert": "false",
    },
    body: new Uint8Array(bytes),
  });

  return response.ok ? null : `${response.status} ${(await response.text()).slice(0, 120)}`;
}

/**
 * 아무 Asset도 가리키지 않는 파일을 지운다.
 *
 * **DB가 진실이다.** 변환이 도중에 끊겨 올라가기만 한 파일, 그리고 변환을 마친 뒤 남은 옛
 * 파일이 여기 걸린다. 본문이 가리키는 주소는 전부 `Asset.storagePath`에 있으므로(실측으로
 * 확인했다 — 본문의 1892개 주소와 Asset 1892행이 정확히 일치했다), 그 목록에 없는 파일은
 * 아무 지면에도 안 나온다.
 */
async function sweep() {
  const { url, key } = storageEnv();

  const assets = await prisma.asset.findMany({ select: { storagePath: true, postId: true } });
  const keep = new Set(assets.map((a) => a.storagePath));
  const folders = [...new Set(assets.map((a) => a.postId ?? "orphan"))];

  console.log(`붙은 곳        ${connectionLabel()}`);
  console.log(`저장소         ${new URL(url).hostname}`);
  console.log(`지켜야 할 파일 ${keep.size}개 · 폴더 ${folders.length}개\n`);

  const stale: string[] = [];

  for (const folder of folders) {
    const response = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ prefix: `${folder}/`, limit: 1000 }),
    });

    if (!response.ok) {
      console.log(`  ⚠ ${folder} 목록 실패 ${response.status}`);
      continue;
    }

    for (const row of (await response.json()) as { name: string; id: string | null }[]) {
      // 폴더 자리 표시자는 id가 없다
      if (row.id === null) continue;
      const path = `${BUCKET}/${folder}/${row.name}`;
      if (!keep.has(path)) stale.push(path);
    }
  }

  console.log(`아무도 안 가리키는 파일  ${stale.length}개`);
  for (const path of stale.slice(0, 10)) console.log(`  ${path}`);
  if (stale.length > 10) console.log(`  … 그리고 ${stale.length - 10}개 더`);

  if (stale.length === 0 || !APPLY) {
    console.log(stale.length === 0 ? "\n지울 것이 없다." : "\n리포트만 했다. 지우려면 --apply.");
    return;
  }

  // 한 번에 다 보내면 본문이 너무 커진다. 100개씩 끊는다
  for (let at = 0; at < stale.length; at += 100) {
    const chunk = stale.slice(at, at + 100);
    const response = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ prefixes: chunk.map((path) => path.slice(BUCKET.length + 1)) }),
    });
    if (!response.ok) throw new Error(`삭제 실패 ${response.status} ${await response.text()}`);
    process.stdout.write(".");
  }

  console.log(`\n${stale.length}개를 지웠다.`);
}

async function main() {
  if (SWEEP) return sweep();

  const { url: storageUrl } = storageEnv();

  const assets = await prisma.asset.findMany({
    where: { postId: { not: null } },
    select: { id: true, storagePath: true, mimeType: true, bytes: true, postId: true },
    orderBy: { bytes: "desc" },
  });

  const todo = assets.filter((a) => !KEEP_AS_IS.has(a.mimeType)) as Convertible[];
  const done = assets.length - todo.length;
  const totalBytes = todo.reduce((sum, a) => sum + (a.bytes ?? 0), 0);

  console.log(`붙은 곳        ${connectionLabel()}`);
  console.log(`저장소         ${new URL(storageUrl).hostname}`);
  console.log(`이미지         ${assets.length}장`);
  console.log(`이미 webp·gif  ${done}장`);
  console.log(`바꿀 것        ${todo.length}장 · ${mb(totalBytes)}`);
  if (LIMIT !== Number.POSITIVE_INFINITY) console.log(`이번에 돌릴 것 ${LIMIT}장까지`);

  if (todo.length === 0) {
    console.log("\n바꿀 것이 없다.");
    return;
  }

  if (!APPLY) {
    console.log(`\n리포트만 했다. 실제로 바꾸려면 --apply 를 붙인다.`);
    console.log(
      `재보니 q=${QUALITY} webp가 83% 줄인다 — ${mb(totalBytes)} → ${mb(totalBytes * 0.17)} 예상.`,
    );
    return;
  }

  // 글 단위로 묶는다 — 한 글이 한 트랜잭션이라 반쯤 바뀐 글이 생기지 않는다
  const byPost = new Map<string, Convertible[]>();
  for (const asset of todo.slice(0, LIMIT)) {
    const list = byPost.get(asset.postId) ?? [];
    list.push(asset);
    byPost.set(asset.postId, list);
  }

  let changed = 0;
  let savedBytes = 0;
  const failures: { path: string; reason: string }[] = [];

  for (const [postId, group] of byPost) {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { content: true } });
    // content가 비었으면 바꿔 넣을 주소도 없다. 조용히 넘기지 않고 실패로 센다
    if (!post || post.content === null) {
      const reason = post ? "본문이 비어 있다" : "글이 없다";
      for (const a of group) failures.push({ path: a.storagePath, reason });
      continue;
    }

    const srcs = new Set(collectImageSrcs(post.content));
    const converted: Converted[] = [];

    for (const asset of group) {
      const oldUrl = publicImageUrl(asset.storagePath, storageUrl);

      // 본문이 안 가리키는 파일은 본문을 못 고치므로 건드리지 않는다 — sweep의 몫이다
      if (!srcs.has(oldUrl)) {
        failures.push({ path: asset.storagePath, reason: "본문이 가리키지 않음" });
        continue;
      }

      const result = await downloadAndConvert(asset, storageUrl);
      if ("error" in result) {
        failures.push({ path: asset.storagePath, reason: result.error });
        continue;
      }

      const newPath = `${BUCKET}/${postId}/${nanoid()}.webp`;
      const error = await upload(newPath, result.bytes);
      if (error) {
        failures.push({ path: asset.storagePath, reason: `올리기 ${error}` });
        continue;
      }

      converted.push({ asset, newPath, newBytes: result.bytes.byteLength });
    }

    if (converted.length === 0) continue;

    /*
      **폭·높이는 본문에 적힌 것을 그대로 둔다.** 크기를 안 바꿨으니 값도 그대로여야 하는데,
      `rewriteImageSrcs`는 셋을 함께 덮어쓴다(이관 때는 그게 맞았다 — 그때는 크기를 새로
      알아냈으니까). 그래서 원래 값을 읽어 되돌려 넣는다. 0으로 덮으면 next/image가 자리를
      못 잡아 글을 열 때마다 레이아웃이 튄다.
    */
    const originals = new Map<string, { width: number; height: number }>();
    walkImages(post.content, (src, width, height) => originals.set(src, { width, height }));

    const replacements = new Map(
      converted.map((c) => {
        const oldSrc = publicImageUrl(c.asset.storagePath, storageUrl);
        const size = originals.get(oldSrc);
        return [
          oldSrc,
          {
            src: publicImageUrl(c.newPath, storageUrl),
            width: size?.width ?? 0,
            height: size?.height ?? 0,
          },
        ];
      }),
    );

    const nextContent = rewriteImageSrcs(post.content, replacements);

    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: postId },
        // 위에서 null을 걸렀다. Prisma의 입력 타입은 그걸 모른다
        data: { content: nextContent as Prisma.InputJsonValue },
      });
      for (const c of converted) {
        await tx.asset.update({
          where: { id: c.asset.id },
          data: { storagePath: c.newPath, mimeType: "image/webp", bytes: c.newBytes },
        });
      }
    });

    for (const c of converted) savedBytes += (c.asset.bytes ?? 0) - c.newBytes;
    changed += converted.length;
    process.stdout.write(".");
  }

  console.log(`\n\n바꾼 그림      ${changed}장`);
  console.log(`줄어든 용량    ${mb(savedBytes)}`);
  console.log(`실패           ${failures.length}장`);
  for (const f of failures.slice(0, 10)) console.log(`  ⚠ ${f.path} — ${f.reason}`);
  if (failures.length > 10) console.log(`  … 그리고 ${failures.length - 10}장 더`);

  console.log("\n옛 파일은 아직 그대로다 — 눈으로 확인한 뒤 `-- --sweep --apply`로 지운다.");
  console.log("지면이 캐시를 들고 있으면 배포 한 번이 가장 확실하다.");
}

/** 본문의 이미지 노드에서 주소와 크기를 읽는다 — 바꿀 때 폭·높이를 잃지 않으려고 */
function walkImages(
  content: unknown,
  visit: (src: string, width: number, height: number) => void,
): void {
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const child of value) walk(child);
      return;
    }
    if (typeof value !== "object" || value === null) return;

    const node = value as { type?: unknown; attrs?: Record<string, unknown> };
    if (node.type === "image" && typeof node.attrs?.src === "string") {
      visit(
        node.attrs.src,
        typeof node.attrs.width === "number" ? node.attrs.width : 0,
        typeof node.attrs.height === "number" ? node.attrs.height : 0,
      );
    }

    for (const child of Object.values(value)) walk(child);
  };

  walk(content);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
