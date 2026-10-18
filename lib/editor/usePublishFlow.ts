"use client";

import { useState } from "react";

import { publishFromEditor, type UpsertDraftInput } from "@/lib/actions/posts";

/**
 * 발행 흐름 (02 §3.2 · ADR-006).
 *
 * 에디터 4종이 똑같은 순서를 밟는다: 화면 게이트 → **지금 값을 실어 발행 요청 한 번** → 그 글의
 * 공개 지면. 네 벌로 두면 다음에 세 곳만 고친다.
 *
 * **발행이 저장을 기다리지 않는다.** 전에는 자동 저장을 마저 돌리고(flush), 다 올라갔는지
 * 확인한 뒤(isDirty), DB에 저장된 content로 발행했다 — 다 썼는데 마지막 저장이 끝날 때까지
 * 발행이 막혔다. 이제 요청이 폼 값을 들고 가서 서버가 저장과 발행을 함께 한다
 * (`publishFromEditor`). 옛 content로 발행되는 사고는 구조적으로 사라진다.
 *
 * **누른 뒤가 보여야 한다.** 진행 중에는 `isPublishing`이 참이고 버튼이 그 사실을 글자로 말한다.
 * 성공하면 되돌리지 않는다(이동이 끝나면 화면이 사라진다). 실패·예외에서만 되돌린다.
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
 */
const PUBLISH_FAILURE: Record<string, string> = {
  "not-found": "이 글을 찾지 못했어요. 목록에서 다시 열어주세요",
  // 화면 게이트를 지나고도 여기서 막히는 것은 서버 게이트가 더 엄격한 칸이다
  "invalid-content": "아직 덜 채운 칸이 있어요. 확인한 뒤 다시 눌러주세요",
  "type-mismatch": "글 종류가 맞지 않아요. 이 글은 목록에서 확인해 주세요",
};

export type PublishFlowOptions<TValues> = {
  gate: PublishGate;
  /** 폼 값 → 서버 입력. 임시저장과 같은 모양이다(id는 여기서 붙인다) */
  toInput: (values: TValues) => Omit<UpsertDraftInput, "id">;
  /** 초안 id. ref에서 읽는다 — 아직 서버에 없는 새 글이면 null */
  currentId: () => string | null;
  /** 새 글이 저장까지는 됐는데 발행에서 막혔다 — 그 id를 넘겨받아야 다시 누를 때 초안이 안 는다 */
  onSaved: (id: string) => void;
  /** 발행 요청이 도는 동안 자동 저장을 멈춘다 — 새 글이면 초안이 둘 생긴다 */
  hold: () => void;
  release: () => void;
  clearMirror: () => void;
};

export function usePublishFlow<TValues>({
  gate,
  toInput,
  currentId,
  onSaved,
  hold,
  release,
  clearMirror,
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
    hold();

    try {
      const result = await publishFromEditor({ ...toInput(values), id: currentId() ?? undefined });

      if (result.ok) {
        clearMirror();
        // 발행 직후 그 글의 공개 지면으로 간다(02 §3.2 확정). `router.push`가 아닌 이유는
        // 호스트가 갈리기 때문이다 — 발행 화면은 루트 호스트의 `/admin`이고 글은 `faith.○`에 선다.
        // 이동이 끝날 때까지 진행 표시를 남긴다
        window.location.assign(result.url);
        return;
      }

      if (result.id) onSaved(result.id);
      setError(PUBLISH_FAILURE[result.reason] ?? "발행하지 못했어요. 잠시 후 다시 시도해 주세요");
    } catch (cause) {
      // 네트워크 실패가 여기로 온다. 삼키면 버튼이 영원히 `발행 중…`으로 남는다
      console.error("[publish]", cause);
      setError("발행하지 못했어요. 잠시 후 다시 시도해 주세요");
    }

    release();
    setIsPublishing(false);
  };

  return { isPublishing, error, publish, setError };
}
