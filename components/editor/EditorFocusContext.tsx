"use client";

import type { Editor } from "@tiptap/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

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
  /**
   * 화면의 리치 텍스트 영역 **전부**. 툴바는 포커스된 하나만 보면 되지만, 맞춤법 검사는 버튼
   * 한 번에 화면 전체를 본다(QT 답변 6 + 요약). 돌려준 함수를 부르면 빠진다.
   */
  registerEditor: (editor: Editor) => () => void;
  /** 등록된 영역을 화면에 놓인 순서대로. 이미 파괴된 것은 빼고 준다 */
  getEditors: () => Editor[];
};

const EditorFocusContext = createContext<EditorFocusValue | null>(null);

export function EditorFocusProvider({ children }: { children: ReactNode }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [version, setVersion] = useState(0);

  const notifyChange = useCallback(() => setVersion((current) => current + 1), []);

  // 목록은 상태가 아니라 ref다. 영역이 붙고 떨어질 때마다 화면 전체를 다시 그릴 이유가 없다 —
  // 읽는 쪽(맞춤법 검사)은 버튼을 누른 그 순간에만 읽는다
  const editors = useRef(new Set<Editor>());

  const registerEditor = useCallback((instance: Editor) => {
    editors.current.add(instance);
    return () => {
      editors.current.delete(instance);
    };
  }, []);

  const getEditors = useCallback(
    () =>
      [...editors.current]
        .filter((instance) => !instance.isDestroyed)
        .sort((a, b) =>
          a.view.dom.compareDocumentPosition(b.view.dom) & Node.DOCUMENT_POSITION_FOLLOWING
            ? -1
            : 1,
        ),
    [],
  );

  const value = useMemo(
    () => ({ editor, version, setEditor, notifyChange, registerEditor, getEditors }),
    [editor, version, notifyChange, registerEditor, getEditors],
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
