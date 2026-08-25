/**
 * 구조화 데이터 한 덩어리를 지면에 박는다.
 *
 * `</script>`가 값 안에 들어오면 문서가 거기서 끊긴다 — 제목은 사람이 쓰는 글이므로 `<`를
 * 이스케이프해서 넣는다. 클라이언트 코드가 아니다(아일랜드 한도와 무관, 04 §3.6).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: ld+json은 텍스트로만 들어간다
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
