import type { UploadImageFailure } from "@/lib/actions/images";
import { MAX_IMAGE_LABEL } from "@/lib/images/limits";

/**
 * 그림을 못 올린 사유를 사람 말로 (03 §7.3 · §7.3b).
 *
 * 전에는 **아무 말도 없었다.** `onError`가 어디에도 연결돼 있지 않아서, 붙여넣으면 그림이
 * 그냥 안 들어갔다 — 개발자 도구를 열어야만 500이 보였다.
 *
 * 사유를 갈라 쓴다. 너무 큰 것과 못 읽는 형식은 다음에 할 일이 다르다: 하나는 줄여서 다시,
 * 하나는 다른 파일로. "올리지 못했어요" 하나로 덮으면 둘 다 손쓸 방법이 없다.
 *
 * 서버가 준 영문 사유 코드는 화면에 내보내지 않는다(03 §7.3).
 */
export function imageUploadMessage(reason: UploadImageFailure): string {
  switch (reason) {
    case "too-large":
      return `그림이 너무 커요. ${MAX_IMAGE_LABEL}까지 올릴 수 있어요`;
    case "unsupported-type":
      return "PNG · JPG · WebP · GIF만 올릴 수 있어요";
    case "no-file":
      return "올릴 그림을 찾지 못했어요";
    default:
      return "그림을 올리지 못했어요. 잠시 후 다시 해주세요";
  }
}

/**
 * 액션이 **던졌을 때**의 문구.
 *
 * 본문 한도를 넘기면 액션이 실행되기도 전에 요청이 거절되므로 사유 코드가 오지 않는다.
 * 그 자리에 프레임워크의 영문 오류를 그대로 띄우지 않는다 — 무엇을 고쳐야 하는지 말해주지
 * 않기 때문이다(03 §7.3). 실제로 이 경우의 원인은 대개 "그림이 크다"이다.
 */
export const IMAGE_UPLOAD_THREW = "그림을 올리지 못했어요. 너무 크거나 연결이 끊겼을 수 있어요";
