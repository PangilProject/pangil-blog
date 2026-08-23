"use client";

import { useEffect, useState } from "react";

/**
 * 모바일 소프트 키보드가 덮은 높이 (02 §5.2 확정 사항).
 *
 * QT 답변 작성은 유일하게 모바일에서 실제로 일어나는 작성이다(01 §2.1 — 작성의 95%는
 * 데스크탑). 그래서 고정 툴바를 화면 위에 그냥 두면 키보드가 올라올 때 툴바가 밀려
 * 서식을 쓸 수 없다. visualViewport로 키보드 높이를 재서 툴바를 그 위에 붙인다.
 *
 * 모바일 폭에서만 값을 낸다 — 데스크탑에서는 툴바가 상단 sticky 그대로다.
 * visualViewport가 없는 브라우저에서는 0을 유지해 기존 동작으로 남는다(기능 감소만).
 *
 * **실기기 검증 필요**: iOS Safari는 키보드 높이 보고가 특이하다(02 §5.2 "실기기 테스트 필수").
 */

export const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

/**
 * 브라우저 UI 바(주소창 축소 등)가 만드는 작은 차이를 키보드로 오인하지 않는다.
 * 실제 소프트 키보드는 어느 기기에서도 이보다 훨씬 높다.
 */
const KEYBOARD_MIN_INSET = 120;

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      if (!window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
        setInset(0);
        return;
      }

      // offsetTop은 확대·스크롤로 시각 뷰포트가 밀린 만큼이다. 빼지 않으면 키보드가
      // 없을 때도 값이 남는다
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      setInset(covered > KEYBOARD_MIN_INSET ? Math.round(covered) : 0);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);

    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
