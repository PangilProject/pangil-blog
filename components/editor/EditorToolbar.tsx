"use client";

import { cn } from "@/lib/utils";

/**
 * 고정 툴바 (ADR-001) — 티스토리식 WYSIWYG. 상단에 붙어 있고, 스타일을 고르면 커서 위치의
 * 블록이 그 자리에서 바뀐다. 좌우 분할·소스/미리보기 분리·플로팅 툴바는 금지다.
 *
 * M1에서는 셸까지다. Tiptap 인스턴스 연결과 실제 명령 실행은 M2에서 붙이며, 그때
 * onCommand/activeCommands만 채우면 되도록 표면을 미리 고정해 둔다.
 *
 * variant는 03 §5.3의 툴바 구성 차등이다: 기술·큐티는 full, 설교·찬양은 slim.
 * 관리 화면 전용이므로 공개 페이지의 클라이언트 아일랜드 한도(04 §3.6)와 무관하다.
 */

export type BlockStyle = "p" | "h2" | "h3" | "blockquote" | "pre";

export type ToolbarCommand =
  | "bold"
  | "italic"
  | "underline"
  | "bulletList"
  | "blockquote"
  | "horizontalRule";

export type EditorToolbarVariant = "full" | "slim";

const BLOCK_STYLE_LABELS: Record<BlockStyle, string> = {
  p: "본문",
  h2: "제목 1",
  h3: "제목 2",
  blockquote: "인용",
  pre: "코드 블록",
};

/** slim은 설교·찬양용 — 라이브 속기와 가사 타이핑을 방해하지 않을 만큼만 남긴다 */
const BLOCK_STYLES_BY_VARIANT: Record<EditorToolbarVariant, BlockStyle[]> = {
  full: ["p", "h2", "h3", "blockquote", "pre"],
  slim: ["p", "h3", "blockquote"],
};

const MARK_COMMANDS_BY_VARIANT: Record<EditorToolbarVariant, ToolbarCommand[]> = {
  full: ["bold", "italic", "underline"],
  slim: ["bold"],
};

const BLOCK_COMMANDS_BY_VARIANT: Record<EditorToolbarVariant, ToolbarCommand[]> = {
  full: ["bulletList", "blockquote", "horizontalRule"],
  slim: ["bulletList", "blockquote"],
};

const COMMAND_LABELS: Record<ToolbarCommand, string> = {
  bold: "굵게",
  italic: "기울임",
  underline: "밑줄",
  bulletList: "목록",
  blockquote: "인용",
  horizontalRule: "구분선",
};

const COMMAND_GLYPHS: Record<ToolbarCommand, string> = {
  bold: "B",
  italic: "가",
  underline: "U",
  bulletList: "≡ 목록",
  blockquote: "❝ 인용",
  horizontalRule: "— 구분선",
};

export type EditorToolbarProps = {
  variant?: EditorToolbarVariant;
  /** 커서가 놓인 블록의 스타일. 툴바는 현재 블록을 표시한다(ADR-001 §3 양방향 반영) */
  blockStyle?: BlockStyle;
  activeCommands?: ToolbarCommand[];
  onBlockStyleChange?: (style: BlockStyle) => void;
  onCommand?: (command: ToolbarCommand) => void;
  /** 우측 힌트 — "마크다운 단축 입력도 됩니다" 등 */
  hint?: string;
  className?: string;
};

export function EditorToolbar({
  variant = "full",
  blockStyle = "p",
  activeCommands = [],
  onBlockStyleChange,
  onCommand,
  hint,
  className,
}: EditorToolbarProps) {
  const marks = MARK_COMMANDS_BY_VARIANT[variant];
  const blocks = BLOCK_COMMANDS_BY_VARIANT[variant];

  return (
    <div
      // 스크롤해도 늘 같은 자리에 있어야 한다 — 떠다니는 UI 금지(ADR-001 §5)
      className={cn(
        "sticky top-0 z-10 flex flex-wrap items-center gap-1 border-edge border-b",
        "bg-[#f4efe3] px-[5%] py-[9px]",
        className,
      )}
    >
      <label className="sr-only" htmlFor="editor-block-style">
        문단 스타일
      </label>
      <select
        id="editor-block-style"
        value={blockStyle}
        onChange={(event) => onBlockStyleChange?.(event.target.value as BlockStyle)}
        className="min-w-[92px] border border-edge bg-card px-2 py-[7px] text-[13px] text-ink"
      >
        {BLOCK_STYLES_BY_VARIANT[variant].map((style) => (
          <option key={style} value={style}>
            {BLOCK_STYLE_LABELS[style]}
          </option>
        ))}
      </select>

      <Separator />

      {marks.map((command) => (
        <ToolbarButton
          key={command}
          command={command}
          active={activeCommands.includes(command)}
          onCommand={onCommand}
        />
      ))}

      <Separator />

      {blocks.map((command) => (
        <ToolbarButton
          key={command}
          command={command}
          active={activeCommands.includes(command)}
          onCommand={onCommand}
          typewriter
        />
      ))}

      {hint && <span className="ml-auto font-typewriter text-[10px] text-[#a79c86]">{hint}</span>}
    </div>
  );
}

function Separator() {
  return <span aria-hidden className="mx-1.5 h-5 w-px bg-[#dcd4c2]" />;
}

function ToolbarButton({
  command,
  active,
  onCommand,
  typewriter,
}: {
  command: ToolbarCommand;
  active: boolean;
  onCommand?: (command: ToolbarCommand) => void;
  typewriter?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={COMMAND_LABELS[command]}
      onClick={() => onCommand?.(command)}
      className={cn(
        "h-8 min-w-8 border px-2 text-[13.5px] text-[#4e483c] transition-colors duration-150",
        typewriter && "font-typewriter text-[11px]",
        active
          ? "border-[#c9a98a] bg-card text-(--accent)"
          : "border-transparent hover:border-edge hover:bg-card",
      )}
    >
      {COMMAND_GLYPHS[command]}
    </button>
  );
}
