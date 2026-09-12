import { cn } from "@/lib/utils";

/**
 * 크롤링 띠 (03 §3) — A-04 QT 에디터 상단. "가져온 것"임을 표시하되 전부 편집 가능하다는
 * 사실을 같이 적는다(02 §5 "잠금 없음. 불러오기만 할 뿐").
 *
 * 실패 variant는 수동 폴백을 안내한다 — 크롤러가 죽어도 1탭 진입은 유지되어야 한다
 * (프리모템 #1, 06 §7).
 */

export type CrawlBandProps = {
  /** 크롤 시각 — "06:12" */
  fetchedAt?: string;
  questionCount?: number;
  annotationCount?: number;
  variant?: "ok" | "failed";
  className?: string;
};

export function CrawlBand({
  fetchedAt,
  questionCount,
  annotationCount,
  variant = "ok",
  className,
}: CrawlBandProps) {
  const isFailed = variant === "failed";

  return (
    <div
      className={cn(
        "flex flex-wrap justify-between gap-2 border px-[13px] py-[9px]",
        "font-typewriter text-[10.5px]",
        isFailed
          ? "border-warn bg-crawl text-warn-ink"
          : "border-[#efe3c8] bg-crawl text-[#98835a]",
        className,
      )}
    >
      {isFailed ? (
        <>
          <span>
            <b className="text-ink">가져오지 못했어요</b> · 빈 템플릿으로 시작합니다
          </span>
          <span>본문과 질문을 직접 적어도 오늘 기록은 남아요</span>
        </>
      ) : (
        <>
          <span>
            <b className="text-[#6e5d38]">날마다 솟는 샘물</b>에서 가져옴
            {fetchedAt && ` · ${fetchedAt}`}
            {questionCount !== undefined && ` · 질문 ${questionCount}`}
            {annotationCount !== undefined && ` · 주석 ${annotationCount}`}
          </span>
          <span>가져온 내용도 자유롭게 고칠 수 있어요</span>
        </>
      )}
    </div>
  );
}
