"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { CancelDraftButton } from "@/components/editor/CancelDraftButton";
import { ConnectedEditorToolbar } from "@/components/editor/ConnectedEditorToolbar";
import { EditorFocusProvider } from "@/components/editor/EditorFocusContext";
import { EditorShell } from "@/components/editor/EditorShell";
import { RecoveryBanner } from "@/components/editor/RecoveryBanner";
import { RichTextField } from "@/components/editor/RichTextField";
import { SaveErrorNote } from "@/components/editor/SaveErrorNote";
import { SaveIndicator, toSaveState } from "@/components/editor/SaveIndicator";
import { TagInput } from "@/components/editor/TagInput";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadPostImage } from "@/lib/actions/images";
import { upsertDraft } from "@/lib/actions/posts";
import type { CategoryOption } from "@/lib/db/categories";
import { IMAGE_UPLOAD_THREW, imageUploadMessage } from "@/lib/editor/imageUploadMessage";
import { measureImage } from "@/lib/editor/measureImage";
import {
  deriveExcerpt,
  EMPTY_TECH_FORM,
  type TechFormValues,
  TechPublishFormSchema,
  toDraftContent,
  toDraftMeta,
} from "@/lib/editor/techForm";
import { useEditorAutosave } from "@/lib/editor/useEditorAutosave";
import { usePublishFlow } from "@/lib/editor/usePublishFlow";

/**
 * A-07 기술 에디터 (02 §5.5).
 *
 * 최우선 인터랙션은 마크다운 붙여넣기다(lib/editor/markdownPaste) — AI와 정리한 글을
 * 붙여넣으면 그 자리에서 서식이 된다. 좌우 분할·소스/미리보기 분리는 금지다(ADR-001).
 *
 * content에는 body만 들어가고 카테고리·요약·썸네일·태그는 posts 컬럼과 태그 테이블로
 * 간다(05 §2). 갈라지는 지점은 techForm의 조립 함수 두 개뿐이다.
 */

export type TechEditorProps = {
  postId: string | null;
  /**
   * 초안인가. 새 글 경로는 늘 초안이라 기본값이 참이고, `[id]` 경로만 실제 상태를 넘긴다 —
   * 발행된 글을 고치는 중이면 `작성 취소`가 서지 않는다
   */
  isDraft?: boolean;
  initialValues: TechFormValues;
  categories: CategoryOption[];
};

export function TechEditor({ postId, initialValues, categories, isDraft }: TechEditorProps) {
  const router = useRouter();
  const [id, setId] = useState(postId);
  /**
   * 초안 id는 ref로도 들고 있는다. 첫 저장이 발행 클릭 안에서(flush) 끝나면 setId의 결과가
   * 이 클로저에 보이지 않아 "아직 저장되지 않았어요"로 막힌다 — 방금 저장에 성공했는데도.
   */
  const idRef = useRef(postId);
  const [imageError, setImageError] = useState<string | null>(null);

  const form = useForm<TechFormValues>({ defaultValues: initialValues ?? EMPTY_TECH_FORM });
  const { control, register, setValue, watch, handleSubmit } = form;

  const save = useCallback(
    async (values: TechFormValues) => {
      const result = await upsertDraft({
        id: idRef.current ?? undefined,
        type: "TECH",
        title: values.title,
        content: toDraftContent(values),
        ...toDraftMeta(values),
      });

      if (!result.ok) {
        throw new Error(`초안 저장 실패: ${result.reason}`);
      }

      if (!idRef.current) {
        idRef.current = result.id;
        setId(result.id);
        router.replace(`/admin/write/tech/${result.id}`);
      }
    },
    // id는 ref에서 읽는다 — 상태를 읽으면 첫 저장이 끝나기 전에 큐에 있던 저장이 초안을
    // 하나 더 만든다
    [router],
  );

  const autosave = useEditorAutosave<TechFormValues>({ type: "TECH", id: id ?? "new", save });

  /**
   * 붙여넣은·끌어놓은 이미지를 Storage로 올린다(04 §3.3). 크기는 브라우저가 잰다 — 파일을
   * 이미 들고 있는 쪽이 재는 게 정확하고, 서버에서 이미지 헤더를 파싱할 필요가 없다.
   */
  /**
   * 붙여넣은 그림. **실패를 조용히 넘기지 않는다** — 전에는 `onError`가 연결돼 있지 않아
   * 그림이 그냥 안 들어갔고, 개발자 도구를 열어야만 원인이 보였다.
   *
   * 액션이 던지는 경우도 잡는다. 본문 한도를 넘기면 액션이 실행되기도 전에 요청이 거절돼서
   * 사유 코드가 오지 않는다(next.config의 bodySizeLimit 주석).
   */
  const uploadImage = useCallback(async (file: File) => {
    const size = await measureImage(file);
    const form = new FormData();
    form.set("file", file);
    if (idRef.current) form.set("postId", idRef.current);
    if (size) {
      form.set("width", String(size.width));
      form.set("height", String(size.height));
    }

    setImageError(null);

    try {
      const result = await uploadPostImage(form);

      if (!result.ok) {
        setImageError(imageUploadMessage(result.reason));
        return null;
      }

      return { url: result.url, width: result.width, height: result.height };
    } catch (cause) {
      console.error("[upload]", cause);
      setImageError(IMAGE_UPLOAD_THREW);
      return null;
    }
  }, []);

  useEffect(() => {
    const subscription = watch((values) => {
      autosave.onChange(values as TechFormValues);
    });
    return () => subscription.unsubscribe();
  }, [watch, autosave]);

  const {
    isPublishing,
    error: publishError,
    publish,
  } = usePublishFlow<TechFormValues>({
    type: "TECH",
    gate: TechPublishFormSchema,
    flush: autosave.flush,
    clearMirror: autosave.clearMirror,
    // 상태가 아니라 ref다 — 첫 저장이 이 클릭 안에서 끝나는 경우가 있다
    currentId: () => idRef.current,
  });

  const onPublish = handleSubmit(publish);

  return (
    <EditorFocusProvider>
      <EditorShell
        breadcrumb={
          <>
            관리 · <b className="text-ink">기술 글</b>
          </>
        }
        indicator={
          <>
            <SaveIndicator
              state={toSaveState(autosave.state)}
              savedAgo={autosave.savedAt ? "방금" : undefined}
            />
            <SaveErrorNote message={autosave.lastError} />
            <SaveErrorNote message={imageError} />
          </>
        }
        actions={
          <>
            {/* 초안이면 지우고 나간다. 발행된 글을 고치는 중이면 이 버튼은 서지 않는다 */}
            <CancelDraftButton draftId={id} isDraft={isDraft} onDiscard={autosave.abandon} />
            <Button size="sm" type="button" onClick={() => void autosave.flush()}>
              임시저장
            </Button>
            <Button
              size="sm"
              variant="primary"
              type="button"
              disabled={isPublishing}
              onClick={() => void onPublish()}
            >
              {isPublishing ? "발행 중…" : "발행"}
            </Button>
          </>
        }
        toolbar={<ConnectedEditorToolbar hint="마크다운을 붙여넣으면 그 자리에서 서식이 돼요" />}
        banner={
          autosave.recovery ? (
            <RecoveryBanner
              savedAt={new Date(autosave.recovery.updatedAt).toLocaleString("ko-KR")}
              onRestore={() => {
                const recovered = autosave.recovery?.value;
                if (recovered) {
                  for (const [key, value] of Object.entries(recovered)) {
                    setValue(key as keyof TechFormValues, value as never);
                  }
                }
                autosave.dismissRecovery();
              }}
              onDismiss={autosave.dismissRecovery}
            />
          ) : null
        }
      >
        <div className="flex flex-col gap-5 px-[6%] pt-8">
          <input
            {...register("title")}
            placeholder="제목"
            aria-label="제목"
            className="border-edge border-b bg-transparent pb-2 font-serif text-xl outline-none placeholder:text-faint"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    aria-label="카테고리"
                    className="min-w-[140px] rounded-none text-[13px]"
                  >
                    <SelectValue placeholder="카테고리" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id} className="text-[13px]">
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />

            <div className="min-w-[220px] flex-1">
              <Controller
                control={control}
                name="tags"
                render={({ field }) => <TagInput value={field.value} onChange={field.onChange} />}
              />
            </div>
          </div>

          <Controller
            control={control}
            name="body"
            render={({ field }) => (
              <div className="border border-edge">
                <RichTextField
                  ariaLabel="본문"
                  value={field.value}
                  onChange={field.onChange}
                  uploadImage={uploadImage}
                  placeholder="마크다운을 붙여넣거나 바로 적어보세요"
                  contentClassName="min-h-[420px] px-4 py-3"
                />
              </div>
            )}
          />

          <details className="border-edge border-t pt-4">
            <summary className="cursor-pointer font-typewriter text-[11px] text-faint">
              목록 카드 (요약 · 썸네일)
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              {/* 비워두면 본문 앞부분을 쓴다(02 §5.5) — 그래서 placeholder가 그 파생값이다 */}
              <textarea
                {...register("excerpt")}
                rows={2}
                placeholder={deriveExcerpt(watch("body")) || "비워두면 본문 앞부분을 씁니다"}
                aria-label="요약"
                className="resize-y border border-edge bg-card px-3 py-2 text-[13px] outline-none placeholder:text-faint"
              />
              <input
                {...register("thumbnailUrl")}
                placeholder="썸네일 주소 (본문에 붙여넣은 이미지 주소도 돼요)"
                aria-label="썸네일 주소"
                inputMode="url"
                className="border-edge border-b bg-transparent pb-1.5 font-typewriter text-[11.5px] outline-none placeholder:text-faint"
              />
            </div>
          </details>

          {publishError && (
            <p role="alert" className="font-typewriter text-[11.5px] text-(--accent)">
              {publishError}
            </p>
          )}
        </div>
      </EditorShell>
    </EditorFocusProvider>
  );
}
