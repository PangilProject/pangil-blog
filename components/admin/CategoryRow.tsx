"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/record/ConfirmDialog";
import { deleteCategory, moveCategory, renameCategory } from "@/lib/actions/categories";
import type { AdminCategory, CategoryOption } from "@/lib/db/categories";
import { UNCATEGORIZED_LABEL } from "@/lib/record/category";

/**
 * 카테고리 한 줄 (A-08).
 *
 * 이름은 그 자리에서 고친다. 별도 화면으로 보내면 여덟 개를 손보려고 여덟 번 왕복한다 —
 * 목록 자체가 편집 화면이다.
 *
 * **주소는 읽기 전용이다.** 만든 뒤에는 바꾸지 않는다(lib/record/category) — 공개 주소와
 * 무효화 태그가 그 값을 쓴다. 그래서 회색 글자로 두고, 왜 못 바꾸는지는 화면 아래 한 줄이
 * 말한다.
 *
 * **모든 분류를 지울 수 있다(2026-10-05).** 전에는 글이 있는 분류에 삭제 버튼을 놓지 않고
 * 글 수를 그 자리에 뒀는데, 그러면 분류를 정리하려고 글을 한 편씩 열어 바꿔야 했다.
 * 이제 지울 때 딸린 글을 어디로 보낼지 묻는다 — 기본은 미분류이고, 다른 분류를 고르면
 * 그게 곧 병합이다. 글 수는 목록에서 뺐다: 그 숫자가 필요한 순간은 지우기 직전 한 번이다.
 */
export function CategoryRow({
  category,
  isFirst,
  isLast,
  others,
}: {
  category: AdminCategory;
  /** 옮길 곳 후보 — 자기 자신을 뺀 나머지 분류 */
  others: CategoryOption[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  /** 옮길 분류의 id. 빈 문자열이 미분류다 */
  const [moveTo, setMoveTo] = useState("");

  const run = (task: () => Promise<{ ok: boolean; reason?: string }>) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        setError(result.reason ?? "바꾸지 못했어요");
        return;
      }
      setError(null);
      router.refresh();
    });

  const submitName = () => {
    const next = name.trim();
    if (next === "" || next === category.name) {
      setName(category.name);
      return;
    }
    run(() => renameCategory(category.id, next));
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="flex gap-1">
        <MoveButton
          label={`${category.name} 위로`}
          disabled={isFirst || isPending}
          onClick={() => run(() => moveCategory(category.id, "up"))}
        >
          ↑
        </MoveButton>
        <MoveButton
          label={`${category.name} 아래로`}
          disabled={isLast || isPending}
          onClick={() => run(() => moveCategory(category.id, "down"))}
        >
          ↓
        </MoveButton>
      </span>

      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={submitName}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setName(category.name);
        }}
        aria-label={`${category.name} 이름`}
        disabled={isPending}
        className="w-28 border-edge border-b bg-transparent pb-1 text-[14px] outline-none disabled:opacity-50"
      />

      <span className="font-typewriter text-[10.5px] text-faint">{category.slug}</span>

      <span className="ml-auto flex items-center gap-3 font-typewriter text-[10.5px]">
        {error && (
          <button type="button" onClick={() => setError(null)} className="text-(--accent)">
            {error}
          </button>
        )}

        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setMoveTo("");
            setIsConfirming(true);
          }}
          aria-label={`${category.name} 삭제`}
          className="text-faint hover:text-(--accent) disabled:opacity-50"
        >
          삭제
        </button>
      </span>

      {isConfirming && (
        <ConfirmDialog
          title={category.name}
          message={
            category.postCount > 0
              ? `이 분류에 글 ${category.postCount}편이 있어요. 지우면 아래로 옮겨요.`
              : "이 분류를 삭제할까요? 되돌릴 수 없어요."
          }
          confirmLabel="삭제"
          pendingLabel="삭제 중…"
          isPending={isPending}
          error={error}
          onCancel={() => {
            setIsConfirming(false);
            setError(null);
          }}
          onConfirm={() => {
            setIsConfirming(false);
            const target = others.find((other) => other.id === moveTo);
            run(() =>
              deleteCategory(
                category.id,
                category.slug,
                target ? { id: target.id, slug: target.slug } : null,
              ),
            );
          }}
        >
          {category.postCount > 0 && (
            <label className="flex items-center gap-2 font-typewriter text-[11px] text-faint">
              옮길 곳
              <select
                value={moveTo}
                onChange={(event) => setMoveTo(event.target.value)}
                className="flex-1 border border-edge bg-paper px-2 py-1 text-[12px] text-ink"
              >
                <option value="">{UNCATEGORIZED_LABEL}</option>
                {others.map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </ConfirmDialog>
      )}
    </li>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="border border-transparent px-1.5 font-typewriter text-[11px] text-faint hover:border-edge hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
