"use client";

import { CodeBlock } from "@tiptap/extension-code-block";
import { Image } from "@tiptap/extension-image";
import { Table, TableCell, TableHeader, TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import type { JSONContent } from "@tiptap/react";
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

import { CodeBlockNodeView } from "@/components/editor/CodeBlockNodeView";
import { useEditorFocus } from "@/components/editor/EditorFocusContext";
import { TableNodeView } from "@/components/editor/TableNodeView";
import { EMPTY_TIPTAP_DOC } from "@/lib/content/schema";
import { BlockSplitOnDoubleEnter } from "@/lib/editor/blockSplit";
import { CodeBlockFenceOnEnter } from "@/lib/editor/codeBlockFence";
import { CodeHighlight } from "@/lib/editor/codeHighlight";
import { HeadingWithShiftedShortcuts } from "@/lib/editor/headingShortcuts";
import { ImagePaste, type ImageUploadResult } from "@/lib/editor/imagePaste";
import { MarkdownPaste } from "@/lib/editor/markdownPaste";
import type { RichTextValue } from "@/lib/editor/richText";
import { cellColorClass } from "@/lib/editor/tableCellColors";
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
  /**
   * 이미지 업로드 담당. **이 위젯은 업로드를 모른다** — Server Action을 여기서 import하면
   * 클라이언트 컴포넌트의 모듈 그래프에 Prisma까지 딸려온다(실제로 테스트가 그렇게 깨졌다).
   * 넘기지 않으면 붙여넣은 이미지는 무시된다.
   */
  uploadImage?: (file: File) => Promise<ImageUploadResult | null>;
  value: RichTextValue | undefined;
  onChange: (value: RichTextValue) => void;
  /** 슬림 구성은 설교·찬양용 — 제목1과 코드 블록을 뺀다(03 §5.3) */
  variant?: "full" | "slim";
  placeholder?: string;
  ariaLabel: string;
  autoFocus?: boolean;
  /**
   * 편집 영역(contenteditable) 자체의 클래스. 높이는 여기서 줘야 한다 — 감싼 div에 주면
   * 글자 아래 빈 자리를 눌렀을 때 커서가 잡히지 않는다
   */
  contentClassName?: string;
  className?: string;
  /**
   * 이 칸이 블록 목록의 한 칸일 때의 키보드 계약(찬양 묵상). 넘기지 않으면 Enter·Backspace는
   * 평범한 리치 텍스트 그대로다 — 다른 세 에디터의 동작을 건드리지 않는다.
   */
  blockEditing?: { onSplit: () => void; onRemove: () => void };
};

export function RichTextField({
  value,
  onChange,
  variant = "full",
  uploadImage,
  placeholder,
  ariaLabel,
  autoFocus = false,
  contentClassName,
  className,
  blockEditing,
}: RichTextFieldProps) {
  const { setEditor, notifyChange } = useEditorFocus();

  /**
   * 확장은 편집기를 만들 때 한 번만 읽힌다. 콜백을 그대로 넘기면 그 순간의 클로저가 굳어
   * 블록이 늘어난 뒤에는 옛 자리를 가리킨다 — ref로 늘 최신 것을 부른다.
   */
  const blockEditingRef = useRef(blockEditing);
  blockEditingRef.current = blockEditing;

  const editor = useEditor({
    // SSR에서 즉시 렌더하면 하이드레이션이 어긋난다
    immediatelyRender: false,
    autofocus: autoFocus,
    extensions: [
      StarterKit.configure({
        // 제목은 단축 입력을 한 칸 민 확장으로 대체한다 (lib/editor/headingShortcuts 참고)
        heading: false,
        // 코드 블록은 full 구성에서 NodeView(언어 선택)와 함께 다시 등록한다
        codeBlock: false,
      }),
      HeadingWithShiftedShortcuts.configure({ levels: variant === "slim" ? [3] : [2, 3] }),
      ...(blockEditing
        ? [
            BlockSplitOnDoubleEnter.configure({
              onSplit: () => blockEditingRef.current?.onSplit(),
              onRemove: () => blockEditingRef.current?.onRemove(),
            }),
          ]
        : []),
      // 빈 칸이 6개 놓이는 QT 답변에서는 자리 안내가 없으면 화면이 고장난 것처럼 보인다
      // (02 §5.2 필드 6의 placeholder 문구). 실제 그리기는 .record-prose가 한다
      ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
      // 마크다운 붙여넣기는 기술 글의 최우선 인터랙션이다(02 §5.5). full 구성에만 붙인다 —
      // 설교 라이브 속기와 찬양 묵상에는 이미지·코드 블록이 들어올 자리가 없다
      ...(variant === "full"
        ? [
            MarkdownPaste,
            CodeBlockFenceOnEnter,
            // 블록 안에서 언어를 고르고(NodeView), 그 자리에서 색이 입는다(CodeHighlight)
            CodeBlock.extend({
              addNodeView() {
                return ReactNodeViewRenderer(CodeBlockNodeView);
              },
            }),
            CodeHighlight,
            Image.configure({ inline: false }),
            // 이관해 온 138편에 표가 298개 있다. 확장이 없으면 그 글을 한 번 편집하는
            // 순간 Tiptap이 모르는 노드를 조용히 버린다 — 이관한 표를 지키는 장치이자,
            // 이제는 툴바에서 새 표를 놓는 길이기도 하다(TableToolbarRow)
            TableKit.configure({ table: false, tableCell: false, tableHeader: false }),
            // 행·열 손잡이를 표 위에 얹는다(TableNodeView). 조작 대상이 화면에 있어야 한다
            // 폭을 끌어서 정한다. 저장은 셀의 colwidth에 실리고, 공개 지면도 같은 폭으로
            // 그린다(lib/render/richText의 colgroup) — 안 그리면 지면이 에디터와 달라진다
            // 칸에 색 한 칸을 더 연다. 값이 아니라 **토큰 이름**을 저장한다 —
            // 팔레트를 고치면 이미 발행된 글도 따라온다(lib/editor/tableCellColors)
            ...[TableCell, TableHeader].map((extension) =>
              extension.extend({
                addAttributes() {
                  return {
                    ...this.parent?.(),
                    backgroundColor: {
                      default: null,
                      parseHTML: (element: HTMLElement) => element.getAttribute("data-cell-color"),
                      renderHTML: (attributes: Record<string, unknown>) =>
                        attributes.backgroundColor
                          ? {
                              "data-cell-color": String(attributes.backgroundColor),
                              class: cellColorClass(attributes.backgroundColor),
                            }
                          : {},
                    },
                  };
                },
              }),
            ),
            Table.configure({ resizable: true, cellMinWidth: 48 }).extend({
              addNodeView() {
                // 안쪽 content 요소를 tbody로 만든다 — 기본값(div)이면 표 안에 div가
                // 들어가 브라우저가 그것을 표 밖으로 밀어낸다(TableNodeView 주석)
                return ReactNodeViewRenderer(TableNodeView, { contentDOMElementTag: "tbody" });
              },
            }),
            // 스크린샷 붙여넣기가 기술 글의 실제 작성 경로다(04 §3.3)
            ...(uploadImage ? [ImagePaste.configure({ upload: uploadImage })] : []),
          ]
        : []),
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
        class: cn("record-prose px-4 py-3 outline-none", contentClassName ?? "min-h-[120px]"),
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
