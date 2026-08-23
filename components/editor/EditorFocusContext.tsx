"use client";

import type { Editor } from "@tiptap/react";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

/**
 * 고정 툴바가 가리키는 "현재 포커스된 Tiptap 인스턴스" (ADR-001 · 04 §2.1).
 *
 * 한 에디터 화면에 리치 텍스트 영역이 여러 개 있다(QT는 답변 6 + 요약). 툴바는 하나이고,
 * 포커스가 옮겨가면 그 인스턴스를 가리켜야 한다 — 툴바를 영역마다 복제하지 않는다.
 */

type EditorFocusValue = {
  editor: Editor | null;
  /** 리렌더를 유발하는 카운터. Tiptap 인스턴스는 변경 시 참조가 그대로라 별도 신호가 필요하다 */
  version: number;
  setEditor: (editor: Editor | null) => void;
  notifyChange: () => void;
};

const EditorFocusContext = createContext<EditorFocusValue | null>(null);

export function EditorFocusProvider({ children }: { children: ReactNode }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [version, setVersion] = useState(0);

  const notifyChange = useCallback(() => setVersion((current) => current + 1), []);

  const value = useMemo(
    () => ({ editor, version, setEditor, notifyChange }),
    [editor, version, notifyChange],
  );

  return <EditorFocusContext.Provider value={value}>{children}</EditorFocusContext.Provider>;
}

export function useEditorFocus(): EditorFocusValue {
  const value = useContext(EditorFocusContext);
  if (!value) {
    throw new Error("EditorFocusProvider 안에서만 쓸 수 있습니다.");
  }
  return value;
}
