"use client";

import { useState } from "react";

import { publishPost } from "@/lib/actions/posts";

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
 *
 * **저장이 끝났는지 확인하고 발행한다.** `flush()`가 정상 종료했다는 것은 저장이 성공했다는
 * 뜻이 아니다(아래 참조) — 그걸 믿고 넘어가면 옛 content가 발행된다.
 */

/** 화면 쪽 발행 게이트 — 각 폼의 `*PublishFormSchema` */
export type PublishGate = {
  safeParse: (value: unknown) => {
    success: boolean;
    error?: { issues: { message?: string }[] };
  };
};

/**
 * 발행이 막힌 사유를 사람 말로 (03 §7.3 — 구현 용어는 화면에 쓰지 않는다).
 *
 * 전에는 `발행하지 못했어요 (invalid-content)`처럼 서버의 사유 코드를 괄호에 그대로 달았다.
 * 영문 코드는 무엇을 고쳐야 하는지 알려주지 않는다 — 그게 화면 문구의 일이다.
 */
const PUBLISH_FAILURE: Record<string, string> = {
  "not-found": "이 글을 찾지 못했어요. 목록에서 다시 열어주세요",
  // 화면 게이트를 지나고도 여기서 막히는 것은 저장된 내용이 아직 덜 채워졌을 때다
  "invalid-content": "아직 덜 채운 칸이 있어요. 저장을 기다린 뒤 다시 눌러주세요",
  "type-mismatch": "글 종류가 맞지 않아요. 이 글은 목록에서 확인해 주세요",
};

export type PublishFlowOptions<TValues> = {
  gate: PublishGate;
  /** 발행 전에 저장을 마친다 — 서버는 저장된 content로 게이트를 통과시킨다 */
  flush: () => Promise<void>;
  /** 그 저장이 실제로 끝났는가 (autosave.isDirty) */
  isDirty: () => boolean;
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
  gate,
  flush,
  isDirty,
  clearMirror,
  currentId,
}: PublishFlowOptions<TValues>) {
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

      /**
       * **`flush()`는 저장이 실패해도 정상 종료한다.** 상태 기계가 재시도를 걸 뿐 다시
       * 던지지 않는다(lib/editor/autosave의 catch). 그래서 여기까지 왔다고 저장이 끝난 것이
       * 아니다.
       *
       * 그대로 두면 `publishPost`가 **DB에서 content를 다시 읽어** 발행한다 — 방금 쓴 문단이
       * 빠진 옛 내용이 나가고, 발행 게이트도 그 옛 내용으로 판단해서 아무도 막지 않는다.
       * 반대로 저장된 것이 아직 비어 있으면 다 써놓고도 "덜 채웠다"로 거절당한다.
       *
       * 유실은 아니다 — 재시도가 나중에 올린다. 막아야 하는 것은 **그 사이에 나가는 발행**이다.
       */
      if (isDirty()) {
        setError("아직 저장되지 않은 내용이 있어요. 저장을 마친 뒤에 다시 눌러주세요");
        setIsPublishing(false);
        return;
      }

      const target = currentId();
      if (!target) {
        setError("아직 저장되지 않았어요. 잠시 후 다시 시도해 주세요");
      } else {
        const result = await publishPost(target);

        if (!result.ok) {
          setError(
            PUBLISH_FAILURE[result.reason] ?? "발행하지 못했어요. 잠시 후 다시 시도해 주세요",
          );
        } else {
          clearMirror();
          // 발행 직후 그 글의 공개 지면으로 간다(02 §3.2 확정). 도착지는 설정값이 아니라
          // 발행 결과에서 온다 — 방금 만들어진 주소라 서버만 알 수 있다.
          //
          // `router.push`가 아닌 이유는 **호스트가 갈리기 때문**이다. 발행 화면은 루트
          // 호스트의 `/admin`이고 글은 `faith.○`에 선다 — 라우터는 그 경계를 넘지 못한다
          window.location.assign(result.url);
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
