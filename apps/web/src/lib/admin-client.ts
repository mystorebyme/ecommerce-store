// Purpose: Admin client helpers — token sirf sessionStorage me (URL/localStorage me nahi)

export function adminToken(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("youpi_admin_token") ?? "";
}

export function saveAdminToken(token: string): void {
  sessionStorage.setItem("youpi_admin_token", token.trim());
}

export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-admin-token": adminToken(),
      ...(init.headers ?? {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((json as { error?: { message?: string } })?.error?.message ?? `Request failed (${response.status})`);
  }
  return (json as { data: T }).data;
}

/** Admin pages ke liye chhota token gate — token na ho to form dikhao. */
export function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
