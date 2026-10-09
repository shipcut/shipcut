import Link from "next/link";

import { REPO } from "./links";

/** The line at the bottom of every page. */
export function SiteFooter() {
  return (
    <footer className="border-line text-haze mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 border-t px-4 py-8 text-sm sm:px-8">
      <span className="mr-auto">shipcut, MIT licence</span>
      <Link href="/docs" className="hover:text-paper">
        Docs
      </Link>
      <Link href="/changelog" className="hover:text-paper">
        Changelog
      </Link>
      <a href={REPO} className="hover:text-paper">
        GitHub
      </a>
      <Link href="/privacy" className="hover:text-paper">
        Privacy
      </Link>
      <a href="mailto:hello@shipcut.dev" className="hover:text-paper">
        hello@shipcut.dev
      </a>
    </footer>
  );
}
