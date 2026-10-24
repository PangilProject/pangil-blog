import type { ReactNode } from "react";

import { AdminFooter } from "@/components/admin/AdminFooter";
import { AdminNav } from "@/components/admin/AdminNav";
import { LoadingRegion, SkeletonBlock, SkeletonFrame } from "@/components/record/Skeleton";
import { cn } from "@/lib/utils";

/**
 * 관리 화면이 오는 동안의 틀 (`app/admin/**\/loading.tsx`).
 *
 * **네비와 푸터는 진짜다.** 전에는 레이아웃의 빈 종이색 판(app/admin/layout)만 서서, 메뉴를 누르면
 * 네비까지 사라졌다가 인증·조회가 끝나야 통째로 돌아왔다 — 눌렀는지조차 읽히지 않았다. 네비가
 * 그 자리에 남으면 이동은 된 것이고, 그 사이 다른 메뉴로 갈아탈 수도 있다.
 *
 * 폭(`width`)은 각 지면의 `main`과 같아야 한다. 다르면 내용이 들어오는 순간 덩어리 칸이 옆으로
 * 튄다 — 지면 쪽 폭을 바꾸면 그 지면의 loading.tsx도 같이 바꾼다.
 *
 * 제목을 아는 지면은 진짜 제목을 넘긴다(`title`). 회색 막대보다 "글 관리"가 먼저 서는 편이
 * 어디에 도착했는지를 빨리 말한다. 날짜처럼 요청 시점 값이 든 제목은 막대로 둔다 — 껍데기는
 * 시계를 볼 수 없다(ADR-003).
 */
export function AdminScreenSkeleton({
  width,
  gap = "gap-5",
  title,
  children,
}: {
  width: "max-w-[720px]" | "max-w-[760px]" | "max-w-[1040px]";
  gap?: "gap-5" | "gap-7" | "gap-8";
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-paper">
      <AdminNav />

      <LoadingRegion className={cn("mx-auto flex w-full flex-col px-[5%] py-8", width, gap)}>
        {title ? (
          <h1 className="font-serif text-lg">{title}</h1>
        ) : (
          <SkeletonBlock className="h-7 w-56" />
        )}
        {children}
      </LoadingRegion>

      <AdminFooter />
    </div>
  );
}

/** 목록 지면(글 관리·초안함)의 행들. 행 높이는 실제 행과 비슷하게만 — 정확할 필요는 없다 */
export function SkeletonRows({ count }: { count: number }) {
  return (
    <SkeletonFrame className="flex flex-col divide-y divide-edge border border-edge bg-card">
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 자리 표시라 순서 말고는 구분할 것이 없다
        <div key={index} className="flex items-center gap-4 px-4 py-4">
          <SkeletonBlock className="h-3 w-14 shrink-0" />
          <SkeletonBlock className="h-3.5 flex-1" />
          <SkeletonBlock className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </SkeletonFrame>
  );
}
