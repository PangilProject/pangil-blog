import { nanoid } from "nanoid";

import type { PostContent } from "@/lib/content/schema";
import { prisma } from "@/lib/db/prisma";
import type { RecordType } from "@/lib/record/callNumber";
import { deriveSlug, findAvailableSlug } from "@/lib/record/slug";
import { extractSearchText } from "@/lib/render/searchText";
import { publicImageUrl } from "@/lib/storage/images";
import { CATEGORIES } from "@/prisma/categories.mts";
import { PostStatus, type PostType, Site } from "@/prisma/generated/enums";
import { backupKeyList, backupOf } from "@/scripts/migrate-tistory/backups";
import { type ImageReplacement, rewriteImageSrcs } from "@/scripts/migrate-tistory/imageNodes";
import { loadImage } from "@/scripts/migrate-tistory/imageSource";
import { assignCallNumbers, deriveExcerpt } from "@/scripts/migrate-tistory/loadPlan";
import { type PreparedPost, readBackup } from "@/scripts/migrate-tistory/pipeline";

/**
 * 티스토리 적재 (05 §6.1 3·4단계 · §6.4).
 *
 *   npm run migrate:load -- --input=<백업 폴더> --source=<백업 키> [--append] [--limit=N] [--only=105]
 *
 * 순서가 규칙이다. **타입별 원본 작성일 오름차순으로 청구기호를 소급 부여**한다(§6.4) —
 * 번호가 곧 이 기록물의 연대기이므로, 옮기는 순서가 아니라 쓴 순서를 따라야 한다.
 *
 * 발행 게이트(publishPost)를 우회하는 전용 경로다. 대신 pipeline이 적재 전에 같은 스키마를
 * 통과시켰고, 게이트를 못 넘은 글은 초안으로 들어간다.
 *
 * **재실행 안전**: legacyId가 이미 있으면 건너뛴다. 750편 중간에 멈춰도 다시 돌리면 된다.
 * 무효화는 하지 않는다 — 대량 적재는 per-post revalidate 대신 전체 1회 rebuild다(§6.4-6).
 */

type Loaded = { created: number; skipped: number; images: number; imageFailures: string[] };

async function ensureCategories() {
  // 이관은 "학교"처럼 나중에 추가된 분류를 필요로 한다. 없는 것만 넣고 이름은 건드리지 않는다
  for (const [index, category] of CATEGORIES.entries()) {
    const existing = await prisma.category.findUnique({ where: { slug: category.slug } });
    if (existing) continue;
    await prisma.category.create({
      data: { ...category, sortOrder: (index + 1) * 10 },
    });
  }

  const rows = await prisma.category.findMany({ select: { id: true, slug: true } });
  return new Map(rows.map((row) => [row.slug, row.id]));
}

async function uploadImages(postId: string, post: PreparedPost) {
  const replacements = new Map<string, ImageReplacement>();
  const failures: string[] = [];
  const assets: {
    storagePath: string;
    mimeType: string;
    bytes: number;
    width: number;
    height: number;
  }[] = [];

  for (const src of new Set(post.images)) {
    const result = await loadImage(src, post.folder);

    if (!result.ok) {
      // 못 옮긴 이미지는 주소를 그대로 둔다. 리포트가 이름을 대므로 손으로 채울 수 있다
      failures.push(
        `${post.file} — ${result.failure.reason}: ${result.failure.detail.slice(0, 80)}`,
      );
      continue;
    }

    const { bytes, probed } = result.image;
    const storagePath = `post-images/${postId}/${nanoid()}.${probed.extension}`;

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${storagePath}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "content-type": probed.mime,
          "x-upsert": "false",
        },
        // Uint8Array를 그대로 넘기면 BodyInit 타입에 맞지 않는다
        body: bytes.slice() as unknown as BodyInit,
      },
    );

    if (!response.ok) {
      failures.push(
        `${post.file} — upload ${response.status}: ${(await response.text()).slice(0, 80)}`,
      );
      continue;
    }

    const url = publicImageUrl(storagePath);
    replacements.set(src, { src: url, width: probed.width, height: probed.height });
    assets.push({
      storagePath,
      mimeType: probed.mime,
      bytes: bytes.byteLength,
      width: probed.width,
      height: probed.height,
    });
  }

  return { replacements, failures, assets };
}

async function loadPost(
  post: PreparedPost,
  callNumber: number | null,
  categoryIds: Map<string, string>,
): Promise<{ created: boolean; images: number; failures: string[] }> {
  const existing = await prisma.post.findUnique({
    where: { legacyId: post.legacyId },
    select: { id: true },
  });

  // 재실행 안전 — 이미 옮긴 글은 손대지 않는다
  if (existing) return { created: false, images: 0, failures: [] };

  const content = post.content as PostContent;
  const publishable = post.publishable && callNumber !== null;

  const slug = publishable
    ? await findAvailableSlug(
        deriveSlug({ type: post.type, callNumber: callNumber as number }),
        async (candidate) =>
          (await prisma.post.findUnique({ where: { slug: candidate }, select: { id: true } })) !==
          null,
      )
    : null;

  const created = await prisma.post.create({
    data: {
      legacyId: post.legacyId,
      type: post.type as PostType,
      status: publishable ? PostStatus.PUBLISHED : PostStatus.DRAFT,
      title: post.title,
      slug,
      content,
      excerpt: deriveExcerpt(content),
      categoryId: post.categorySlug ? (categoryIds.get(post.categorySlug) ?? null) : null,
      callNumber: publishable ? callNumber : null,
      // 원본 작성일을 그대로 쓴다 — 이 블로그의 연대기가 티스토리와 같아야 한다(07 §3)
      publishedAt: publishable ? post.publishedAt : null,
      createdAt: post.publishedAt,
      searchText: publishable ? extractSearchText(post.title, content) : null,
    },
    select: { id: true },
  });

  // 태그는 사이트별로 따로 있다 — dev와 faith에 동명 태그가 공존한다(05 §1.4)
  const site = post.site === "faith" ? Site.FAITH : Site.DEV;

  for (const name of new Set(post.tags)) {
    const tag = await prisma.tag.upsert({
      where: { site_name: { site, name } },
      update: {},
      create: { site, name },
      select: { id: true },
    });
    await prisma.postTag.create({ data: { postId: created.id, tagId: tag.id } });
  }

  const { replacements, failures, assets } = await uploadImages(created.id, post);

  if (replacements.size > 0) {
    const rewritten = rewriteImageSrcs(content, replacements);
    await prisma.post.update({
      where: { id: created.id },
      data: {
        content: rewritten,
        searchText: publishable ? extractSearchText(post.title, rewritten) : null,
      },
    });
  }

  for (const asset of assets) {
    await prisma.asset.create({
      data: { postId: created.id, ...asset },
    });
  }

  return { created: true, images: assets.length, failures };
}

async function main() {
  const args = process.argv.slice(2);
  const input = args.find((arg) => arg.startsWith("--input="))?.slice("--input=".length);
  const limit = Number(args.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length));
  const only = args
    .find((arg) => arg.startsWith("--only="))
    ?.slice("--only=".length)
    .split(",")
    .map(Number);

  const backup = backupOf(
    args.find((arg) => arg.startsWith("--source="))?.slice("--source=".length),
  );

  if (!input || !backup) {
    console.error(
      "사용법: npm run migrate:load -- --input=<백업 폴더> --source=<백업 키> [--append] [--limit=N] [--only=105]",
    );
    console.error(`  백업 키: ${backupKeyList()}`);
    process.exitCode = 1;
    return;
  }

  const { posts, review, failed } = readBackup(input, backup);

  if (review.length > 0 || failed.length > 0) {
    // dry-run이 초록이 아니면 적재하지 않는다
    console.error(`검토 큐 ${review.length}편 · 추출 실패 ${failed.length}편이 남아 있습니다.`);
    console.error("npm run migrate -- --dry-run 으로 먼저 해결해주세요.");
    process.exitCode = 1;
    return;
  }

  const existingPublished = await prisma.post.count({
    where: { legacyId: null, callNumber: { not: null } },
  });
  if (existingPublished > 0 && !args.includes("--append")) {
    // 청구기호를 1부터 소급하려면 DB가 비어 있어야 한다. 이미 발행된 글의 번호는 불변이다(05 §5)
    console.error(
      `이관과 무관한 발행 글이 ${existingPublished}편 있습니다. 청구기호를 1부터 소급할 수 없습니다.`,
    );
    console.error("그 글을 지우고 다시 돌리거나, 기존 번호 뒤에 이어 붙이려면 --append를 주세요.");
    process.exitCode = 1;
    return;
  }

  const startFrom = new Map<RecordType, number>();
  if (args.includes("--append")) {
    for (const type of ["QT", "SERMON", "PRAISE", "TECH"] as RecordType[]) {
      const max = await prisma.post.aggregate({
        where: { type: type as PostType },
        _max: { callNumber: true },
      });
      startFrom.set(type, max._max.callNumber ?? 0);
    }
  }

  const numbers = assignCallNumbers(posts, startFrom);
  const categoryIds = await ensureCategories();

  const targets = posts
    // 리포트가 보여주는 번호는 폴더 번호다. 오프셋 붙은 값을 외우게 하지 않는다
    .filter((post) => (only ? only.includes(post.originalId) : true))
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : undefined);

  console.log(`[load] ${targets.length}편을 적재합니다 (전체 ${posts.length}편)`);

  const summary: Loaded = { created: 0, skipped: 0, images: 0, imageFailures: [] };

  for (const [index, post] of targets.entries()) {
    const result = await loadPost(post, numbers.get(post.legacyId) ?? null, categoryIds);

    if (result.created) summary.created += 1;
    else summary.skipped += 1;

    summary.images += result.images;
    summary.imageFailures.push(...result.failures);

    if ((index + 1) % 25 === 0 || index === targets.length - 1) {
      console.log(
        `  ${index + 1}/${targets.length} — 생성 ${summary.created} · 건너뜀 ${summary.skipped} · 이미지 ${summary.images}`,
      );
    }
  }

  // 카운터를 실제 최대값에 맞춘다 — 신규 글이 이어받는다(05 §6.4-5)
  for (const type of ["QT", "SERMON", "PRAISE", "TECH"] as RecordType[]) {
    const max = await prisma.post.aggregate({
      where: { type: type as PostType },
      _max: { callNumber: true },
    });
    const lastNumber = max._max.callNumber ?? 0;
    if (lastNumber === 0) continue;

    await prisma.callNumberCounter.upsert({
      where: { type: type as PostType },
      update: { lastNumber },
      create: { type: type as PostType, lastNumber },
    });
    console.log(`  카운터 ${type} = ${lastNumber}`);
  }

  console.log(
    `\n[load] 완료 — 생성 ${summary.created}편 · 건너뜀 ${summary.skipped}편 · 이미지 ${summary.images}개`,
  );

  if (summary.imageFailures.length > 0) {
    console.log(`\n못 옮긴 이미지 ${summary.imageFailures.length}개 — 주소를 그대로 뒀습니다`);
    for (const failure of summary.imageFailures) console.log(`   · ${failure}`);
  }

  console.log("\n다음: 전체 rebuild (vercel --prod). 대량 적재는 per-post 무효화를 하지 않습니다.");
}

await main();
await prisma.$disconnect();
