/**
 * 코드 블록에 적을 언어 라벨. 하이라이팅 여부와 무관하게 화면에 쓰이므로 server-only가 아니다
 * (lib/render/highlight는 Shiki를 물고 있어 서버 전용이다).
 */
const LABELS: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TSX",
  typescript: "TypeScript",
  js: "JavaScript",
  jsx: "JSX",
  javascript: "JavaScript",
  json: "JSON",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  sql: "SQL",
  postgres: "SQL",
  postgresql: "SQL",
  css: "CSS",
  scss: "SCSS",
  html: "HTML",
  prisma: "Prisma",
};

export function languageLabel(language: string | null): string | null {
  if (!language) return null;
  const key = language.trim().toLowerCase();
  return LABELS[key] ?? language.trim();
}
