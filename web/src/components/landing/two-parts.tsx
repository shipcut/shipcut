"use client";

import { IconCheck, IconCopy } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";

import { REPO } from "@/components/site/links";
import { Button, buttonVariants } from "@/components/ui/button";

// The CLI is the whole product: free, open source, and installable now.
const INSTALL = [
  "git clone https://github.com/shipcut/shipcut && cd shipcut",
  "pnpm install",
  'ln -s "$PWD/bin/shipcut" ~/.local/bin/shipcut',
] as const;

export function TwoParts() {
  return (
    <section
      aria-labelledby="parts"
      className="border-line mx-auto flex max-w-6xl flex-col items-start gap-5 border-t px-4 py-16 sm:px-8 lg:py-24"
    >
      <h2 id="parts" className="text-3xl font-bold tracking-tight">
        Install the CLI
      </h2>
      <p className="text-haze max-w-[60ch] text-lg leading-relaxed text-pretty">
        Free and open source, MIT. Works today on Linux and CI runners; on a Mac
        it records in real time.
      </p>
      <div className="w-full max-w-2xl">
        <Install />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link
          href="/docs"
          className={buttonVariants({
            size: "lg",
            className: "h-12 px-6 text-base",
          })}
        >
          Read the docs
        </Link>
        <a
          href={REPO}
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
