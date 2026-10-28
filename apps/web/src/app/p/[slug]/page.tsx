// Purpose: Short product link `/p/<slug>` — ads/WhatsApp ke liye
//
// Price hamesha server se (product page) — URL me amount kabhi nahi.
// UTM params aage pass hote hain taaki attribution na toote.

import { redirect } from "next/navigation";

export default function ShortProductLink({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  redirect(`/products/${encodeURIComponent(params.slug)}${suffix}`);
}
