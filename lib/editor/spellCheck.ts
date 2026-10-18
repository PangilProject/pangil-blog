import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { type EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

import { readRange } from "@/lib/editor/spellSegments";

/**
 * 맞춤법 밑줄 (데코레이션).
 *
 * **문서에 아무것도 쓰지 않는다.** 밑줄은 화면에만 그려지는 표시라 저장 JSON에 실리지 않고,
 * 자동 저장·로컬 미러·발행 어디에도 닿지 않는다. 고치는 일(`applySpellFix`)만 진짜 편집이다.
 *
 * 밑줄은 **처음 그 말 위에 있을 때만** 산다. 문서가 바뀔 때마다 자리를 옮긴 뒤 그 자리의 글자가
 * 아직 처음 말과 같은지 본다 — 사람이 그 말을 직접 고쳐 쓰면 밑줄이 사라지고, 옆 문장을 고치면
 * 그대로 남는다. 바뀐 범위를 계산하는 것보다 이 한 줄이 덜 틀린다.
 *
 * 밑줄을 누르면 문서가 아니라 DOM으로 알린다(`SPELL_SELECT_EVENT`). 확장은 에디터를 만들 때
 * 한 번 굳으므로, 누가 듣는지 모르는 채로 소리만 내는 편이 맞다.
 */

export type SpellMark = {
  id: string;
  /** 검사기의 분류 그대로다 (lib/spell/locate의 SpellTypo.type) */
  type: string;
  token: string;
  suggestion: string;
  info: string | null;
};

export type SpellPlacement = { from: number; to: number; mark: SpellMark };

type SpellState = { set: DecorationSet; current: string | null };

type SpellMeta =
  | { kind: "set"; placements: SpellPlacement[] }
  | { kind: "clear" }
  | { kind: "remove"; id: string }
  | { kind: "current"; id: string | null };

export const spellPluginKey = new PluginKey<SpellState>("recordSpellCheck");

/** 밑줄을 눌렀을 때 view.dom에서 위로 올라가는 이벤트. detail은 `{ id }` */
export const SPELL_SELECT_EVENT = "record:spell-select";

/** 색과 선 모양은 둘뿐이다 — 띄어쓰기만 틀린 것과 그 밖의 것. 둘 다 틀린 것은 맞춤법 쪽이다 */
export function spellToneOf(type: string): "spell" | "space" {
  return type === "space" ? "space" : "spell";
}

const LABELS: Record<string, string> = {
  spell: "맞춤법",
  space: "띄어쓰기",
  space_spell: "맞춤법 · 띄어쓰기",
  doubt: "표준어 의심",
};

export function spellLabelOf(type: string): string {
  return LABELS[type] ?? "맞춤법";
}

function decorationFor({ from, to, mark }: SpellPlacement): Decoration {
  return Decoration.inline(
    from,
    to,
    { class: `spell-typo spell-typo--${spellToneOf(mark.type)}`, "data-spell-id": mark.id },
    { spell: mark },
  );
}

const markOf = (decoration: Decoration) => (decoration.spec as { spell: SpellMark }).spell;

/** 그 자리의 글자가 처음 말과 같은가 */
function stillThere(doc: PMNode, from: number, to: number, token: string): boolean {
  return from < to && to <= doc.content.size && readRange(doc, from, to) === token;
}

function apply(tr: import("@tiptap/pm/state").Transaction, state: SpellState): SpellState {
  let { set, current } = state;

  if (tr.docChanged) {
    set = set.map(tr.mapping, tr.doc);
    const stale = set
      .find()
      .filter(
        (decoration) =>
          !stillThere(tr.doc, decoration.from, decoration.to, markOf(decoration).token),
      );
    if (stale.length > 0) set = set.remove(stale);
  }

  const meta = tr.getMeta(spellPluginKey) as SpellMeta | undefined;
  switch (meta?.kind) {
    case "set":
      // 검사하는 동안 사람이 계속 썼을 수 있다. 자리가 어긋난 결과는 긋지 않는다
      set = DecorationSet.create(
        tr.doc,
        meta.placements
          .filter(({ from, to, mark }) => stillThere(tr.doc, from, to, mark.token))
          .map(decorationFor),
      );
      current = null;
      break;
    case "clear":
      set = DecorationSet.empty;
      current = null;
      break;
    case "remove":
      set = set.remove(set.find(undefined, undefined, (spec) => spec.spell?.id === meta.id));
      break;
    case "current":
      current = meta.id;
      break;
  }

  if (
    current &&
    set.find(undefined, undefined, (spec) => spec.spell?.id === current).length === 0
  ) {
    current = null;
  }

  return { set, current };
}

export const SpellCheck = Extension.create({
  name: "recordSpellCheck",

  addProseMirrorPlugins() {
    return [
      new Plugin<SpellState>({
        key: spellPluginKey,

        state: {
          init: () => ({ set: DecorationSet.empty, current: null }),
          apply: (tr, value) => apply(tr, value),
        },

        props: {
          decorations: (state) => {
            const value = spellPluginKey.getState(state);
            if (!value?.current) return value?.set;

            // 지금 고치는 곳에 테두리를 하나 더 얹는다. 밑줄 자체는 그대로 둔다
            const [target] = value.set.find(
              undefined,
              undefined,
              (spec) => spec.spell?.id === value.current,
            );
            if (!target) return value.set;
            return value.set.add(state.doc, [
              Decoration.inline(target.from, target.to, { class: "spell-typo--current" }),
            ]);
          },

          handleClick: (view, pos) => {
            const value = spellPluginKey.getState(view.state);
            const hit = value?.set.find(pos, pos).find((d) => d.from <= pos && pos <= d.to);
            if (hit) {
              view.dom.dispatchEvent(
                new CustomEvent(SPELL_SELECT_EVENT, {
                  bubbles: true,
                  detail: { id: markOf(hit).id },
                }),
              );
            }
            // 커서는 그대로 그 자리에 놓인다 — 밑줄을 누른 김에 직접 고쳐 쓸 수도 있어야 한다
            return false;
          },
        },
      }),
    ];
  },
});

/* ── 바깥에서 쓰는 손잡이. 에디터 종류(Tiptap)를 모르고 ProseMirror 뷰만 안다 ── */

export function listSpellMarks(state: EditorState): SpellPlacement[] {
  const value = spellPluginKey.getState(state);
  if (!value) return [];
  return value.set
    .find()
    .map((decoration) => ({ from: decoration.from, to: decoration.to, mark: markOf(decoration) }))
    .sort((a, b) => a.from - b.from);
}

export function currentSpellMark(state: EditorState): string | null {
  return spellPluginKey.getState(state)?.current ?? null;
}

function send(view: EditorView, meta: SpellMeta) {
  // 파괴된 뷰에 dispatch하면 "mismatched transaction"으로 터진다(lib/editor/codeHighlight)
  if (view.isDestroyed) return;
  view.dispatch(view.state.tr.setMeta(spellPluginKey, meta).setMeta("addToHistory", false));
}

export const setSpellMarks = (view: EditorView, placements: SpellPlacement[]) =>
  send(view, { kind: "set", placements });
export const clearSpellMarks = (view: EditorView) => send(view, { kind: "clear" });
export const removeSpellMark = (view: EditorView, id: string) => send(view, { kind: "remove", id });
export const setCurrentSpellMark = (view: EditorView, id: string | null) =>
  send(view, { kind: "current", id });

/**
 * 밑줄 자리를 고친다. **이것만 진짜 편집이다** — 되돌리기(⌘Z)에 남고, 자동 저장이 돈다.
 * 고칠 말이 원문과 같아도(직접 수정에서 그대로 둔 경우) 밑줄은 걷는다.
 */
export function applySpellFix(view: EditorView, id: string, text: string): boolean {
  if (view.isDestroyed) return false;

  const target = listSpellMarks(view.state).find((placement) => placement.mark.id === id);
  if (!target) return false;

  view.dispatch(
    view.state.tr
      .insertText(text, target.from, target.to)
      .setMeta(spellPluginKey, { kind: "remove", id } satisfies SpellMeta),
  );
  return true;
}
