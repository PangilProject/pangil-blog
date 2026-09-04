import { PostIt } from "@/components/record/PostIt";
import { addNit, resolveNit } from "@/lib/actions/nits";
import type { Nit } from "@/lib/db/nits";

/**
 * 거슬림 목록 (03 §3 · 프리모템 #3 · #10).
 *
 * 대시보드의 네 번째 요소다. 02 §2.4가 A-01을 세 가지로 잡았고 "그 외에는 아무것도 두지
 * 않는다"고 했는데, 그 취지는 **아침에 여는 화면에 작성 마찰을 늘리지 않는 것**이다. 그래서
 * 이 목록은 오늘의 카드·초안 아래 맨 끝에 서고, 비어 있으면 입력칸 하나로 줄어든다.
 *
 * **클라이언트 컴포넌트가 아니다.** 평범한 form 두 개고, JS 없이 동작한다 — 개선 욕구를
 * 적는 장치가 무거우면 적지 않게 되고, 그러면 욕구가 목록이 아니라 코드로 간다.
 */
export function NitList({ nits, total }: { nits: Nit[]; total: number }) {
  const hidden = total - nits.length;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-typewriter text-[10.5px] tracking-[0.14em] text-faint">
        거슬림 목록{total > 0 && ` · ${total}`}
      </h2>

      <div className="flex flex-wrap items-start gap-3">
        {nits.map((nit) => (
          <PostIt key={nit.id}>
            {nit.body}
            {/*
              지우기가 아니라 "고쳤다"다. doneAt만 채우고 행은 남는다 — 무엇이 거슬렸고
              무엇을 실제로 고쳤는지가 이 목록의 두 번째 쓸모다
            */}
            <form action={resolveNit} className="mt-2">
              <input type="hidden" name="id" value={nit.id} />
              <button
                type="submit"
                className="font-typewriter text-[10px] text-[#a0904e] hover:text-[#5c5334]"
              >
                고쳤음
              </button>
            </form>
          </PostIt>
        ))}

        {/* 입력칸은 항상 있다. "적으려면 먼저 버튼을 찾아야 한다"가 되면 안 적는다 */}
        <form action={addNit} className="flex w-[190px] flex-col gap-2">
          <textarea
            name="body"
            rows={2}
            maxLength={200}
            placeholder="지금 거슬리는 것 한 줄"
            className="resize-none border border-edge bg-card px-2.5 py-2 text-[12.5px] leading-[1.7] placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-(--accent)"
          />
          <button
            type="submit"
            className="self-start border border-edge bg-card px-2.5 py-1 font-typewriter text-[10.5px] text-ink hover:bg-paper"
          >
            적어두기
          </button>
        </form>
      </div>

      {hidden > 0 && (
        <p className="font-typewriter text-[10.5px] text-faint">
          {hidden}개는 접어 뒀어요 — 위에서부터 하나씩 고치면 따라 올라와요
        </p>
      )}
    </section>
  );
}
