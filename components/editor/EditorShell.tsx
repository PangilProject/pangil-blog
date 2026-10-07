import type { ReactNode } from "react";

import { EditorActionBar } from "@/components/editor/EditorActionBar";
import type { RecordType } from "@/lib/record/callNumber";
import { siteOf } from "@/lib/revalidate/tags";
import { cn } from "@/lib/utils";

/**
 * 에디터 공통 셸 (03 §5.3).
 *
 * [상단 띠(밝기·저장 상태 / 작성 취소·임시저장·발행) + 고정 툴바] → 에디터 시트.
 * 시트는 720px 지면이고 상단 괘가 그어진다 — 목록 카드가 펼쳐진 것처럼 보여야 한다.
 *
 * **저장과 발행은 툴바 위 띠에 늘 붙어 있다**(EditorActionBar, 2026-10-07). 전에는 발행이 시트
 * 끝에 있어 "라이브 속기 중 잘못 누를 일이 없다"는 것이 근거였는데, 긴 글에서 끝까지 내려가야
 * 하는 비용이 더 컸다 — 오발행은 PRIVATE 전환으로 되돌릴 수 있다는 판단(02 §3.4)은 그대로다.
 *
 * 띠와 툴바는 **한 덩어리로 위에 붙는다.** 처음에는 띠를 화면 아래에 붙였는데, 폰에서는 위아래
 * 두 곳이 화면을 먹었다. 위에 함께 두면 붙은 띠가 한 곳이고, 본문 끝을 가릴 일도 없다.
 *
 * **따로 된 헤더는 없다.** 저장·발행이 띠로 옮겨 가자 남은 것이 `관리 · 기술 글`이라는 글자와 밝기
 * 토글뿐이었다 — 글자는 어느 에디터인지 시트가 이미 말하고, 토글은 띠의 저장 상태 왼쪽에 선다.
 *
 * 발행 버튼에 확인 모달을 붙이지 않는다(02 §3.4). 설교는 "끝나면 바로 발행"이 요구사항이고,
 * 실수는 PRIVATE 전환으로 복구되므로 모달이 더 비싸다.
 *
 * **셸이 그 글의 지면 색을 입는다**(`data-site`). 관리 화면에는 그 속성이 없어 `--accent`가
 * 기본값(인주 빨강)이었고, 그래서 **기술 글을 쓸 때도 에디터가 빨갰다**. 지금 어느 지면 글을
 * 쓰는지는 색으로 읽히는 편이 낫다 — 공개 지면이 이미 그 한 축으로만 갈린다(03 §2.1).
 *
 * 관리 화면 전체가 아니라 **에디터만** 입는다. 대시보드·목록·통계는 특정 지면의 것이 아니고,
 * 넓히면 다크 검증 면적만 세 배가 된다.
 */
export function EditorShell({
  type,
  indicator,
  actions,
  toolbar,
  banner,
  children,
  footer,
  className,
}: {
  /** 이 셸이 감싸는 글의 종류. 지면 색은 여기서 나온다 */
  type: RecordType;
  indicator: ReactNode;
  actions: ReactNode;
  toolbar?: ReactNode;
  /** 복구 배너 등 */
  banner?: ReactNode;
  children: ReactNode;
  /** 띠의 맨 끝 — 발행 */
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div data-site={siteOf(type)} className={cn("flex min-h-full flex-col bg-paper", className)}>
      {/* 띠와 툴바가 함께 붙는다. 폰에서 키보드가 뜨면 띠는 숨고 툴바는 키보드 위로 간다(ToolbarDock) */}
      <div className="sticky top-0 z-20">
        <EditorActionBar
          status={indicator}
          actions={
            <>
              {actions}
              {footer}
            </>
          }
        />
        {toolbar}
      </div>
      {banner}

      {/* 폰에서는 시트가 화면 폭을 다 쓴다 — 좁은 화면에서 바깥 여백·그림자는 쓸 자리만 줄인다 */}
      <div className="mx-auto mt-[26px] mb-[50px] w-full max-w-[720px] border border-edge bg-card pb-6 shadow-card max-md:mt-0 max-md:mb-0 max-md:border-x-0 max-md:border-t-0 max-md:shadow-none">
        <div className="relative">
          {/* 시트 상단 괘 — 카드에서 펼쳐진 지면이라는 연속성(03 §5.2) */}
          <div className="absolute inset-x-0 top-0 h-[1.5px] bg-(--accent)" />
        </div>
        {children}
      </div>
    </div>
  );
}
