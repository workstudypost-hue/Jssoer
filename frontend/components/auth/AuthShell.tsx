import type { ReactNode } from 'react';

/**
 * الغلاف البصري المشترك لكل صفحات المصادقة: لوحة جانبية كحلية بالهوية + النموذج.
 * الترتيب البصري (أي جهة تظهر فيها اللوحة) يتبع dir الحالي تلقائيًا بفضل سلوك
 * flexbox الافتراضي مع RTL/LTR - لا حاجة لعكس الترتيب يدويًا هنا.
 */
export function AuthShell({
  panelTitle,
  panelSubtitle,
  children,
}: {
  panelTitle: string;
  panelSubtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="relative flex flex-col justify-between overflow-hidden bg-navy-950 px-8 py-10 text-white lg:w-[40%] lg:px-14 lg:py-16">
        <BrandMark />

        <div className="relative z-10 max-w-sm">
          <h1 className="text-3xl font-extrabold leading-tight lg:text-4xl">{panelTitle}</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-navy-200">{panelSubtitle}</p>
        </div>

        <PanelPattern />
        <span className="relative z-10 text-xs text-navy-200/70">© {new Date().getFullYear()}</span>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}

/** علامة تجارية تجريدية: صفحتان متراكبتان بانفتاحة بسيطة - ترمز للتعلّم دون اعتماد اسم غير مؤكَّد بعد. */
function BrandMark() {
  return (
    <div className="relative z-10 flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <path
          d="M15 6C12 4 7.5 3.5 4 4.5V22c3.5-1 8-0.5 11 1.5V6Z"
          fill="#C79A3E"
        />
        <path
          d="M15 6C18 4 22.5 3.5 26 4.5V22c-3.5-1-8-0.5-11 1.5V6Z"
          fill="#EEF1F7"
          fillOpacity="0.9"
        />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-white/90">منصّة التعلّم</span>
    </div>
  );
}

/** نمط زخرفي هندسي خفيف (دوائر متحدة المركز) - بديل عن صورة فوتوغرافية جاهزة. */
function PanelPattern() {
  return (
    <svg
      className="pointer-events-none absolute -bottom-24 -end-24 opacity-[0.12]"
      width="420"
      height="420"
      viewBox="0 0 420 420"
      fill="none"
      aria-hidden="true"
    >
      {[60, 110, 160, 210].map((r) => (
        <circle key={r} cx="210" cy="210" r={r} stroke="#C79A3E" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
