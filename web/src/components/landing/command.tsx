"use client";

import { IconCheck, IconCopy } from "@tabler/icons-react";
import { track } from "@vercel/analytics";
import { cn } from "cn";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** A shell command with a copy button, which reports the copy as `name`. */
export function Command({
  lines,
  name,
  className,
}: {
  lines: readonly string[];
  name: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className={cn(
        "border-line bg-slab relative w-full rounded-xl border",
        className
      )}
    >
      <pre className="overflow-x-auto py-3.5 pr-14 pl-4 font-mono text-sm leading-6">
        <code>
          {lines.map((line) => (
            <span key={line} className="block">
              <span className="text-haze select-none">$ </span>
              {line}
            </span>
          ))}
        </code>
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={copied ? "Copied" : "Copy"}
        className="text-haze hover:text-paper absolute top-2.5 right-2.5"
        onClick={() => {
          navigator.clipboard
            .writeText(`${lines.join("\n")}\n`)
            .then(() => {
              track("Copy", { code: name, page: window.location.pathname });
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
