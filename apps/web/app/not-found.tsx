import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="bg-surface flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo />
      <div>
        <p className="text-brand text-xs font-extrabold tracking-wide uppercase">404</p>
        <h1 className="text-ink mt-1 text-2xl font-extrabold">Page not found</h1>
        <p className="text-ink-500 mx-auto mt-2 max-w-sm text-sm font-semibold">
          That lesson or link isn&apos;t here. Your progress is safe — head back to the academy.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href="/academy">
          <Button size="lg">Go to academy</Button>
        </Link>
        <Link href="/">
          <Button size="lg" variant="outline">
            Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
