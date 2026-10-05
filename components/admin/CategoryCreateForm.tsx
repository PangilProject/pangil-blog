"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createCategory } from "@/lib/actions/categories";
import { suggestCategorySlug } from "@/lib/record/category";
import { cn } from "@/lib/utils";

/**
 * 새 카테고리 (A-08).
 *
 * 주소는 영문 이름일 때만 제안한다. 한글 이름에서 `회고` → `retrospective`는 뜻을 옮기는
 * 일이라 자동이 못 한다(lib/record/category) — 그때는 빈 칸으로 두고 사람이 정한다.
 *
 * 제안은 **주소 칸을 아직 손대지 않았을 때만** 채운다. 직접 적은 값을 이름 타이핑이
 * 덮어쓰면, 고쳐 적을 때마다 되돌아가는 칸이 된다.
 *
 * **두 칸이 다 차야 버튼이 켜진다.** 전에는 늘 같은 흐린 테두리라 누를 수 있는 때와 없는 때가
 * 구별되지 않았다. 켜지면 액센트로 채워 "이제 누를 수 있다"가 보이게 한다. 형식 검사는 여기서
 * 하지 않는다 — 꺼진 버튼은 이유를 말하지 못하므로, 형식이 틀리면 눌렀을 때 사유를 돌려준다.
 */
export function CategoryCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isReady = name.trim() !== "" && slug.trim() !== "";

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      action={() =>
        startTransition(async () => {
          const result = await createCategory({ name, slug });

          if (!result.ok) {
            setError(result.reason);
            return;
          }

          setName("");
          setSlug("");
          setSlugTouched(false);
          setError(null);
          router.refresh();
        })
      }
    >
      <label className="flex flex-col gap-1 font-typewriter text-[10.5px] text-faint">
        이름
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugTouched) setSlug(suggestCategorySlug(event.target.value));
          }}
          placeholder="웹 보안"
          aria-label="새 분류 이름"
          className="w-28 border-edge border-b bg-transparent pb-1 text-[14px] text-ink outline-none placeholder:text-faint"
        />
      </label>

      <label className="flex flex-col gap-1 font-typewriter text-[10.5px] text-faint">
        주소
        <input
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          placeholder="web-security"
          aria-label="새 분류 주소"
          inputMode="url"
          className="w-36 border-edge border-b bg-transparent pb-1 font-typewriter text-[12px] text-ink outline-none placeholder:text-faint"
        />
      </label>

      <button
        type="submit"
        disabled={!isReady || isPending}
        className={cn(
          "border px-3 py-1 font-typewriter text-[11px] transition-colors duration-150",
          isReady
            ? "border-(--accent) bg-(--accent) font-bold text-paper hover:brightness-90 disabled:opacity-60"
            : "cursor-not-allowed border-edge text-faint",
        )}
      >
        {isPending ? "만드는 중…" : "분류 추가"}
      </button>

      {error && (
        <p role="alert" className="font-typewriter text-[11px] text-(--accent)">
          {error}
        </p>
      )}
    </form>
  );
}
