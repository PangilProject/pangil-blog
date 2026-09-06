import { connection } from "next/server";

import { findViewTotals } from "@/lib/db/statSummary";

/**
 * 사이드바의 조회 수 (05 §4).
 *
 * **눈에 먼저 닿는 자리에 둔다.** 처음에는 푸터였는데, 그 숫자를 보려면 글을 다 지나 끝까지
 * 내려야 했다 — 매일 확인하게 되는 숫자가 가장 먼 자리에 있었다.
 *
 * 세던 것도 바뀌었다. 처음에는 **방문자 수**였는데(티스토리 사이드바가 그렇다) 조회로
 * 옮겼다 — 누적 방문자는 각주가 필요한 숫자다. 해시 솔트가 날마다 바뀌어 "날마다 센 합"이고
 * 같은 사람이 사흘 오면 3이다(05 §4.2). 설명 없이는 틀린 값처럼 보이는 숫자를 지면에 적을
 * 이유가 없다. 조회는 몇 번 읽혔는지, 그게 전부다.
 *
 * 방문자 수가 사라진 것은 아니다. 관리 화면이 두 값을 이름과 함께 나란히 보여준다(A-09).
 *
 * **요청 시점에 그린다.** 지면 자체는 정적으로 캐시되므로(04 §1.1) 이 숫자를 껍데기에
 * 넣으면 그 지면이 다시 발행될 때까지 굳는다 — 어제 숫자가 오늘도 붙어 있게 된다.
 * 그래서 Suspense 안의 조각으로 떼어낸다. DB 부담은 조회 쪽의 짧은 캐시가 맡는다.
 */
export async function ViewCount() {
  await connection();

  const { today, yesterday, total } = await findViewTotals();

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
