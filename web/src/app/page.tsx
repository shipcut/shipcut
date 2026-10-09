import { Features } from "@/components/landing/features";
import { FlowBoard } from "@/components/landing/flow-board";
import { HeroStage } from "@/components/landing/hero-stage";
import { Waitlist } from "@/components/landing/waitlist";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-8 pb-16 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:pt-20 lg:pb-24">
          <div className="flex flex-col items-start gap-7">
            <h1 className="text-[clamp(2.75rem,5.4vw,4.5rem)] leading-[0.98] font-black tracking-[-0.035em] text-balance lg:text-wrap">
              A demo video that updates with every deploy.
            </h1>
            <p className="text-haze max-w-[36ch] text-xl leading-relaxed text-pretty">
              Your coding agent writes a Playwright script. shipcut records it
              frame by frame and edits it like a person would.
            </p>
            <div className="flex items-center gap-5">
              <Waitlist className="h-12 px-6 text-base" />
              <a
                href="#how"
                className="text-lavender inline-flex h-12 items-center font-medium underline-offset-4 hover:underline"
              >
                How it works
              </a>
            </div>
          </div>
          <HeroStage />
        </section>

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
            From a push to a video in your PR.
          </h2>
          <FlowBoard />
        </section>
      </main>

      <section className="border-line mx-auto flex max-w-6xl flex-col gap-8 border-t px-4 py-12 sm:flex-row sm:flex-wrap sm:items-center sm:px-8 lg:py-16">
        <p className="text-3xl font-bold tracking-tight">
          Want it on your app?
        </p>
        <Waitlist className="h-12 px-6 text-base" />
        <p className="text-haze basis-full lg:ml-auto lg:basis-auto">
          Or write to{" "}
          <a
            href="mailto:hello@shipcut.dev"
            className="text-paper underline-offset-4 hover:underline"
          >
            hello@shipcut.dev
          </a>
        </p>
      </section>
      <SiteFooter />
    </>
  );
}
