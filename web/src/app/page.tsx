import Link from "next/link";

import { Command } from "@/components/landing/command";
import { Compare } from "@/components/landing/compare";
import { Demo } from "@/components/landing/demo";
import { Features } from "@/components/landing/features";
import { FlowBoard } from "@/components/landing/flow-board";
import { HeroStage } from "@/components/landing/hero-stage";
import { INIT, TwoParts } from "@/components/landing/two-parts";
import { REPO } from "@/components/site/links";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

const LINK =
  "text-lavender decoration-violet font-medium underline decoration-2 underline-offset-4 hover:decoration-lavender";

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
            <div className="flex w-full max-w-md flex-col gap-3">
              <Command lines={INIT} name="hero install" />
              <p className="text-haze text-sm leading-relaxed text-pretty">
                Installs the CLI and Chromium, checks ffmpeg and adds the skill
                for Claude Code, Cursor or Codex.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/docs" className={LINK} data-track="hero: run it">
                Read the docs
              </Link>
              <a href={REPO} className={LINK} data-track="hero: code">
                See the code
              </a>
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
