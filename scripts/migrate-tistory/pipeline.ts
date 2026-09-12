import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { QT_GROUP_COUNT, QT_QUESTION_COUNT } from "@/lib/content/schema";
import { parseDraftContent, parsePublishContent } from "@/lib/db/content";
import type { RecordType } from "@/lib/record/callNumber";
import type { Backup } from "@/scripts/migrate-tistory/backups";
import { classify, type MigrationSite } from "@/scripts/migrate-tistory/classify";
import { htmlToTiptapContent } from "@/scripts/migrate-tistory/convertHtml";
import { convertPraise } from "@/scripts/migrate-tistory/convertPraise";
import { convertQt } from "@/scripts/migrate-tistory/convertQt";
import { convertSermon } from "@/scripts/migrate-tistory/convertSermon";
import { ExtractError, extractPost } from "@/scripts/migrate-tistory/extract";
import { collectImageSrcs } from "@/scripts/migrate-tistory/imageNodes";
import { overrideFor } from "@/scripts/migrate-tistory/overrides";

/**
 * 백업 → 적재 후보 (05 §6.1의 1·2단계).
 *
 * **리포트와 적재가 같은 함수를 쓴다.** dry-run에서 본 결과와 실제로 들어가는 것이 다르면
 * dry-run은 아무 의미가 없다 — 이 파일이 그 약속이다.
 */

export type PreparedPost = {
  /** DB에 적히는 멱등 키 = 백업 오프셋 + 원본 글 ID */
  legacyId: number;
  /** 백업 폴더의 번호. 리포트·`--only`가 이걸로 말한다 */
  originalId: number;
  file: string;
  folder: string;
  title: string;
  publishedAt: Date;
  site: MigrationSite;
  type: RecordType;
  categorySlug: string | null;
  tags: string[];
  content: unknown;
  /** 발행 게이트를 넘었는가. 못 넘으면 초안으로 들어간다(05 §6.3) */
  publishable: boolean;
  /** 게이트·스키마 위반 사유 */
  blockers: string[];
  /** 변환 중 흘린 것 */
  notes: string[];
  /** content 안의 이미지 주소 (중복 포함) */
  images: string[];
};

export type Skipped = { originalId: number; file: string; title: string; reason: string };

export type Prepared = {
  total: number;
  posts: PreparedPost[];
  excluded: Skipped[];
  review: Skipped[];
  failed: { file: string; error: string }[];
};

type BackupFile = { path: string; relative: string; folder: string };

function htmlFiles(root: string): BackupFile[] {
  const files: BackupFile[] = [];

  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (!statSync(path).isDirectory()) continue;

    for (const name of readdirSync(path)) {
      if (name.toLowerCase().endsWith(".html")) {
        files.push({ path: join(path, name), relative: `${entry}/${name}`, folder: path });
      }
    }
  }

  // 원본 글 ID 순 — 두 번 돌렸을 때 줄이 흔들리지 않게
  return files.sort((a, b) => Number(a.relative.split("/")[0]) - Number(b.relative.split("/")[0]));
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

  return {
    content: { kind: "TECH" as const, body: { type: "doc" as const, content } },
    notes: notes.map((note) => `${note.kind}: ${note.detail}`),
    // 원본부터 본문이 없는 글이 있다("(미완료)" 제목). 빈 지면을 공개하지 않는다
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
 * 게이트를 넘은 글만 발행 스키마를 통과해야 한다(05 §6.3). 못 넘은 글은 초안으로 들어가므로
 * 초안 스키마로 검증한다 — 그것마저 실패하면 저장 자체가 안 되니 반드시 알아야 한다.
 */
function validate(content: unknown, gate: string[]) {
  const parsed = gate.length === 0 ? parsePublishContent(content) : parseDraftContent(content);
  return parsed.ok ? [] : parsed.issues;
}

export function readBackup(input: string, backup: Backup): Prepared {
  const files = htmlFiles(input);

  const posts: PreparedPost[] = [];
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

    // 글 단위 예외가 규칙을 이긴다 — 카테고리를 안 고른 32편이 그렇다.
    // 표는 백업마다 다르다: 두 백업의 같은 번호는 서로 다른 글이다
    const classified = overrideFor(backup.overrides, post.legacyId) ?? classify(post.categoryPath);

    if (classified.kind !== "post") {
      const row = {
        originalId: post.legacyId,
        file: post.file,
        title: post.title,
        reason: classified.reason,
      };
      if (classified.kind === "exclude") excluded.push(row);
      else review.push(row);
      continue;
    }

    const converted = convertOne(classified.type, post.bodyHtml);
    const issues = validate(converted.content, converted.gate);
    const blockers = [...converted.gate, ...issues];

    posts.push({
      legacyId: backup.idOffset + post.legacyId,
      originalId: post.legacyId,
      file: post.file,
      folder: file.folder,
      title: post.title,
      publishedAt: post.publishedAt,
      site: classified.site,
      type: classified.type,
      categorySlug: classified.categorySlug,
      tags: post.tags,
      content: converted.content,
      publishable: blockers.length === 0,
      blockers,
      notes: converted.notes,
      images: collectImageSrcs(converted.content),
    });
  }

  return { total: files.length, posts, excluded, review, failed };
}
