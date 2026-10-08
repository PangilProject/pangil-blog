import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 칸을 접는 손잡이의 생김새 (03 §1.1).
 *
 * **사이드바와 목차가 같은 부품을 쓴다.** 하나는 서버가 그리는 체크박스고 하나는 아일랜드
 * 안의 버튼이라 컴포넌트를 합칠 수 없다 — 그래서 합치는 대신 **생김새를 한 자리에 둔다**.
 * 따로 두었더니 한쪽은 맨 글리프, 한쪽은 글자와 글리프가 되어 같은 화면에서 다른 물건으로
 * 읽혔다.
 *
 * **사이트 공통 버튼의 기본형을 그대로 입는다**(2026-10-08). 괘선 테두리·hover에 테두리가
 * 짙어짐·눌리면 1px 내려앉음·각진 모서리(radius 0 토큰)가 이미 거기 있다. 바탕만 비운다 —
 * 종이 위에 테두리만 그은 칸이라 옆의 밝기 토글보다 무거워 보이지 않는다. 크기는 `icon`(32px).
 * 손잡이가 `<label>`이라 `Button`을 쓰지 못하고 클래스만 빌린다.
 */
export const PANEL_TOGGLE = cn(
  buttonVariants({ size: "icon" }),
  "cursor-pointer bg-transparent duration-150",
);

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
