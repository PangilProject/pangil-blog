/**
 * 코드 블록 언어 목록 (02 §5.5 "코드 블록(언어 지정)").
 *
 * 에디터의 선택 목록과 공개 지면의 라벨이 같은 목록을 쓴다. 하이라이터가 문법을 싣는 목록도
 * 여기에 맞춰야 하며(lib/render/highlight), 어긋나면 "고를 수는 있는데 색이 안 입는 언어"가
 * 생긴다 — 그 일치를 테스트로 고정한다.
 */
export const CODE_LANGUAGES = [
  { value: "ts", label: "TypeScript" },
  { value: "tsx", label: "TSX" },
  { value: "js", label: "JavaScript" },
  { value: "jsx", label: "JSX" },
  { value: "json", label: "JSON" },
  { value: "bash", label: "bash" },
  { value: "sql", label: "SQL" },
  { value: "css", label: "CSS" },
  { value: "html", label: "HTML" },
  { value: "prisma", label: "Prisma" },
  // 아래는 티스토리 이관(M5)에서 실제로 쓰인 언어들이다. "고를 수는 있는데 색이 안 입는
  // 언어"를 만들지 않으려면 lib/render/highlight의 로더도 같이 늘려야 한다(테스트로 고정)
  { value: "java", label: "Java" },
  { value: "swift", label: "Swift" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "python", label: "Python" },
  { value: "yaml", label: "YAML" },
  { value: "md", label: "Markdown" },
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number]["value"];

/** 붙여넣은 마크다운의 언어 표기는 제각각이다 — 같은 문법으로 모은다 */
const ALIASES: Record<string, CodeLanguage> = {
  typescript: "ts",
  javascript: "js",
  shell: "bash",
  sh: "bash",
  zsh: "bash",
  console: "bash",
  postgres: "sql",
  postgresql: "sql",
  pgsql: "sql",
  scss: "css",
  py: "python",
  yml: "yaml",
  markdown: "md",
  "c++": "cpp",
  xml: "html",
};

export function normalizeCodeLanguage(language: string | null | undefined): CodeLanguage | null {
  if (!language) return null;
  const key = language.trim().toLowerCase();

  const known = CODE_LANGUAGES.find((entry) => entry.value === key);
  if (known) return known.value;

  return ALIASES[key] ?? null;
}

/** 화면에 적을 라벨. 모르는 언어는 적힌 그대로 보여준다 — 지우면 정보가 사라진다 */
export function codeLanguageLabel(language: string | null | undefined): string | null {
  const normalized = normalizeCodeLanguage(language);
  if (normalized) {
    return CODE_LANGUAGES.find((entry) => entry.value === normalized)?.label ?? normalized;
  }

  const raw = language?.trim();
  return raw ? raw : null;
}
