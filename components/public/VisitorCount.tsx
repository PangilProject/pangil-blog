import { connection } from "next/server";

import { findVisitorTotals } from "@/lib/db/statSummary";

/**
 * 사이드바의 방문자 수 (05 §4.2).
 *
 * **눈에 먼저 닿는 자리에 둔다.** 처음에는 푸터였는데, 그 숫자를 보려면 글을 다 지나 끝까지
 * 내려야 했다 — 매일 확인하게 되는 숫자가 가장 먼 자리에 있었다.
 *
 * **요청 시점에 그린다.** 지면 자체는 정적으로 캐시되므로(04 §1.1) 이 숫자를 껍데기에
 * 넣으면 그 지면이 다시 발행될 때까지 굳는다 — 어제 숫자가 오늘도 붙어 있게 된다.
 * 그래서 Suspense 안의 조각으로 떼어낸다. DB 부담은 조회 쪽의 짧은 캐시가 맡는다.
 *
 * 전체는 **날마다 센 방문자의 합**이다. 같은 사람이 사흘 오면 3으로 센다 — 해시가 날마다
 * 바뀌어 여러 날을 이을 수 없기 때문이다(05 §4.2). 화면에서 그 한계를 통계 용어로 설명하지
 * 않는다(03 §7.3): 숫자의 뜻은 "얼마나 읽히는지"이고, 정확한 정의는 문서에 있다.
 */
export async function VisitorCount() {
  await connection();

  const { today, yesterday, total } = await findVisitorTotals();

  return (
    <section className="flex items-baseline gap-4 border-edge border-y py-2.5">
      <Figure label="전체" value={total} strong />
      <Figure label="오늘" value={today} />
      <Figure label="어제" value={yesterday} />
    </section>
  );
}

function Figure({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <p className="flex flex-col gap-0.5">
      <span className="font-typewriter text-[9.5px] tracking-[0.12em] text-faint">{label}</span>
      <span
        className={
          strong
            ? "font-typewriter font-bold text-[15px] text-ink"
            : "font-typewriter text-[12px] text-ink-soft"
        }
      >
        {value.toLocaleString("ko-KR")}
      </span>
    </p>
  );
}
