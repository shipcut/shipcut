"use client";

import { cn } from "cn";
import { useEffect, useRef, useState } from "react";

// How a video gets made, as an automation board seen from above at an angle:
// four lanes, and one job card that travels through them.
const LANES = [
  { name: "Deploy", station: "Your CI", note: "coming", card: "booking.ts" },
  {
    name: "Record",
    station: "Chromium, frame by frame",
    note: undefined,
    card: "frame",
  },
  {
    name: "Polish",
    station: "Pointer, zoom, frame",
    note: undefined,
    card: "video-polished.mp4",
  },
  {
    name: "Publish",
    station: "A link for your site, changelog or PR",
    note: undefined,
    card: "media.shipcut.dev/…",
  },
] as const;
const FRAMES = 540;

export function FlowBoard() {
  const [lane, setLane] = useState(0);
  // The lane whose output the card shows: it changes once the card arrives.
  const [shown, setShown] = useState(0);
  const [frame, setFrame] = useState(0);
  const [slot, setSlot] = useState({ x: 0, y: 0, width: 0 });
  const board = useRef<HTMLDivElement>(null);
  const slots = useRef<(HTMLDivElement | null)[]>([]);

  // The card sits over its lane's empty slot, wherever the layout put it.
  useEffect(() => {
    const place = () => {
      const el = slots.current[lane];
      if (el)
        setSlot({ x: el.offsetLeft, y: el.offsetTop, width: el.offsetWidth });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [lane]);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Reduced motion is known only in the browser.
      // oxlint-disable-next-line react/set-state-in-effect
      setLane(3);
      setShown(3);
      return;
    }
    let seen = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let arrival: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let current = 0;
    const advance = () => {
      if (!seen || document.hidden) {
        timer = undefined;
        return;
      }
      current = (current + 1) % LANES.length;
      setLane(current);
      const arrived = current;
      arrival = setTimeout(() => {
        setShown(arrived);
        if (arrived !== 1) return;
        const start = performance.now();
        const count = (now: number) => {
          const t = Math.min(1, (now - start) / 1300);
          setFrame(Math.round(t * FRAMES));
          if (t < 1) raf = requestAnimationFrame(count);
        };
        setFrame(0);
        raf = requestAnimationFrame(count);
      }, 700);
      timer = setTimeout(advance, current === 3 ? 2600 : 1900);
    };
    const resume = () => {
      if (seen && !document.hidden && !timer) timer = setTimeout(advance, 1200);
    };
    const observer = new IntersectionObserver(([entry]) => {
      seen = entry?.isIntersecting ?? false;
      resume();
    });
    if (board.current) observer.observe(board.current);
    document.addEventListener("visibilitychange", resume);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", resume);
      clearTimeout(timer);
      clearTimeout(arrival);
      cancelAnimationFrame(raf);
    };
  }, []);

  const text = shown === 1 ? `frame ${frame} of ${FRAMES}` : LANES[shown]?.card;

  // The tilt moves the board's visible top down, and the isometric view is
  // taller than its layout box, so the wrapper's heights are what fits the drawing.
  return (
    <div
      ref={board}
      className="-mt-6 flex items-center justify-center pb-2 md:mt-8 md:h-[400px] md:pb-0 lg:h-[520px]"
    >
      <div className="iso-plane relative grid w-[min(300px,78vw)] grid-cols-1 gap-3 md:w-[880px] md:grid-cols-4 md:gap-4">
        {LANES.map((l, i) => (
          <div
            key={l.name}
            className={cn(
              "flex flex-col gap-3 rounded-2xl border p-3 transition-colors duration-500 md:min-h-[300px]",
              i === lane
                ? "border-violet/70 bg-violet/10"
                : "border-line bg-ink"
            )}
          >
            <div className="flex items-baseline gap-2 px-1">
              <span className="text-haze font-mono text-sm">{i + 1}</span>
              <span className="text-lg font-bold">{l.name}</span>
              {l.note && (
                <span className="border-haze text-paper ml-auto rounded-full border px-2.5 text-sm font-medium">
                  {l.note}
                </span>
              )}
            </div>
            <div className="iso-block bg-slab text-lavender rounded-xl px-3 py-4 text-base font-medium">
              {l.station}
            </div>
            <div
              ref={(el) => {
                slots.current[i] = el;
              }}
              className="border-line h-[72px] rounded-xl border border-dashed"
            />
          </div>
        ))}
        <div
          aria-hidden
          className="iso-card bg-lavender text-ink pointer-events-none absolute top-0 left-0 flex h-[72px] items-center rounded-xl px-4 font-mono text-[13px] font-medium transition-transform duration-700 ease-[cubic-bezier(.5,0,.2,1)]"
          style={{
            // Lifted off its slot towards the screen's top, whatever the angle.
            transform: `translate(${slot.x}px, ${slot.y}px) translate(calc(var(--down-x) * -16px), calc(var(--down-y) * -16px))`,
            width: slot.width,
          }}
        >
          <span className="truncate tabular-nums">{text}</span>
        </div>
      </div>
    </div>
  );
}
