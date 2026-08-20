import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 테스트 간 DOM 누수 방지
afterEach(() => {
  cleanup();
});
