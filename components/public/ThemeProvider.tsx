"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * 테마 공급자 (04 §3.6).
 *
 * `class` 속성으로 테마를 심는다 — globals.css가 `.dark`에 팔레트를 갈아끼우는 구조이기
 * 때문이다(03 §2.1). OS 기본값을 따르고, 수동 선택은 localStorage에 남는다.
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
