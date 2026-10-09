"use client";

// The docs' table of contents (a sidebar, a disclosure on phones) and the
// previous and next links under each page, both from one ordered list.
import { IconChevronDown } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGES = [
  { href: "/docs", title: "Quick start" },
  { href: "/docs/scenarios", title: "Scenarios" },
  { href: "/docs/commands", title: "Commands" },
  { href: "/docs/publishing", title: "Publishing" },
  { href: "/docs/agents", title: "Coding agents" },
  { href: "/docs/faq", title: "FAQ" },
] as const;

function Pages({ current }: { current: string }) {
  return (
    <ul className="flex flex-col">
      {PAGES.map((p) => (
        <li key={p.href}>
          <Link
            href={p.href}
            aria-current={p.href === current ? "page" : undefined}
            className="text-haze hover:text-paper aria-[current=page]:text-paper aria-[current=page]:border-paper border-line block border-l py-1.5 pl-4 aria-[current=page]:font-bold"
          >
            {p.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The list of pages: a sidebar from lg up, a disclosure above the article below that. */
export function DocsNav() {
  const pathname = usePathname();
  const current = PAGES.find((p) => p.href === pathname) ?? PAGES[0];
  return (
    <>
      {/* Keyed by the path, so it closes again after a page is picked. */}
      <details
        key={pathname}
        className="group border-line rounded-lg border lg:hidden"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-bold [&::-webkit-details-marker]:hidden">
          {current.title}
          <IconChevronDown
            aria-hidden
            className="text-haze size-5 transition-transform group-open:rotate-180"
          />
        </summary>
        <nav aria-label="Docs" className="px-4 pb-4">
          <Pages current={current.href} />
        </nav>
      </details>
      <nav
        aria-label="Docs"
        className="hidden lg:sticky lg:top-8 lg:block lg:self-start"
      >
        <Pages current={current.href} />
      </nav>
    </>
  );
}

/** Links to the pages before and after this one, at the end of the article. */
export function DocsPager() {
  const pathname = usePathname();
  const i = PAGES.findIndex((p) => p.href === pathname);
  const previous = i > 0 ? PAGES[i - 1] : undefined;
  const next = i === -1 ? undefined : PAGES[i + 1];
  return (
    <nav
      aria-label="Previous and next"
      className="border-line mt-16 grid grid-cols-2 gap-4 border-t pt-6"
    >
      {previous && (
        <Link href={previous.href} className="group flex flex-col gap-1">
          <span className="text-haze text-sm">Previous</span>
          <span className="group-hover:text-lavender font-bold">
            {previous.title}
          </span>
        </Link>
      )}
      {next && (
        <Link
          href={next.href}
          className="group col-start-2 flex flex-col items-end gap-1 text-right"
        >
          <span className="text-haze text-sm">Next</span>
          <span className="group-hover:text-lavender font-bold">
            {next.title}
          </span>
        </Link>
      )}
    </nav>
  );
}
