import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * 허브 머무는 구간의 CSS 가드 (ADR-004 결정 2).
 *
 * **조판이 없는 테스트로는 볼 수 없는 고장들**이라 규칙 자체를 훑는다 — 04 §3.6.1이
 * 같은 이유로 빌드된 CSS를 직접 확인했던 그 방식이다. 화면에서는 "스크롤해도 안 바뀐다"로만
 * 보이고 원인은 전혀 다른 곳에 있다.
 *
 * 여기 걸린 둘은 **실제로 한 번씩 낸 고장**이다.
 */
const css = readFileSync("app/globals.css", "utf8");

/** 공백을 지워 비교한다 — 포매터가 줄을 어떻게 접든 규칙은 같다 */
const squashed = css.replace(/\s+/g, "");

/**
 * 규칙이 있는지만 묻는다. `expect(css).toContain(...)`을 쓰면 실패할 때 CSS 전문이
 * 덤프되어 정작 무엇이 틀렸는지 안 보인다.
 */
const has = (pattern: RegExp) => pattern.test(squashed);

/** 주석을 걷어낸 본문. "쓰지 않는다"를 확인하는 가드는 설명글이 아니라 선언만 봐야 한다 */
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("허브 머무는 구간 CSS", () => {
  it("구간 안에서는 순차 등장 애니메이션을 끈다", () => {
    // `.record-appear`는 animation-fill-mode: both라 끝난 뒤에도 opacity: 1을 붙들고,
    // 애니메이션은 일반 선언을 이긴다 — 이 규칙이 없으면 겹쳐 둔 항목이 전부 보인다
    expect(has(/html\[data-hub-live\]\[data-hub-step\]\{animation:none;?\}/)).toBe(true);
  });

  it("겹쳐 둔 항목은 기본이 감춤이고, 켜진 것만 보인다", () => {
    expect(has(/\[data-hub-steps="swap"\]>\[data-hub-step\]\{[^}]*opacity:0/)).toBe(true);
    expect(has(/\[data-hub-steps="swap"\]>\[data-hub-step\]\[data-on="1"\]\{[^}]*opacity:1/)).toBe(
      true,
    );
  });

  it("겹침 칸의 높이를 em으로 주지 않는다", () => {
    // 이 칸의 글자는 15px인데 안에 든 제목은 clamp로 훨씬 크다.
    // 부모 em을 기준 삼으면 높이가 1/4로 잡혀 항목이 칸 밖으로 나간다
    const page = readFileSync("app/(public)/hub/page.tsx", "utf8");
    const minHeights = [...css, ...page].length
      ? [...(css.match(/--steps-min[^;"}]*/g) ?? []), ...(page.match(/--steps-min[^,}]*/g) ?? [])]
      : [];

    expect(minHeights.length).toBeGreaterThan(0);
    for (const value of minHeights) {
      expect(value).not.toMatch(/\d\s*em\b/);
    }
  });

  it("붙들기를 푸는 조건은 세로가 짧을 때뿐이다", () => {
    // 좁은 화면 전체에서 풀면 폰에서는 스크롤해도 아무 일이 없는 정적인 문서가 된다 —
    // 이 지면에서 보여줄 것의 절반이 사라진다. 폭은 글자를 줄여 담는다
    expect(has(/@media\(height<34rem\)/)).toBe(true);
    expect(has(/html\[data-hub-live\]\[data-hub-track\]\{height:auto/)).toBe(true);
    expect(has(/@media\(width<40rem\),\(height<40rem\)/)).toBe(false);
  });

  it("좁은 화면에서도 붙들되, 한 화면에 담기게 줄인다", () => {
    const at = css.indexOf("min-height: 56svh");

    expect(at).toBeGreaterThan(-1);
    expect(css.lastIndexOf("@media (width < 40rem)", at)).toBeGreaterThan(
      css.lastIndexOf("}\n}", at),
    );
  });

  it("달력을 감추는 규칙이 없다 — 늦게 오는 조각을 빈 자리로 두지 않는다", () => {
    // 달력·발행 수는 Suspense 안에서 나중에 스트리밍으로 온다. 스크립트가 그 노드에
    // 속성을 쓰면 React가 하이드레이트하기 전에 DOM이 갈려 서버와 어긋나고(hydration mismatch),
    // 못 잡은 채 CSS가 숨기면 영영 비어 있다 — 둘 다 실제로 났다.
    // 그래서 달력은 **감추지 않는다.** 나타나는 연출은 스크롤 타임라인이 맡는다.
    expect(has(/\[data-heat\][^{]*\{[^}]*opacity:0/)).toBe(false);
  });

  it("달력에는 사라질 수 있는 연출을 걸지 않는다", () => {
    // 스크롤 타임라인 연출을 걸었더니 빌드가 그 규칙을 떨어뜨리면서 clip-path 시작값만 남아
    // 달력이 잘린 채 굳었다. 보여야 하는 것에 조건부 연출을 얹지 않는다
    expect(declarations).not.toContain("animation-timeline");
    expect(declarations).not.toContain("clip-path");
  });

  it("가로 넘침을 막는 규칙이 color-mix보다 앞에 선다", () => {
    // 빌드는 color-mix를 쓰는 규칙에 @supports 폴백을 만들면서 **이웃 규칙까지 함께 감싼다.**
    // 감싸이면 그 문법을 모르는 브라우저에서 클립이 사라지고 지면이 옆으로 밀린다 — 폰에서 그랬다.
    // 지면 전체를 자르는 그물이 있는가
    const bodyClip = declarations.search(/body\s*\{[^}]*overflow-x:\s*clip/);
    expect(bodyClip).toBeGreaterThan(-1);

    // 흐르는 글자를 담은 칸도 스스로 자르는가.
    // 이 칸에는 sticky가 없으므로 `hidden`으로 완전히 가둔다 — 오래된 브라우저까지 듣는다
    const marqueeClip = declarations.search(/\[data-hub-marquee\]\s*\{[^}]*overflow:\s*hidden/);
    expect(marqueeClip).toBeGreaterThan(-1);

    // 둘 다 color-mix보다 앞에 서는가
    const firstMix = declarations.indexOf("color-mix");
    expect(bodyClip).toBeLessThan(firstMix);
    expect(marqueeClip).toBeLessThan(firstMix);
  });

  it("무대의 칸이 내용 폭을 따라 늘어나지 않는다", () => {
    // grid의 `auto` 트랙은 자식의 max-content 폭까지 늘어난다. 흐르는 글자 한 줄이 화면의
    // 몇 배라 트랙이 그만큼 커지고, 안쪽이 커진 채 overflow가 잘라낸다 —
    // **문서는 안 넘치니 좌우로 밀 수도 없는데 오른쪽 글자만 잘려 나간다.** 폰·PC 모두 그랬다
    const stage = declarations.match(/\[data-hub-stage\]\s*\{[^}]*\}/)?.[0] ?? "";

    expect(stage).toContain("display: grid");
    expect(stage).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  it("흐르는 글자를 담은 칸은 flex가 아니다", () => {
    // flex 컨테이너는 자식의 max-content 폭에 맞춰 스스로 늘어난다. 그러면 흐르는 글자가
    // 칸을 밀고, 칸이 바깥을 밀어 지면이 좌우로 삐져나간다 — 폰에서 실제로 그랬다
    const rule = declarations.match(/\[data-hub-marquee\]\s*\{[^}]*display:[^;}]+/g) ?? [];

    expect(rule.length).toBeGreaterThan(0);
    for (const found of rule) {
      expect(found).toContain("display: block");
    }
  });

  it("자르는 것은 clip이지 hidden이 아니다", () => {
    // hidden은 스크롤 상자를 만들어 안쪽 position: sticky를 죽인다 — 머무는 구간이 거기 걸린다
    expect(declarations).not.toMatch(/body\s*\{[^}]*overflow(-x)?:\s*hidden/);
  });

  it("좁은 화면 재정의가 넓은 화면으로 새지 않는다", () => {
    // **모바일을 고치다 PC가 깨지는 것은 재정의가 미디어쿼리 밖으로 새기 때문이다.**
    // 좁은 화면에서만 필요한 값들이 조건 없이 선언돼 있으면 여기서 걸린다.
    const mobileOnly = [
      "--heat-cell: 9px", // 달력 칸 줄이기
      "overscroll-behavior-x", // 손가락으로 밀 때 지면까지 밀리지 않게
    ];

    for (const needle of mobileOnly) {
      const at = css.indexOf(needle);
      expect(at).toBeGreaterThan(-1);

      // 이 선언 앞에 가장 가까운 여는 블록이 좁은 화면 미디어쿼리여야 한다
      const media = css.lastIndexOf("@media", at);
      const between = css.slice(media, at);

      expect(between).toContain("width < 40rem");
      expect(between).not.toContain("}\n}"); // 그 사이에서 닫히지 않았는가
    }
  });

  it("터치 기기에서 딱지가 눌린 채 남지 않는다", () => {
    // 터치에는 :hover를 뗄 방법이 없다. 한 번 누른 칸의 딱지가 화면에 박힌다
    const at = css.indexOf("[data-heat] > i[data-label]:hover::after");

    expect(at).toBeGreaterThan(-1);
    expect(css.lastIndexOf("@media (hover: hover)", at)).toBeGreaterThan(
      css.lastIndexOf("}\n}", at),
    );
  });

  it("연출이 없으면 구간 규칙이 하나도 서지 않는다", () => {
    // 머무는 구간·겹침·눈금은 전부 live 조건 아래에 있어야 한다.
    // 하나라도 새어 나가면 JS 없는 지면이 깨진다(04 §3.6 "JS 없이도 읽힌다")
    const trackRules =
      css.match(/^[^@{}\n][^{}\n]*\[data-hub-(track|stage|steps)[^{}\n]*\{/gm) ?? [];

    for (const rule of trackRules) {
      expect(rule).toContain("data-hub-live");
    }
  });
});
