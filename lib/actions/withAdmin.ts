import "server-only";

import type { User } from "@supabase/supabase-js";

import { getAdminUser } from "@/lib/auth/adminSession";

export class UnauthorizedError extends Error {
  constructor() {
    super("관리자 인증이 필요합니다.");
    this.name = "UnauthorizedError";
  }
}

/**
 * 모든 변경 Server Action의 첫 줄 가드 (05 §3.2 이중 가드).
 *
 * middleware만으론 부족하다 — Server Action은 별도 POST 엔드포인트로 직접 호출될 수
 * 있으므로, 상태를 바꾸는 액션은 예외 없이 이 래퍼를 통과해야 한다.
 * (upsertDraft / publishPost / updatePost / setPrivate / deletePost / 카테고리·태그 관리 …)
 *
 * 사용: export const publishPost = withAdmin(async (user, postId: string) => { ... })
 */
export function withAdmin<Args extends unknown[], Result>(
  action: (user: User, ...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args: Args) => {
    const user = await getAdminUser();
    if (!user) {
      throw new UnauthorizedError();
    }
    return action(user, ...args);
  };
}
