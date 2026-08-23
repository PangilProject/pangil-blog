import { Editor } from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImagePaste, type ImageUploadResult } from "@/lib/editor/imagePaste";

/**
 * 스크린샷 붙여넣기가 기술 글의 실제 작성 경로다(04 §3.3). 여기서 고정하는 것은
 * "이미지만 가로챈다"와 "업로드 실패가 편집을 망치지 않는다"다.
 */
let editor: Editor | null = null;

function open(upload: (file: File) => Promise<ImageUploadResult | null>) {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: [StarterKit, Image, ImagePaste.configure({ upload })],
    content: "<p>본문</p>",
  });
  return editor;
}

const png = () => new File([new Uint8Array([1, 2, 3])], "shot.png", { type: "image/png" });
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

afterEach(() => {
  editor?.destroy();
  editor = null;
});

function paste(instance: Editor, files: File[]) {
  const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & {
    clipboardData: unknown;
  };
  Object.defineProperty(event, "clipboardData", {
    value: { files, getData: () => "", types: files.length ? ["Files"] : [] },
  });
  instance.view.dom.dispatchEvent(event);
  return event;
}

describe("ImagePaste", () => {
  it("붙여넣은 이미지를 올려 그 자리에 넣는다", async () => {
    const upload = vi.fn(async () => ({ url: "https://e.com/a.png", width: 800, height: 600 }));
    const instance = open(upload);

    paste(instance, [png()]);
    await settle();

    expect(upload).toHaveBeenCalledTimes(1);
    const image = instance.getJSON().content?.find((node) => node.type === "image");
    expect(image?.attrs).toMatchObject({ src: "https://e.com/a.png", width: 800, height: 600 });
  });

  it("크기를 모르면 크기 없이 넣는다 — 이미지가 올라가는 게 먼저다", async () => {
    const instance = open(async () => ({ url: "https://e.com/a.png", width: null, height: null }));

    paste(instance, [png()]);
    await settle();

    const image = instance.getJSON().content?.find((node) => node.type === "image");
    expect(image?.attrs?.src).toBe("https://e.com/a.png");
    expect(image?.attrs?.width).toBeNull();
  });

  it("업로드가 실패하면 아무것도 넣지 않는다 — 쓰던 글은 그대로다", async () => {
    const instance = open(async () => null);

    paste(instance, [png()]);
    await settle();

    expect(instance.getJSON().content?.some((node) => node.type === "image")).toBe(false);
    expect(instance.getText()).toContain("본문");
  });

  it("이미지가 없는 붙여넣기는 가로채지 않는다", async () => {
    const upload = vi.fn(async () => null);
    const instance = open(upload);

    const event = paste(instance, []);
    await settle();

    expect(upload).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
