// Purpose: Payment ka progress ring — countdown (pay window) + success/fail states
//
// SVG circle: dasharray = 2πr, dashoffset = 2πr × (1 − progress).
// States: waiting (pulse) → success (tick draw) → expired (settle).

"use client";

export type RingState = "waiting" | "success" | "expired";

export function ProgressRing({
  progress,
  secondsLeft,
  state = "waiting",
  size = 96,
}: {
  /** 0..1 — 1 = poora waqt bacha hai */
  progress: number;
  secondsLeft?: number;
  state?: RingState;
  size?: number;
}) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const offset = circumference * (1 - clamped);
  const minutes = Math.floor((secondsLeft ?? 0) / 60);
  const seconds = (secondsLeft ?? 0) % 60;

  return (
    <div className={`ring ring-${state}`} style={{ width: size, height: size }} aria-hidden={state === "success"}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Payment window time left">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(12,17,22,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={state === "expired" ? "var(--danger, #b42318)" : state === "success" ? "var(--ok, #067647)" : "var(--accent, #0b5e4f)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={state === "success" ? 0 : offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-arc"
        />
      </svg>
      <div className="ring-label">
        {state === "success" ? (
          <span className="ring-tick">✓</span>
        ) : (
          <span className="mono">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
        )}
      </div>
    </div>
  );
}
