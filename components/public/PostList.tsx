import { RecordCard } from "@/components/record/RecordCard";
import { StateStamp } from "@/components/record/StateStamp";
import type { ListCard } from "@/lib/db/publicLists";
import { formatCallNumber } from "@/lib/record/callNumber";
import { freshPostIds } from "@/lib/record/freshPosts";
import { RECORD_TYPE_LABELS } from "@/lib/record/todayCard";
import { siteOf } from "@/lib/revalidate/tags";
import { postHref } from "@/lib/site/publicUrl";
import { cn } from "@/lib/utils";

/**
 * 목록 카드 그리드 (03 §5.1) — `minmax(250px, 1fr)`, 미세 회전 ±1도.
 *
 * 회전은 인덱스에서 나오는 고정값이다. 매번 다른 각도면 같은 목록이 볼 때마다 흔들려 보이고,
 * 프리렌더도 재현되지 않는다(ADR-003 — 렌더 중 난수 금지).
 *
 * 카드가 곧 상세 지면이고 OG 카드다(04 §3.5). 그래서 여기서 정한 조판이 세 곳에서 반복된다.
 */

/** ±1도 안에서 흩뿌린다. 6개 주기로 돌아 목록이 길어도 규칙적으로 보이지 않는다 */
const ROTATIONS = [-0.8, 0.6, -0.4, 0.9, -0.6, 0.5];

export function PostList({
  cards,
  emptyMessage = "이 칸은 아직 비어 있어요",
  className,
}: {
  cards: ListCard[];
  emptyMessage?: string;
  className?: string;
}) {
  if (cards.length === 0) {
    return (
      <p className="border border-edge border-dashed px-5 py-10 text-center text-[13.5px] text-ink-soft">
        {emptyMessage}
      </p>
    );
  }

  /*
    **시각이 아니라 데이터에서 나온다.** 이 목록은 통째로 캐시되고 그 캐시는 글이 발행될 때
    갈린다 — 렌더 중에 "오늘"을 읽으면 어제 만든 HTML이 오늘도 "오늘"이라고 적혀 있게 된다
    (lib/record/freshPosts).
  */
  const fresh = freshPostIds(cards);

  return (
    <ul className={cn("grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-5", className)}>
      {cards.map((card, index) => (
        <li key={card.id}>
          <RecordCard
            variant={card.type === "TECH" ? "dev" : "faith"}
            rotate={ROTATIONS[index % ROTATIONS.length]}
            href={postHref(card.type, card.slug, siteOf(card.type))}
            callNumber={formatCallNumber({
              type: card.type,
              callNumber: card.callNumber,
              categoryName: card.categoryName,
            })}
            aside={formatDate(card.publishedAt)}
            title={card.title}
            subtitle={card.scriptureRef ?? card.excerpt}
            meta={metaOf(card)}
            overlay={fresh.has(card.id) ? <StateStamp kind="new" /> : undefined}
          />
        </li>
      ))}
    </ul>
  );
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}

/**
 * 카드 메타 한 줄.
 *
 * faith는 타입 배지(02 §2.3), dev는 태그다. dev에서 카테고리를 쓰지 않는 이유는 청구기호가
 * 이미 `0001 · FE`로 카테고리를 담고 있어서다(03 §6.3) — 같은 정보를 두 번 적지 않는다.
 */
function metaOf(card: ListCard): string | null {
  if (card.type !== "TECH") return RECORD_TYPE_LABELS[card.type].replace("오늘의 ", "");
  return card.tags.length > 0 ? card.tags.slice(0, 3).join(" · ") : null;
}
