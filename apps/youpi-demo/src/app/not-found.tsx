import Link from "next/link";
import { Icon, Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col items-center px-5 py-24 text-center">
      <Logo />
      <p className="mono-nums mt-6 text-[52px] font-semibold leading-none text-ink">404</p>
      <h1 className="mt-2 text-[22px] font-semibold text-ink">This page never got a session</h1>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-mute">
        The route you tried does not exist in the demo. Everything lives in five surfaces — store, checkout,
        outcomes, admin console and docs.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn-primary">
          Back to overview
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
        <Link href="/store" className="btn-ghost">
          Open the demo store
        </Link>
        <Link href="/docs" className="btn-ghost">
          Read the docs
        </Link>
      </div>
    </div>
  );
}
