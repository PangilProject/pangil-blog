import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { htmlToTiptapContent } from "@/scripts/migrate-tistory/convertHtml";
import { extractPost } from "@/scripts/migrate-tistory/extract";

/**
 * 티스토리 마크업의 실제 모양을 하나씩 고정한다(05 §6.2 "sanitize가 실무 8할").
 * 여기서 잃는 것은 750편에서 잃는 것이다.
 */

function convert(html: string) {
  return htmlToTiptapContent(html);
}

function first(html: string) {
  return convert(html).content[0] as Record<string, unknown>;
}

describe("문단·글자", () => {
  it("data-ke-*·인라인 style·span 껍데기를 버리고 글자만 남긴다", () => {
    expect(
      first(
        '<p style="color:#000" data-ke-size="size16"><span>주님이 </span><span>채우시네</span></p>',
      ),
    ).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "주님이 " },
        { type: "text", text: "채우시네" },
      ],
    });
  });

  it("&nbsp;만 있는 문단은 버린다 — 티스토리가 줄 간격으로 쓴다", () => {
    expect(convert("<p>&nbsp;</p><p>본문</p>").content).toHaveLength(1);
  });

  it("굵게·밑줄·링크를 마크로 옮긴다", () => {
    const paragraph = first('<p><b>굵게</b><u>밑줄</u><a href="https://x.dev">링크</a></p>');
    expect(paragraph.content).toEqual([
      { type: "text", text: "굵게", marks: [{ type: "bold" }] },
      { type: "text", text: "밑줄", marks: [{ type: "underline" }] },
      {
        type: "text",
        text: "링크",
        marks: [{ type: "link", attrs: { href: "https://x.dev" } }],
      },
    ]);
  });

  it("<br>은 문단 안에서 hardBreak가 된다", () => {
    expect((first("<p>한 줄<br>다음 줄</p>").content as unknown[])[1]).toEqual({
      type: "hardBreak",
    });
  });
});

describe("제목", () => {
  it("지면 최상위는 h2다 — h1·h2는 2, 그 아래는 전부 3으로 눕힌다", () => {
    const levels = convert("<h1>a</h1><h2>b</h2><h3>c</h3><h4>d</h4><h5>e</h5>").content.map(
      (node) => (node as { attrs: { level: number } }).attrs.level,
    );

    expect(levels).toEqual([2, 2, 3, 3, 3]);
  });
});

describe("코드 블록", () => {
  it("사용자가 고른 언어(data-ke-language)를 믿는다", () => {
    expect(
      first('<pre data-ke-language="typescript" class="routeros"><code>const a = 1</code></pre>'),
    ).toMatchObject({ type: "codeBlock", attrs: { language: "ts" } });
  });

  it("language-* 클래스도 읽는다", () => {
    expect(first('<pre><code class="language-c">int main()</code></pre>')).toMatchObject({
      attrs: { language: "c" },
    });
  });

  it("티스토리 자동 감지가 일관되게 틀리는 n1ql은 sql로 고친다", () => {
    expect(first('<pre class="n1ql"><code>DROP DATABASE naver_db;</code></pre>')).toMatchObject({
      attrs: { language: "sql" },
    });
  });

  it("모르는 자동 감지 라벨은 언어 없이 둔다 — 틀린 색보다 색 없는 편이 낫다", () => {
    expect(first('<pre class="angelscript"><code>x</code></pre>')).toMatchObject({
      attrs: { language: null },
    });
  });

  it("코드의 공백은 그대로 지킨다", () => {
    const code = first('<pre class="sql"><code>SELECT 1\n  FROM t</code></pre>');
    expect((code.content as { text: string }[])[0].text).toBe("SELECT 1\n  FROM t");
  });
});

describe("이미지", () => {
  it("figure 안의 이미지를 꺼내고 껍데기를 버린다", () => {
    expect(
      convert(
        '<figure class="imageblock"><span data-lightbox="lightbox"><img src="./img/img.png"></span><figcaption></figcaption></figure>',
      ).content,
    ).toEqual([{ type: "image", attrs: { src: "./img/img.png", alt: "" } }]);
  });

  it("캡션이 있으면 아래 문단으로 남긴다 — 이미지 노드에 자리가 없다", () => {
    const content = convert(
      '<figure><img src="a.png"><figcaption>그림 1</figcaption></figure>',
    ).content;

    expect(content).toHaveLength(2);
    expect(content[1]).toMatchObject({ type: "paragraph" });
  });

  it("문단이 이미지를 품고 있으면 문단이 아니라 컨테이너다", () => {
    const content = convert('<p><figure><img src="a.png"></figure></p>').content;

    expect(content).toEqual([{ type: "image", attrs: { src: "a.png", alt: "" } }]);
  });

  it("마크 안에 든 이미지도 살린다 — 굵게는 잃고 그림은 지킨다", () => {
    expect(convert('<p><b><img src="a.png"></b></p>').content).toEqual([
      { type: "image", attrs: { src: "a.png", alt: "" } },
    ]);
  });
});

describe("표", () => {
  it("표를 노드로 옮긴다", () => {
    const table = first("<table><tbody><tr><th>이름</th><td>값</td></tr></tbody></table>");

    expect(table.type).toBe("table");
    const row = (table.content as { content: Record<string, unknown>[] }[])[0];
    expect(row.content.map((cell) => cell.type)).toEqual(["tableHeader", "tableCell"]);
    expect(row.content[0].content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "이름" }] },
    ]);
  });

  it("병합 칸을 지킨다", () => {
    const table = first('<table><tr><td colspan="2" rowspan="3">x</td></tr></table>');
    const cell = ((table.content as { content: Record<string, unknown>[] }[])[0].content ?? [])[0];

    expect(cell.attrs).toMatchObject({ colspan: 2, rowspan: 3 });
  });
});

describe("목록", () => {
  it("글자만 있는 li를 문단으로 감싼다 — listItem은 블록만 담는다", () => {
    expect(first("<ul><li>하나</li></ul>")).toEqual({
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "하나" }] }],
        },
      ],
    });
  });

  it("중첩 목록을 지킨다", () => {
    const item = (
      first("<ul><li>겉<ul><li>안</li></ul></li></ul>").content as Record<string, unknown>[]
    )[0];

    expect((item.content as { type: string }[]).map((child) => child.type)).toEqual([
      "paragraph",
      "bulletList",
    ]);
  });
});

describe("잃는 것을 알려준다", () => {
  it("iframe은 주소를 남기고 노트를 붙인다", () => {
    const result = convert('<iframe src="https://www.youtube.com/embed/abc"></iframe>');

    expect(result.notes).toEqual([{ kind: "iframe", detail: "https://www.youtube.com/embed/abc" }]);
    expect(result.content[0]).toMatchObject({ type: "paragraph" });
  });

  it("꺾쇠가 태그로 먹힌 글자를 되살린다", () => {
    // 원문은 `s3://<bucket-name>/키` 였다. 브라우저가 <bucket-name>을 태그로 읽는다
    const paragraph = first("<p>s3://<bucket-name>/키</p>");

    expect((paragraph.content as { text: string }[]).map((child) => child.text).join("")).toBe(
      "s3://<bucket-name>/키",
    );
  });

  it("본문이 비면 노트로 알린다", () => {
    expect(convert("<p>&nbsp;</p>").notes).toEqual([
      { kind: "empty-body", detail: "변환 결과가 비었습니다" },
    ]);
  });
});

describe("실제 백업 한 편", () => {
  it("코드·이미지·목록이 섞인 글을 통째로 변환한다", () => {
    const html = readFileSync(new URL("./fixtures/tech-105.html", import.meta.url), "utf-8");
    const post = extractPost(html, "105/105-x.html");
    const { content, notes } = htmlToTiptapContent(post.bodyHtml);

    const types = new Set(content.map((node) => (node as { type: string }).type));
    expect(types).toContain("heading");
    expect(types).toContain("codeBlock");
    expect(types).toContain("image");
    expect(types).toContain("bulletList");
    // 실물 한 편에서는 아무것도 흘리지 않는다
    expect(notes).toEqual([]);
  });
});
