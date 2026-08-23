"use client";

import type { JSONContent } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

import { useEditorFocus } from "@/components/editor/EditorFocusContext";
import { EMPTY_TIPTAP_DOC } from "@/lib/content/schema";
import { HeadingWithShiftedShortcuts } from "@/lib/editor/headingShortcuts";
import type { RichTextValue } from "@/lib/editor/richText";
import { cn } from "@/lib/utils";

/**
 * 리치 텍스트 입력 위젯 (04 §2.1).
 *
 * 진실의 원천은 RHF 폼 상태 하나다. Tiptap은 입력 위젯이고, 변경될 때마다 JSON을 폼으로
 * 올려보낸다(Controller가 감싼다). 여기서 상태를 따로 들고 있지 않는다.
 *
 * 마크다운 단축 입력(`#`, `-`, `>`)은 input rule이 그 자리에서 변환한다 —
 * ADR-001의 "마크다운 병행, 별도 변환 창 없음". `#`는 지면의 최상위 제목(h2)에 대응하도록
 * 한 칸 밀어 매핑한다(lib/editor/headingShortcuts).
 */

export type RichTextFieldProps = {
  value: RichTextValue | undefined;
  onChange: (value: RichTextValue) => void;
  /** 슬림 구성은 설교·찬양용 — 제목1과 코드 블록을 뺀다(03 §5.3) */
  variant?: "full" | "slim";
  placeholder?: string;
  ariaLabel: string;
  autoFocus?: boolean;
  className?: string;
};

export function RichTextField({
  value,
  onChange,
  variant = "full",
  ariaLabel,
  autoFocus = false,
  className,
}: RichTextFieldProps) {
  const { setEditor, notifyChange } = useEditorFocus();

  const editor = useEditor({
    // SSR에서 즉시 렌더하면 하이드레이션이 어긋난다
    immediatelyRender: false,
    autofocus: autoFocus,
    extensions: [
      StarterKit.configure({
        // 제목은 단축 입력을 한 칸 민 확장으로 대체한다 (lib/editor/headingShortcuts 참고)
        heading: false,
        codeBlock: variant === "slim" ? false : {},
      }),
      HeadingWithShiftedShortcuts.configure({ levels: variant === "slim" ? [3] : [2, 3] }),
    ],
    // 저장 계약(z.json 배열)과 Tiptap의 JSONContent는 같은 JSON을 다르게 좁힌 타입이다.
    // 변환 지점은 이 위젯 경계 한 곳뿐이므로 여기서만 맞춰준다.
    content: (value ?? EMPTY_TIPTAP_DOC) as JSONContent,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        role: "textbox",
        "aria-multiline": "true",
        // record-prose가 제목·목록·인용을 실제로 다르게 보이게 한다(03 §5.2).
        // 이게 없으면 서식이 적용돼도 본문과 똑같이 보인다 — 실제로 그랬다.
        class: cn("record-prose min-h-[120px] px-4 py-3 outline-none"),
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getJSON() as RichTextValue);
    },
    onFocus: ({ editor: instance }) => setEditor(instance),
    onSelectionUpdate: () => notifyChange(),
    onTransaction: () => notifyChange(),
  });

  // 언마운트 시 툴바가 죽은 인스턴스를 가리키지 않게 한다
  useEffect(() => {
    return () => {
      setEditor(null);
    };
  }, [setEditor]);

  return <EditorContent editor={editor} className={cn("bg-card", className)} />;
}
