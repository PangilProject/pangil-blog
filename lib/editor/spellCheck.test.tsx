import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applySpellFix,
  clearSpellMarks,
  currentSpellMark,
  listSpellMarks,
  removeSpellMark,
  SPELL_SELECT_EVENT,
  SpellCheck,
  type SpellMark,
  setCurrentSpellMark,
  setSpellMarks,
  spellToneOf,
} from "@/lib/editor/spellCheck";
import { collectSegments, readRange } from "@/lib/editor/spellSegments";

/**
 * 맞춤법 밑줄 — 문서에서 글자열을 뽑고, 그 자리에 밑줄을 긋고, 고치면 걷히는지.
 *
 * 화면에서 밑줄을 눌러 고치는 흐름은 브라우저로 본다(SpellCheckControl). 여기서는 jsdom이
 * 믿을 만한 것 — 문서 위치와 플러그인 상태 — 만 고정한다.
 */
let editor: Editor | null = null;

function open(html: string) {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit, SpellCheck],
    content: html,
  });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

function mark(id: string, token: string, suggestion: string, type = "spell"): SpellMark {
  return { id, type, token, suggestion, info: null };
}

/** 문서에서 token을 찾아 밑줄 자리로 만든다 */
function place(instance: Editor, item: SpellMark) {
  const [segment] = collectSegments(instance.state.doc).filter((s) => s.text.includes(item.token));
  const from = segment.from + segment.text.indexOf(item.token);
  return { from, to: from + item.token.length, mark: item };
}

describe("collectSegments", () => {
  it("문단마다 하나씩, 문서 위치와 함께 뽑는다", () => {
    const instance = open("<p>몇일 동안</p><h2>되서 기쁘다</h2>");
    const segments = collectSegments(instance.state.doc);

    expect(segments.map((s) => s.text)).toEqual(["몇일 동안", "되서 기쁘다"]);
    for (const { text, from } of segments) {
      expect(readRange(instance.state.doc, from, from + text.length)).toBe(text);
    }
  });

  it("목록·인용 안의 문단도 뽑는다", () => {
    const instance = open("<ul><li><p>금새</p></li></ul><blockquote><p>뵈요</p></blockquote>");

    expect(collectSegments(instance.state.doc).map((s) => s.text)).toEqual(["금새", "뵈요"]);
  });

  it("코드 블록은 건너뛴다", () => {
    const instance = open("<p>앞</p><pre><code>const 되서 = 1;</code></pre><p>뒤</p>");

    expect(collectSegments(instance.state.doc).map((s) => s.text)).toEqual(["앞", "뒤"]);
  });

  it("인라인 코드에서 끊는다 — 공백으로 메우면 띄어쓰기 오류가 생긴다", () => {
    const instance = open("<p>함수 <code>되서()</code>를 부른다</p>");
    const segments = collectSegments(instance.state.doc);

    expect(segments.map((s) => s.text)).toEqual(["함수 ", "를 부른다"]);
    const [, after] = segments;
    expect(readRange(instance.state.doc, after.from, after.from + after.text.length)).toBe(
      after.text,
    );
  });

  it("줄바꿈은 한 글자로 들어가고 위치가 어긋나지 않는다", () => {
    const instance = open("<p>첫 줄<br>몇일</p>");
    const [segment] = collectSegments(instance.state.doc);

    expect(segment.text).toBe("첫 줄\n몇일");
    const at = segment.from + segment.text.indexOf("몇일");
    expect(readRange(instance.state.doc, at, at + 2)).toBe("몇일");
  });

  it("줄바꿈 없는 공백은 공백으로 읽는다", () => {
    const instance = open("<p>감사 드리는</p>");

    expect(collectSegments(instance.state.doc)[0].text).toBe("감사 드리는");
  });

  it("빈 문단은 보내지 않는다", () => {
    expect(collectSegments(open("<p></p><p>  </p>").state.doc)).toEqual([]);
  });
});

describe("밑줄", () => {
  it("자리에 밑줄을 긋는다 — 맞춤법과 띄어쓰기는 모양이 다르다", () => {
    const instance = open("<p>몇일 동안 안했다.</p>");
    setSpellMarks(instance.view, [
      place(instance, mark("a", "몇일", "며칠")),
      place(instance, mark("b", "안했다.", "안 했다.", "space")),
    ]);

    expect(listSpellMarks(instance.state).map((p) => p.mark.id)).toEqual(["a", "b"]);
    expect(instance.view.dom.querySelector('[data-spell-id="a"]')?.className).toContain(
      "spell-typo--spell",
    );
    expect(instance.view.dom.querySelector('[data-spell-id="b"]')?.className).toContain(
      "spell-typo--space",
    );
  });

  it("문서에 아무것도 쓰지 않는다", () => {
    const instance = open("<p>몇일 동안</p>");
    const before = JSON.stringify(instance.getJSON());

    setSpellMarks(instance.view, [place(instance, mark("a", "몇일", "며칠"))]);

    expect(JSON.stringify(instance.getJSON())).toBe(before);
  });

  it("자리의 글자가 다르면 긋지 않는다 — 검사하는 동안 계속 썼을 수 있다", () => {
    const instance = open("<p>몇일 동안</p>");

    setSpellMarks(instance.view, [{ from: 1, to: 3, mark: mark("a", "되서", "돼서") }]);

    expect(listSpellMarks(instance.state)).toEqual([]);
  });

  it("그 말을 직접 고쳐 쓰면 밑줄이 사라진다", () => {
    const instance = open("<p>몇일 동안</p>");
    setSpellMarks(instance.view, [place(instance, mark("a", "몇일", "며칠"))]);

    instance.commands.insertContentAt(2, "x");

    expect(listSpellMarks(instance.state)).toEqual([]);
  });

  it("다른 곳을 고치면 밑줄은 남고 자리를 따라간다", () => {
    const instance = open("<p>오늘 몇일 동안</p>");
    setSpellMarks(instance.view, [place(instance, mark("a", "몇일", "며칠"))]);

    instance.commands.insertContentAt(1, "아, ");

    const [placement] = listSpellMarks(instance.state);
    expect(readRange(instance.state.doc, placement.from, placement.to)).toBe("몇일");
  });

  it("고치면 글자가 바뀌고 밑줄이 걷힌다", () => {
    const instance = open("<p>몇일 동안</p>");
    setSpellMarks(instance.view, [place(instance, mark("a", "몇일", "며칠"))]);

    expect(applySpellFix(instance.view, "a", "며칠")).toBe(true);

    expect(instance.getText()).toBe("며칠 동안");
    expect(listSpellMarks(instance.state)).toEqual([]);
  });

  it("직접 수정한 말로도 고친다 — 원문과 같아도 밑줄은 걷는다", () => {
    const instance = open("<p>몇일 동안</p>");
    setSpellMarks(instance.view, [place(instance, mark("a", "몇일", "며칠"))]);

    applySpellFix(instance.view, "a", "몇일");

    expect(instance.getText()).toBe("몇일 동안");
    expect(listSpellMarks(instance.state)).toEqual([]);
  });

  it("고친 것은 되돌릴 수 있다", () => {
    const instance = open("<p>몇일 동안</p>");
    setSpellMarks(instance.view, [place(instance, mark("a", "몇일", "며칠"))]);

    applySpellFix(instance.view, "a", "며칠");
    instance.commands.undo();

    expect(instance.getText()).toBe("몇일 동안");
  });

  it("무시하면 그 밑줄만 걷힌다", () => {
    const instance = open("<p>몇일 동안 되서</p>");
    setSpellMarks(instance.view, [
      place(instance, mark("a", "몇일", "며칠")),
      place(instance, mark("b", "되서", "돼서")),
    ]);

    removeSpellMark(instance.view, "a");

    expect(listSpellMarks(instance.state).map((p) => p.mark.id)).toEqual(["b"]);
  });

  it("지금 고치는 곳에 테두리를 얹고, 그 밑줄이 사라지면 함께 사라진다", () => {
    const instance = open("<p>몇일 동안</p>");
    setSpellMarks(instance.view, [place(instance, mark("a", "몇일", "며칠"))]);

    setCurrentSpellMark(instance.view, "a");
    expect(instance.view.dom.querySelector(".spell-typo--current")).not.toBeNull();

    removeSpellMark(instance.view, "a");
    expect(currentSpellMark(instance.state)).toBeNull();
    expect(instance.view.dom.querySelector(".spell-typo--current")).toBeNull();
  });

  it("지우면 전부 걷힌다", () => {
    const instance = open("<p>몇일 동안 되서</p>");
    setSpellMarks(instance.view, [place(instance, mark("a", "몇일", "며칠"))]);

    clearSpellMarks(instance.view);

    expect(listSpellMarks(instance.state)).toEqual([]);
  });

  it("밑줄을 누르면 어느 것인지 DOM으로 알린다", () => {
    const instance = open("<p>몇일 동안</p>");
    const placement = place(instance, mark("a", "몇일", "며칠"));
    setSpellMarks(instance.view, [placement]);

    const heard = vi.fn();
    instance.view.dom.addEventListener(SPELL_SELECT_EVENT, (event) =>
      heard((event as CustomEvent).detail),
    );
    instance.view.someProp("handleClick", (handle) =>
      handle(instance.view, placement.from + 1, new MouseEvent("click")),
    );

    expect(heard).toHaveBeenCalledWith({ id: "a" });
  });

  it("되돌리기에 밑줄 긋기가 끼지 않는다", () => {
    const instance = open("<p>몇일 동안</p>");
    instance.commands.insertContentAt(instance.state.doc.content.size - 1, "!");
    setSpellMarks(instance.view, [place(instance, mark("a", "몇일", "며칠"))]);

    instance.commands.undo();

    expect(instance.getText()).toBe("몇일 동안");
  });
});

describe("spellToneOf", () => {
  it("띄어쓰기만 틀린 것만 초록이다. 둘 다 틀린 것은 맞춤법 쪽이다", () => {
    expect(spellToneOf("space")).toBe("space");
    expect(spellToneOf("space_spell")).toBe("spell");
    expect(spellToneOf("doubt")).toBe("spell");
  });
});
