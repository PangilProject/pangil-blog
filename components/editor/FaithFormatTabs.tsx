"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DividerTabs } from "@/components/record/DividerTabs";
import { discardDraft } from "@/lib/actions/posts";
import { TYPE_LABELS } from "@/lib/record/axis";
import type { RecordType } from "@/lib/record/callNumber";
import { editorPath } from "@/lib/record/todayCard";

/**
 * 묵상 서식 고르기 (A-04~06 · 02 §2.4).
 *
 * 신앙 지면의 글쓰기는 진입이 하나다(`/admin/write/faith`). 하지만 **저장 계약은 셋으로
 * 갈린다** — 타입이 content 스키마·청구기호 시퀀스·slug 접두어(`qt-`/`sr-`/`pr-`)를 가르는
 * 축이다. 그래서 에디터를 합치지 않고 이 탭이 그 위에 선다.
 *
 * **아직 아무것도 안 적었을 때만 보인다.** 내용이 있는 뒤에 서식을 바꾸는 것은 여전히 불가다
 * (02 §2.4 "변경 = 삭제 후 재작성"). 비어 있을 때 고르는 것은 변경이 아니라 최초 결정이라
 * 그 결정에만 문을 연다 — 쓰기 시작하면 탭은 조용히 사라지고, 그때부터 이 글의 종류는
 * 정해진 것이다.
 *
 * 자동 저장이 이미 빈 초안을 만들었다면 그것을 지우고 옮긴다. 초안함에 빈 껍데기가 쌓이면
 * "이어서 쓸 것"이라는 초안함의 질문이 흐려진다.
 */

const FAITH_FORMATS: RecordType[] = ["QT", "SERMON", "PRAISE"];

export function FaithFormatTabs({
  current,
  postId,
  isEmpty,
}: {
  current: RecordType;
  /** 자동 저장이 이미 만든 초안. 옮기기 전에 지운다 */
  postId: string | null;
  /** 폼이 아직 비어 있는가 — 각 폼의 isEmptyForm이 판단한다 */
  isEmpty: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 쓰기 시작하면 사라진다. 안내를 남기지 않는 것은 의도다 — 이 자리는 글의 자리이고,
  // "이제 못 바꿔요"는 방금 쓰기 시작한 사람에게 할 말이 아니다
  if (!isEmpty) return null;

  const switchTo = (next: RecordType) =>
    startTransition(async () => {
      if (postId) {
        const result = await discardDraft(postId);

        if (!result.ok) {
          // 발행된 글이면 서버가 막는다. 화면 판단이 틀렸다는 뜻이라 조용히 넘기지 않는다
          setError("서식을 바꾸지 못했어요");
          return;
        }
      }

      router.replace(editorPath(next));
    });

  return (
    <div className="flex flex-col gap-1.5">
      <DividerTabs
        label="묵상 서식"
        items={FAITH_FORMATS.map((type) => ({
          label: TYPE_LABELS[type],
          // 탭이지만 이동이 아니다 — 빈 초안을 지우고 옮기므로 링크로 두면 그 정리가 빠진다.
          // 지금 서식도 버튼으로 둔다: 누를 수 없는 링크(`href="#"`)는 화면 맨 위로 튄다
          href: editorPath(type),
          active: type === current,
          onSelect: () => {
            if (type === current || isPending) return;
            switchTo(type);
          },
        }))}
      />

      <p className="font-typewriter text-[10.5px] text-faint">
        {error ?? (isPending ? "서식을 바꾸는 중…" : "쓰기 시작하면 이 글의 서식이 정해져요")}
      </p>
    </div>
  );
}
