import { toKebabCase } from "@/lib/record/slug";

/**
 * 카테고리 입력 규칙 (A-08 · 02 §4).
 *
 * **slug는 만들 때만 정하고 이후 바꾸지 않는다.** 그 값이 공개 주소(`/dev?category=fe`)와
 * 무효화 태그(`list:dev:fe`)에 들어가 있어서다 — 발행된 URL은 바뀌지 않는다는 원칙(05 §6.4)이
 * 카테고리에도 그대로 적용된다. 이름은 자유롭게 바꾼다: 이름은 화면에만 있다.
 *
 * 규칙을 DB 제약이 아니라 여기 두는 이유는 **사유를 사람 말로 돌려주기 위해서**다.
 * unique 위반은 사후에 잡을 수 있지만, 그때는 무엇이 잘못됐는지 화면이 설명할 수 없다.
 */

export const CATEGORY_NAME_MAX = 20;
export const CATEGORY_SLUG_MAX = 30;

/** 소문자·숫자·하이픈. 하이픈으로 시작·끝나지 않고 연달아 오지 않는다 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CategoryInput = { name: string; slug: string };
export type CategoryInputError = { field: "name" | "slug"; message: string };

export function validateCategoryInput({ name, slug }: CategoryInput): CategoryInputError | null {
  const trimmedName = name.trim();
  if (trimmedName === "") return { field: "name", message: "이름을 적어주세요" };
  if (trimmedName.length > CATEGORY_NAME_MAX) {
    return { field: "name", message: `이름은 ${CATEGORY_NAME_MAX}자까지예요` };
  }

  const trimmedSlug = slug.trim();
  if (trimmedSlug === "") return { field: "slug", message: "주소를 적어주세요" };
  if (trimmedSlug.length > CATEGORY_SLUG_MAX) {
    return { field: "slug", message: `주소는 ${CATEGORY_SLUG_MAX}자까지예요` };
  }
  if (!SLUG.test(trimmedSlug)) {
    return { field: "slug", message: "주소는 영문 소문자·숫자·하이픈만 쓸 수 있어요" };
  }

  return null;
}

/**
 * 이름에서 주소를 제안한다. 한글 이름은 kebab 결과가 비므로 빈 문자열을 준다 —
 * 그때는 사람이 정해야 한다(`회고` → `retrospective`처럼 뜻을 옮기는 일이라 자동이 못 한다).
 */
export function suggestCategorySlug(name: string): string {
  return toKebabCase(name).slice(0, CATEGORY_SLUG_MAX);
}
