import type { RecordType } from "@/lib/record/callNumber";
import { backupKeyList, backupOf } from "@/scripts/migrate-tistory/backups";
import { isRemoteSource, loadImage } from "@/scripts/migrate-tistory/imageSource";
import { type PreparedPost, readBackup } from "@/scripts/migrate-tistory/pipeline";

/**
 * 마이그레이션 dry-run 리포트 (05 §6.1 · AGENTS.md "dry-run이 기본").
 *
 *   npm run migrate -- --dry-run --input=<백업 폴더> --source=<백업 키> [--check-images]
 *
 * 이 단계는 **DB를 건드리지 않는다.** 무엇이 어디로 갈지, 무엇이 사람 손을 필요로 하는지만
 * 보여준다. 판정과 변환은 적재기와 **같은 함수**(pipeline)가 한다 — dry-run에서 본 결과와
 * 실제로 들어가는 것이 다르면 dry-run은 아무 의미가 없다.
 */

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
 * 이미지가 실제로 확보되는지 확인한다 — 올리지는 않는다.
 *
 * velog CDN 618개를 진짜로 내려받아 본다. "옮길 수 있다"를 적재 당일이 아니라 지금 알아야
 * 하고(그날 velog가 죽어 있으면 그 65편이 그냥 깨진다), 형식·크기도 여기서 걸러진다.
 */
async function checkImages(posts: PreparedPost[]) {
  const jobs = posts.flatMap((post) => [...new Set(post.images)].map((src) => ({ post, src })));
  const remote = jobs.filter((job) => isRemoteSource(job.src)).length;

  console.log(`\n이미지 확인  ${jobs.length}개 (외부 ${remote}개는 실제로 내려받는다)`);

  const failures: { file: string; reason: string; detail: string }[] = [];
  let ok = 0;
  const CONCURRENCY = 8;

  for (let index = 0; index < jobs.length; index += CONCURRENCY) {
    const batch = jobs.slice(index, index + CONCURRENCY);
    const results = await Promise.all(batch.map((job) => loadImage(job.src, job.post.folder)));

    for (const [offset, result] of results.entries()) {
      if (result.ok) ok += 1;
      else {
        failures.push({
          file: batch[offset].post.file,
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

  // 백업이 둘이고 원본 글 ID가 겹친다. 어느 백업인지는 폴더 이름으로 짐작하지 않는다 —
  // 틀리면 남의 글 판정을 이 백업에 씌운다(backups.ts)
  const backup = backupOf(
    args.find((arg) => arg.startsWith("--source="))?.slice("--source=".length),
  );

  if (!input || !backup || !args.includes("--dry-run")) {
    console.error(
      "사용법: npm run migrate -- --dry-run --input=<백업 폴더> --source=<백업 키> [--check-images]",
    );
    console.error(`  백업 키: ${backupKeyList()}`);
    console.error(
      "적재는 별도 명령입니다: npm run migrate:load -- --input=<백업 폴더> --source=<백업 키>",
    );
    process.exitCode = 1;
    return;
  }

  const { total, posts, excluded, review, failed } = readBackup(input, backup);
  console.log(`[migrate] ${input} — ${backup.label} · HTML ${total}편`);

  printTally(
    "사이트·타입",
    group(posts, (post) => `${post.site} / ${post.type}`),
  );
  printTally(
    "TECH 카테고리",
    group(
      posts.filter((post) => post.type === "TECH"),
      (post) => post.categorySlug ?? "(없음)",
    ),
  );

  const dates = posts.map((post) => post.publishedAt.getTime());
  const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
  console.log(`\n작성일 범위  ${iso(Math.min(...dates))} ~ ${iso(Math.max(...dates))}`);

  const images = posts.flatMap((post) => post.images);
  const remote = images.filter(isRemoteSource);
  console.log(
    [
      "\n본문 자산",
      `  이미지  로컬 ${images.length - remote.length} · 외부 ${remote.length}`,
      `  태그    ${posts.reduce((total, post) => total + post.tags.length, 0)}개`,
    ].join("\n"),
  );

  console.log("\n본문 변환");
  for (const type of ["QT", "SERMON", "PRAISE", "TECH"] as RecordType[]) {
    const ofType = posts.filter((post) => post.type === type);
    if (ofType.length === 0) continue;
    const passed = ofType.filter((post) => post.publishable).length;
    console.log(`  ${type.padEnd(7)} ${String(passed).padStart(4)} / ${ofType.length}`);
  }

  const notes = posts.flatMap((post) => post.notes);
  if (notes.length > 0)
    printTally(
      "  변환 노트",
      group(notes, (note) => note),
    );

  const drafts = posts.filter((post) => !post.publishable);
  console.log(`\n적재 계획  발행 ${posts.length - drafts.length}편 · 초안 ${drafts.length}편`);

  if (drafts.length > 0) {
    // 게이트를 못 넘은 글은 **버리지 않고 초안으로** 넣는다(05 §6.3의 검토 큐를 A-02 초안함이
    // 겸한다). 빈 지면을 공개하지 않으면서 글을 잃지도 않는다
    console.log("  초안으로 들어가는 글 — 손으로 채운 뒤 발행한다");
    for (const post of drafts) {
      console.log(`   · ${post.file} — ${post.blockers.join(" · ")}`);
    }
  }

  if (args.includes("--check-images")) await checkImages(posts);

  if (excluded.length > 0) {
    console.log(`\n제외  ${excluded.length}편 — 일부러 가져오지 않는다`);
    for (const row of excluded) console.log(`   · ${row.title || row.file} (${row.reason})`);
  }

  if (review.length > 0) {
    // 이 수가 0이 아니면 아직 이관할 준비가 안 된 것이다
    console.log(`\n검토 큐  ${review.length}편 — 사람이 정해야 한다`);
    for (const row of review) console.log(`   · ${row.file} — ${row.title} (${row.reason})`);
    process.exitCode = 1;
  }

  if (failed.length > 0) {
    console.error(`\n추출 실패  ${failed.length}편`);
    for (const row of failed) console.error(`   · ${row.file} — ${row.error}`);
    process.exitCode = 1;
  }
}

await main();
