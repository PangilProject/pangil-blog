"use client";

import type { Editor } from "@tiptap/react";
import {
  type ComponentProps,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { useEditorFocus } from "@/components/editor/EditorFocusContext";
import { checkSpelling } from "@/lib/actions/spell";
import { isComposing } from "@/lib/editor/ime";
import {
  applySpellFix,
  clearSpellMarks,
  currentSpellMark,
  listSpellMarks,
  removeSpellMark,
  SPELL_SELECT_EVENT,
  type SpellMark,
  type SpellPlacement,
  setCurrentSpellMark,
  setSpellMarks,
  spellLabelOf,
  spellToneOf,
} from "@/lib/editor/spellCheck";
import { collectSegments } from "@/lib/editor/spellSegments";
import { cn } from "@/lib/utils";

/**
 * 맞춤법 검사 — 툴바 버튼 · 하나씩 고치기 창 · 밑줄 말풍선.
 *
 * **누를 때만 돈다.** 버튼이나 ⌘⇧P. 타이핑 중에는 아무것도 뜨지 않는다 — 설교 라이브 속기의
 * "방해 요소 제로"(02 §5.3)가 이 기능의 첫 조건이다. 창이 뜨는 것도 사람이 검사를 누른 직후뿐이다.
 *
 * 흐름: 화면의 리치 텍스트 영역 전부 → 글자열(lib/editor/spellSegments) → 서버 액션 →
 * 밑줄(lib/editor/spellCheck) → 아래에 붙은 고치기 창. 창을 닫아도 밑줄은 남고, 밑줄을 누르면
 * 그 자리에 말풍선이 뜬다.
 *
 * 남은 밑줄의 원천은 **각 에디터의 플러그인 상태**다. 여기서는 따로 목록을 들지 않고, 트랜잭션이
 * 돌 때마다 다시 읽는다 — 사람이 밑줄 친 말을 직접 고쳐 쓰면 창의 목록도 저절로 준다.
 */

type Item = SpellPlacement & { editor: Editor };

type Status = "idle" | "checking" | "clean" | "failed" | "too-long";

const STATUS_TEXT: Record<Exclude<Status, "idle">, string> = {
  checking: "검사 중…",
  clean: "고칠 곳이 없어요",
  failed: "검사하지 못했어요",
  "too-long": "글이 길어 검사하지 못했어요",
};

/** "이번엔 무시"는 이 화면에 있는 동안 다시 검사해도 긋지 않는다 */
const ignoreKey = (mark: Pick<SpellMark, "token" | "suggestion">) =>
  `${mark.token}\u0000${mark.suggestion}`;

const smoothScroll = () =>
  typeof window !== "undefined" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** id는 우리가 만든 "회차-번호"라 선택자에 그대로 넣어도 된다 */
function elementOf(item: Item): HTMLElement | null {
  return item.editor.view.dom.querySelector<HTMLElement>(`[data-spell-id="${item.mark.id}"]`);
}

export function SpellCheckControl() {
  const { getEditors } = useEditorFocus();

  const [status, setStatus] = useState<Status>("idle");
  const [, setTick] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [bubble, setBubble] = useState<{ id: string; top: number; left: number } | null>(null);

  const ignored = useRef(new Set<string>());
  const runCount = useRef(0);
  const watched = useRef<(() => void)[]>([]);

  const items: Item[] = getEditors().flatMap((editor) =>
    listSpellMarks(editor.state).map((placement) => ({ ...placement, editor })),
  );
  const current = items.find((item) => item.mark.id === currentId) ?? null;

  /* ── 에디터 변화 구독: 밑줄이 걷히면 창의 목록도 다시 그린다 ── */
  const watch = useCallback((editors: Editor[]) => {
    for (const stop of watched.current) stop();
    const bump = () => setTick((tick) => tick + 1);
    watched.current = editors.map((editor) => {
      editor.on("transaction", bump);
      return () => editor.off("transaction", bump);
    });
  }, []);

  useEffect(
    () => () => {
      for (const stop of watched.current) stop();
    },
    [],
  );

  // 잠깐 보여 줄 말은 저절로 걷는다. "검사 중"은 끝날 때까지 둔다
  useEffect(() => {
    if (status === "idle" || status === "checking") return;
    const timer = setTimeout(() => setStatus("idle"), 2400);
    return () => clearTimeout(timer);
  }, [status]);

  /* ── 검사 ── */
  const run = useCallback(async () => {
    if (status === "checking") return;

    const editors = getEditors();
    const flat = editors.flatMap((editor) =>
      collectSegments(editor.state.doc).map((segment) => ({ editor, segment })),
    );

    for (const editor of editors) clearSpellMarks(editor.view);
    setBubble(null);
    setReviewOpen(false);
    setCurrentId(null);

    if (flat.length === 0) {
      setStatus("clean");
      return;
    }

    setStatus("checking");
    runCount.current += 1;
    const ticket = runCount.current;

    const result = await checkSpelling(flat.map(({ segment }) => segment.text)).catch(
      () => ({ ok: false, reason: "failed" }) as const,
    );
    // 기다리는 사이에 다시 눌렀으면 이 결과는 버린다
    if (ticket !== runCount.current) return;
    if (!result.ok) {
      setStatus(result.reason);
      return;
    }

    const placements = new Map<Editor, SpellPlacement[]>();
    result.typos.forEach((typo, index) => {
      if (ignored.current.has(ignoreKey(typo))) return;
      const { editor, segment } = flat[typo.segment];
      const list = placements.get(editor) ?? [];
      list.push({
        from: segment.from + typo.from,
        to: segment.from + typo.to,
        mark: {
          id: `${ticket}-${index}`,
          type: typo.type,
          token: typo.token,
          suggestion: typo.suggestion,
          info: typo.info,
        },
      });
      placements.set(editor, list);
    });

    const alive = editors.filter((editor) => !editor.isDestroyed);
    for (const editor of alive) setSpellMarks(editor.view, placements.get(editor) ?? []);
    watch(alive);

    const first = alive.flatMap((editor) => listSpellMarks(editor.state))[0];
    if (!first) {
      setStatus("clean");
      return;
    }
    setStatus("idle");
    setCurrentId(first.mark.id);
    setReviewOpen(true);
  }, [getEditors, status, watch]);

  // ⌘⇧P — 크롬·사파리는 이 키를 쓰지 않는다. 파이어폭스는 "사생활 보호 창"과 겹친다
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        void run();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [run]);

  /* ── 지금 고치는 곳: 테두리를 얹고 화면 가운데로 ── */
  useEffect(() => {
    const target = reviewOpen ? currentId : null;
    for (const editor of getEditors()) {
      const has = listSpellMarks(editor.state).some((item) => item.mark.id === target);
      const next = has ? target : null;
      if (currentSpellMark(editor.state) !== next) setCurrentSpellMark(editor.view, next);
    }
  });

  // 가리키는 곳이 바뀔 때만 움직인다. 같은 곳을 두고 다른 상태가 바뀔 때마다 스크롤하지 않는다
  const scrollTarget = reviewOpen ? currentId : null;
  useEffect(() => {
    if (!scrollTarget) return;
    document
      .querySelector(`[data-spell-id="${scrollTarget}"]`)
      ?.scrollIntoView({ block: "center", behavior: smoothScroll() ? "smooth" : "auto" });
  }, [scrollTarget]);

  // 지금 고치던 곳이 사라졌으면(직접 고쳐 썼다) 남은 것의 맨 앞으로 간다
  useEffect(() => {
    if (reviewOpen && currentId && !current && items[0]) setCurrentId(items[0].mark.id);
  });

  /* ── 밑줄을 누르면: 창이 떠 있으면 그 자리로, 닫혀 있으면 말풍선 ── */
  useEffect(() => {
    const onSelect = (event: Event) => {
      const id = (event as CustomEvent<{ id: string }>).detail.id;
      if (reviewOpen) {
        setCurrentId(id);
        return;
      }
      const item = getEditors()
        .flatMap((editor) => listSpellMarks(editor.state).map((p) => ({ ...p, editor })))
        .find((candidate) => candidate.mark.id === id);
      const element = item && elementOf(item);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      setBubble({
        id,
        top: rect.bottom + window.scrollY + 8,
        left: Math.max(
          12,
          Math.min(rect.left + window.scrollX, window.scrollX + window.innerWidth - 352),
        ),
      });
    };
    document.addEventListener(SPELL_SELECT_EVENT, onSelect);
    return () => document.removeEventListener(SPELL_SELECT_EVENT, onSelect);
  }, [getEditors, reviewOpen]);

  /* ── 고치기 ── */
  const neighbor = (id: string, wrap: boolean) => {
    const index = items.findIndex((item) => item.mark.id === id);
    return items[index + 1] ?? (wrap ? items[0] : items[index - 1]) ?? null;
  };

  const fix = (item: Item, text: string) => {
    const next = neighbor(item.mark.id, false);
    applySpellFix(item.editor.view, item.mark.id, text);
    if (reviewOpen) setCurrentId(next && next.mark.id !== item.mark.id ? next.mark.id : null);
  };

  const ignore = (item: Item) => {
    const next = neighbor(item.mark.id, false);
    ignored.current.add(ignoreKey(item.mark));
    removeSpellMark(item.editor.view, item.mark.id);
    if (reviewOpen) setCurrentId(next && next.mark.id !== item.mark.id ? next.mark.id : null);
  };

  const fixAll = () => {
    for (const item of items) applySpellFix(item.editor.view, item.mark.id, item.mark.suggestion);
    setCurrentId(null);
  };

  const clearAll = () => {
    for (const editor of getEditors()) clearSpellMarks(editor.view);
    setReviewOpen(false);
    setBubble(null);
  };

  const closeReview = () => {
    const back = current?.editor;
    setReviewOpen(false);
    back?.view.focus();
  };

  const bubbleItem = bubble ? (items.find((item) => item.mark.id === bubble.id) ?? null) : null;

  return (
    <>
      <span className="ml-auto flex items-center gap-2">
        {status !== "idle" && (
          <span role="status" className="font-typewriter text-[10.5px] text-faint">
            {STATUS_TEXT[status]}
          </span>
        )}
        <button
          type="button"
          onClick={() => void run()}
          aria-label="맞춤법 검사"
          aria-keyshortcuts="Meta+Shift+P"
          className={cn(
            "flex h-8 shrink-0 items-center gap-2 border px-2.5 text-[13px] transition-colors duration-150",
            "max-md:h-11",
            items.length > 0
              ? "border-accent-faith text-accent-faith"
              : "border-edge-strong text-ink hover:bg-card",
          )}
        >
          맞춤법
          {items.length > 0 ? (
            <span className="font-typewriter text-[11px] tabular-nums">{items.length}</span>
          ) : (
            <kbd className="font-typewriter text-[10.5px] text-faint max-md:hidden">⌘⇧P</kbd>
          )}
        </button>
      </span>

      {reviewOpen &&
        createPortal(
          <ReviewPanel
            items={items}
            current={current}
            onSelect={(item) => setCurrentId(item.mark.id)}
            onFix={fix}
            onIgnore={ignore}
            onSkip={(item) => setCurrentId(neighbor(item.mark.id, true)?.mark.id ?? null)}
            onFixAll={fixAll}
            onClearAll={clearAll}
            onClose={closeReview}
          />,
          document.body,
        )}

      {bubble &&
        bubbleItem &&
        !reviewOpen &&
        createPortal(
          <SuggestionBubble
            item={bubbleItem}
            top={bubble.top}
            left={bubble.left}
            onFix={(text) => {
              fix(bubbleItem, text);
              setBubble(null);
              bubbleItem.editor.view.focus();
            }}
            onIgnore={() => {
              ignore(bubbleItem);
              setBubble(null);
            }}
            onClose={() => {
              setBubble(null);
              bubbleItem.editor.view.focus();
            }}
          />,
          document.body,
        )}
    </>
  );
}

/* ── 하나씩 고치기 창 ── */

function ReviewPanel({
  items,
  current,
  onSelect,
  onFix,
  onIgnore,
  onSkip,
  onFixAll,
  onClearAll,
  onClose,
}: {
  items: Item[];
  current: Item | null;
  onSelect: (item: Item) => void;
  onFix: (item: Item, text: string) => void;
  onIgnore: (item: Item) => void;
  onSkip: (item: Item) => void;
  onFixAll: () => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  const applyRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const index = current ? items.findIndex((item) => item.mark.id === current.mark.id) : -1;
  const done = items.length === 0;

  // 창이 열리면 적용 단추에 손을 얹는다 — 사람이 검사를 누른 바로 다음이라 빼앗는 포커스가 아니다
  useEffect(() => {
    applyRef.current?.focus({ preventScroll: true });
  }, []);

  // 다른 곳으로 옮기면 직접 수정은 접는다
  // biome-ignore lint/correctness/useExhaustiveDependencies: id가 바뀔 때만 접는다
  useEffect(() => setDraft(null), [current?.mark.id]);

  // 다 고쳤으면 잠깐 알리고 닫는다. 닫기 함수는 그릴 때마다 새로 오므로 ref로 부른다 —
  // 의존성에 넣으면 밑줄이 하나 걷힐 때마다 타이머가 처음부터 다시 돈다
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => closeRef.current(), 1400);
    return () => clearTimeout(timer);
  }, [done]);

  const apply = () => {
    if (!current) return;
    const text = draft ?? current.mark.suggestion;
    // 빈 칸으로 고치면 글이 지워진다. 지우려는 거라면 본문에서 지우는 게 맞다
    if (text.trim() === "") return;
    onFix(current, text);
    applyRef.current?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // 한글 조합 중의 Enter는 글자를 확정하는 키다 — 적용으로 받으면 마지막 글자가 날아간다
    if (isComposing(event)) return;

    if (event.key === "Escape") {
      event.preventDefault();
      if (draft !== null) {
        setDraft(null);
        applyRef.current?.focus({ preventScroll: true });
      } else {
        onClose();
      }
      return;
    }

    const target = event.target as HTMLElement;
    if (event.key === "Enter" && target.tagName !== "BUTTON") {
      event.preventDefault();
      apply();
      return;
    }

    // 입력칸 안의 화살표는 커서 이동이다
    if (target.tagName === "INPUT" || index === -1) return;
    if (event.key === "ArrowRight" && items[index + 1]) {
      event.preventDefault();
      onSelect(items[index + 1]);
    }
    if (event.key === "ArrowLeft" && items[index - 1]) {
      event.preventDefault();
      onSelect(items[index - 1]);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="하나씩 고치기"
      onKeyDown={onKeyDown}
      className={cn(
        "fixed left-1/2 z-40 flex w-[min(540px,calc(100%-32px))] -translate-x-1/2 flex-col",
        "border border-edge-strong bg-card text-ink shadow-card",
        "bottom-[calc(16px+env(safe-area-inset-bottom,0px))]",
      )}
    >
      <div className="flex items-center gap-2.5 border-edge border-b px-4 py-2 font-typewriter text-[11px] text-faint tracking-[0.08em]">
        <span>하나씩 고치기</span>
        <span className="text-ink tabular-nums">
          {done ? "0 / 0" : `${index + 1} / ${items.length}`}
        </span>
        <span className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={onClearAll}
            className="h-8 px-2 tracking-normal hover:bg-surface-tab hover:text-ink"
          >
            밑줄 지우기
          </button>
          <PanelIcon label="이전" disabled={index <= 0} onClick={() => onSelect(items[index - 1])}>
            ←
          </PanelIcon>
          <PanelIcon
            label="다음"
            disabled={index === -1 || index >= items.length - 1}
            onClick={() => onSelect(items[index + 1])}
          >
            →
          </PanelIcon>
          <PanelIcon label="닫기" onClick={onClose}>
            ✕
          </PanelIcon>
        </span>
      </div>

      {done || !current ? (
        <p className="px-4 py-6 text-center font-serif text-[16px]">다 고쳤어요.</p>
      ) : (
        <>
          <Suggestion
            mark={current.mark}
            draft={draft}
            onDraft={setDraft}
            size="lg"
            className="px-4 pt-3.5 pb-2.5"
          />
          <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3.5">
            <ActionButton ref={applyRef} primary onClick={apply}>
              {draft === null ? "적용" : "이대로 적용"}
              <kbd className="font-typewriter text-[10px] opacity-70">Enter</kbd>
            </ActionButton>
            {draft === null && (
              <ActionButton onClick={() => setDraft(current.mark.suggestion)}>
                직접 수정
              </ActionButton>
            )}
            <ActionButton onClick={() => onSkip(current)}>건너뛰기</ActionButton>
            <ActionButton onClick={() => onIgnore(current)}>이번엔 무시</ActionButton>
            <ActionButton className="ml-auto" onClick={onFixAll}>
              남은 것 모두 적용
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}

/* ── 밑줄 말풍선 (창을 닫은 뒤) ── */

function SuggestionBubble({
  item,
  top,
  left,
  onFix,
  onIgnore,
  onClose,
}: {
  item: Item;
  top: number;
  left: number;
  onFix: (text: string) => void;
  onIgnore: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<string | null>(null);

  // 바깥을 누르면 닫는다. 다른 밑줄을 누른 것이면 그쪽이 곧 새로 연다
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) closeRef.current();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 다른 밑줄로 옮기면 직접 수정을 접는다
  useEffect(() => setDraft(null), [item.mark.id]);

  const apply = () => {
    const text = draft ?? item.mark.suggestion;
    if (text.trim() !== "") onFix(text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isComposing(event)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (draft !== null) setDraft(null);
      else onClose();
    }
    if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
      event.preventDefault();
      apply();
    }
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="맞춤법 제안"
      onKeyDown={onKeyDown}
      style={{ top, left }}
      className="absolute z-40 flex w-[min(340px,calc(100vw-24px))] flex-col gap-2.5 border border-edge-strong bg-card px-3.5 py-3 text-ink shadow-card"
    >
      <Suggestion mark={item.mark} draft={draft} onDraft={setDraft} size="md" />
      <div className="flex flex-wrap items-center gap-1.5">
        <ActionButton primary onClick={apply}>
          {draft === null ? "적용" : "이대로 적용"}
        </ActionButton>
        {draft === null && (
          <ActionButton onClick={() => setDraft(item.mark.suggestion)}>직접 수정</ActionButton>
        )}
        <ActionButton onClick={onIgnore}>이번엔 무시</ActionButton>
        <span className="ml-auto font-typewriter text-[10.5px] text-faint">Esc 닫기</span>
      </div>
    </div>
  );
}

/* ── 공통 조각 ── */

/** 분류 · 원문 → 제안(또는 직접 적는 칸) · 설명 */
function Suggestion({
  mark,
  draft,
  onDraft,
  size,
  className,
}: {
  mark: SpellMark;
  draft: string | null;
  onDraft: (value: string) => void;
  size: "md" | "lg";
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const editing = draft !== null;

  // 직접 수정을 열면 제안을 채운 채 전부 고른다 — 바로 치면 통째로 바뀌고, 화살표로 다듬을 수도 있다
  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const tone = spellToneOf(mark.type);

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <span
        className={cn(
          "font-typewriter text-[10.5px] tracking-[0.12em]",
          tone === "space" ? "text-ok" : "text-accent-faith",
        )}
      >
        {spellLabelOf(mark.type)}
      </span>
      <div
        className={cn(
          "flex flex-wrap items-baseline gap-2.5",
          size === "lg" ? "text-[18px]" : "text-[16px]",
        )}
      >
        <span className="text-faint line-through">{mark.token}</span>
        <span aria-hidden className="text-[13px] text-faint">
          →
        </span>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            aria-label="고칠 말 직접 입력"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-[1_1_160px] border border-accent-faith bg-surface-sheet px-2 py-0.5 font-bold outline-none focus-visible:ring-2 focus-visible:ring-accent-faith/30"
          />
        ) : (
          <span className="font-bold">{mark.suggestion}</span>
        )}
      </div>
      {mark.info && (
        <p className="whitespace-pre-line text-[12.5px] text-ink-soft leading-[1.65]">
          {firstParagraph(mark.info)}
        </p>
      )}
    </div>
  );
}

/** 다음의 설명은 규칙 뒤에 예문이 빈 줄 몇 개를 두고 붙어 온다. 창에는 규칙만 싣는다 */
function firstParagraph(info: string): string {
  return info.split(/\n{2,}/)[0];
}

function ActionButton({
  primary,
  className,
  ref,
  ...props
}: ComponentProps<"button"> & { primary?: boolean }) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex min-h-[34px] items-center gap-2 border px-3.5 text-[13px] transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-accent-faith focus-visible:outline-offset-1",
        primary
          ? "border-ink bg-ink text-card"
          : "border-edge-strong text-ink hover:bg-surface-tab",
        className,
      )}
      {...props}
    />
  );
}

function PanelIcon({ label, ...props }: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="h-8 min-w-8 text-[13px] text-ink-soft hover:bg-surface-tab hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent"
      {...props}
    />
  );
}
