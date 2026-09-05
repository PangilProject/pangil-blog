import { describe, expect, it } from "vitest";

import { IMAGE_UPLOAD_THREW, imageUploadMessage } from "@/lib/editor/imageUploadMessage";

/**
 * 붙여넣기 실패가 **아무 말도 하지 않던** 자리다. `onError`가 연결돼 있지 않아 그림이 그냥
 * 안 들어갔고, 개발자 도구를 열어야만 500이 보였다.
 */
describe("imageUploadMessage", () => {
  it("사유를 갈라 쓴다 — 줄여서 다시 할 일과 다른 파일을 고를 일은 다르다", () => {
    expect(imageUploadMessage("too-large")).not.toBe(imageUploadMessage("unsupported-type"));
  });

  it("한도를 숫자로 말한다 — 얼마나 줄여야 하는지가 문구의 일이다", () => {
    expect(imageUploadMessage("too-large")).toContain("4MB");
  });

  /** 영문 사유 코드는 무엇을 고쳐야 하는지 알려주지 않는다(03 §7.3) */
  it("서버의 사유 코드를 화면에 내보내지 않는다", () => {
    for (const reason of ["no-file", "unsupported-type", "too-large", "upload-failed"] as const) {
      expect(imageUploadMessage(reason)).not.toMatch(/[a-z]+-[a-z]+/);
    }
    expect(IMAGE_UPLOAD_THREW).not.toMatch(/[a-z]+-[a-z]+/);
  });
});
