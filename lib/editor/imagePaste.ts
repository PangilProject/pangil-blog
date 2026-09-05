import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * 이미지 붙여넣기·드롭 (04 §3.3).
 *
 * 스크린샷을 붙여넣는 것이 기술 글의 실제 작성 경로다 — 파일 선택 창을 여는 단계를 두지 않는다.
 *
 * **크기는 브라우저가 잰다.** 이미 파일을 들고 있는 쪽이 재는 게 정확하고, 서버에서 이미지
 * 헤더를 파싱하는 코드를 두지 않아도 된다. next/image가 그 값을 요구한다(04 §3.3).
 *
 * 업로드 중에는 편집을 막지 않는다. 올라간 뒤 커서 자리가 아니라 **놓은 자리**에 넣는다 —
 * 기다리는 동안 계속 쓰던 사람의 커서를 빼앗지 않는다.
 *
 * **올리는 동안 그 자리에 빈 칸을 세운다.** 전에는 붙여넣어도 화면에 아무 일이 없었고, 올라간
 * 뒤에야 그림이 툭 나타났다 — 되고 있는 건지 안 되는 건지 알 수 없었다.
 *
 * 그 빈 칸은 **문서가 아니라 장식(decoration)이다.** 노드로 넣으면 1초마다 도는 자동 저장이
 * 그것까지 저장한다 — content는 Zod를 지나가므로(ADR-002) 모르는 노드는 검증에서 걸리거나
 * 초안에 쓰레기로 남는다. 장식은 문서 밖이라 저장될 수 없다.
 *
 * 덤으로 자리가 정확해졌다. 장식의 위치는 편집을 따라 옮겨지므로, 기다리는 동안 위쪽에
 * 글을 더 써도 그림이 제자리에 들어간다 — 전에는 붙여넣을 때의 숫자를 그대로 들고 있어서
 * 그런 경우 엉뚱한 자리로 갔다.
 */

export type ImageUploadResult = { url: string; width: number | null; height: number | null };

export type ImagePasteOptions = {
  /** 업로드 담당. 실패는 null이고, 그때 빈 칸만 걷어낸다 (사유는 호출자가 말한다) */
  upload: (file: File) => Promise<ImageUploadResult | null>;
  onError?: (message: string) => void;
};

/** 올리는 중인 자리를 담는다. 문서가 아니라 장식이라 저장될 수 없다 */
const uploadingKey = new PluginKey<DecorationSet>("imageUploading");

type UploadingMeta = { add: { id: object; pos: number } } | { remove: { id: object } };

/**
 * 올라오는 동안 서는 빈 칸. 조판은 globals.css의 `.image-uploading`이 맡는다.
 *
 * 진행률은 적지 않는다 — Server Action은 올라간 바이트를 알려주지 않으므로 몇 %인지 지어낼
 * 수 없다. "되고 있다"까지가 이 칸이 말할 수 있는 전부다(03 §7.3b).
 */
function uploadingElement(): HTMLElement {
  const box = document.createElement("div");
  box.className = "image-uploading";
  box.setAttribute("role", "status");
  box.textContent = "그림 올리는 중…";
  return box;
}

/** 이 장식이 지금 어디 있는지. 편집을 따라 옮겨졌을 수 있다 */
function uploadingPos(set: DecorationSet | undefined, id: object): number | null {
  const found = set?.find(undefined, undefined, (spec) => spec.id === id);
  return found && found.length > 0 ? found[0].from : null;
}

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
        const id = {};
        const start =
          at !== null && at <= editor.state.doc.content.size ? at : editor.state.selection.from;

        // 빈 칸을 먼저 세운다. 이 한 줄이 "되고 있다"를 말한다
        editor.view.dispatch(
          editor.state.tr.setMeta(uploadingKey, {
            add: { id, pos: start },
          } satisfies UploadingMeta),
        );

        /** 빈 칸을 걷어내고, 걷어내기 전 그 자리를 돌려준다 */
        const clear = (): number | null => {
          const pos = uploadingPos(uploadingKey.getState(editor.state), id);
          editor.view.dispatch(
            editor.state.tr.setMeta(uploadingKey, { remove: { id } } satisfies UploadingMeta),
          );
          return pos;
        };

        void upload(file)
          .then((result) => {
            const pos = clear();
            if (!result) return;

            const attrs = {
              src: result.url,
              ...(result.width ? { width: result.width } : {}),
              ...(result.height ? { height: result.height } : {}),
            };

            // 빈 칸이 서 있던 자리. 그 자리가 사라졌으면(글을 지웠다) 커서 자리로 떨어진다
            const position = pos !== null && pos <= editor.state.doc.content.size ? pos : undefined;
            editor
              .chain()
              .insertContentAt(position ?? editor.state.selection.from, {
                type: "image",
                attrs,
              })
              .run();
          })
          .catch((error) => {
            // 빈 칸을 남겨두면 영원히 올리는 중인 글이 된다
            clear();
            onError?.(error instanceof Error ? error.message : "이미지를 올리지 못했어요");
          });
      }
    };

    return [
      new Plugin<DecorationSet>({
        key: uploadingKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            // 편집을 따라 자리를 옮긴다 — 이게 "제자리에 들어간다"를 만든다
            let next = set.map(tr.mapping, tr.doc);
            const meta = tr.getMeta(uploadingKey) as UploadingMeta | undefined;

            if (meta && "add" in meta) {
              next = next.add(tr.doc, [
                Decoration.widget(meta.add.pos, uploadingElement, { id: meta.add.id }),
              ]);
            }

            if (meta && "remove" in meta) {
              next = next.remove(
                next.find(undefined, undefined, (spec) => spec.id === meta.remove.id),
              );
            }

            return next;
          },
        },
        props: {
          decorations: (state) => uploadingKey.getState(state),
        },
      }),

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
