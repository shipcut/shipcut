"use client";

import { IconCheck, IconCopy } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";

import { Waitlist } from "@/components/landing/waitlist";
import { Button, buttonVariants } from "@/components/ui/button";

// The two things on offer, side by side: the CLI, free and installable now,
// and hosted shipcut, which is coming and is what the waitlist is for.
const INSTALL = [
  "git clone https://github.com/shipcut/shipcut && cd shipcut",
  "pnpm install",
  'ln -s "$PWD/bin/shipcut" ~/.local/bin/shipcut',
] as const;

const HOSTED = [
  "A re-render on every deploy, from CI",
  "A stable link and a player for every video",
  "Run history",
] as const;

export function TwoParts() {
  return (
    <section
      aria-labelledby="parts"
      className="border-line mx-auto grid max-w-6xl gap-12 border-t px-4 py-16 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-24"
    >
      <h2 id="parts" className="sr-only">
        The CLI today, and shipcut hosted
      </h2>
      <div className="flex min-w-0 flex-col items-start gap-5">
        <h3 className="text-3xl font-bold tracking-tight">The CLI</h3>
        <p className="text-haze text-lg leading-relaxed text-pretty">
          Free and open source, MIT. Works today on Linux and CI runners; on a
          Mac it records in real time.
        </p>
        <Install />
        <Link
          href="/docs"
          className={buttonVariants({
            size: "lg",
            className: "h-12 px-6 text-base",
          })}
        >
          Read the docs
        </Link>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-5">
        <h3 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          shipcut hosted
          <span className="border-haze rounded-full border px-2.5 text-sm font-medium">
            coming
          </span>
        </h3>
        <ul className="text-haze text-lg leading-relaxed">
          {HOSTED.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 lg:mt-auto">
          <Waitlist variant="outline" className="h-12 px-6 text-base" />
          <p className="text-haze">
            Or write to{" "}
            <a
              href="mailto:hello@shipcut.dev"
              className="text-paper underline-offset-4 hover:underline"
            >
              hello@shipcut.dev
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

/** The three install lines from the README, with a button that copies them. */
function Install() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border-line relative w-full rounded-xl border">
      <pre className="overflow-x-auto p-4 pr-12 font-mono text-xs leading-6">
        <code>{INSTALL.join("\n")}</code>
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={copied ? "Copied" : "Copy the commands"}
        className="text-haze hover:text-paper absolute top-3 right-3"
        onClick={() => {
          navigator.clipboard
            .writeText(`${INSTALL.join("\n")}\n`)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => {
              // Clipboard refused, as on http: the text is there to select.
            });
        }}
      >
        {copied ? <IconCheck className="text-lavender" /> : <IconCopy />}
      </Button>
    </div>
  );
}
