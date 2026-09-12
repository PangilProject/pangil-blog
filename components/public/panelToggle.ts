/**
 * 칸을 접는 손잡이의 생김새 (03 §1.1).
 *
 * **사이드바와 목차가 같은 부품을 쓴다.** 하나는 서버가 그리는 체크박스고 하나는 아일랜드
 * 안의 버튼이라 컴포넌트를 합칠 수 없다 — 그래서 합치는 대신 **생김새를 한 자리에 둔다**.
 * 따로 두었더니 한쪽은 맨 글리프, 한쪽은 글자와 글리프가 되어 같은 화면에서 다른 물건으로
 * 읽혔다.
 *
 * 네모난 작은 칩이다. 종이 위에 찍힌 다른 것들과 같은 괘선·같은 바탕·같은 타자기체를 쓴다.
 */
export const PANEL_TOGGLE =
  "inline-flex size-[26px] shrink-0 cursor-pointer select-none items-center justify-center " +
  "border border-edge bg-card font-typewriter text-[11px] leading-none text-faint " +
  "transition-colors hover:border-(--accent) hover:text-(--accent)";

/**
 * 방향 기호는 **누르면 어디로 접히는지**를 가리킨다.
 *
 * 그래서 왼쪽 칸과 오른쪽 칸이 서로 반대다 — 사이드바는 펴진 채로 `«`(왼쪽으로 접는다),
 * 목차는 펴진 채로 `»`(오른쪽으로 접는다). 목차가 사이드바를 그대로 따라 했다가 "누르면
 * 왼쪽으로 간다"로 읽히는 화살표를 오른쪽 여백에 달고 있었다.
 */
export const FOLD_LEFT = "«";
export const FOLD_RIGHT = "»";
