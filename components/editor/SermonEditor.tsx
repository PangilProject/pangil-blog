"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { AutoGrowTextarea } from "@/components/editor/AutoGrowTextarea";
import { CancelDraftButton } from "@/components/editor/CancelDraftButton";
import { ConnectedEditorToolbar } from "@/components/editor/ConnectedEditorToolbar";
import { EditorFocusProvider } from "@/components/editor/EditorFocusContext";
import { EditorShell } from "@/components/editor/EditorShell";
import { FaithFormatTabs } from "@/components/editor/FaithFormatTabs";
import { RecoveryBanner } from "@/components/editor/RecoveryBanner";
import { RichTextField } from "@/components/editor/RichTextField";
import { SaveErrorNote } from "@/components/editor/SaveErrorNote";
import { SaveIndicator, toSaveState } from "@/components/editor/SaveIndicator";
import { TagInput } from "@/components/editor/TagInput";
import { Button } from "@/components/ui/button";
import { upsertDraft } from "@/lib/actions/posts";
import { isEmptyDoc } from "@/lib/editor/richText";
import {
  emptySermonForm,
  isEmptyForm,
  type SermonFormValues,
  SermonPublishFormSchema,
  toDraftContent,
} from "@/lib/editor/sermonForm";
import { useEditorAutosave } from "@/lib/editor/useEditorAutosave";
import { usePublishFlow } from "@/lib/editor/usePublishFlow";

/**
 * A-05 설교 에디터 (02 §5.3 · 프리모템 #2).
 *
 * 불변식:
 * - 진입 커서는 제목이다. 그 외 자동 포커스 이동은 없다
 * - 팝업·확인 모달·떠다니는 UI 없음. 라이브 속기를 방해하는 것은 전부 금지다
 * - 로컬이 먼저 저장된다. 서버 동기화가 실패해도 "로컬 저장됨 · 동기화 대기"로 계속 쓴다
 * - 발행은 한 번에 끝난다(확인 모달 없음). 실수는 PRIVATE 전환으로 복구한다
 */

export type SermonEditorProps = {
  postId: string | null;
  /**
   * 초안인가. 새 글 경로는 늘 초안이라 기본값이 참이고, `[id]` 경로만 실제 상태를 넘긴다 —
   * 발행된 글을 고치는 중이면 `작성 취소`가 서지 않는다
   */
  isDraft?: boolean;
  initialValues: SermonFormValues;
};

export function SermonEditor({ postId, initialValues, isDraft }: SermonEditorProps) {
  const router = useRouter();
  const [id, setId] = useState(postId);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  /**
   * 초안 id는 ref로도 들고 있는다. 첫 저장이 발행 클릭 안에서(flush) 끝나면 setId의 결과가
   * 이 클로저에 보이지 않아 "아직 저장되지 않았어요"로 막힌다 — 방금 저장에 성공했는데도.
   */
  const idRef = useRef(postId);

  const form = useForm<SermonFormValues>({ defaultValues: initialValues ?? emptySermonForm() });
  const { control, register, setValue, watch, handleSubmit } = form;

  const save = useCallback(
    async (values: SermonFormValues) => {
      const result = await upsertDraft({
        id: idRef.current ?? undefined,
        type: "SERMON",
        title: values.title,
        content: toDraftContent(values),
        tags: values.tags,
      });

      if (!result.ok) {
        // 저장 실패는 상태 기계가 재시도한다. 여기서 삼키면 유실이다
        throw new Error(`초안 저장 실패: ${result.reason}`);
      }

      if (!idRef.current) {
        idRef.current = result.id;
        setId(result.id);
        // 새로고침해도 같은 초안으로 돌아오게 URL을 맞춘다
        router.replace(`/admin/write/sermon/${result.id}`);
      }
    },
    // id는 ref에서 읽는다 — 상태를 읽으면 첫 저장이 끝나기 전에 큐에 있던 저장이 초안을
    // 하나 더 만든다
    [router],
  );

  const autosave = useEditorAutosave<SermonFormValues>({
    type: "SERMON",
    id: id ?? "new",
    save,
  });

  // 입력이 있을 때마다 로컬 → 서버 파이프라인에 넘긴다
  useEffect(() => {
    const subscription = watch((values) => {
      autosave.onChange(values as SermonFormValues);
    });
    return () => subscription.unsubscribe();
  }, [watch, autosave]);

  const {
    isPublishing,
    error: publishError,
    publish,
  } = usePublishFlow<SermonFormValues>({
    gate: SermonPublishFormSchema,
    flush: autosave.flush,
    isDirty: autosave.isDirty,
    clearMirror: autosave.clearMirror,
    // 상태가 아니라 ref다 — 첫 저장이 이 클릭 안에서 끝나는 경우가 있다
    currentId: () => idRef.current,
  });

  /**
   * 요약이 비어 발행이 막힐 상황이면 그 칸을 먼저 펴 둔다 — 게이트 메시지가 뜨는 순간
   * 적을 자리가 보여야 한다. 게이트는 스키마 한 곳이고 여기서는 접힘만 다룬다.
   */
  const onPublish = handleSubmit((values) => {
    if (isEmptyDoc(values.summary)) setIsSummaryOpen(true);
    return publish(values);
  });

  return (
    <EditorFocusProvider>
      <EditorShell
        breadcrumb={
          <>
            관리 · <b className="text-ink">설교 묵상</b>
          </>
        }
        indicator={
          <>
            <SaveIndicator
              variant="sermon"
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
          </>
        }
        footer={
          <Button
            variant="primary"
            type="button"
            disabled={isPublishing}
            onClick={() => void onPublish()}
          >
            {isPublishing ? "발행 중…" : "발행"}
          </Button>
        }
        toolbar={<ConnectedEditorToolbar variant="slim" hint="# - > 로 바로 서식이 돼요" />}
        banner={
          autosave.recovery ? (
            <RecoveryBanner
              savedAt={new Date(autosave.recovery.updatedAt).toLocaleString("ko-KR")}
              onRestore={() => {
                const recovered = autosave.recovery?.value;
                if (recovered) {
                  for (const [key, value] of Object.entries(recovered)) {
                    setValue(key as keyof SermonFormValues, value as never);
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
          <FaithFormatTabs current="SERMON" postId={id} isEmpty={isEmptyForm(watch())} />

          {/* 두 제목은 역할이 다르다(02 §5.3). 글 제목은 목록·RSS·OG에 나가는 이름이고
              (`2026년 08월 23일 주일 예배 설교`), 설교 제목은 그날 설교의 이름이다
              (`하나님의 편에 서라`). 진입 커서는 글 제목에 둔다 — 예배 전에 적어두는 쪽이다 */}
          <input
            {...register("title")}
            // 진입 커서는 제목 (02 결정 로그 #10)
            // biome-ignore lint/a11y/noAutofocus: 예배 시작과 동시에 바로 적을 수 있어야 한다
            autoFocus
            placeholder="글 제목 (예: 2026년 09월 06일 주일 예배 설교)"
            aria-label="글 제목"
            className="border-edge border-b bg-transparent pb-2 font-serif text-xl outline-none placeholder:text-faint"
          />

          <input
            {...register("sermonTitle")}
            placeholder="설교 제목"
            aria-label="설교 제목"
            className="border-edge border-b bg-transparent pb-1.5 font-serif text-base outline-none placeholder:text-faint"
          />

          <div className="flex flex-col gap-2">
            <input
              {...register("scriptureRef")}
              placeholder="당일 말씀 (예: 전도서 9장 7~10절)"
              aria-label="말씀 범위"
              className="border-edge border-b bg-transparent pb-1.5 font-typewriter text-[12.5px] text-(--accent) outline-none placeholder:text-faint"
            />
            <AutoGrowTextarea
              {...register("scriptureBody")}
              placeholder="말씀 본문"
              aria-label="말씀 본문"
              rows={4}
              className="border border-edge bg-paper px-3 py-2 font-serif text-sm leading-scripture outline-none placeholder:text-faint"
            />
          </div>

          <Controller
            control={control}
            name="body"
            render={({ field }) => (
              <div className="border border-edge">
                <RichTextField
                  ariaLabel="설교 본문"
                  variant="slim"
                  value={field.value}
                  onChange={field.onChange}
                  contentClassName="min-h-[420px] px-4 py-3"
                />
              </div>
            )}
          />

          {/*
            접힌 채로 연다. 예배 중에 쓰는 것은 본문이고 요약은 예배 뒤의 일이라, 펴 둔
            빈 칸이 속기하는 동안 눈에 걸린다(방해 요소 제로).

            대신 **발행이 이것 때문에 막히면 펴 준다.** 필수로 올린 칸이 접힌 채로 막으면
            "적어주세요"라는 말만 있고 적을 자리가 안 보인다.
          */}
          <details
            open={isSummaryOpen}
            onToggle={(event) => setIsSummaryOpen(event.currentTarget.open)}
            className="border-edge border-t pt-4"
          >
            <summary className="cursor-pointer font-typewriter text-[11px] text-faint">
              예배 후 요약
            </summary>
            <Controller
              control={control}
              name="summary"
              render={({ field }) => (
                <div className="mt-3 border border-edge">
                  <RichTextField
                    ariaLabel="예배 후 요약"
                    variant="slim"
                    value={field.value}
                    onChange={field.onChange}
                  />
                </div>
              )}
            />
          </details>

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
