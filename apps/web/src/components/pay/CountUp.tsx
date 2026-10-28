// Purpose: Amount ko count-up animation se dikhana (easeOutExpo)
//
// Accessibility: `prefers-reduced-motion` par seedha final value (koi animation nahi).
// Number hamesha server se aata hai — yahan sirf display animation hai.

"use client";

import { useEffect, useRef, useState } from "react";

/** easeOutExpo, par hamesha 0..1 ke andar — negative t par number ulta ho jaata tha. */
const easeOutExpo = (t: number) => {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped >= 1 ? 1 : 1 - Math.pow(2, -10 * clamped);
};

export function CountUp({
  paise,
  durationMs = 850,
  className,
}: {
  paise: number;
  durationMs?: number;
  className?: string;
}) {
  const [value, setValue] = useState(paise);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(paise);
      return;
    }

    // Double rAF: pehla paint SSR value ke saath hota hai, uske baad animation shuru.
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, Math.max(0, (now - start) / durationMs));
      setValue(Math.round(paise * easeOutExpo(t)));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [paise, durationMs]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      ₹{(value / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
    </span>
  );
}
