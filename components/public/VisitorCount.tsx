import { connection } from "next/server";

import { findVisitorTotals } from "@/lib/db/statSummary";

/**
 * 푸터의 방문자 수 (05 §4.2).
 *
 * **요청 시점에 그린다.** 지면 자체는 정적으로 캐시되므로(04 §1.1) 이 숫자를 껍데기에
 * 넣으면 그 지면이 다시 발행될 때까지 굳는다 — 어제 숫자가 오늘도 붙어 있게 된다.
 * 그래서 Suspense 안의 조각으로 떼어낸다. DB 부담은 조회 쪽의 짧은 캐시가 맡는다.
 *
 * 누적은 **날마다 센 방문자의 합**이다. 같은 사람이 사흘 오면 3으로 센다 — 해시가 날마다
 * 바뀌어 여러 날을 이을 수 없기 때문이다(05 §4.2). 화면에서 그 한계를 통계 용어로 설명하지
 * 않는다(03 §7.3): 숫자의 뜻은 "얼마나 읽히는지"이고, 정확한 정의는 문서에 있다.
 */
export async function VisitorCount() {
  await connection();

  const { today, total } = await findVisitorTotals();

  return (
    <span>
      오늘 {today.toLocaleString("ko-KR")} · 누적 {total.toLocaleString("ko-KR")}
    </span>
  );
}
