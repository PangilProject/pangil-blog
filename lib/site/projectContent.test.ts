import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
const MAX_SHOTS_PER_PROJECT = 10;
const MAX_SHOT_BYTES = 200 * 1024;
const SHOT_ROOT = "public/projects";

describe("작업물 콘텐츠 (ADR-005)", () => {
  it("slug가 겹치지 않는다", () => {
    const slugs = projects.map((project) => project.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
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
        // `.DS_Store` 같은 운영체제 부스러기는 화면이 아니다. 이것까지 세면
        // 파인더로 폴더를 한 번 연 것만으로 테스트가 빨개진다
        if (entry.name.startsWith(".")) continue;

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

/**
 * 캐러셀 CSS 가드 (ADR-005).
 *
 * 화면 넘김이 라디오 + CSS라 **규칙의 개수가 곧 넘길 수 있는 장수**다. 상한만 올리고
 * 규칙을 안 늘리면 7번째 장은 화살표를 눌러도 서지 않는다 — 화면에서는 "가끔 안 넘어간다"로만
 * 보이고 원인은 CSS에 있다. 그래서 숫자 둘을 여기서 묶는다.
 *
 * `color-mix` 금지는 ADR-004의 구현 노트에서 온다: 빌드가 그 규칙에 폴백을 만들면서
 * 이웃 규칙까지 `@supports`로 감싸 통째로 떨어뜨린 적이 있다.
 */
describe("화면 캐러셀 CSS (ADR-005)", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const squashed = css.replace(/\s+/g, "");
  /** 주석을 걷어낸 본문. "쓰지 않는다"는 설명글이 아니라 선언만 보고 판단한다 */
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");

  it("상한만큼의 장 규칙이 있다", () => {
    const rules = squashed.match(/--shot-i:\d+/g) ?? [];
    expect(new Set(rules).size).toBe(MAX_SHOTS_PER_PROJECT);
  });

  it("썸네일과 장 번호도 같은 수만큼 받는다", () => {
    expect((squashed.match(/\[data-shot-thumbs\]li:nth-child\(\d+\)/g) ?? []).length).toBe(
      MAX_SHOTS_PER_PROJECT,
    );
    expect((squashed.match(/\[data-shot-count\]>span:nth-child\(\d+\)/g) ?? []).length).toBe(
      MAX_SHOTS_PER_PROJECT,
    );
  });

  it("캐러셀 규칙에 color-mix를 쓰지 않는다", () => {
    const block = declarations.slice(declarations.indexOf("[data-shot-track]"));
    expect(block).not.toContain("color-mix");
  });

  it("움직임을 줄여 달라고 하면 미끄러지지 않는다", () => {
    expect(squashed).toContain(
      "@media(prefers-reduced-motion:reduce){[data-shot-track]{transition:none;}",
    );
  });
});
