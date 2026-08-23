/**
 * 먹지 코드 테마 (03 §3.2 · 04 §3.2) — 배경은 --ink, 글자는 종이색 계열.
 *
 * 에디터(클라이언트)와 공개 지면(서버)이 **같은 테마 하나**를 쓴다. 두 벌이면 쓰는 자리와
 * 보이는 자리의 색이 갈리고, 그건 ADR-001이 막으려던 바로 그 상태다.
 */
export const INK_THEME = {
  name: "record-ink",
  type: "dark" as const,
  colors: {
    "editor.background": "#2B2823",
    "editor.foreground": "#F3EFE4",
  },
  settings: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#8B8474" } },
    { scope: ["string", "constant.other.symbol"], settings: { foreground: "#C7B58A" } },
    { scope: ["constant.numeric", "constant.language"], settings: { foreground: "#D8A25B" } },
    { scope: ["keyword", "storage", "storage.type"], settings: { foreground: "#D98872" } },
    { scope: ["entity.name.function", "support.function"], settings: { foreground: "#A8BFA0" } },
    {
      scope: ["entity.name.type", "support.type", "support.class"],
      settings: { foreground: "#9DB4C0" },
    },
    { scope: ["variable", "meta.definition.variable"], settings: { foreground: "#F3EFE4" } },
    { scope: ["entity.name.tag"], settings: { foreground: "#D98872" } },
    { scope: ["entity.other.attribute-name"], settings: { foreground: "#C7B58A" } },
  ],
};
