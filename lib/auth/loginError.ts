/**
 * 로그인 실패 사유를 사람 말로 (A-00 · 03 §7 문구 규약).
 *
 * 사유마다 **다음에 할 일이 다르다** — 빈 칸이면 적으면 되고, 틀렸으면 다시 확인해야 한다.
 * 한 문장으로 뭉치면 빈 칸으로 제출한 사람이 비밀번호를 의심한다.
 *
 * 계정이 없는 것과 비밀번호가 틀린 것은 **구분하지 않는다**(05 §3.2) — 어느 이메일이
 * 관리자인지 알려주는 셈이 된다.
 */
const MESSAGES: Record<string, string> = {
  empty: "이메일과 비밀번호를 적어주세요.",
  invalid: "로그인하지 못했어요. 이메일과 비밀번호를 확인해 주세요.",
};

export function loginErrorMessage(error: string | undefined | null): string | null {
  if (!error) return null;
  // 모르는 사유도 조용히 넘기지 않는다. 무슨 일이 있었다는 것은 말해야 한다
  return MESSAGES[error] ?? MESSAGES.invalid;
}
