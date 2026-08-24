import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import type { RecordType } from "@/lib/record/callNumber";
import { classify, type MigrationSite } from "@/scripts/migrate-tistory/classify";
import { ExtractError, extractPost } from "@/scripts/migrate-tistory/extract";
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

function main() {
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

main();
