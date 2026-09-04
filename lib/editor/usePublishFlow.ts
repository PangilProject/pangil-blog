"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { publishPost } from "@/lib/actions/posts";
import type { RecordType } from "@/lib/record/callNumber";
import { publicPostPath } from "@/lib/record/paths";

/**
 * 발행 흐름 (02 §3.2 · 05 §3.4).
 *
 * 에디터 4종이 똑같은 순서를 밟는다: 화면 게이트 → 저장 마무리 → 발행 → 그 글의 공개 지면.
 * 네 벌로 두면 다음에 세 곳만 고친다 — 실제로 진행 표시가 빠진 것을 네 곳에서 함께 발견했다.
 *
 * **누른 뒤가 보여야 한다.** 전에는 버튼이 `disabled`만 되고 글자는 `발행`으로 남아 있었다.
 * 게다가 `finally`에서 상태를 되돌려서, 이동이 아직 진행 중인데 버튼이 `발행`으로 돌아왔다 —
 * 누른 사람 눈에는 "눌렀는데 아무 일도 안 일어났다"로 보인다. 그래서
 *
 * - 진행 중에는 `isPublishing`이 참이고, 버튼이 그 사실을 글자로 말한다
 * - **성공하면 되돌리지 않는다.** 이동이 끝나면 이 화면 자체가 사라진다
 * - 실패·예외에서만 되돌린다. 되돌리지 않으면 다시 시도할 길이 없다
 */

/** 화면 쪽 발행 게이트 — 각 폼의 `*PublishFormSchema` */
export type PublishGate = {
  safeParse: (value: unknown) => {
    success: boolean;
    error?: { issues: { message?: string }[] };
  };
};

export type PublishFlowOptions<TValues> = {
  type: RecordType;
  gate: PublishGate;
  /** 발행 전에 저장을 마친다 — 서버는 저장된 content로 게이트를 통과시킨다 */
  flush: () => Promise<void>;
  clearMirror: () => void;
  /**
   * 초안 id. ref에서 읽어야 한다 — 첫 저장이 이 클릭 안에서 끝나면 상태로 읽은 값은
   * 아직 null이고, 방금 저장에 성공했는데도 "아직 저장되지 않았어요"로 막힌다.
   */
  currentId: () => string | null;
  /** 폼 값 타입을 고정하기 위한 자리. 런타임에는 쓰지 않는다 */
  values?: TValues;
};

export function usePublishFlow<TValues>({
  type,
  gate,
  flush,
  clearMirror,
  currentId,
}: PublishFlowOptions<TValues>) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publish = async (values: TValues) => {
    const validated = gate.safeParse(values);
    if (!validated.success) {
      setError(validated.error?.issues[0]?.message ?? "발행할 수 없어요");
      return;
    }

    setError(null);
    setIsPublishing(true);

    try {
      await flush();

      const target = currentId();
      if (!target) {
        setError("아직 저장되지 않았어요. 잠시 후 다시 시도해 주세요");
      } else {
        const result = await publishPost(target);

        if (!result.ok) {
          setError(`발행하지 못했어요 (${result.reason})`);
        } else {
          clearMirror();
          // 발행 직후 그 글의 공개 지면으로 간다(02 §3.2 확정). 도착지는 설정값이 아니라
          // 발행 결과의 slug에서 나온다 — 방금 만들어진 주소라 여기서만 알 수 있다
          router.push(publicPostPath(type, result.slug));
          // 이동이 끝날 때까지 진행 표시를 남긴다. 여기서 되돌리면 화면이 바뀌기 전에
          // 버튼이 `발행`으로 돌아가 안 된 것처럼 보인다
          return;
        }
      }
    } catch (cause) {
      // 저장 실패(네트워크)가 여기로 온다. 삼키면 버튼이 영원히 `발행 중…`으로 남는다
      console.error("[publish]", cause);
      setError("발행하지 못했어요. 잠시 후 다시 시도해 주세요");
    }

    setIsPublishing(false);
  };

  return { isPublishing, error, publish, setError };
}
