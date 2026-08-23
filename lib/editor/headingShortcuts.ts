import { textblockTypeInputRule } from "@tiptap/core";
import { Heading, type Level } from "@tiptap/extension-heading";

/**
 * 마크다운 제목 단축 입력을 한 칸 밀어 붙인다 (02 §5.3 · ADR-001).
 *
 * Tiptap 기본 규칙은 "# 개수 = heading level"이다. 그런데 이 블로그의 지면에서 h1은 글
 * 제목이고 본문 최상위 제목은 h2다(02 §5.5 "제목(h2/h3)"). 그래서 기본 규칙으로는 작성자가
 * 자연스럽게 치는 `# `가 어느 level과도 맞지 않아 그냥 글자로 남는다 — 실제로 그랬다.
 *
 * 규칙을 순서대로 매핑한다: levels[0]에는 `#`, levels[1]에는 `##`.
 *   full(levels [2,3]) → `# `=제목1(h2), `## `=제목2(h3)
 *   slim(levels [3])   → `# `=소제목(h3)
 *
 * 결과적으로 작성자는 늘 `#`부터 쓰고, 문서에는 의미에 맞는 태그가 남는다.
 */
export const HeadingWithShiftedShortcuts = Heading.extend({
  addInputRules() {
    return this.options.levels.map((level: Level, index: number) =>
      textblockTypeInputRule({
        find: new RegExp(`^(#{${index + 1}})\\s$`),
        type: this.type,
        getAttributes: { level },
      }),
    );
  },
});
