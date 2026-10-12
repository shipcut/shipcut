"use client";

import { cn } from "cn";
import { useRef, useState } from "react";

import { Clip } from "./clip";

const STEPS = [
  "A guest opens Kávomat",
  "Book a table",
  "Pick a day",
  "Pick a time",
  "Name and email",
  "Table booked",
] as const;

const CUT_NAMES = ["desktop", "story"] as const;
type Cut = (typeof CUT_NAMES)[number];

const MEDIA = "https://media.shipcut.dev/heystol";
// Published with `shipcut publish --project heystol`; chapters are each
// step's start in seconds of that cut.
const CUTS: Record<
  Cut,
  {
    src: string;
    poster: string;
    chapters: readonly number[];
    className: string;
  }
> = {
  desktop: {
    src: `${MEDIA}/20261008-120850-booking/video-polished-clip.mp4`,
    poster: "/changelog/booking.jpg",
    chapters: [0, 3.333, 5.133, 8.267, 10, 13.6],
    className: "hidden aspect-[16/10] sm:block",
  },
  story: {
    src: `${MEDIA}/20261008-121515-booking/video-polished-clip.mp4`,
    poster: "/landing/booking-story.jpg",
    chapters: [0, 3.333, 5.1, 8.067, 9.8, 13.367],
    className: "mx-auto aspect-[9/16] w-[min(100%,58svh*9/16)] sm:hidden",
  },
};

export function Demo() {
  const [current, setCurrent] = useState(0);
  const videos = useRef<Record<Cut, HTMLVideoElement | null>>({
    desktop: null,
    story: null,
  });

  const seek = (i: number) => {
    for (const cut of CUT_NAMES) {
      const el = videos.current[cut];
      // The cut the CSS hides has no box, and must not start playing unseen.
      if (!el || el.getClientRects().length === 0) continue;
      el.currentTime = CUTS[cut].chapters[i] ?? 0;
      setCurrent(i);
      el.play().catch(() => {
        // Nothing to do: the poster stays.
      });
    }
  };

  return (
    <figure className="mx-auto w-full max-w-md sm:max-w-none">
      {CUT_NAMES.map((cut) => {
        const { src, poster, chapters, className } = CUTS[cut];
        return (
          <Clip
            key={cut}
            src={src}
            poster={poster}
            className={className}
            ref={(el) => {
              videos.current[cut] = el;
            }}
            onTimeUpdate={(e) => {
              // A seek lands a hair early, hence the 0.05.
              const t = e.currentTarget.currentTime + 0.05;
              setCurrent(
                Math.max(
                  0,
                  chapters.findLastIndex((start) => t >= start)
                )
              );
            }}
          />
        );
      })}
      <figcaption className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <ol
            className="flex w-full gap-1.5 sm:w-auto sm:flex-1"
            aria-label="Chapters, click one to jump there"
          >
            {STEPS.map((title, i) => (
              <li key={title} className="flex-1">
                <button
                  type="button"
                  onClick={() => seek(i)}
                  aria-current={i === current ? "step" : undefined}
                  className="group flex w-full py-2"
                >
                  <span
                    className={cn(
                      "group-hover:bg-lavender h-1 w-full rounded-full transition-colors duration-500",
                      i <= current ? "bg-violet" : "bg-line"
                    )}
                  />
                  <span className="sr-only">{title}</span>
                </button>
              </li>
            ))}
          </ol>
          <code className="text-haze min-w-0 shrink truncate font-mono text-sm">
            {clock(CUTS.desktop.chapters[current] ?? 0)} step(&quot;
            {STEPS[current]}&quot;)
          </code>
        </div>
        <p className="text-haze text-sm leading-relaxed text-pretty">
          A guest books a table in Heystol, Roman&apos;s own app. shipcut
          recorded it from a six-step script on a 4-vCPU server with no GPU.
        </p>
      </figcaption>
    </figure>
  );
}

function clock(seconds: number) {
  return `0:${String(Math.floor(seconds)).padStart(2, "0")}`;
}
