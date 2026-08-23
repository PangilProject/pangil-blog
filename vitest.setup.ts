import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * jsdom에 없는 브라우저 API를 채운다. Radix 드롭다운(문단 스타일·카테고리·섹션 라벨)이
 * 열릴 때 항목으로 스크롤하므로, 이게 없으면 드롭다운을 여는 테스트가 전부 터진다.
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// 테스트 간 DOM 누수 방지
afterEach(() => {
  cleanup();
});
