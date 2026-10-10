import Link from "next/link";

import { Compare } from "@/components/landing/compare";
import { Demo } from "@/components/landing/demo";
import { Features } from "@/components/landing/features";
import { FlowBoard } from "@/components/landing/flow-board";
import { HeroStage } from "@/components/landing/hero-stage";
import { TwoParts } from "@/components/landing/two-parts";
import { Waitlist } from "@/components/landing/waitlist";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { buttonVariants } from "@/components/ui/button";

// Installing is the signal the launch counts, so the docs are the primary
// action everywhere and the waitlist waits for what is not built yet.
const INSTALL = buttonVariants({
  size: "lg",
  className: "h-12 px-6 text-base",
});
const LATER = "text-lavender h-12 px-0 text-base font-medium";

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pt-6 pb-8 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:pt-8 lg:pb-8">
          <div className="flex flex-col items-start gap-7">
            <h1 className="text-[clamp(2.75rem,5.4vw,4.5rem)] leading-[0.98] font-black tracking-[-0.035em] text-balance">
              Demo videos of your app, every frame, even on CI.
            </h1>
            <p className="text-haze max-w-[36ch] text-xl leading-relaxed text-pretty">
              Your UI changed, your demo didn&apos;t. Your coding agent writes a
              Playwright script, and shipcut records it.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/docs" className={INSTALL}>
                Run it on your app
              </Link>
              <Waitlist variant="link" className={LATER}>
                Get it hosted
              </Waitlist>
            </div>
          </div>
          <HeroStage />
        </section>

        <Demo />

        <Compare />

        <Features />

        <section
          id="how"
          aria-labelledby="how-title"
          className="mx-auto max-w-6xl px-4 py-16 sm:px-8 lg:py-24"
        >
          <h2
            id="how-title"
            className="max-w-[18ch] text-4xl leading-tight font-black tracking-tight text-balance sm:text-5xl"
          >
            From a script to a video you can put anywhere.
          </h2>
          <FlowBoard />
        </section>
      </main>

      <TwoParts />
      <SiteFooter />
    </>
  );
}
