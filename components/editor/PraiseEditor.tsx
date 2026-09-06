"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import { CancelDraftButton } from "@/components/editor/CancelDraftButton";
import { ConnectedEditorToolbar } from "@/components/editor/ConnectedEditorToolbar";
import { EditorFocusProvider } from "@/components/editor/EditorFocusContext";
import { EditorShell } from "@/components/editor/EditorShell";
import { FaithFormatTabs } from "@/components/editor/FaithFormatTabs";
import { PraiseSectionList } from "@/components/editor/PraiseSectionList";
import { RecoveryBanner } from "@/components/editor/RecoveryBanner";
import { RichTextField } from "@/components/editor/RichTextField";
import { SaveErrorNote } from "@/components/editor/SaveErrorNote";
import { SaveIndicator, toSaveState } from "@/components/editor/SaveIndicator";
import { TagInput } from "@/components/editor/TagInput";
import { Button } from "@/components/ui/button";
import { upsertDraft } from "@/lib/actions/posts";
import { suggestTitleFromYouTube } from "@/lib/actions/praise";
import {
  emptyPraiseForm,
  isEmptyForm,
  newMeditationBlock,
  newSection,
  type PraiseFormValues,
  PraisePublishFormSchema,
  toDraftContent,
} from "@/lib/editor/praiseForm";
import { useEditorAutosave } from "@/lib/editor/useEditorAutosave";
import { usePublishFlow } from "@/lib/editor/usePublishFlow";
import { parseYouTubeId, youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/praise/youtube";

/**
 * A-06 찬양 에디터 (02 §5.4 · 04 §2.5).
 *
 * 흐름은 "URL 붙여넣기 → 제목 제안 → 가사 타이핑 → 묵상과 기도"다.
 *
 * 불변식:
 * - 제안은 제목 칸이 비어 있을 때만 채운다. 적어둔 제목을 덮어쓰지 않는다
 * - 가사에는 서식이 없다. 툴바 서식은 "묵상과 기도"에만 적용된다(02 §5.4)
 * - 순서는 배열 인덱스가 유일한 진실이다(04 §2.5)
 */

export type PraiseEditorProps = {
  postId: string | null;
  /**
   * 초안인가. 새 글 경로는 늘 초안이라 기본값이 참이고, `[id]` 경로만 실제 상태를 넘긴다 —
   * 발행된 글을 고치는 중이면 `작성 취소`가 서지 않는다
   */
  isDraft?: boolean;
  initialValues: PraiseFormValues;
};

export function PraiseEditor({ postId, initialValues, isDraft }: PraiseEditorProps) {
  const router = useRouter();
  const [id, setId] = useState(postId);
  /**
   * 초안 id는 ref로도 들고 있는다. 첫 저장이 발행 클릭 안에서(flush) 끝나면 setId의 결과가
   * 이 클로저에 보이지 않아 "아직 저장되지 않았어요"로 막힌다 — 방금 저장에 성공했는데도.
   */
  const idRef = useRef(postId);

  const form = useForm<PraiseFormValues>({ defaultValues: initialValues ?? emptyPraiseForm() });
  const { control, register, setValue, watch, handleSubmit, getValues } = form;

  const sections = useFieldArray({ control, name: "sections" });
  const meditation = useFieldArray({ control, name: "meditationBlocks" });
  /**
   * 새 블록·삭제 뒤에 커서를 옮길 자리. 가사 섹션과 같은 방식이다 — 새로 붙은 편집기는
   * 이 effect가 도는 시점에 이미 DOM에 있다.
   */
  const [pendingBlockFocus, setPendingBlockFocus] = useState<number | null>(null);
  const meditationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pendingBlockFocus === null) return;
    const target = meditationRef.current?.querySelector<HTMLElement>(
      `[data-meditation-block="${pendingBlockFocus}"] [contenteditable="true"]`,
    );
    target?.focus();
    setPendingBlockFocus(null);
  }, [pendingBlockFocus]);
  // 가사·라벨을 화면에 그리려면 값을 구독해야 한다. useFieldArray의 fields는 순서만 알려준다
  const watchedSections = watch("sections");
  const youtubeUrl = watch("youtubeUrl");
  const videoId = parseYouTubeId(youtubeUrl);

  const save = useCallback(
    async (values: PraiseFormValues) => {
      const result = await upsertDraft({
        id: idRef.current ?? undefined,
        type: "PRAISE",
        title: values.title,
        content: toDraftContent(values),
        tags: values.tags,
      });

      if (!result.ok) {
        throw new Error(`초안 저장 실패: ${result.reason}`);
      }

      if (!idRef.current) {
        idRef.current = result.id;
        setId(result.id);
        router.replace(`/admin/write/praise/${result.id}`);
      }
    },
    // id는 ref에서 읽는다 — 상태를 읽으면 첫 저장이 끝나기 전에 큐에 있던 저장이 초안을
    // 하나 더 만든다
    [router],
  );

  const autosave = useEditorAutosave<PraiseFormValues>({ type: "PRAISE", id: id ?? "new", save });

  useEffect(() => {
    const subscription = watch((values) => {
      autosave.onChange(values as PraiseFormValues);
    });
    return () => subscription.unsubscribe();
  }, [watch, autosave]);

  /**
   * 영상이 확정되면 제목을 제안한다. 조회 실패는 조용히 넘어간다 —
   * 제안이 없으면 직접 적으면 되고, 그게 원래 하던 일이다(00 §7-4 폴백).
   */
  useEffect(() => {
    if (!videoId) return;

    let cancelled = false;
    void (async () => {
      const result = await suggestTitleFromYouTube(youtubeWatchUrl(videoId));
      if (cancelled || !result.ok) return;

      // 적어둔 제목을 덮지 않는다. 제안은 빈 칸을 채우는 일까지다
      if (getValues("title").trim() !== "") return;
      setValue("title", result.suggested, { shouldDirty: true, shouldTouch: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [videoId, getValues, setValue]);

  const {
    isPublishing,
    error: publishError,
    publish,
  } = usePublishFlow<PraiseFormValues>({
    gate: PraisePublishFormSchema,
    flush: autosave.flush,
    isDirty: autosave.isDirty,
    clearMirror: autosave.clearMirror,
    // 상태가 아니라 ref다 — 첫 저장이 이 클릭 안에서 끝나는 경우가 있다
    currentId: () => idRef.current,
  });

  const onPublish = handleSubmit(publish);

  const items = sections.fields.map((field, index) => ({
    key: field.id,
    value: watchedSections[index] ?? { id: field.id, label: "Verse", lyrics: "" },
  }));

  return (
    <EditorFocusProvider>
      <EditorShell
        breadcrumb={
          <>
            관리 · <b className="text-ink">오늘의 찬양</b>
          </>
        }
        indicator={
          <>
            <SaveIndicator
              state={toSaveState(autosave.state)}
              savedAgo={autosave.savedAt ? "방금" : undefined}
            />
            <SaveErrorNote message={autosave.lastError} />
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
        toolbar={<ConnectedEditorToolbar variant="slim" hint="서식은 묵상과 기도에 적용돼요" />}
        banner={
          autosave.recovery ? (
            <RecoveryBanner
              savedAt={new Date(autosave.recovery.updatedAt).toLocaleString("ko-KR")}
              onRestore={() => {
                const recovered = autosave.recovery?.value;
                if (recovered) {
                  for (const [key, value] of Object.entries(recovered)) {
                    setValue(key as keyof PraiseFormValues, value as never);
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
          {/* 서식은 아직 아무것도 안 적었을 때만 고를 수 있다(02 §2.4) — 저장 계약이
              타입마다 갈리므로, 쓰기 시작한 뒤의 변경은 삭제 후 재작성이다 */}
          <FaithFormatTabs current="PRAISE" postId={id} isEmpty={isEmptyForm(watch())} />

          <div className="flex flex-col gap-2">
            <input
              {...register("youtubeUrl")}
              placeholder="유튜브 주소를 붙여넣어 주세요"
              aria-label="유튜브 주소"
              inputMode="url"
              className="border-edge border-b bg-transparent pb-1.5 font-typewriter text-[12.5px] text-(--accent) outline-none placeholder:text-faint"
            />

            {videoId && (
              // 붙여넣은 문자열이 아니라 id로 만든 주소를 넣는다(lib/praise/youtube)
              <iframe
                key={videoId}
                src={youtubeEmbedUrl(videoId)}
                title="찬양 영상 미리보기"
                allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full border border-edge bg-ink"
              />
            )}
          </div>

          <input
            {...register("title")}
            placeholder="아티스트 - 곡명"
            aria-label="찬양 제목"
            className="border-edge border-b bg-transparent pb-2 font-serif text-xl outline-none placeholder:text-faint"
          />

          <div className="flex flex-col gap-2">
            <span className="font-typewriter text-[10.5px] tracking-[0.14em] text-faint">
              가사 · 엔터 2회로 다음 섹션, Alt+↑↓로 순서 이동
            </span>
            <PraiseSectionList
              items={items}
              onLabelChange={(index, label) =>
                setValue(`sections.${index}.label`, label, { shouldDirty: true })
              }
              onLyricsChange={(index, lyrics) =>
                setValue(`sections.${index}.lyrics`, lyrics, { shouldDirty: true })
              }
              onAppendAfter={(index, label) => sections.insert(index + 1, newSection(label))}
              onRemove={(index) => sections.remove(index)}
              onMove={(from, to) => sections.move(from, to)}
            />
          </div>

          <div ref={meditationRef} className="flex flex-col gap-2">
            <span className="font-typewriter text-[10.5px] tracking-[0.14em] text-faint">
              묵상과 기도 · 엔터 2회로 다음 블록
            </span>

            {meditation.fields.map((field, index) => (
              <div
                key={field.id}
                data-meditation-block={index}
                className="border border-edge bg-card"
              >
                <Controller
                  control={control}
                  name={`meditationBlocks.${index}.doc`}
                  render={({ field: block }) => (
                    <RichTextField
                      ariaLabel={
                        meditation.fields.length > 1 ? `묵상과 기도 ${index + 1}` : "묵상과 기도"
                      }
                      variant="slim"
                      value={block.value}
                      onChange={block.onChange}
                      placeholder={
                        index === 0 ? "가사를 묵상하며 떠오른 것과 기도를 적어보세요" : undefined
                      }
                      // 첫 블록만 넉넉히 연다. 이어지는 블록까지 크게 열면 화면이 빈 칸으로 찬다
                      contentClassName={
                        index === 0 ? "min-h-[200px] px-4 py-3" : "min-h-[80px] px-4 py-3"
                      }
                      blockEditing={{
                        onSplit: () => {
                          meditation.insert(index + 1, newMeditationBlock());
                          setPendingBlockFocus(index + 1);
                        },
                        onRemove: () => {
                          // 마지막 하나는 남긴다 — 블록 0개는 발행 불가 상태다
                          if (meditation.fields.length <= 1) return;
                          meditation.remove(index);
                          setPendingBlockFocus(Math.max(index - 1, 0));
                        },
                      }}
                    />
                  )}
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                meditation.append(newMeditationBlock());
                setPendingBlockFocus(meditation.fields.length);
              }}
              className="self-start border border-edge px-2.5 py-1 font-typewriter text-[11px] text-faint hover:text-ink"
            >
              + 블록
            </button>
          </div>

          {/* 태그는 다 쓰고 나서 붙인다 — 그래서 맨 아래다. 쓰는 도중에 눈에 걸리면
              거기서 손이 멈춘다(에디터 불변식: 방해 요소 제로) */}
          <div className="flex flex-col gap-2">
            <span className="font-typewriter text-[10.5px] tracking-[0.14em] text-faint">태그</span>
            <Controller
              control={control}
              name="tags"
              render={({ field }) => <TagInput value={field.value} onChange={field.onChange} />}
            />
          </div>

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
