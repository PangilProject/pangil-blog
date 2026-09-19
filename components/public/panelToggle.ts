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

/**
 * 손잡이를 읽어 주는 이름.
 *
 * **지금 상태를 말한다**(`{이름} 열기` / `{이름} 닫기`). 한동안 넓은 화면 쪽만 `목차 접고 펴기`로
 * **동작 한 장**을 썼고 좁은 화면은 상태 두 장을 썼다 — 한 물건에 두 문법이었다
 * (전수조사 디자인 4-4). `ThemeToggle`도 상태 쪽이다(`밝은 화면으로` / `어두운 화면으로`).
 *
 * 생김새를 한 자리에 둔 것과 같은 이유로 여기 둔다 — 따로 적으면 갈린다.
 */
export const openLabel = (name: string) => `${name} 열기`;
export const closeLabel = (name: string) => `${name} 닫기`;
