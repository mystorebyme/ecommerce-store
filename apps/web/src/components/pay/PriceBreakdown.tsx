// Purpose: Price breakdown — GST math + donut chart (base / GST / shipping)
//
// Prices GST-inclusive hain (India retail norm). Isliye:
//   base = total / (1 + gstRate)   →   gst = total − base
// Sab kuch integer paise me, round sirf display par.

import { rupees } from "@/lib/api";

export interface BreakdownInput {
  totalPaise: number;
  /** GST rate — 5% kapde (₹1000 se kam), 12% usse upar */
  gstRate?: number;
  shippingPaise?: number;
}

export function breakdown({ totalPaise, gstRate = 0.05, shippingPaise = 0 }: BreakdownInput) {
  const taxableTotal = totalPaise - shippingPaise;
  const basePaise = Math.round(taxableTotal / (1 + gstRate));
  const gstPaise = taxableTotal - basePaise;
  return {
    totalPaise,
    basePaise,
    gstPaise,
    cgstPaise: Math.round(gstPaise / 2),
    sgstPaise: gstPaise - Math.round(gstPaise / 2),
    shippingPaise,
    gstRate,
  };
}

export function PriceBreakdown({ input }: { input: BreakdownInput }) {
  const parts = breakdown(input);
  const size = 108;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { key: "base", value: parts.basePaise, color: "#0b5e4f", label: "Item value" },
    { key: "gst", value: parts.gstPaise, color: "#b4530f", label: `GST ${(parts.gstRate * 100).toFixed(0)}%` },
    ...(parts.shippingPaise > 0 ? [{ key: "ship", value: parts.shippingPaise, color: "#3c4a7a", label: "Shipping" }] : []),
  ];

  let offsetSoFar = 0;

  return (
    <div className="breakdown">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Price breakdown">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(12,17,22,0.07)" strokeWidth={stroke} />
        {segments.map((segment) => {
          const fraction = parts.totalPaise > 0 ? segment.value / parts.totalPaise : 0;
          const length = circumference * fraction;
          const dash = `${length} ${circumference - length}`;
          const rotation = (offsetSoFar / circumference) * 360;
          offsetSoFar += length;
          return (
            <circle
              key={segment.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeLinecap="butt"
              transform={`rotate(${-90 + rotation} ${size / 2} ${size / 2})`}
              className="donut-segment"
            />
          );
        })}
      </svg>

      <dl className="breakdown-legend">
        {segments.map((segment) => (
          <div key={segment.key} className="breakdown-row">
            <dt>
              <span className="dot" style={{ background: segment.color }} />
              {segment.label}
            </dt>
            <dd>{rupees(segment.value)}</dd>
          </div>
        ))}
        <div className="breakdown-row total">
          <dt>Total</dt>
          <dd>{rupees(parts.totalPaise)}</dd>
        </div>
        {parts.gstPaise > 0 ? (
          <p className="muted breakdown-note">
            CGST {rupees(parts.cgstPaise)} + SGST {rupees(parts.sgstPaise)} — invoice me alag dikhega.
          </p>
        ) : null}
      </dl>
    </div>
  );
}
