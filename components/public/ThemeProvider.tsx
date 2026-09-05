"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * 테마 공급자 (04 §3.6).
 *
 * `class` 속성으로 테마를 심는다 — globals.css가 `.dark`에 팔레트를 갈아끼우는 구조이기
 * 때문이다(03 §2.1). OS 기본값을 따르고, 수동 선택은 localStorage에 남는다.
 *
 * **개발 서버에서 "Encountered a script tag while rendering React component" 경고가 뜬다.**
 * next-themes가 첫 페인트 전 테마를 심는 스크립트를 `createElement("script")`로 넣는데,
 * React 19는 컴포넌트 안의 `<script>`를 보면 무조건 경고한다 — 라이브러리의 알려진 오탐이고
 * SSR에서는 그 스크립트가 제대로 실행된다.
 *
 * 없는 주소 화면에서만 보인다. 그 화면은 클라이언트에서 다시 그려지기 때문이다(스트리밍이
 * 시작된 뒤에 `notFound()`가 걸린다 — proxy.ts와 같은 사정). **프로덕션 빌드에서는 나지
 * 않는다**(빌드해서 확인했다).
 *
 * 고치려면 스크립트를 React 밖에서 넣어야 한다(`useServerInsertedHTML`). 첫 페인트에 직결된
 * 자리를 개발 경고 하나 때문에 손대지 않는다 — 화면이 번쩍이는 대가가 더 크다.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
