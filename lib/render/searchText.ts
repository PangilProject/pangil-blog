import { type PostContent, praiseMeditationBlocks } from "@/lib/content/schema";
import { normalizeWhitespace, tiptapToPlainText } from "@/lib/render/plainText";

/**
 * searchText 생성 (05 §4A).
 *
 * 발행(및 마이그레이션 적재) 시 title + 본문 평문을 뽑아 컬럼에 채운다. 검색은 pg_trgm
 * 트라이그램 GIN으로 이 컬럼을 훑는다 — 한국어는 Postgres 기본 FTS가 부분 매칭을 못 해서
 * "전도서" 검색이 "전도서를"을 놓친다.
 *
 * 무엇을 넣는가: 작성자가 옛 글을 찾을 때 기억하는 것들. 말씀 범위, 본문, 내가 쓴 답변,
 * 가사, 기도문. 질문 원문도 넣는다(365qt 문구로 기억할 수 있다).
 */
export function extractSearchText(title: string, content: PostContent): string {
  const parts: string[] = [title];

  switch (content.kind) {
    case "QT": {
      parts.push(content.scriptureRef, content.scriptureBody);

      for (const annotation of content.annotations) {
        parts.push(annotation.term, annotation.body);
      }

      for (const group of content.questionGroups) {
        parts.push(group.group);
        for (const question of group.questions) {
          parts.push(question.text, tiptapToPlainText(question.answer));
        }
      }

      parts.push(tiptapToPlainText(content.summary));
      break;
    }

    case "SERMON": {
      parts.push(
        content.scriptureRef,
        content.scriptureBody,
        // 설교 제목은 본문 밖에 있다 — 안 담으면 그 말로는 글을 못 찾는다
        content.sermonTitle ?? "",
        tiptapToPlainText(content.body),
        tiptapToPlainText(content.summary),
      );
      break;
    }

    case "PRAISE": {
      for (const section of content.sections) {
        // 감춘 절은 검색에도 안 걸린다. 지면에서 뺐는데 검색어로 찾아지면 감춘 것이 아니다
        if (section.hidden === true) continue;

        parts.push(typeof section.label === "string" ? section.label : section.label.custom);
        parts.push(section.lyrics);
      }

      for (const block of praiseMeditationBlocks(content.meditationAndPrayer)) {
        parts.push(tiptapToPlainText(block));
      }
      break;
    }

    case "TECH": {
      parts.push(tiptapToPlainText(content.body));
      break;
    }
  }

  return normalizeWhitespace(parts.filter(Boolean).join(" "));
}
