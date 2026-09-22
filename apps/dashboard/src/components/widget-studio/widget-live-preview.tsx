"use client";

const DEFAULT_GREETING: Record<string, string> = {
  english: "Hello! I'm your shopping assistant. How can I help you today?",
  roman_urdu: "Assalam o Alaikum! Main Zello AI hoon. Aaj main aapki kya madad kar sakta hoon?",
  urdu: "السلام علیکم! میں Zello AI ہوں۔ آج میں آپ کی کیا مدد کر سکتا ہوں؟",
};

export function WidgetLivePreview({
  primaryColor,
  greetingPersona,
  logoUrl,
  language,
}: {
  primaryColor: string;
  greetingPersona: string;
  logoUrl: string;
  language: string;
}) {
  const greeting = greetingPersona.trim() || DEFAULT_GREETING[language] || DEFAULT_GREETING.english;

  return (
    <div className="relative flex h-[420px] items-end justify-end overflow-hidden rounded-card border border-border bg-[repeating-linear-gradient(135deg,var(--color-surface-hover)_0,var(--color-surface-hover)_10px,transparent_10px,transparent_20px)] p-4">
      <div className="w-full max-w-[280px] overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <div
          className="flex items-center gap-2 px-4 py-3 text-white"
          style={{ backgroundColor: primaryColor || "#b6602a" }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary tenant-supplied URL
            <img src={logoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
              Z
            </span>
          )}
          <span className="text-sm font-semibold">Zello AI</span>
        </div>
        <div className="space-y-2 p-3">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-surface-hover px-3 py-2 text-sm text-ink">
            {greeting}
          </div>
        </div>
        <div className="border-t border-border p-2">
          <div className="h-8 w-full rounded-full border border-border bg-bg" />
        </div>
      </div>

      <div
        className="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-card"
        style={{ backgroundColor: primaryColor || "#b6602a" }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
        </svg>
      </div>
    </div>
  );
}
