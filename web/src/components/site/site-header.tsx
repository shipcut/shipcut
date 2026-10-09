import Link from "next/link";

import { Waitlist } from "@/components/landing/waitlist";

import { REPO } from "./links";

/** The bar on every page: the wordmark home, the docs, the changelog, the repo and the waitlist. */
export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-5 sm:px-8">
      <Link
        href="/"
        className="mr-auto flex items-center gap-2 text-xl font-bold tracking-tight"
      >
        <svg viewBox="0 0 16 22" className="w-3.5" aria-hidden>
          <path
            d="M1 1V17L5 13.2L7.8 19.6L10.2 18.6L7.5 12.3H12.8Z"
            className="fill-paper stroke-violet"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
        shipcut
      </Link>
      <nav className="text-haze flex items-center gap-6">
        <Link href="/docs" className="hover:text-paper">
          Docs
        </Link>
        <Link href="/changelog" className="hover:text-paper hidden sm:block">
          Changelog
        </Link>
        <a href={REPO} className="hover:text-paper hidden sm:block">
          GitHub
        </a>
      </nav>
      <Waitlist size="default" className="h-10 px-4" />
    </header>
  );
}
