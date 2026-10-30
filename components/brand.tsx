// Hirelane brand: name, tagline and the logo mark (three lanes merging into one).
export const APP_NAME = "Hirelane";
export const TAGLINE = "Your inbox, sorted into a shortlist.";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="url(#hl-g)" />
      <path d="M8 9.5h6.5c2 0 3 1 4 2.5l1.5 2.5M8 16h12M8 22.5h6.5c2 0 3-1 4-2.5l1.5-2.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".95" />
      <circle cx="23.5" cy="16" r="2.6" fill="#fff" />
      <defs>
        <linearGradient id="hl-g" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#7752f8" />
          <stop offset="1" stopColor="#4523aa" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className={`text-[17px] font-semibold tracking-tight ${inverted ? "text-white" : "text-slate-900"}`}>{APP_NAME}</span>
    </span>
  );
}
