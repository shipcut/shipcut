"use client";

import { cn } from "cn";
import { useRef, useState } from "react";

import { Clip } from "./clip";

// One real shipcut video beside the six step() lines of the scenario that made
// it. The line of the chapter on screen is lit, and clicking a line seeks
// there. Phones get the story cut of the same scenario.
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
    <section
      aria-labelledby="demo"
      className="mx-auto grid max-w-6xl gap-6 px-4 pt-6 pb-16 sm:px-8 lg:grid-cols-5 lg:items-start lg:gap-12 lg:pt-6 lg:pb-24"
    >
      <h2 id="demo" className="sr-only">
        A video shipcut made
      </h2>
      <div className="lg:col-span-3">
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
      </div>
      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="border-line rounded-xl border px-2 py-3 font-mono text-[13px] leading-6">
          <p className="text-haze px-3 pb-2 text-xs">booking.ts</p>
          <ol aria-label="Chapters, click one to jump there">
            {STEPS.map((title, i) => (
              <li key={title}>
                <button
                  type="button"
                  onClick={() => seek(i)}
                  aria-current={i === current ? "step" : undefined}
                  className={cn(
                    "flex w-full items-baseline gap-3 rounded-md px-3 py-0.5 text-left whitespace-nowrap",
                    i === current
                      ? "bg-violet text-paper font-medium"
                      : "hover:bg-line"
                  )}
                >
                  <span
                    className={cn(
                      "w-[4ch] shrink-0 tabular-nums",
                      i === current ? "text-paper" : "text-haze"
                    )}
                  >
                    {clock(CUTS.desktop.chapters[i] ?? 0)}
                  </span>
                  <code className="truncate">step(&quot;{title}&quot;);</code>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-haze text-base leading-relaxed text-pretty">
          A guest books a table in Heystol, Roman&apos;s own app. shipcut
          recorded it from this script on a 4-vCPU server with no GPU.
        </p>
      </div>
    </section>
  );
}

/** Seconds as `0:07`. */
function clock(seconds: number) {
  return `0:${String(Math.floor(seconds)).padStart(2, "0")}`;
}
