import { RichTextBody } from "@/components/public/RichTextBody";
import type { PostContent } from "@/lib/content/schema";

/**
 * D-02 기술 글 상세 (02 §2.2).
 * 본문은 묵상 글과 **같은 직렬화기**를 탄다(04 §3.1). 목차·하이라이팅은 슬라이스 2에서 붙는다.
 */
export function TechView({ content }: { content: Extract<PostContent, { kind: "TECH" }> }) {
  return <RichTextBody doc={content.body} />;
}
