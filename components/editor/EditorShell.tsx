import type { ReactNode } from "react";

import type { RecordType } from "@/lib/record/callNumber";
import { siteOf } from "@/lib/revalidate/tags";
import { cn } from "@/lib/utils";

/**
 * 에디터 공통 셸 (03 §5.3).
 *
 * 브레드크럼 + 저장 인디케이터 + 임시저장 → 그 아래 고정 툴바 → 에디터 시트 → 발행.
 * 시트는 720px 지면이고 상단 괘가 그어진다 — 목록 카드가 펼쳐진 것처럼 보여야 한다.
 *
 * **발행은 시트 끝에 둔다.** 다 쓰고 나서 하는 일이라 글 끝이 손의 동선과 맞고, 라이브
 * 속기 중에 위쪽 버튼을 잘못 누를 일도 없다. 헤더에는 쓰는 동안 필요한 것만 남는다 —
 * 저장 인디케이터·임시저장·작성 취소.
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
  breadcrumb,
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
  breadcrumb: ReactNode;
  indicator: ReactNode;
  actions: ReactNode;
  toolbar?: ReactNode;
  /** 복구 배너 등 */
  banner?: ReactNode;
  children: ReactNode;
  /** 시트 끝에 붙는 것 — 발행 */
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div data-site={siteOf(type)} className={cn("flex min-h-full flex-col bg-paper", className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-edge border-b bg-paper px-[5%] py-[13px]">
        <div className="font-typewriter text-[11.5px] text-faint">{breadcrumb}</div>
        <div className="flex flex-wrap items-center gap-2.5">
          {indicator}
          {actions}
        </div>
      </header>

      {toolbar}
      {banner}

      <div className="mx-auto mt-[26px] mb-[50px] w-full max-w-[720px] border border-edge bg-card pb-6 shadow-card">
        <div className="relative">
          {/* 시트 상단 괘 — 카드에서 펼쳐진 지면이라는 연속성(03 §5.2) */}
          <div className="absolute inset-x-0 top-0 h-[1.5px] bg-(--accent)" />
        </div>
        {children}

        {footer && (
          <div className="mt-8 flex justify-end border-edge border-t px-[6%] pt-5">{footer}</div>
        )}
      </div>
    </div>
  );
}
