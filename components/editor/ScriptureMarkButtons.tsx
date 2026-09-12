"use client";

import { wrapSelection } from "@/lib/editor/wrapSelection";
import { cn } from "@/lib/utils";

/**
 * 말씀 본문의 굵게·밑줄 (02 §5.2).
 *
 * 말씀 칸은 리치 텍스트가 아니라 **글자열**이다 — 저장 계약이 그렇고, 그 칸의 주인은
 * 크롤러다(06 §2). 그래서 강조는 마크를 붙이는 것이 아니라 `**굵게**` · `__밑줄__`
 * 표시를 글자에 넣는 일이고, 조판할 때 풀린다(`toScriptureVerses`).
 *
 * **대가는 쓰는 동안 표시가 보이는 것**이다. 지면에서는 굵게·밑줄로 나간다.
 * 그 대신 크롤러·이관해 온 700여 편·검색·내보내기가 하나도 흔들리지 않는다.
 */
/** 한 화면에 말씀 칸은 하나뿐이라 고정 id로 충분하다 */
export const SCRIPTURE_FIELD_ID = "scriptureBody";

export function ScriptureMarkButtons({
  onChange,
  fieldId,
}: {
  onChange: (next: string) => void;
  /**
   * 감쌀 textarea. 값도 **여기서 읽는다** — 폼을 구독하면 말씀을 한 글자 칠 때마다
   * 에디터 전체가 다시 그려진다(register로 묶인 칸이라 지금은 안 그런다).
   */
  fieldId: string;
}) {
  const apply = (marker: string) => {
    const field = document.getElementById(fieldId);
    if (!(field instanceof HTMLTextAreaElement)) return;

    const value = field.value;
    const result = wrapSelection(value, field.selectionStart, field.selectionEnd, marker);
    if (result.value === value) return;

    onChange(result.value);

    // 고른 자리를 그대로 둔다 — 감싸고 나서 선택이 풀리면 다음 강조를 다시 골라야 한다
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(result.start, result.end);
    });
  };

  return (
    <fieldset aria-label="말씀 강조" className="flex items-center gap-1">
      {[
        { marker: "**", label: "말씀 굵게", glyph: "B", className: "font-bold" },
        { marker: "__", label: "말씀 밑줄", glyph: "U", className: "underline" },
      ].map((mark) => (
        <button
          key={mark.marker}
          type="button"
          aria-label={mark.label}
          onClick={() => apply(mark.marker)}
          className={cn(
            "border border-transparent px-1.5 font-typewriter text-[11.5px] text-faint",
            "hover:border-edge hover:text-ink",
            mark.className,
          )}
        >
          {mark.glyph}
        </button>
      ))}
    </fieldset>
  );
}
