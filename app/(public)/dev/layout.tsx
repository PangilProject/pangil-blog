/** D — 기술 블로그. data-site="dev"가 --accent를 잉크 블루로 바꾼다(03 §2.1). */
export default function DevSiteLayout({ children }: LayoutProps<"/dev">) {
  return (
    <div data-site="dev" className="flex min-h-full flex-col">
      {children}
    </div>
  );
}
