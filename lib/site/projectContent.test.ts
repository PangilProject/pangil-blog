import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { hubWorks } from "@/lib/site/hubContent";
import { findProject, projects } from "@/lib/site/projectContent";

/**
 * `/project` 지면의 약속을 잠근다 (ADR-005).
 *
 * 이 파일이 막는 것은 둘이다.
 *
 * 1. **허브의 `자세히 ↗`가 404로 가는 것.** 허브와 `/project`는 일부러 서로 다른 문장을
 *    적지만(중복이 낡는다), 링크만은 구조로 묶어 둔다
 * 2. **스크린샷이 조용히 무거워지는 것.** 지금 `images.unoptimized: true`라 올린 바이트가
 *    그대로 내려간다(2026-09 Storage 초과 회차). 최적화기가 뒤에서 구해 주지 않으므로
 *    상한은 사람이 지켜야 하고, 사람이 지키는 것은 반드시 한 번 샌다
 */

/** ADR-005가 정한 스크린샷 상한 */
const MAX_SHOTS_PER_PROJECT = 6;
const MAX_SHOT_BYTES = 200 * 1024;
const SHOT_ROOT = "public/projects";

describe("작업물 콘텐츠 (ADR-005)", () => {
  it("slug가 겹치지 않는다", () => {
    const slugs = projects.map((project) => project.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("청구기호가 겹치지 않는다", () => {
    const calls = projects.map((project) => project.call);
    expect(new Set(calls).size).toBe(calls.length);
  });

  it("허브 작업물의 `자세히` 링크가 전부 존재하는 지면을 가리킨다", () => {
    const missing = hubWorks
      .filter((work) => work.project)
      .filter((work) => !findProject(work.project as string))
      .map((work) => `${work.call} → ${work.project}`);

    expect(missing).toEqual([]);
  });

  it("바깥으로 나가는 링크는 전부 https다", () => {
    const bad = projects.flatMap((project) =>
      project.links.filter((link) => !link.href.startsWith("https://")).map((link) => link.href),
    );

    expect(bad).toEqual([]);
  });

  it("스크린샷 경로가 자기 slug 아래를 가리킨다", () => {
    const misplaced = projects.flatMap((project) =>
      project.shots
        .filter((shot) => !shot.src.startsWith(`/projects/${project.slug}/`))
        .map((shot) => shot.src),
    );

    expect(misplaced).toEqual([]);
  });

  it("스크린샷이 있으면 파일이 실제로 있고 크기를 적었다", () => {
    const broken = projects.flatMap((project) =>
      project.shots
        .filter(
          (shot) => !existsSync(join("public", shot.src)) || shot.width < 1 || shot.height < 1,
        )
        .map((shot) => shot.src),
    );

    expect(broken).toEqual([]);
  });

  it("건당 스크린샷이 상한을 넘지 않는다", () => {
    const over = projects
      .filter((project) => project.shots.length > MAX_SHOTS_PER_PROJECT)
      .map((project) => `${project.slug}: ${project.shots.length}장`);

    expect(over).toEqual([]);
  });
});

describe("스크린샷 파일 (ADR-005 상한)", () => {
  /** `public/projects` 아래 실제 파일. 콘텐츠가 안 가리키는 파일도 용량은 먹는다 */
  function allShotFiles(): string[] {
    if (!existsSync(SHOT_ROOT)) return [];

    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else found.push(path);
      }
    };
    walk(SHOT_ROOT);

    return found;
  }

  it("webp만 둔다", () => {
    const wrong = allShotFiles().filter((path) => !path.endsWith(".webp"));
    expect(wrong).toEqual([]);
  });

  it("한 장이 200KB를 넘지 않는다", () => {
    const heavy = allShotFiles()
      .filter((path) => statSync(path).size > MAX_SHOT_BYTES)
      .map((path) => `${path} (${Math.round(statSync(path).size / 1024)}KB)`);

    expect(heavy).toEqual([]);
  });
});
