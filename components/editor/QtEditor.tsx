"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { type Control, Controller, useFieldArray, useForm } from "react-hook-form";

import { ConnectedEditorToolbar } from "@/components/editor/ConnectedEditorToolbar";
import { CrawlBand } from "@/components/editor/CrawlBand";
import { EditorFocusProvider } from "@/components/editor/EditorFocusContext";
import { EditorShell } from "@/components/editor/EditorShell";
import { RecoveryBanner } from "@/components/editor/RecoveryBanner";
import { RichTextField } from "@/components/editor/RichTextField";
import { SaveErrorNote } from "@/components/editor/SaveErrorNote";
import { SaveIndicator, toSaveState } from "@/components/editor/SaveIndicator";
import { ToolbarDock } from "@/components/editor/ToolbarDock";
import { GroupTab } from "@/components/record/GroupTab";
import { Button } from "@/components/ui/button";
import { publishPost, upsertDraft } from "@/lib/actions/posts";
import {
  countEmptyAnswers,
  emptyQtForm,
  type QtFormValues,
  QtPublishFormSchema,
  toDraftContent,
} from "@/lib/editor/qtForm";
import { useEditorAutosave } from "@/lib/editor/useEditorAutosave";

/**
 * A-04 QT 에디터 (02 §5.2).
 *
 * 이 화면의 전제는 "대부분 이미 채워져 있다"다. 크롤러가 새벽에 제목·말씀·주석·질문을
 * 넣어둔 초안을 열어(06 §2) 답만 적는 것이 목표 동작이고, 그래서 존재 이유 지표가
 * "QT 입력 노동 0분"이다(07 §5).
 *
 * 불변식:
 * - 가져온 값에 잠금이 없다. 전부 그 자리에서 고칠 수 있다(02 §5)
 * - 답변·요약이 비어도 발행된다. 경고만 보여준다(02 §5.2 · 07 M2 DoD)
 * - 툴바는 하나이고, 커서가 놓인 답변 칸에 그대로 적용된다(ADR-001)
 */

export type QtEditorProps = {
  postId: string | null;
  initialValues: QtFormValues;
  /**
   * 크롤 결과 (06 §2). null이면 띠를 놓지 않는다 — 손으로 만든 새 글에
   * "가져오지 못했어요"를 띄우면 거짓말이다. 실패 띠는 크롤러가 실제로 실패했을 때만 띄운다
   */
  crawl?: { status: "ok" | "failed"; fetchedAt?: string } | null;
  afterPublishHref: string;
};

export function QtEditor({ postId, initialValues, crawl, afterPublishHref }: QtEditorProps) {
  const router = useRouter();
  const [id, setId] = useState(postId);
  /**
   * 초안 id는 ref로도 들고 있는다. 첫 저장이 발행 클릭 안에서(flush) 끝나면 setId의 결과가
   * 이 클로저에 보이지 않아 "아직 저장되지 않았어요"로 막힌다 — 방금 저장에 성공했는데도.
   */
  const idRef = useRef(postId);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [emptyAnswers, setEmptyAnswers] = useState(() => countEmptyAnswers(initialValues));

  const form = useForm<QtFormValues>({ defaultValues: initialValues ?? emptyQtForm() });
  const { control, register, setValue, watch, handleSubmit } = form;

  const annotations = useFieldArray({ control, name: "annotations" });
  // "가져옴" 표시는 실제로 가져왔을 때만 붙인다 — 손으로 적은 값에 붙으면 표시가 거짓이 된다
  const crawledHint = crawl?.status === "ok" ? "가져옴" : undefined;
  const questionGroups = watch("questionGroups");

  const save = useCallback(
    async (values: QtFormValues) => {
      const result = await upsertDraft({
        id: idRef.current ?? undefined,
        type: "QT",
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
        router.replace(`/admin/write/qt/${result.id}`);
      }
    },
    // id는 ref에서 읽는다 — 상태를 읽으면 첫 저장이 끝나기 전에 큐에 있던 저장이 초안을
    // 하나 더 만든다
    [router],
  );

  const autosave = useEditorAutosave<QtFormValues>({ type: "QT", id: id ?? "new", save });

  useEffect(() => {
    const subscription = watch((values) => {
      autosave.onChange(values as QtFormValues);
      // 값이 같으면 리렌더가 없다 — 답변 7칸을 매 타이핑마다 다시 그리지 않는다
      setEmptyAnswers(countEmptyAnswers(values as QtFormValues));
    });
    return () => subscription.unsubscribe();
  }, [watch, autosave]);

  const onPublish = handleSubmit(async (values) => {
    const validated = QtPublishFormSchema.safeParse(values);
    if (!validated.success) {
      setPublishError(validated.error.issues[0]?.message ?? "발행할 수 없습니다");
      return;
    }

    setPublishError(null);
    setIsPublishing(true);

    try {
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
      router.push(afterPublishHref);
    } finally {
      setIsPublishing(false);
    }
  });

  return (
    <EditorFocusProvider>
      <EditorShell
        breadcrumb={
          <>
            관리 · <b className="text-ink">오늘의 큐티</b>
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
        toolbar={
          <ToolbarDock>
            <ConnectedEditorToolbar hint="# - > 로 바로 서식이 됩니다" />
          </ToolbarDock>
        }
        banner={
          autosave.recovery ? (
            <RecoveryBanner
              savedAt={new Date(autosave.recovery.updatedAt).toLocaleString("ko-KR")}
              onRestore={() => {
                const recovered = autosave.recovery?.value;
                if (recovered) {
                  for (const [key, value] of Object.entries(recovered)) {
                    setValue(key as keyof QtFormValues, value as never);
                  }
                }
                autosave.dismissRecovery();
              }}
              onDismiss={autosave.dismissRecovery}
            />
          ) : null
        }
      >
        <div className="flex flex-col gap-4 px-[6%] pt-6">
          {crawl && (
            <CrawlBand
              variant={crawl.status}
              fetchedAt={crawl.fetchedAt}
              questionCount={
                crawl.status === "ok"
                  ? questionGroups.flatMap((group) => group.questions).length
                  : undefined
              }
              annotationCount={crawl.status === "ok" ? annotations.fields.length : undefined}
            />
          )}

          <input
            {...register("title")}
            placeholder="큐티 제목"
            aria-label="큐티 제목"
            className="border-edge border-b bg-transparent pb-2 font-serif font-bold text-xl outline-none placeholder:text-faint"
          />

          <Field label="말씀" hint={crawledHint}>
            <input
              {...register("scriptureRef")}
              placeholder="예: 열왕기상 2장 41~46절"
              aria-label="말씀 범위"
              className="mb-2 w-full border-edge border-b bg-transparent pb-1.5 font-typewriter text-[12.5px] text-(--accent) outline-none placeholder:text-faint"
            />
            {/* 기본 펼침 확정(02 §5.2) — 접어두면 매일 펼치는 동작이 붙는다 */}
            <textarea
              {...register("scriptureBody")}
              placeholder="말씀 본문"
              aria-label="말씀 본문"
              rows={6}
              className="w-full resize-y border border-edge bg-card px-3.5 py-3 font-serif text-sm leading-scripture outline-none placeholder:text-faint"
            />
          </Field>

          <Field label="주석" hint={crawledHint}>
            <div className="flex flex-col gap-2">
              {annotations.fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-col gap-1.5 border border-dashed border-[#dcc9b8] bg-[#fbf5ec] px-3 py-2.5"
                >
                  <div className="flex gap-2">
                    <input
                      {...register(`annotations.${index}.term`)}
                      placeholder="용어"
                      aria-label={`주석 ${index + 1} 용어`}
                      className="flex-1 bg-transparent font-bold text-[13px] outline-none placeholder:text-faint"
                    />
                    <input
                      {...register(`annotations.${index}.verseRef`)}
                      placeholder="절"
                      aria-label={`주석 ${index + 1} 절`}
                      className="w-16 bg-transparent font-typewriter text-[10.5px] text-faint outline-none placeholder:text-faint"
                    />
                    <button
                      type="button"
                      onClick={() => annotations.remove(index)}
                      aria-label={`주석 ${index + 1} 삭제`}
                      className="font-typewriter text-[11px] text-faint hover:text-(--accent)"
                    >
                      삭제
                    </button>
                  </div>
                  <textarea
                    {...register(`annotations.${index}.body`)}
                    placeholder="풀이"
                    aria-label={`주석 ${index + 1} 풀이`}
                    rows={2}
                    className="resize-y bg-transparent text-[13px] leading-[1.85] text-ink-soft outline-none placeholder:text-faint"
                  />
                </div>
              ))}

              {/* 주석 없는 날도 정상이다(02 §5.2) — 그래서 0개 상태가 기본이고 추가는 손으로 한다 */}
              <button
                type="button"
                onClick={() => annotations.append({ term: "", verseRef: "", body: "" })}
                className="self-start border border-edge px-2.5 py-1 font-typewriter text-[11px] text-faint hover:text-ink"
              >
                + 주석 추가
              </button>
            </div>
          </Field>

          {questionGroups.map((group, groupIndex) => (
            <section key={group.group || groupIndex} className="mt-3">
              <GroupTab>{group.group}</GroupTab>
              <div className="flex flex-col gap-3">
                {group.questions.map((question, questionIndex) => (
                  <QuestionItem
                    key={`${group.group}-${question.label || questionIndex}`}
                    control={control}
                    groupIndex={groupIndex}
                    questionIndex={questionIndex}
                    label={question.label}
                  />
                ))}
              </div>
            </section>
          ))}

          <Field label="오늘의 요약">
            <Controller
              control={control}
              name="summary"
              render={({ field }) => (
                <div className="border border-edge">
                  <RichTextField
                    ariaLabel="오늘의 요약"
                    value={field.value}
                    onChange={field.onChange}
                  />
                </div>
              )}
            />
          </Field>

          {/*
            경고만 한다. 차단하지 않는다(02 §5.2) — 일부만 쓰는 날도 루틴의 일부이고,
            막으면 그날 기록이 아예 남지 않는다. 발행 후 토스트가 아니라 발행 전에 보여준다.
          */}
          {emptyAnswers > 0 && (
            <p role="status" className="font-typewriter text-[11px] text-faint">
              아직 답을 안 쓴 질문 {emptyAnswers}개 · 그대로 발행해도 됩니다
            </p>
          )}

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

/** 필드 라벨 — "가져옴" 표시가 붙는 자리(03 §3 크롤링 유래 표시) */
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="mb-2 font-typewriter text-[10.5px] tracking-[0.14em] text-faint">
        {label}
        {hint && <i className="ml-1.5 text-[#b98f4f] not-italic">{hint}</i>}
      </span>
      {children}
    </div>
  );
}

/**
 * 질문 한 칸 — 질문 원문도 편집 가능하다(02 §5.2 "text도 편집 가능, 잠금 없음").
 * 365qt 문구가 어색한 날 그 자리에서 고쳐 쓰는 것이 실제 사용 방식이다.
 */
function QuestionItem({
  control,
  groupIndex,
  questionIndex,
  label,
}: {
  control: Control<QtFormValues>;
  groupIndex: number;
  questionIndex: number;
  label: string;
}) {
  return (
    <div className="border border-edge border-t-2 border-t-[#eae2d0] bg-[#fffefa] px-4 py-3.5">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="flex-none font-typewriter text-[11px] text-(--accent)">{label}.</span>
        <Controller
          control={control}
          name={`questionGroups.${groupIndex}.questions.${questionIndex}.text`}
          render={({ field }) => (
            <input
              {...field}
              placeholder="질문"
              aria-label={`질문 ${label}`}
              className="flex-1 bg-transparent font-bold text-sm text-ink outline-none placeholder:text-faint"
            />
          )}
        />
      </div>

      <Controller
        control={control}
        name={`questionGroups.${groupIndex}.questions.${questionIndex}.answer`}
        render={({ field }) => (
          <RichTextField
            ariaLabel={`답변 ${label}`}
            value={field.value}
            onChange={field.onChange}
            placeholder="질문을 묵상하고 답을 적어보세요"
            contentClassName="min-h-[52px] px-3.5 py-2.5"
          />
        )}
      />
    </div>
  );
}
