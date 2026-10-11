import Link from "next/link";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[60vh] max-w-6xl flex-col items-start justify-center gap-6 px-4 py-16 sm:px-8">
        <h1 className="text-5xl font-black tracking-tight text-balance sm:text-6xl">
          There is no page here.
        </h1>
        <p className="text-haze flex gap-6 text-lg">
          <Link
            href="/"
            className="text-lavender underline-offset-4 hover:underline"
          >
            Back home
          </Link>
          <Link
            href="/docs"
            className="text-lavender underline-offset-4 hover:underline"
          >
            Read the docs
          </Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
