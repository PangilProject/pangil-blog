/**
 * 커밋 규칙(AGENTS.md "커밋 & 브랜치 규칙")을 자동 검증한다.
 * - Conventional Commits, 제목은 영문 소문자
 * - 본문은 한글 (길이 제한을 두지 않는다 — HEREDOC 여러 줄 본문 전제)
 * - Claude 서명/어트리뷰션 푸터 금지는 .husky/commit-msg에서 별도 차단
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "chore", "docs", "refactor", "test", "ci", "perf", "revert", "style"],
    ],
    "subject-case": [2, "always", "lower-case"],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 72],
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};
