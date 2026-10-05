"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { CategoryRow } from "@/components/admin/CategoryRow";
import { reorderCategories } from "@/lib/actions/categories";
import type { AdminCategory } from "@/lib/db/categories";
import { cn } from "@/lib/utils";

/**
 * 카테고리 목록 — 끌어서 순서를 바꾼다 (A-08).
 *
 * 순서는 공개 기술 지면의 분류 탭·사이드바, 에디터의 선택 목록, 글 관리의 필터에 그대로
 * 나간다. 전에는 줄마다 ↑↓ 버튼이었는데 한 번에 한 칸이라, 맨 아래를 맨 위로 올리려면 일곱 번
 * 눌러야 했다.
 *
 * **놓는 순간 저장한다.** 이름처럼 확인을 묻지 않는다 — 다시 끌면 되돌아간다. 화면은 먼저
 * 옮겨 두고(서버를 기다리면 놓은 줄이 제자리로 튀었다가 다시 온다), 저장이 막히면 원래
 * 순서로 돌리고 사유를 적는다.
 *
 * 찬양 섹션 목록(PraiseSectionList)과 같은 설정이다: 4px 움직여야 끌기가 시작되고(손잡이를
 * 누르기만 한 것은 끌기가 아니다), 키보드로도 옮긴다(스페이스로 집고 방향키).
 */
export function CategoryList({ categories }: { categories: AdminCategory[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [order, setOrder] = useState(categories);
  const [error, setError] = useState<string | null>(null);

  // 만들기·지우기·이름 바꾸기 뒤의 새 목록을 받는다. 끌어 놓은 순서도 저장 뒤 같은 값으로 돌아온다
  useEffect(() => setOrder(categories), [categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = order.findIndex((category) => category.id === active.id);
    const to = order.findIndex((category) => category.id === over.id);
    if (from < 0 || to < 0) return;

    const previous = order;
    const next = arrayMove(order, from, to);
    setOrder(next);

    startTransition(async () => {
      const result = await reorderCategories(next.map((category) => category.id));
      if (!result.ok) {
        setOrder(previous);
        setError(result.reason);
        return;
      }
      setError(null);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {/*
        id를 손으로 준다 — 안 주면 dnd-kit이 마운트 순서로 번호를 매겨 서버 HTML과 어긋나고
        하이드레이션 경고가 난다(PraiseSectionList에서 실제로 났다)
      */}
      <DndContext
        id="category-order"
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={order.map((category) => category.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col divide-y divide-edge border border-edge bg-card">
            {order.map((category) => (
              <SortableCategory
                key={category.id}
                category={category}
                others={order.filter((other) => other.id !== category.id)}
                disabled={isPending}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {error && (
        <p role="alert" className="font-typewriter text-[11px] text-(--accent)">
          {error}
        </p>
      )}
    </div>
  );
}

function SortableCategory({
  category,
  others,
  disabled,
}: {
  category: AdminCategory;
  others: AdminCategory[];
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("bg-card", isDragging && "relative z-10 shadow-card")}
    >
      <CategoryRow
        category={category}
        others={others}
        dragHandle={
          <button
            type="button"
            // dnd-kit이 키보드 정렬(스페이스로 집고 방향키로 이동)까지 붙여준다
            {...attributes}
            {...listeners}
            aria-label={`${category.name} 순서 이동`}
            className="cursor-grab touch-none px-1 font-typewriter text-[13px] text-faint hover:text-ink active:cursor-grabbing disabled:opacity-30"
          >
            ⠿
          </button>
        }
      />
    </li>
  );
}
