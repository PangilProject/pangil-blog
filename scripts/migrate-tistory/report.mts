import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { QT_GROUP_COUNT, QT_QUESTION_COUNT } from "@/lib/content/schema";
import { parseDraftContent, parsePublishContent } from "@/lib/db/content";
import type { RecordType } from "@/lib/record/callNumber";
import { classify, type MigrationSite } from "@/scripts/migrate-tistory/classify";
import { htmlToTiptapContent } from "@/scripts/migrate-tistory/convertHtml";
import { convertPraise } from "@/scripts/migrate-tistory/convertPraise";
import { convertQt } from "@/scripts/migrate-tistory/convertQt";
import { convertSermon } from "@/scripts/migrate-tistory/convertSermon";
import { ExtractError, extractPost } from "@/scripts/migrate-tistory/extract";
import { collectImageSrcs } from "@/scripts/migrate-tistory/imageNodes";
import { isRemoteSource, loadImage } from "@/scripts/migrate-tistory/imageSource";
import { overrideFor } from "@/scripts/migrate-tistory/overrides";

/**
 * 마이그레이션 dry-run 리포트 (05 §6.1 · AGENTS.md "dry-run이 기본").
 *
 *   npm run migrate -- --dry-run --input=<백업 폴더>
 *
 * 이 단계는 **DB를 건드리지 않는다.** 759편을 다 읽어서 무엇이 어디로 갈지, 무엇이 사람
 * 손을 필요로 하는지만 보여준다. 변환·적재는 다음 슬라이스다.
 *
 * 리포트가 먼저 있어야 하는 이유: 이관은 한 번 하고 끝나는 일이 아니라 **여러 번 돌려보며
 * 규칙을 고치는 일**이다. 매번 DB를 비우고 다시 넣는 대신, 틀린 곳을 리포트에서 본다.
 */

type BackupFile = { path: string; relative: string };

function htmlFiles(root: string): BackupFile[] {
  const files: BackupFile[] = [];

  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (!statSync(path).isDirectory()) continue;

    for (const name of readdirSync(path)) {
      if (name.toLowerCase().endsWith(".html")) {
        files.push({ path: join(path, name), relative: `${entry}/${name}` });
      }
    }
  }

  // 원본 글 ID 순 — 리포트를 두 번 돌렸을 때 줄이 흔들리지 않게
  return files.sort((a, b) => Number(a.relative.split("/")[0]) - Number(b.relative.split("/")[0]));
}

type Row = {
  legacyId: number;
  file: string;
  title: string;
  publishedAt: Date;
  site: MigrationSite;
  type: RecordType;
  categorySlug: string | null;
  tags: number;
  images: string[];
  tables: number;
  codeBlocks: number;
  iframes: number;
  convert: { ok: boolean; issues: string[]; notes: string[]; gate: string[] };
  /** 변환 결과 안의 이미지 — 이관 대상이다(원본 HTML의 개수와 다를 수 있다) */
  contentImages: string[];
};

type Skipped = { legacyId: number; file: string; title: string; reason: string };

function countIn(html: string, pattern: RegExp): number {
  return html.match(pattern)?.length ?? 0;
}

function imageSources(html: string): string[] {
  return [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1]);
}

function isRemote(src: string): boolean {
  return /^(https?:)?\/\//.test(src);
}

/** 외부 이미지는 호스트별로 센다 — 어느 서비스가 사라지면 몇 편이 깨지는지가 그대로 나온다 */
function imageHost(src: string): string {
  return src.replace(/^(https?:)?\/\//, "").split("/")[0];
}

function group<T>(rows: T[], key: (row: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return new Map([...counts].sort((a, b) => b[1] - a[1]));
}

function printTally(title: string, counts: Map<string, number>) {
  console.log(`\n${title}`);
  for (const [name, count] of counts) console.log(`  ${String(count).padStart(4)}  ${name}`);
}

/**
 * 타입별 변환 + 적재 전 검증 (05 §6.3 "모든 변환 결과는 적재 전 safeParse").
 *
 * safeParse는 형식만 본다 — 빈 문자열도 문자열이다. 그래서 타입별 **필수 구조 게이트**를
 * 따로 둔다(§6.3 "QT 6문4그룹 / 찬양 URL+≥1섹션 / 설교 3필드"). 둘 중 하나라도 걸리면
 * 검토 큐로 가고 DB에 들어가지 않는다.
 */
function convertBody(type: RecordType, bodyHtml: string) {
  const converted = convertOne(type, bodyHtml);

  // 게이트를 넘은 글만 발행 스키마를 통과해야 한다. 못 넘은 글은 초안으로 들어가므로
  // 초안 스키마로 검증한다 — 그것마저 실패하면 저장 자체가 안 되니 반드시 알아야 한다
  const parsed =
    converted.gate.length === 0
      ? parsePublishContent(converted.content)
      : parseDraftContent(converted.content);

  return {
    ok: parsed.ok && converted.gate.length === 0,
    issues: parsed.ok ? [] : parsed.issues,
    notes: converted.notes,
    gate: converted.gate,
    content: converted.content,
  };
}

function convertOne(type: RecordType, bodyHtml: string) {
  if (type === "QT") {
    const { content, notes } = convertQt(bodyHtml);
    return { content, notes, gate: qtGate(content) };
  }

  if (type === "SERMON") {
    const { content, notes } = convertSermon(bodyHtml);
    return { content, notes, gate: sermonGate(content) };
  }

  if (type === "PRAISE") {
    const { content, notes } = convertPraise(bodyHtml);
    return { content, notes, gate: praiseGate(content) };
  }

  const { content, notes } = htmlToTiptapContent(bodyHtml);
  const body = { kind: "TECH" as const, body: { type: "doc" as const, content } };

  return {
    content: body,
    notes: notes.map((note) => `${note.kind}: ${note.detail}`),
    // 원본부터 본문이 없는 글이 4편 있다("(미완료)" 제목). 빈 지면을 공개하지 않는다
    gate: content.length === 0 ? ["본문 없음"] : [],
  };
}

function qtGate(content: ReturnType<typeof convertQt>["content"]): string[] {
  const issues: string[] = [];
  const questions = content.questionGroups.reduce(
    (total, group) => total + group.questions.length,
    0,
  );

  if (content.scriptureRef === "") issues.push("말씀 범위 없음");
  if (content.scriptureBody === "") issues.push("말씀 본문 없음");
  if (content.questionGroups.length !== QT_GROUP_COUNT) {
    issues.push(`그룹 ${content.questionGroups.length}개`);
  }
  if (questions !== QT_QUESTION_COUNT) issues.push(`질문 ${questions}개`);

  return issues;
}

function sermonGate(content: ReturnType<typeof convertSermon>["content"]): string[] {
  const issues: string[] = [];

  if (content.scriptureRef === "") issues.push("말씀 범위 없음");
  if (content.scriptureBody === "") issues.push("말씀 본문 없음");
  if ((content.body as { content: unknown[] }).content.length === 0) issues.push("본문 없음");

  return issues;
}

function praiseGate(content: ReturnType<typeof convertPraise>["content"]): string[] {
  const issues: string[] = [];

  if (!content.youtubeUrl) issues.push("유튜브 주소 없음");
  if (content.sections.length === 0) issues.push("섹션 없음");

  return issues;
}

/**
 * 이미지가 실제로 확보되는지 확인한다 — 올리지는 않는다.
 *
 * velog CDN 618개를 진짜로 내려받아 본다. "옮길 수 있다"를 적재 당일이 아니라 지금 알아야
 * 하고(그날 velog가 죽어 있으면 그 65편이 그냥 깨진다), 형식·크기도 여기서 걸러진다.
 */
async function checkImages(rows: Row[], input: string) {
  const jobs: { row: Row; src: string }[] = [];
  for (const row of rows) {
    for (const src of new Set(row.contentImages)) jobs.push({ row, src });
  }

  console.log(
    `\n이미지 확인  ${jobs.length}개 (외부 ${jobs.filter((job) => isRemoteSource(job.src)).length}개는 실제로 내려받는다)`,
  );

  const failures: { file: string; reason: string; detail: string }[] = [];
  let ok = 0;
  const CONCURRENCY = 8;

  for (let index = 0; index < jobs.length; index += CONCURRENCY) {
    const batch = jobs.slice(index, index + CONCURRENCY);
    const results = await Promise.all(
      batch.map((job) => loadImage(job.src, join(input, String(job.row.legacyId)))),
    );

    for (const [offset, result] of results.entries()) {
      if (result.ok) ok += 1;
      else {
        failures.push({
          file: batch[offset].row.file,
          reason: result.failure.reason,
          detail: result.failure.detail,
        });
      }
    }
  }

  console.log(`  확보 ${ok}개 · 실패 ${failures.length}개`);

  if (failures.length > 0) {
    printTally(
      "  실패 사유",
      group(failures, (failure) => failure.reason),
    );
    for (const failure of failures) {
      console.log(`   · ${failure.file} — ${failure.reason}: ${failure.detail.slice(0, 90)}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const input = args.find((arg) => arg.startsWith("--input="))?.slice("--input=".length);
  const dryRun = args.includes("--dry-run");

  if (!input) {
    console.error("사용법: npm run migrate -- --dry-run --input=<백업 폴더>");
    process.exitCode = 1;
    return;
  }

  if (!dryRun) {
    // 적재는 다음 슬라이스다. 그때까지 --dry-run 없이 실행되는 일이 없게 막는다
    console.error("아직 적재 단계가 없습니다. --dry-run으로 실행해주세요 (05 §6.1).");
    process.exitCode = 1;
    return;
  }

  const files = htmlFiles(input);
  console.log(`[migrate] ${input} — HTML ${files.length}편`);

  const rows: Row[] = [];
  const excluded: Skipped[] = [];
  const review: Skipped[] = [];
  const failed: { file: string; error: string }[] = [];

  for (const file of files) {
    let post: ReturnType<typeof extractPost>;
    try {
      post = extractPost(readFileSync(file.path, "utf-8"), file.relative);
    } catch (error) {
      // 추출 실패는 삼키지 않는다. 몇 편이 조용히 빠지는 것이 가장 나쁘다
      failed.push({
        file: file.relative,
        error: error instanceof ExtractError ? error.message : String(error),
      });
      continue;
    }

    // 글 단위 예외가 규칙을 이긴다 — 카테고리를 안 고른 32편이 그렇다
    const classified = overrideFor(post.legacyId) ?? classify(post.categoryPath);

    if (classified.kind !== "post") {
      const row = {
        legacyId: post.legacyId,
        file: post.file,
        title: post.title,
        reason: classified.reason,
      };
      if (classified.kind === "exclude") excluded.push(row);
      else review.push(row);
      continue;
    }

    const converted = convertBody(classified.type, post.bodyHtml);

    rows.push({
      legacyId: post.legacyId,
      file: post.file,
      title: post.title,
      publishedAt: post.publishedAt,
      site: classified.site,
      type: classified.type,
      categorySlug: classified.categorySlug,
      tags: post.tags.length,
      images: imageSources(post.bodyHtml),
      tables: countIn(post.bodyHtml, /<table/g),
      codeBlocks: countIn(post.bodyHtml, /<pre/g),
      iframes: countIn(post.bodyHtml, /<iframe/g),
      convert: converted,
      contentImages: collectImageSrcs(converted.content),
    });
  }

  printTally(
    "사이트·타입",
    group(rows, (row) => `${row.site} / ${row.type}`),
  );
  printTally(
    "TECH 카테고리",
    group(
      rows.filter((row) => row.type === "TECH"),
      (row) => row.categorySlug ?? "(없음)",
    ),
  );

  const dates = rows.map((row) => row.publishedAt.getTime());
  const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
  console.log(`\n작성일 범위  ${iso(Math.min(...dates))} ~ ${iso(Math.max(...dates))}`);

  const sum = (pick: (row: Row) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const allImages = rows.flatMap((row) => row.images);
  const remoteImages = allImages.filter(isRemote);

  console.log(
    [
      "\n본문 자산",
      `  이미지   로컬 ${allImages.length - remoteImages.length} · 외부 ${remoteImages.length}`,
      `  표       ${sum((row) => row.tables)}개 (${rows.filter((row) => row.tables > 0).length}편)`,
      `  코드블록 ${sum((row) => row.codeBlocks)}개 (${rows.filter((row) => row.codeBlocks > 0).length}편)`,
      `  iframe   ${sum((row) => row.iframes)}개`,
      `  태그     ${sum((row) => row.tags)}개 (${rows.filter((row) => row.tags > 0).length}편)`,
    ].join("\n"),
  );

  if (remoteImages.length > 0) {
    printTally(
      "외부 이미지 호스트 — 이관 대상(원본이 사라지면 깨진다)",
      group(remoteImages, imageHost),
    );
  }

  const blocked = rows.filter((row) => !row.convert.ok);
  const notes = rows.flatMap((row) => row.convert.notes);

  console.log("\n본문 변환");
  for (const type of ["QT", "SERMON", "PRAISE", "TECH"] as RecordType[]) {
    const ofType = rows.filter((row) => row.type === type);
    if (ofType.length === 0) continue;
    const passed = ofType.filter((row) => row.convert.ok).length;
    console.log(`  ${type.padEnd(7)} ${String(passed).padStart(4)} / ${ofType.length}`);
  }

  if (notes.length > 0) {
    printTally(
      "  변환 노트",
      group(notes, (note) => note),
    );
  }

  console.log(`\n적재 계획  발행 ${rows.length - blocked.length}편 · 초안 ${blocked.length}편`);

  if (blocked.length > 0) {
    // 게이트를 못 넘은 글은 **버리지 않고 초안으로** 넣는다(05 §6.3의 검토 큐를 A-02 초안함이
    // 겸한다). 빈 지면을 공개하지 않으면서 글을 잃지도 않는다 — 손으로 채우고 발행하면 된다
    console.log("  초안으로 들어가는 글 — 손으로 채운 뒤 발행한다");
    for (const row of blocked) {
      console.log(`   · ${row.file} — ${[...row.convert.gate, ...row.convert.issues].join(" · ")}`);
    }
  }

  if (args.includes("--check-images")) await checkImages(rows, input);

  console.log(`\n이관 대상  ${rows.length}편`);

  if (excluded.length > 0) {
    console.log(`\n제외  ${excluded.length}편 — 일부러 가져오지 않는다`);
    for (const row of excluded) console.log(`   · ${row.title || row.file} (${row.reason})`);
  }

  if (review.length > 0) {
    // 이 수가 0이 아니면 아직 이관할 준비가 안 된 것이다. 규칙이나 overrides에 답이 없다
    console.log(`\n검토 큐  ${review.length}편 — 사람이 정해야 한다`);
    for (const row of review) {
      console.log(`   · ${row.file}${row.title ? ` — ${row.title}` : ""} (${row.reason})`);
    }
    process.exitCode = 1;
  }

  if (failed.length > 0) {
    console.error(`\n추출 실패  ${failed.length}편`);
    for (const row of failed) console.error(`  · ${row.file} — ${row.error}`);
    process.exitCode = 1;
  }
}

await main();
