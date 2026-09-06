/**
 * 본인 방문과 남의 방문을 갈라 접는다 (05 §4.1).
 *
 * 공개 지면은 본인 것도 센다(`all`) — 웹사이트를 열어 글을 읽은 것이면 누가 읽었든 1회다.
 * 관리 화면은 밖에서 온 것만 본다(`others`) — 그 화면이 답하는 질문이 "밖에서 뭐가 읽히나"다.
 *
 * **리포지토리가 아니라 여기 있는 이유는 테스트가 직접 봐야 하기 때문이다.** `lib/db`를
 * 불러오면 Prisma가 딸려와 env를 요구한다(lib/record/listQuery와 같은 사정). 두 화면의
 * 숫자가 서로를 반박하지 않게 하는 규칙이 이 함수 하나에 있으므로, 여기는 테스트가 닿아야 한다.
 */

export type ViewTotals = {
  today: number;
  yesterday: number;
  /** 일요일에 시작하는 주 — 이 블로그의 한 주가 설교에서 시작한다(02 §3.1) */
  thisWeek: number;
  total: number;
};

export type SplitTotals = { all: ViewTotals; others: ViewTotals };

export type OwnerRow = ViewTotals & { isOwner: boolean };

const ZERO: ViewTotals = { today: 0, yesterday: 0, thisWeek: 0, total: 0 };

function add(a: ViewTotals, b: ViewTotals): ViewTotals {
  return {
    today: a.today + b.today,
    yesterday: a.yesterday + b.yesterday,
    thisWeek: a.thisWeek + b.thisWeek,
    total: a.total + b.total,
  };
}

/**
 * 한쪽 줄이 없는 것이 정상이다 — 본인이 안 왔거나 남이 안 온 날이 있다.
 * 그 줄을 0으로 채우지 않으면 `undefined`가 합계로 새어 나간다.
 */
export function splitOf(rows: OwnerRow[]): SplitTotals {
  const others = totalsOf(rows.find((row) => !row.isOwner));
  const owner = totalsOf(rows.find((row) => row.isOwner));

  return { all: add(others, owner), others };
}

/**
 * 세 칸만 뽑는다. 행을 그대로 펼치면 `isOwner`가 딸려 나가고, 그러면 "남의 조회"라는 값에
 * `isOwner: false`가 붙어 화면까지 흘러간다 — 테스트가 실제로 그걸 잡았다.
 */
function totalsOf(row: OwnerRow | undefined): ViewTotals {
  if (!row) return ZERO;
  return {
    today: row.today,
    yesterday: row.yesterday,
    thisWeek: row.thisWeek,
    total: row.total,
  };
}
