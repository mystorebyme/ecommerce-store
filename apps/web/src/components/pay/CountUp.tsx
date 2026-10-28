// Purpose: Amount ko count-up animation se dikhana (easeOutExpo)
//
// Accessibility: `prefers-reduced-motion` par seedha final value (koi animation nahi).
// Number hamesha server se aata hai — yahan sirf display animation hai.

"use client";

import { useEffect, useRef, useState } from "react";

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

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

    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      setValue(Math.round(from + (paise - from) * easeOutExpo(t)));
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
