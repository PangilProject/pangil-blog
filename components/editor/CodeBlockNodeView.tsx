"use client";

import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CODE_LANGUAGES } from "@/lib/editor/codeLanguages";

/**
 * 에디터의 코드 블록 (02 §5.5 "코드 블록(언어 지정)").
 *
 * 언어 선택이 **블록 안에** 있다. 툴바에 두면 "지금 어느 블록에 적용되는지"를 커서로 추론해야
 * 하는데, 코드 블록은 화면에서 이미 한 덩어리로 보이므로 그 덩어리 안에 두는 편이 맞다 —
 * 찬양 섹션 라벨과 같은 형태다. 떠다니는 UI가 아니라 블록의 일부이므로 ADR-001 §5와도 맞다.
 *
 * 하이라이팅은 CodeBlockShiki가 decoration으로 얹으므로 여기서는 자리만 만든다.
 */
export function CodeBlockNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const language = typeof node.attrs.language === "string" ? node.attrs.language : "";

  return (
    <NodeViewWrapper className="my-[1.4em] border border-[#3a3630] bg-ink">
      <div
        className="flex items-center justify-between border-[#3a3630] border-b px-2 py-1.5"
        // 헤더는 편집 대상이 아니다 — 커서가 여기 들어오면 코드가 아닌 곳에 글자가 생긴다
        contentEditable={false}
      >
        <Select value={language} onValueChange={(value) => updateAttributes({ language: value })}>
          <SelectTrigger
            aria-label="코드 언어"
            className="h-auto min-w-[104px] rounded-none border-[#3a3630] bg-transparent py-0.5 font-typewriter text-[11px] text-[#C7B58A]"
          >
            <SelectValue placeholder="언어 선택" />
          </SelectTrigger>
          <SelectContent>
            {CODE_LANGUAGES.map((entry) => (
              <SelectItem key={entry.value} value={entry.value} className="text-[13px]">
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <pre className="record-code-plain">
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}
