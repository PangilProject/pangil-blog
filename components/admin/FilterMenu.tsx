"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";

import { type DividerTabItem, dividerTabClassName } from "@/components/record/DividerTabs";
import { cn } from "@/lib/utils";

/**
 * 하위 분류를 접어 둔 탭 — `기술 ▾` (A-03, 넓은 화면).
 *
 * 기술 카테고리를 탭 줄에 다 펴면 카테고리가 늘수록 줄이 길어진다. 탭은 전체·큐티·설교·찬양·기술
 * 다섯 칸으로 고정하고, 기술 칸을 누르면 카테고리 목록이 바로 열린다 — 전에는 기술 탭을 누르면
 * 탭 줄이 하나 더 열려 두 번 눌러야 했다. 메뉴에 `기술 전체`는 없다(기술 글 전부는 `전체` 탭이다).
 *
 * 고르면 탭 이름이 그 카테고리로 바뀐다(`기술` → `FE`). 닫혀 있어도 무엇으로 거르고 있는지가
 * 보여야 하고, `기술 · FE`로 앞에 붙이면 탭이 길어진다 — 큐티·설교 옆의 `FE`는 그 자체로 읽힌다.
 *
 * 항목은 링크다(필터는 URL이다, 02 §2.3). 카테고리가 열 개를 넘으면 메뉴 위에 검색을 둔다 —
 * 지금은 그보다 적어 두지 않았다.
 */
export function TabMenu({ label, items }: { label: string; items: DividerTabItem[] }) {
  const current = items.find((item) => item.active);

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={current ? `${label}: ${current.label}` : label}
        className={cn(dividerTabClassName(Boolean(current)), "inline-flex items-center gap-1")}
      >
        {current ? current.label : label}
        <ChevronDownIcon aria-hidden className="size-3.5 text-faint" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 max-h-[60vh] min-w-[160px] overflow-y-auto border border-edge bg-card py-1 font-typewriter text-xs shadow-card"
        >
          <MenuItems items={items} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * 좁은 화면의 필터 — 탭 대신 드롭다운 하나 (A-03).
 *
 * 분류가 큐티·설교·찬양에 기술 카테고리까지 열 개가 넘는다. 좁은 화면에서 탭으로 늘어놓으면
 * 세 줄을 차지하고 목록이 화면 아래로 밀려났다. 트리거에는 지금 고른 분류를 적는다.
 *
 * 안은 분류명만 잇는다. 묵상·기술 머리글로 묶었더니 머리글과 구분선이 두 줄씩 더해 메뉴가
 * 화면을 넘겼고, 큐티와 FE는 묶지 않아도 무엇인지 읽힌다. 항목 높이도 줄였고, 그래도 화면 절반을
 * 넘으면 메뉴 안에서 스크롤한다.
 */
export function FilterMenu({
  items,
  label,
  className,
}: {
  items: DividerTabItem[];
  /** 스크린리더용 이름 */
  label: string;
  className?: string;
}) {
  const current = items.find((item) => item.active) ?? items[0];

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={`${label}: ${current?.label ?? ""}`}
        className={cn(
          "flex w-full items-center justify-between border border-edge bg-card px-3 py-2 font-typewriter text-xs text-ink data-[state=open]:border-ink-soft",
          className,
        )}
      >
        {current?.label}
        <ChevronDownIcon aria-hidden className="size-4 text-faint" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 max-h-[50vh] w-(--radix-dropdown-menu-trigger-width) overflow-y-auto border border-edge bg-card py-1 font-typewriter text-xs shadow-card"
        >
          <MenuItems items={items} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuItems({ items }: { items: DividerTabItem[] }) {
  return items.map((item) => (
    <DropdownMenu.Item key={item.label} asChild>
      <Link
        href={item.href}
        aria-current={item.active ? "page" : undefined}
        className={cn(
          "flex items-center justify-between gap-3 px-3 py-1.5 outline-none data-[highlighted]:bg-paper",
          item.active ? "font-bold text-ink" : "text-ink-soft",
        )}
      >
        {item.label}
        {item.active && <CheckIcon aria-hidden className="size-3.5 text-(--accent)" />}
      </Link>
    </DropdownMenu.Item>
  ));
}
