"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRAISE_SECTION_LABELS } from "@/lib/content/schema";
import { isComposing } from "@/lib/editor/ime";
import type { PraiseSectionFormValue } from "@/lib/editor/praiseForm";
import { sectionOrdinals } from "@/lib/editor/praiseForm";
import { cn } from "@/lib/utils";

/**
 * 찬양 가사 섹션 목록 (02 §5.4 · 04 §2.5).
 *
 * 타이핑 흐름을 끊지 않는 것이 이 목록의 유일한 목표다. 가사는 타이핑이 곧 묵상이므로
 * 서식이 없고(textarea), 손이 키보드를 떠나지 않아도 섹션을 늘리고 옮길 수 있어야 한다.
 *
 * - 엔터 2회 → 마지막 라벨을 이어받은 새 섹션 + 커서 이동
 * - 빈 섹션에서 Backspace → 삭제 (마지막 하나는 남긴다)
 * - Alt+↑↓ → 순서 이동. 드래그 핸들과 같은 move를 쓴다
 * - 순서는 배열 인덱스가 유일한 진실이다. Verse 번호는 파생 계산이다
 */

const CUSTOM_OPTION = "__custom__";

export type PraiseSectionListProps = {
  /** RHF useFieldArray의 fields — key는 RHF가 만든 값이고 순서는 배열 그대로다 */
  items: { key: string; value: PraiseSectionFormValue }[];
  onLabelChange: (index: number, label: string) => void;
  onLyricsChange: (index: number, lyrics: string) => void;
  onAppendAfter: (index: number, label: string) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
};

export function PraiseSectionList({
  items,
  onLabelChange,
  onLyricsChange,
  onAppendAfter,
  onRemove,
  onMove,
}: PraiseSectionListProps) {
  const ordinals = sectionOrdinals(items.map((item) => item.value));
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // 새 섹션이 생기면 그 가사 칸으로 커서를 옮긴다 — 손이 마우스로 가지 않아야 한다
  useEffect(() => {
    if (pendingFocus === null) return;
    const target = listRef.current?.querySelector<HTMLTextAreaElement>(
      `[data-lyrics-index="${pendingFocus}"]`,
    );
    target?.focus();
    setPendingFocus(null);
    // pendingFocus는 섹션을 추가·삭제한 그 이벤트에서 함께 정해진다. 이 effect는 커밋 뒤에
    // 돌기 때문에 새 textarea가 이미 DOM에 있다
  }, [pendingFocus]);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.key === active.id);
    const to = items.findIndex((item) => item.key === over.id);
    if (from >= 0 && to >= 0) onMove(from, to);
  };

  return (
    <div ref={listRef} className="flex flex-col gap-2.5">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.key)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item, index) => (
            <SortableSection
              key={item.key}
              id={item.key}
              index={index}
              section={item.value}
              ordinal={ordinals[index]}
              canRemove={items.length > 1}
              onLabelChange={onLabelChange}
              onLyricsChange={onLyricsChange}
              onAppendAfter={(at, label) => {
                onAppendAfter(at, label);
                setPendingFocus(at + 1);
              }}
              onRemove={(at) => {
                onRemove(at);
                setPendingFocus(Math.max(at - 1, 0));
              }}
              onMove={onMove}
              total={items.length}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={() => {
          const last = items[items.length - 1];
          onAppendAfter(items.length - 1, last?.value.label ?? "Verse");
          setPendingFocus(items.length);
        }}
        className="self-start border border-edge px-2.5 py-1 font-typewriter text-[11px] text-faint hover:text-ink"
      >
        + 섹션
      </button>
    </div>
  );
}

function SortableSection({
  id,
  index,
  section,
  ordinal,
  canRemove,
  total,
  onLabelChange,
  onLyricsChange,
  onAppendAfter,
  onRemove,
  onMove,
}: {
  id: string;
  index: number;
  section: PraiseSectionFormValue;
  ordinal?: number;
  canRemove: boolean;
  total: number;
  onLabelChange: (index: number, label: string) => void;
  onLyricsChange: (index: number, lyrics: string) => void;
  onAppendAfter: (index: number, label: string) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const isKnownLabel = PRAISE_SECTION_LABELS.some((label) => label === section.label);
  // 저장된 라벨이 7종 밖이면 직접 입력 상태로 열린다
  const [isCustom, setIsCustom] = useState(!isKnownLabel);
  const name = ordinal ? `${section.label} ${ordinal}` : section.label;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;

    // 가사를 한글로 치는 중의 Enter는 조합 확정이다. 여기서 받으면 섹션이 멋대로 갈린다
    if (isComposing(event)) return;

    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      const to = event.key === "ArrowUp" ? index - 1 : index + 1;
      if (to < 0 || to >= total) return;
      event.preventDefault();
      onMove(index, to);
      return;
    }

    // 엔터 2회 = 다음 섹션. 빈 줄 하나를 남기지 않고 그 자리를 새 블록으로 바꾼다
    if (event.key === "Enter" && !event.shiftKey) {
      const atEnd = target.selectionStart === target.value.length;
      if (atEnd && target.value.endsWith("\n")) {
        event.preventDefault();
        onLyricsChange(index, target.value.replace(/\n+$/, ""));
        onAppendAfter(index, section.label);
      }
      return;
    }

    // 빈 섹션에서 Backspace = 삭제. 마지막 하나는 남긴다 — 섹션 0개는 발행 불가 상태다
    if (event.key === "Backspace" && target.value === "" && canRemove) {
      event.preventDefault();
      onRemove(index);
    }
  };

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group border border-edge bg-[#fffefa]",
        isDragging && "relative z-10 shadow-card",
      )}
    >
      <header className="flex items-center gap-2 border-b border-dashed border-[#ede5d3] px-3 py-2">
        <button
          type="button"
          // dnd-kit이 키보드 정렬(스페이스로 집고 방향키로 이동)까지 붙여준다
          {...attributes}
          {...listeners}
          aria-label={`${name} 순서 이동`}
          className="cursor-grab px-1 font-typewriter text-[13px] text-faint hover:text-ink"
        >
          ⠿
        </button>

        {isCustom ? (
          <input
            value={section.label}
            onChange={(event) => onLabelChange(index, event.target.value)}
            placeholder="라벨"
            aria-label={`섹션 ${index + 1} 라벨`}
            className="w-28 border border-edge bg-paper px-[7px] py-1 font-typewriter text-[11.5px] outline-none placeholder:text-faint"
          />
        ) : (
          <Select
            value={section.label}
            onValueChange={(value) => {
              if (value === CUSTOM_OPTION) {
                setIsCustom(true);
                return;
              }
              // 라벨만 바꾼다. 블록을 다시 만들지 않으므로 가사가 그대로 남는다(02 §5.4)
              onLabelChange(index, value);
            }}
          >
            <SelectTrigger
              aria-label={`섹션 ${index + 1} 라벨`}
              className="h-auto min-w-[104px] rounded-none border-edge bg-paper py-1 font-typewriter text-[11.5px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRAISE_SECTION_LABELS.map((label) => (
                <SelectItem key={label} value={label} className="font-typewriter text-[12px]">
                  {label}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_OPTION} className="font-typewriter text-[12px]">
                직접 입력…
              </SelectItem>
            </SelectContent>
          </Select>
        )}

        {ordinal !== undefined && (
          <span className="font-typewriter text-[10.5px] text-faint">{ordinal}</span>
        )}

        <span className="ml-auto flex gap-1 opacity-40 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100">
          <SectionButton
            label={`${name} 위로`}
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
          >
            ↑
          </SectionButton>
          <SectionButton
            label={`${name} 아래로`}
            disabled={index === total - 1}
            onClick={() => onMove(index, index + 1)}
          >
            ↓
          </SectionButton>
          <SectionButton
            label={`${name} 삭제`}
            disabled={!canRemove}
            onClick={() => onRemove(index)}
          >
            ✕
          </SectionButton>
        </span>
      </header>

      {/* 가사에 서식이 없는 것은 의도다 — 타이핑이 곧 묵상이라 서식 고민을 끼워넣지 않는다 */}
      <textarea
        value={section.lyrics}
        onChange={(event) => onLyricsChange(index, event.target.value)}
        onKeyDown={handleKeyDown}
        data-lyrics-index={index}
        rows={3}
        placeholder="가사를 적어보세요"
        aria-label={`${name} 가사`}
        className="w-full resize-y bg-transparent px-3.5 py-3 font-serif text-sm leading-body outline-none placeholder:text-[#c4bcaa]"
      />
    </section>
  );
}

function SectionButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="border border-transparent px-1.5 font-typewriter text-[11px] text-faint hover:border-edge hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
