"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import { CancelDraftButton } from "@/components/editor/CancelDraftButton";
import { ConnectedEditorToolbar } from "@/components/editor/ConnectedEditorToolbar";
import {
  DraftDrawerButton,
  DraftDrawerList,
  type DraftItem,
} from "@/components/editor/DraftDrawer";
import { EditorFocusProvider } from "@/components/editor/EditorFocusContext";
import { EditorShell } from "@/components/editor/EditorShell";
import { FaithFormatTabs } from "@/components/editor/FaithFormatTabs";
import { PraiseSectionList } from "@/components/editor/PraiseSectionList";
import { RichTextField } from "@/components/editor/RichTextField";
import { SaveErrorNote } from "@/components/editor/SaveErrorNote";
import { SaveIndicator } from "@/components/editor/SaveIndicator";
import { TagInput } from "@/components/editor/TagInput";
import { Button } from "@/components/ui/button";
import { upsertDraft } from "@/lib/actions/posts";
import { suggestTitleFromYouTube } from "@/lib/actions/praise";
import { focusWhenReady } from "@/lib/editor/focusWhenReady";
import {
  emptyPraiseForm,
  isEmptyForm,
  newMeditationBlock,
  newSection,
  type PraiseFormValues,
  PraisePublishFormSchema,
  toCopyText,
  toDraftContent,
} from "@/lib/editor/praiseForm";
import { useEditorAutosave } from "@/lib/editor/useEditorAutosave";
import { usePublishFlow } from "@/lib/editor/usePublishFlow";
import { parseYouTubeId, youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/praise/youtube";
import { copyLabel, useCopyText } from "@/lib/ui/useCopyText";
import { cn } from "@/lib/utils";

/** 접근성 이름. 블록이 하나뿐이면 번호를 붙이지 않는다 — 없는 둘째 블록을 암시한다 */
function blockName(index: number, total: number): string {
  return total > 1 ? `묵상과 기도 ${index + 1}` : "묵상과 기도";
}

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
  /** 발행된 글이면 서버 임시저장 없이 `수정 발행`으로만 반영한다(ADR-006) */
  isPublished?: boolean;
  /** 이 에디터 종류의 초안 — 초안함 목록 */
  drafts?: DraftItem[];
};

export function PraiseEditor({
  postId,
  initialValues,
  isDraft,
  isPublished = false,
  drafts = [],
}: PraiseEditorProps) {
  const router = useRouter();
  const [id, setId] = useState(postId);
  const [draftsOpen, setDraftsOpen] = useState(false);
  /**
   * 초안 id는 ref로도 들고 있는다. 첫 저장이 발행 클릭 안에서(flush) 끝나면 setId의 결과가
   * 이 클로저에 보이지 않아 "아직 저장되지 않았어요"로 막힌다 — 방금 저장에 성공했는데도.
   */
  const idRef = useRef(postId);

  const form = useForm<PraiseFormValues>({ defaultValues: initialValues ?? emptyPraiseForm() });
  const { control, register, setValue, watch, handleSubmit, getValues } = form;
  const { state: copyState, copy } = useCopyText();

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

    /**
     * **찾을 때까지 몇 프레임 기다린다.** 리치 텍스트 칸은 Tiptap이 자기 effect에서 붙이므로
     * 이 effect가 도는 시점에 `contenteditable`이 아직 없을 수 있다 — 한 번만 찾아보고
     * 끝내면 아무 일도 일어나지 않고 의도까지 사라진다(엔터 두 번에 커서가 안 옮겨가던 것).
     */
    focusWhenReady(() =>
      meditationRef.current?.querySelector<HTMLElement>(
        `[data-meditation-block="${pendingBlockFocus}"] [contenteditable="true"]`,
      ),
    );
    setPendingBlockFocus(null);
  }, [pendingBlockFocus]);
  // 가사·라벨을 화면에 그리려면 값을 구독해야 한다. useFieldArray의 fields는 순서만 알려준다
  const watchedSections = watch("sections");
  const youtubeUrl = watch("youtubeUrl");
  const videoId = parseYouTubeId(youtubeUrl);

  /** 첫 서버 저장(임시저장·3분 자동·발행)에서 받은 id를 붙든다. 새로고침해도 같은 초안으로 돌아오게 URL도 맞춘다 */
  const adoptId = useCallback(
    (newId: string) => {
      if (idRef.current) return;
      idRef.current = newId;
      setId(newId);
      router.replace(`/admin/write/praise/${newId}`);
    },
    [router],
  );

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

      adoptId(result.id);
    },
    // id는 ref에서 읽는다 — 상태를 읽으면 첫 저장이 끝나기 전에 큐에 있던 저장이 초안을
    // 하나 더 만든다
    [adoptId],
  );

  const autosave = useEditorAutosave<PraiseFormValues>({
    type: "PRAISE",
    id: id ?? "new",
    save,
    serverSave: !isPublished,
  });

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
    toInput: (values) => ({
      type: "PRAISE",
      title: values.title,
      content: toDraftContent(values),
      tags: values.tags,
    }),
    // 상태가 아니라 ref다 — 발행이 새 글의 첫 저장인 경우가 있다
    currentId: () => idRef.current,
    onSaved: adoptId,
    hold: autosave.hold,
    release: autosave.release,
    clearMirror: autosave.clearMirror,
  });

  const onPublish = handleSubmit(publish);

  const items = sections.fields.map((field, index) => ({
    key: field.id,
    value: watchedSections[index] ?? { id: field.id, label: "Verse", lyrics: "" },
  }));

  return (
    <EditorFocusProvider>
      <EditorShell
        type="PRAISE"
        indicator={
          <>
            <SaveIndicator
              state={autosave.state}
              savedAt={autosave.savedAt}
              hasDraft={id !== null}
              published={isPublished}
              edited={autosave.edited}
            />
            <SaveErrorNote message={autosave.lastError} />
          </>
        }
        actions={
          <>
            {/* 서버 초안과 브라우저에만 남은 내용을 고른다 — 눌렀을 때만 펼친다 */}
            <DraftDrawerButton
              count={drafts.length + (autosave.recovery ? 1 : 0)}
              open={draftsOpen}
              onToggle={() => setDraftsOpen((open) => !open)}
            />
            {/* 초안이면 지우고 나간다. 발행된 글을 고치는 중이면 이 버튼은 서지 않는다 */}
            <CancelDraftButton draftId={id} isDraft={isDraft} onDiscard={autosave.abandon} />
            {/* 한 번에 다 복사한다 — 큐티와 같은 조판(`copyTextOf`). 다른 도구에 붙여넣을 때 쓴다 */}
            <Button type="button" onClick={() => void copy(toCopyText(getValues()))}>
              {copyLabel(copyState, "전체 복사")}
            </Button>
            {/* 발행된 글은 임시저장이 없다 — 서버에 올리면 곧 공개 반영이다(ADR-006) */}
            {!isPublished && (
              <Button type="button" onClick={() => void autosave.flush()}>
                임시저장
              </Button>
            )}
          </>
        }
        footer={
          <Button
            variant="primary"
            type="button"
            disabled={isPublishing}
            onClick={() => void onPublish()}
          >
            {isPublishing ? "발행 중…" : isPublished ? "수정 발행" : "발행"}
          </Button>
        }
        toolbar={<ConnectedEditorToolbar variant="slim" />}
        banner={
          draftsOpen ? (
            <DraftDrawerList
              type="PRAISE"
              drafts={drafts}
              currentId={id}
              local={autosave.recovery}
              onRestoreLocal={() => {
                const recovered = autosave.recovery?.value;
                if (recovered) {
                  for (const [key, value] of Object.entries(recovered)) {
                    setValue(key as keyof PraiseFormValues, value as never);
                  }
                }
                autosave.dismissRecovery();
                setDraftsOpen(false);
              }}
            />
          ) : null
        }
      >
        <div className="flex flex-col gap-5 px-[6%] pt-8 max-md:pt-5">
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
              묵상과 기도 · 엔터 2회로 다음 블록, 숨김은 공개 지면에만 적용돼요
            </span>

            {meditation.fields.map((field, index) => (
              <div
                key={field.id}
                data-meditation-block={index}
                className="group border border-edge bg-card"
              >
                {/* 숨김 표시만 있는 얇은 줄. 손이 오기 전에는 흐리다 — 쓰는 동안 눈에
                    걸리면 거기서 타이핑이 멈춘다(에디터 불변식: 방해 요소 제로) */}
                <Controller
                  control={control}
                  name={`meditationBlocks.${index}.hidden`}
                  render={({ field: flag }) => (
                    <div
                      className={cn(
                        "flex justify-end border-edge border-b border-dashed px-2 py-1 opacity-40 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100",
                        flag.value && "opacity-100",
                      )}
                    >
                      <button
                        type="button"
                        aria-pressed={flag.value === true}
                        aria-label={
                          flag.value
                            ? `${blockName(index, meditation.fields.length)} 공개 지면에 보이기`
                            : `${blockName(index, meditation.fields.length)} 공개 지면에서 숨기기`
                        }
                        onClick={() => flag.onChange(!flag.value)}
                        className={cn(
                          "border px-1.5 font-typewriter text-[11px]",
                          flag.value
                            ? "border-edge text-(--accent)"
                            : "border-transparent text-faint hover:border-edge hover:text-ink",
                        )}
                      >
                        {flag.value ? "숨김" : "보임"}
                      </button>
                    </div>
                  )}
                />

                <Controller
                  control={control}
                  name={`meditationBlocks.${index}.doc`}
                  render={({ field: block }) => (
                    <RichTextField
                      ariaLabel={blockName(index, meditation.fields.length)}
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
