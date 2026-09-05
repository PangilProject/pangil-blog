import { prisma } from "@/lib/db/prisma";
import { extractSearchText } from "@/lib/render/searchText";

/**
 * 001 · 설교 제목을 본문에서 꺼낸다 (05 §1.6 content 마이그레이션 규약).
 *
 *   npm run content:sermon-title              # 리포트만 (기본)
 *   npm run content:sermon-title -- --apply   # 실제 쓰기
 *
 * 배경: 이관해 온 설교 글은 `title`이 "2026년 08월 23일 주일 예배 설교"이고, **그날 설교의
 * 제목은 본문 첫 블록의 제목 노드**로 들어가 있다("하나님의 편에 서라"). 두 제목을 나눈 뒤
 * (02 §5.3) 옛 글도 같은 모양이 되게 옮긴다 — 그러지 않으면 옛 글만 설교 제목이 비고,
 * 본문에는 제목이 한 번 더 찍힌다.
 *
 * 실물에서 그 제목은 두 모양이다(dev 108편 기준):
 *   - `heading` 노드           65편
 *   - **통째로 굵은 문단**      37편 — 티스토리에서 제목을 굵게만 적은 글
 *
 * 나머지 6편(굵지 않은 문단 5 · 인용 블록 1)은 **손대지 않는다.** 첫 줄이 본문일 수 있고,
 * "비슷해 보임"을 근거로 본문을 자르는 순간 그건 유실이다. 그 글들은 리포트에 남기고 사람이
 * 손으로 정리한다.
 *
 * 문단은 **전부** 굵어야 한다. 일부만 굵은 문단은 강조가 섞인 본문이다.
 *
 * 멱등하다. 이미 `sermonTitle`이 있는 글은 세기만 하고 건너뛴다.
 *
 * 기본값이 리포트인 것은 의도다. 이 스크립트는 **본문을 자른다** — 되돌릴 수 없고, 이
 * 레포의 규약은 크롤러·이관과 마찬가지로 "먼저 dry-run"이다(06 §7).
 */

const APPLY = process.argv.includes("--apply");

type Mark = { type?: string };
type Node = { type?: string; content?: Node[]; text?: string; marks?: Mark[] };

function plainText(node: Node | undefined): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  return (node.content ?? []).map(plainText).join("");
}

/** 글자가 하나라도 있고, 그 글자가 **전부** 굵은 문단 */
function isAllBoldParagraph(node: Node | undefined): boolean {
  if (node?.type !== "paragraph") return false;

  const texts = (node.content ?? []).filter((child) => typeof child.text === "string");
  if (texts.length === 0) return false;

  return texts.every((child) => (child.marks ?? []).some((mark) => mark.type === "bold"));
}

async function main() {
  const posts = await prisma.post.findMany({
    where: { type: "SERMON" },
    select: { id: true, title: true, status: true, content: true },
    orderBy: { publishedAt: "asc" },
  });

  const targets: { id: string; title: string; sermonTitle: string; next: object }[] = [];
  let already = 0;
  const skipped: { title: string; reason: string }[] = [];

  for (const post of posts) {
    const content = post.content as { kind?: string; sermonTitle?: string; body?: Node } | null;

    if (content?.kind !== "SERMON") {
      skipped.push({ title: post.title, reason: "content.kind가 SERMON이 아니다" });
      continue;
    }

    if (content.sermonTitle) {
      already += 1;
      continue;
    }

    const blocks = content.body?.content ?? [];
    const [first] = blocks;

    if (first?.type !== "heading" && !isAllBoldParagraph(first)) {
      skipped.push({
        title: post.title,
        reason: `첫 블록이 제목도 굵은 문단도 아니다(${first?.type ?? "없음"})`,
      });
      continue;
    }

    const sermonTitle = plainText(first).trim();
    if (sermonTitle === "") {
      skipped.push({ title: post.title, reason: "첫 제목이 비어 있다" });
      continue;
    }

    targets.push({
      id: post.id,
      title: post.title,
      sermonTitle,
      // 제목 노드는 본문에서 뺀다 — 옮기는 것이지 복사하는 것이 아니다
      next: {
        ...content,
        sermonTitle,
        body: { ...content.body, content: blocks.slice(1) },
      },
    });
  }

  console.log(`설교 글        ${posts.length}편`);
  console.log(`이미 옮김      ${already}편`);
  console.log(`옮길 대상      ${targets.length}편`);
  console.log(`규칙 밖        ${skipped.length}편`);

  for (const item of skipped) {
    console.log(`  ! ${item.reason} — ${item.title}`);
  }
  for (const target of targets) {
    console.log(`  - ${target.title}  →  ${target.sermonTitle}`);
  }

  if (targets.length === 0) {
    console.log("\n옮길 것이 없다.");
    return;
  }

  if (!APPLY) {
    console.log("\n리포트만 했다. 실제로 쓰려면 --apply 를 붙인다.");
    return;
  }

  // 한 트랜잭션에 묶는다. 절반만 옮기면 어떤 글이 옮겨졌는지 사람이 다시 세야 한다
  await prisma.$transaction(
    targets.map((target) =>
      prisma.post.update({
        where: { id: target.id },
        data: {
          content: target.next as never,
          // 설교 제목이 본문 밖으로 나갔다. 다시 뽑지 않으면 그 말로 검색되지 않는다(05 §4A)
          searchText: extractSearchText(target.title, target.next as never),
        },
      }),
    ),
  );

  console.log(`\n${targets.length}편을 옮겼다.`);
  console.log("공개 지면 반영은 배포(전체 rebuild)로 한다 — 이 스크립트는 무효화를 하지 않는다.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
