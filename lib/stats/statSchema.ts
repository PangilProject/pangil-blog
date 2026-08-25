import { z } from "zod";

/**
 * 비콘 payload 스키마 (05 §4) — **신뢰 경계**.
 *
 * 이 엔드포인트는 인증이 없다. 방문자 브라우저가 로그인 없이 쏘아야 하기 때문이고, 그래서
 * **여기 오는 값은 전부 남이 쓴 것으로 취급한다.** 세는 데 쓰는 값(visitorHash·device·시각)은
 * 클라이언트가 아니라 서버가 ip·ua에서 파생한다(05 §4.1).
 *
 * `path`·`referrer`·`postId`는 조작될 수 있다 — 그래서 **집계 시 참고용**이고 카운트 판단에는
 * 쓰지 않는다. 여기서는 길이만 잘라 테이블이 부풀지 않게 막는다.
 */

/** 열 길이 상한. 긴 쿼리스트링·리퍼러가 통계 테이블을 키우는 것을 막는다 */
const PATH_MAX = 512;
const REFERRER_MAX = 1024;
const UTM_MAX = 128;
/** cuid2 하나 길이. 우리 Post.id가 cuid라 그 이상은 볼 필요가 없다 */
const POST_ID_MAX = 40;

export const STAT_EVENT_TYPES = ["PAGEVIEW", "LEAVE"] as const;

export const StatPayloadSchema = z.object({
  site: z.enum(["hub", "dev", "faith"]),
  eventType: z.enum(STAT_EVENT_TYPES),
  path: z.string().min(1).max(PATH_MAX),
  postId: z.string().max(POST_ID_MAX).optional(),
  referrer: z.string().max(REFERRER_MAX).optional(),
  utmSource: z.string().max(UTM_MAX).optional(),
  /**
   * LEAVE의 체류 시간. 음수와 비현실적인 값은 받지 않는다 — 상한이 없으면 탭을 켜 둔
   * 브라우저 하나가 평균 체류를 통째로 망친다. 12시간을 넘는 체류는 사람의 독서가 아니다
   */
  durationMs: z
    .number()
    .int()
    .min(0)
    .max(12 * 60 * 60 * 1000)
    .optional(),
});

export type StatPayload = z.infer<typeof StatPayloadSchema>;
