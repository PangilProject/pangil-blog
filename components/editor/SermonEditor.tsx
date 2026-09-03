"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { AutoGrowTextarea } from "@/components/editor/AutoGrowTextarea";
import { ConnectedEditorToolbar } from "@/components/editor/ConnectedEditorToolbar";
import { EditorFocusProvider } from "@/components/editor/EditorFocusContext";
import { EditorShell } from "@/components/editor/EditorShell";
import { RecoveryBanner } from "@/components/editor/RecoveryBanner";
import { RichTextField } from "@/components/editor/RichTextField";
import { SaveErrorNote } from "@/components/editor/SaveErrorNote";
import { SaveIndicator, toSaveState } from "@/components/editor/SaveIndicator";
import { Button } from "@/components/ui/button";
import { publishPost, upsertDraft } from "@/lib/actions/posts";
import {
  EMPTY_SERMON_FORM,
  type SermonFormValues,
  SermonPublishFormSchema,
  toDraftContent,
} from "@/lib/editor/sermonForm";
import { useEditorAutosave } from "@/lib/editor/useEditorAutosave";
import { publicPostPath } from "@/lib/record/paths";

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
  initialValues: SermonFormValues;
};

export function SermonEditor({ postId, initialValues }: SermonEditorProps) {
  const router = useRouter();
  const [id, setId] = useState(postId);
  /**
   * 초안 id는 ref로도 들고 있는다. 첫 저장이 발행 클릭 안에서(flush) 끝나면 setId의 결과가
   * 이 클로저에 보이지 않아 "아직 저장되지 않았어요"로 막힌다 — 방금 저장에 성공했는데도.
   */
  const idRef = useRef(postId);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const form = useForm<SermonFormValues>({ defaultValues: initialValues ?? EMPTY_SERMON_FORM });
  const { control, register, setValue, watch, handleSubmit } = form;

  const save = useCallback(
    async (values: SermonFormValues) => {
      const result = await upsertDraft({
        id: idRef.current ?? undefined,
        type: "SERMON",
        title: values.title,
        content: toDraftContent(values),
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

  const onPublish = handleSubmit(async (values) => {
    const validated = SermonPublishFormSchema.safeParse(values);
    if (!validated.success) {
      setPublishError(validated.error.issues[0]?.message ?? "발행할 수 없어요");
      return;
    }

    setPublishError(null);
    setIsPublishing(true);

    try {
      // 발행 전에 저장을 마친다 — 서버는 저장된 content로 게이트를 통과시킨다
      await autosave.flush();

      const target = idRef.current;
      if (!target) {
        setPublishError("아직 저장되지 않았어요. 잠시 후 다시 시도해 주세요");
        return;
      }

      const result = await publishPost(target);
      if (!result.ok) {
        setPublishError(`발행하지 못했어요 (${result.reason})`);
        return;
      }

      autosave.clearMirror();
      // 발행 직후 그 글의 공개 지면으로 간다(02 §3.2 확정). 도착지는 설정값이 아니라
      // 발행 결과의 slug에서 나온다 — 방금 만들어진 주소라 여기서만 알 수 있다
      router.push(publicPostPath("SERMON", result.slug));
    } finally {
      setIsPublishing(false);
    }
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
              발행
            </Button>
          </>
        }
        toolbar={<ConnectedEditorToolbar variant="slim" hint="# - > 로 바로 서식이 됩니다" />}
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
          <input
            {...register("title")}
            // 진입 커서는 제목 (02 결정 로그 #10)
            // biome-ignore lint/a11y/noAutofocus: 예배 시작과 동시에 바로 적을 수 있어야 한다
            autoFocus
            placeholder="설교 제목"
            aria-label="설교 제목"
            className="border-edge border-b bg-transparent pb-2 font-serif text-xl outline-none placeholder:text-faint"
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

          <details className="border-edge border-t pt-4">
            <summary className="cursor-pointer font-typewriter text-[11px] text-faint">
              예배 후 요약 (선택)
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
