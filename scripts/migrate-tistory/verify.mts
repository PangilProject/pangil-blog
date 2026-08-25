import { parseDraftContent } from "@/lib/db/content";
import { prisma } from "@/lib/db/prisma";
import { collectImageSrcs } from "@/scripts/migrate-tistory/imageNodes";

/**
 * 적재 후 검증 (07 M5 DoD "티스토리 전량 이관 · 청구기호 소급 · 원본 작성일 보존 ·
 * 깨진 이미지 0").
 *
 *   npm run migrate:verify [-- --check-urls]
 *
 * dry-run 리포트는 **넣기 전**을 본다. 이건 **넣은 뒤**를 본다 — 둘 다 필요하다. 적재는
 * 750번의 쓰기이고, 그중 하나가 조용히 실패했는지는 DB에 물어봐야 안다.
 */

const EXTERNAL_HINTS = [
  { label: "velog CDN", pattern: /velcdn\.com/ },
  { label: "티스토리 CDN", pattern: /(daumcdn|tistory)\.(net|com)/ },
  { label: "백업 상대경로", pattern: /^\.?\/?img\// },
  { label: "data URI", pattern: /^data:/ },
  { label: "티스토리 첨부", pattern: /^attachment:/ },
];

async function main() {
  const posts = await prisma.post.findMany({
    where: { legacyId: { not: null } },
    select: {
      id: true,
      legacyId: true,
      type: true,
      status: true,
      title: true,
      slug: true,
      callNumber: true,
      publishedAt: true,
      content: true,
    },
    orderBy: { legacyId: "asc" },
  });

  console.log(`이관된 글  ${posts.length}편`);

  const byType = new Map<string, { published: number; draft: number; numbers: number[] }>();

  for (const post of posts) {
    const entry = byType.get(post.type) ?? { published: 0, draft: 0, numbers: [] };
    if (post.status === "PUBLISHED") {
      entry.published += 1;
      if (post.callNumber !== null) entry.numbers.push(post.callNumber);
    } else {
      entry.draft += 1;
    }
    byType.set(post.type, entry);
  }

  console.log("\n타입별");
  for (const [type, entry] of byType) {
    const sorted = [...entry.numbers].sort((a, b) => a - b);
    const first = sorted[0] ?? 0;
    // 번호가 **빈틈없이** 이어져야 한다. 시작이 1이 아닌 것은 정상일 수 있다(--append)
    const gaps = sorted.filter((number, index) => number !== first + index).length;

    console.log(
      [
        `  ${type.padEnd(7)}`,
        `발행 ${String(entry.published).padStart(3)} · 초안 ${entry.draft}`,
        `· 청구기호 ${sorted[0] ?? "-"}~${sorted[sorted.length - 1] ?? "-"}`,
        gaps > 0 ? ` ⚠ 결번 ${gaps}개` : "",
        first > 1 ? " (기존 번호 뒤에 이어 붙음)" : "",
      ].join(" "),
    );
  }

  // 원본 작성일 보존 — 발행된 글에 날짜가 없으면 연대기가 깨진다
  const undated = posts.filter((post) => post.status === "PUBLISHED" && post.publishedAt === null);
  if (undated.length > 0) console.log(`\n⚠ 작성일 없는 발행 글 ${undated.length}편`);

  const noSlug = posts.filter((post) => post.status === "PUBLISHED" && !post.slug);
  if (noSlug.length > 0) console.log(`⚠ slug 없는 발행 글 ${noSlug.length}편`);

  // 읽을 수 없는 content — 스키마를 통과했는데도 저장 과정에서 뭉개졌다면 여기서 걸린다
  const unreadable = posts.filter((post) => !parseDraftContent(post.content).ok);
  if (unreadable.length > 0) {
    console.log(`\n⚠ content를 읽지 못하는 글 ${unreadable.length}편`);
    for (const post of unreadable) console.log(`   · #${post.legacyId} ${post.title}`);
  }

  console.log("\n남아 있는 외부 이미지");
  const leftovers: { post: (typeof posts)[number]; src: string; label: string }[] = [];
  let storageImages = 0;

  for (const post of posts) {
    for (const src of collectImageSrcs(post.content)) {
      const hint = EXTERNAL_HINTS.find((entry) => entry.pattern.test(src));
      if (hint) leftovers.push({ post, src, label: hint.label });
      else storageImages += 1;
    }
  }

  console.log(`  Storage로 옮긴 이미지 ${storageImages}개`);

  if (leftovers.length === 0) console.log("  없음 — 깨질 이미지가 없다");
  else {
    for (const entry of leftovers) {
      console.log(`   · #${entry.post.legacyId} ${entry.label}: ${entry.src.slice(0, 70)}`);
    }
  }

  if (process.argv.includes("--check-urls")) {
    // 실제로 읽히는지 본다. 업로드는 성공했는데 공개 읽기가 막혀 있으면 지면에서만 깨진다
    const urls = [...new Set(posts.flatMap((post) => collectImageSrcs(post.content)))].filter(
      (src) => src.startsWith("http") && !EXTERNAL_HINTS.some((e) => e.pattern.test(src)),
    );

    console.log(`\n공개 읽기 확인  ${urls.length}개`);
    let broken = 0;

    for (let index = 0; index < urls.length; index += 10) {
      const batch = urls.slice(index, index + 10);
      const results = await Promise.all(
        batch.map((url) =>
          fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15_000) })
            .then((response) => response.ok)
            .catch(() => false),
        ),
      );

      for (const [offset, ok] of results.entries()) {
        if (!ok) {
          broken += 1;
          console.log(`   · 읽히지 않음: ${batch[offset]}`);
        }
      }
    }

    console.log(`  깨진 이미지 ${broken}개`);
  }

  const total = posts.length;
  const published = [...byType.values()].reduce((sum, entry) => sum + entry.published, 0);
  console.log(`\n합계  ${total}편 (발행 ${published} · 초안 ${total - published})`);
}

await main();
await prisma.$disconnect();
