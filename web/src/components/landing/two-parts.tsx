import Link from "next/link";

import { REPO } from "@/components/site/links";
import { buttonVariants } from "@/components/ui/button";

import { Command } from "./command";

export const INIT = ["npx shipcut init"] as const;

const BY_HAND = [
  "npm install -g shipcut",
  "npx playwright@1.63 install chromium",
] as const;

const STEPS = [
  "Installs the shipcut CLI.",
  "Downloads the Chromium it records with.",
  "Checks ffmpeg, and prints the install command for your system if it is missing.",
  "Adds the shipcut skill for Claude Code, Cursor or Codex.",
  "Writes a first scenario for your landing page.",
] as const;

export function TwoParts() {
  return (
    <section
      id="install"
      aria-labelledby="parts"
      className="border-line mx-auto grid max-w-6xl gap-8 border-t px-4 py-16 sm:px-8 lg:grid-cols-5 lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-6 lg:py-24"
    >
      <div className="flex flex-col items-start gap-5 lg:col-span-2">
        <h2
          id="parts"
          className="text-4xl leading-tight font-black tracking-tight text-balance"
        >
          Set it up in one command.
        </h2>
        <p className="text-haze max-w-[40ch] text-lg leading-relaxed text-pretty">
          Free and open source under MIT. Built and tested on Linux, which is
          what CI runs; on a Mac it records in real time.
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-6 lg:col-span-3 lg:col-start-3 lg:row-span-2 lg:row-start-1">
        <Command lines={INIT} name="install" />
        <div>
          <p className="pb-3 font-medium">
            Run it in your app&apos;s folder. It:
          </p>
          <ol className="text-haze flex list-decimal flex-col gap-1.5 pl-5 text-base leading-relaxed marker:font-mono marker:text-sm">
            {STEPS.map((step) => (
              <li key={step} className="pl-1">
                {step}
              </li>
            ))}
          </ol>
          <p className="text-haze pt-3 text-base leading-relaxed">
            It asks before each step.{" "}
            <code className="font-mono text-sm">--yes</code> takes the defaults,
            for CI.
          </p>
        </div>
        <details className="group">
          <summary className="text-lavender cursor-pointer font-medium">
            Or install by hand
          </summary>
          <div className="flex flex-col gap-3 pt-4">
            <Command lines={BY_HAND} name="install by hand" />
            <p className="text-haze text-base leading-relaxed">
              The skill is a folder to copy, as{" "}
              <Link href="/docs/agents" className="text-lavender underline">
                Coding agents
              </Link>{" "}
              shows.
            </p>
          </div>
        </details>
      </div>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 lg:col-span-2 lg:col-start-1 lg:row-start-2">
        <Link
          href="/docs"
          data-track="install: docs"
          className={buttonVariants({
            size: "lg",
            className: "h-12 px-6 text-base",
          })}
        >
          Read the docs
        </Link>
        <a
          href={REPO}
          data-track="install: code"
          className={buttonVariants({
            variant: "link",
            className: "text-lavender h-12 px-0 text-base font-medium",
          })}
        >
          See the code
        </a>
      </div>
    </section>
  );
}
