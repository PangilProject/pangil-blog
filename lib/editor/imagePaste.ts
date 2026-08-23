import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

/**
 * 이미지 붙여넣기·드롭 (04 §3.3).
 *
 * 스크린샷을 붙여넣는 것이 기술 글의 실제 작성 경로다 — 파일 선택 창을 여는 단계를 두지 않는다.
 *
 * **크기는 브라우저가 잰다.** 이미 파일을 들고 있는 쪽이 재는 게 정확하고, 서버에서 이미지
 * 헤더를 파싱하는 코드를 두지 않아도 된다. next/image가 그 값을 요구한다(04 §3.3).
 *
 * 업로드 중에는 편집을 막지 않는다. 올라간 뒤 커서 자리가 아니라 **처음 놓은 자리**에 넣는다 —
 * 기다리는 동안 계속 쓰던 사람의 커서를 빼앗지 않는다.
 */

export type ImageUploadResult = { url: string; width: number | null; height: number | null };

export type ImagePasteOptions = {
  /** 업로드 담당. 실패는 null이고, 그때 화면에는 아무 일도 일어나지 않는다 */
  upload: (file: File) => Promise<ImageUploadResult | null>;
  onError?: (message: string) => void;
};

function imageFilesOf(list: FileList | null | undefined): File[] {
  if (!list) return [];
  return [...list].filter((file) => file.type.startsWith("image/"));
}

export const ImagePaste = Extension.create<ImagePasteOptions>({
  name: "imagePaste",

  addOptions() {
    return { upload: async () => null };
  },

  addProseMirrorPlugins() {
    const { upload, onError } = this.options;
    const editor = this.editor;

    const insert = (files: File[], at: number | null) => {
      for (const file of files) {
        void upload(file)
          .then((result) => {
            if (!result) return;

            const attrs = {
              src: result.url,
              ...(result.width ? { width: result.width } : {}),
              ...(result.height ? { height: result.height } : {}),
            };

            // 놓은 자리에 넣는다. 그 자리가 사라졌으면(글을 지웠다) 커서 자리로 떨어진다
            const position = at !== null && at <= editor.state.doc.content.size ? at : undefined;
            editor
              .chain()
              .insertContentAt(position ?? editor.state.selection.from, {
                type: "image",
                attrs,
              })
              .run();
          })
          .catch((error) => {
            onError?.(error instanceof Error ? error.message : "이미지를 올리지 못했어요");
          });
      }
    };

    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const files = imageFilesOf(event.clipboardData?.files);
            if (files.length === 0) return false;

            event.preventDefault();
            insert(files, editor.state.selection.from);
            return true;
          },

          handleDrop: (view, event) => {
            const dropEvent = event as DragEvent;
            const files = imageFilesOf(dropEvent.dataTransfer?.files);
            if (files.length === 0) return false;

            event.preventDefault();
            const at = view.posAtCoords({ left: dropEvent.clientX, top: dropEvent.clientY });
            insert(files, at?.pos ?? null);
            return true;
          },
        },
      }),
    ];
  },
});
