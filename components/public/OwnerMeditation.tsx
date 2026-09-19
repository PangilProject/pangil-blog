"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import { CopyButton } from "@/components/public/CopyButton";
import { hasAdminUiHint } from "@/lib/auth/adminUiHint";
import type { HiddenMeditationBlock } from "@/lib/praise/meditation";
import { tiptapToCopyText } from "@/lib/render/plainText";
import { renderRichText } from "@/lib/render/richText";

/**
 * 본인이 볼 때만 나오는 감춘 묵상 덩이 (02 §5.4).
 *
 * **읽는 사람의 HTML에는 감춘 글자가 없다.** 공개 상세는 통째로 캐시되므로(`use cache`,
 * ADR-003) 그 글자를 실으면 캐시 항목 하나가 모든 방문자에게 나간다. 그래서 마운트 뒤에
 * 힌트 쿠키를 보고, 있으면 서버에 따로 받아 온다.
 *
 * 쿠키는 **물어볼지만** 정한다. 흉내 내도 `loadHiddenMeditation`이 `withAdmin`으로
 * 세션을 확인하므로 아무것도 오지 않는다 — `수정`·`삭제`(A-03b)와 달리 여기서는 쿠키가
 * 게이트가 아니다. 내용을 가리는 일은 서버가 한다.
 *
 * 받아 온 것은 **묵상 끝에 모아서** 세운다. 감춘 자리에 끼워 넣으려면 공개 덩이까지 이
 * 아일랜드가 그려야 하고, 그러면 읽는 사람의 지면에 없어도 되는 클라이언트 코드가 늘어난다
 * (04 §3.6). 모아 두면 "이건 안 나가는 것들"이 한눈에 보이는 이득도 있다.
 *
 * 조회는 한 번이다. 소제목 옆 복사와 아래 덩이 목록이 같은 값을 쓰므로 컨텍스트로 나눈다.
 *
 * **조회 함수는 프롭으로 받는다.** 아일랜드가 `"use server"` 모듈을 import하면 그 모듈
 * 그래프(Prisma까지)가 클라이언트로 딸려온다 — M3에서 실제로 테스트 다섯 개가 그렇게
 * 깨졌다(04 §3.3). 여기는 콜백만 알고 무엇을 조회하는지는 모른다.
 */

type OwnerState = { blocks: HiddenMeditationBlock[] };

const OwnerContext = createContext<OwnerState>({ blocks: [] });

export function OwnerMeditation({
  postId,
  load,
  children,
}: {
  postId: string;
  /** 서버 액션. 세션 확인은 그쪽(`withAdmin`)이 한다 */
  load: (postId: string) => Promise<HiddenMeditationBlock[]>;
  children: ReactNode;
}) {
  const [blocks, setBlocks] = useState<HiddenMeditationBlock[]>([]);

  useEffect(() => {
    // 서버 렌더에서는 쿠키를 읽지 않는다 — 렌더 중에 읽으면 하이드레이션이 어긋난다
    if (!hasAdminUiHint(document.cookie)) return;

    let cancelled = false;
    void (async () => {
      try {
        const loaded = await load(postId);
        if (!cancelled) setBlocks(loaded);
      } catch (error) {
        /**
         * 읽는 지면에 오류 문구를 띄울 일은 아니다 — 여기까지 온 사람은 본인이고, 감춘 덩이가
         * 안 보이는 것이 글을 못 읽게 만들지도 않는다.
         *
         * **다만 조용히 삼키지는 않는다.** 대개는 세션이 끊긴 것이지만 그물이 끊겼거나 서버가
         * 답을 못 준 것일 수도 있고, 그때 화면은 "감춘 덩이가 없다"와 구분되지 않는다.
         * 콘솔에 사유가 남으면 스크린샷 한 장으로 갈린다(`SaveErrorNote`와 같은 이유).
         */
        console.warn("[감춘 묵상] 받아오지 못했습니다", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [postId, load]);

  return <OwnerContext.Provider value={{ blocks }}>{children}</OwnerContext.Provider>;
}

/**
 * 묵상과 기도 전체 복사.
 *
 * 본인이 보고 있으면 **감춘 덩이까지** 담는다 — 화면에 보이는 것을 복사한다는 규칙을 그대로
 * 따른다. 읽는 사람에게는 공개된 글자만 간다.
 */
export function MeditationCopyButton({ publicText }: { publicText: string }) {
  const { blocks } = useContext(OwnerContext);

  const text = [publicText, ...blocks.map((block) => tiptapToCopyText(block.doc))]
    .filter((part) => part !== "")
    .join("\n\n");

  if (text === "") return null;

  return <CopyButton text={text} label="묵상과 기도 복사" />;
}

/** 감춘 덩이 목록. 받아 온 것이 없으면(읽는 사람) 아무것도 그리지 않는다 */
export function HiddenMeditationBlocks() {
  const { blocks } = useContext(OwnerContext);

  if (blocks.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 border-edge border-t border-dashed pt-4">
      <p className="font-typewriter text-[10.5px] tracking-[0.14em] text-faint">
        감춘 덩이 {blocks.length}개 · 나에게만 보여요
      </p>

      {blocks.map((block) => (
        <div key={block.index} className="flex flex-col gap-1.5 opacity-70">
          <div className="flex justify-end">
            <CopyButton
              text={tiptapToCopyText(block.doc)}
              label={`감춘 덩이 ${block.index + 1} 복사`}
            />
          </div>
          {/*
            코드 하이라이팅은 서버에서만 한다(04 §3.2). 묵상은 산문이라 코드 블록이 없고,
            있어도 색 없이 그려지는 것이 안 그려지는 것보다 낫다
          */}
          <div className="record-prose">{renderRichText(block.doc).content}</div>
        </div>
      ))}
    </div>
  );
}
