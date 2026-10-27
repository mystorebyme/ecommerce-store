import { cn } from "@/lib/format";

/**
 * Hand-drawn CSS/SVG product art — no copied photography, no stock images.
 */
export function ProductArt({
  variant,
  className,
}: {
  variant: "kurta" | "tote" | "dupatta";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-line",
        variant === "kurta" && "bg-[#E8EDF2]",
        variant === "tote" && "bg-[#F3EDE0]",
        variant === "dupatta" && "bg-[#EDEAF3]",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 200 160" className="h-full w-full">
        <defs>
          <pattern id={`dots-${variant}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="1.6" cy="1.6" r="1.1" fill="#0C1116" opacity="0.14" />
          </pattern>
        </defs>

        {variant === "kurta" && (
          <g>
            <rect x="0" y="0" width="200" height="160" fill={`url(#dots-${variant})`} opacity="0.5" />
            <path d="M74 34h52l16 20-10 10 8 62H60l8-62-10-10z" fill="#22486B" />
            <path d="M74 34h52l10 12-36 12-36-12z" fill="#1B3B59" />
            <path d="M100 58v62" stroke="#F7F4EE" strokeWidth="2.2" strokeDasharray="3 4" />
            <circle cx="100" cy="72" r="2.4" fill="#D98A16" />
            <circle cx="100" cy="90" r="2.4" fill="#D98A16" />
            <circle cx="100" cy="108" r="2.4" fill="#D98A16" />
            <path d="M60 126h80" stroke="#1B3B59" strokeWidth="3" />
          </g>
        )}

        {variant === "tote" && (
          <g>
            <rect x="0" y="0" width="200" height="160" fill={`url(#dots-${variant})`} opacity="0.35" />
            <path d="M62 58h76l8 78H54z" fill="#E4D6B8" stroke="#C9B58C" strokeWidth="2" />
            <path d="M78 58c0-14 8-22 22-22s22 8 22 22" fill="none" stroke="#8C7550" strokeWidth="3" />
            <g fill="#0B5E4F" opacity="0.85">
              <rect x="78" y="78" width="10" height="10" />
              <rect x="94" y="78" width="10" height="10" />
              <rect x="110" y="78" width="10" height="10" />
              <rect x="86" y="92" width="10" height="10" />
              <rect x="102" y="92" width="10" height="10" />
              <rect x="78" y="106" width="10" height="10" />
              <rect x="110" y="106" width="10" height="10" />
            </g>
          </g>
        )}

        {variant === "dupatta" && (
          <g>
            <path d="M18 118C44 60 78 44 118 52c32 6 52 26 64 44" fill="none" stroke="#6C5D86" strokeWidth="26" strokeLinecap="round" opacity="0.9" />
            <path d="M28 110C52 66 82 52 118 58c28 5 46 22 58 38" fill="none" stroke="#F7F4EE" strokeWidth="2" strokeDasharray="4 6" />
            <path d="M154 62c8 10 16 22 20 34" stroke="#D98A16" strokeWidth="3" fill="none" />
            <circle cx="160" cy="70" r="2.5" fill="#D98A16" />
            <circle cx="167" cy="84" r="2.5" fill="#D98A16" />
            <circle cx="171" cy="98" r="2.5" fill="#D98A16" />
          </g>
        )}
      </svg>
    </div>
  );
}
