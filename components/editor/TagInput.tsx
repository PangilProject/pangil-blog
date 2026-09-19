"use client";

import { type KeyboardEvent, useState } from "react";

import { isComposing } from "@/lib/editor/ime";
import { normalizeTagNames } from "@/lib/record/tagNames";

/**
 * 태그 입력 (02 §5.5 필드 6 · dev 태그 탐색 대응).
 *
 * 엔터·쉼표로 확정한다. 빈 칸에서 Backspace는 마지막 태그를 지운다 — 손이 마우스로 가지
 * 않아야 한다. 자동완성은 없다: 태그 목록을 불러오는 요청이 타이핑 중에 끼어드는 값보다
 * 직접 치는 게 빠르고, 대소문자만 다른 중복은 저장 경로가 합친다(normalizeTagNames).
 */
export function TagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    setDraft("");

    /**
     * **정리 규칙은 저장 경로와 같은 것을 쓴다**(`normalizeTagNames`).
     *
     * 여기서 `trim`만 하던 동안 정본은 내부 연속 공백까지 눕히고 있었다 — `내 태그`와
     * `내  태그`가 **화면에서는 둘, 저장에서는 하나**였다. 화면이 받아 준 것이 조용히 사라진다.
     */
    const next = normalizeTagNames([...value, raw.replace(/,$/, "")]);
    if (next.length === value.length) return;
    onChange(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // 조합 중인 Enter는 입력기의 것이다 — 가로채면 태그가 "안녕하세"와 "요"로 갈린다
    if (isComposing(event)) return;

    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
      return;
    }

    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      event.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-edge border-b pb-2">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1.5 border border-edge bg-paper px-2 py-0.5 font-typewriter text-[11px] text-ink"
        >
          {tag}
          <button
            type="button"
            aria-label={`태그 ${tag} 삭제`}
            onClick={() => onChange(value.filter((current) => current !== tag))}
            className="text-faint hover:text-(--accent)"
          >
            ✕
          </button>
        </span>
      ))}

      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        // 포커스를 잃을 때 적던 태그를 버리지 않는다 — 그게 유실로 느껴진다
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? "태그 (엔터로 추가)" : ""}
        aria-label="태그"
        className="min-w-[120px] flex-1 bg-transparent font-typewriter text-[11.5px] outline-none placeholder:text-faint"
      />
    </div>
  );
}
