import type { TiptapDoc } from "@/lib/content/schema";
import { renderRichText } from "@/lib/render/richText";
import { cn } from "@/lib/utils";

/**
 * 리치 텍스트 본문. 조판은 `.record-prose` 한 벌을 쓴다 — 에디터와 공개 지면이 같은 클래스를
 * 공유하므로(03 §5.2) "쓰는 자리에서 보이는 대로"가 지면에서도 유지된다.
 */
export function RichTextBody({
  doc,
  className,
}: {
  doc: TiptapDoc | null | undefined;
  className?: string;
}) {
  const { content } = renderRichText(doc);
  if (!content) return null;

  return <div className={cn("record-prose", className)}>{content}</div>;
}
