"use client";

import { IconCheck } from "@tabler/icons-react";
import { cn } from "cn";
import { type RefObject, useEffect, useRef, useState } from "react";

// One card of an app and the pointer working through it, the way a shipcut
// video shows a flow: a glide on an arc, a wave on each click, and the
// scenario's step() title beside the pointer.
const STEPS = [
  "Name the project",
  "Pick a region",
  "Turn on previews",
  "Create project",
] as const;
const LAST = STEPS.length - 1;
const NAME = "acme-web";

interface Project {
  name: string;
  eu: boolean;
  previews: boolean;
  created: boolean;
}
const START: Project = { name: "", eu: false, previews: false, created: false };
const END: Project = { name: NAME, eu: true, previews: true, created: false };

export function HeroStage() {
  const [project, setProject] = useState<Project>(START);
  const [step, setStep] = useState(-1);
  const [still, setStill] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const pointer = useRef<HTMLDivElement>(null);
  const wave = useRef<HTMLSpanElement>(null);
  const name = useRef<HTMLDivElement>(null);
  const region = useRef<HTMLButtonElement>(null);
  const previews = useRef<HTMLButtonElement>(null);
  const create = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const parts = { area, pointer, wave };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Reduced motion is known only in the browser, so the still frame waits for the effect.
      // oxlint-disable-next-line react/set-state-in-effect
      setStill(true);
      setProject(END);
      setStep(LAST);
      requestAnimationFrame(() => park(parts, create));
      return;
    }
    const run = new Run(area);
    async function loop() {
      while (run.alive) {
        setProject(START);
        setStep(-1);
        park(parts, undefined);
        await run.wait(900);

        setStep(0);
        await glide(run, parts, name);
        await press(run, parts);
        for (let i = 1; i <= NAME.length; i++) {
          const typed = NAME.slice(0, i);
          setProject((p) => ({ ...p, name: typed }));
          await run.wait(75);
        }
        await run.wait(600);

        setStep(1);
        await glide(run, parts, region);
        await press(run, parts);
        setProject((p) => ({ ...p, eu: true }));
        await run.wait(700);

        setStep(2);
        await glide(run, parts, previews);
        await press(run, parts);
        setProject((p) => ({ ...p, previews: true }));
        await run.wait(700);

        setStep(3);
        await glide(run, parts, create);
        await press(run, parts);
        setProject((p) => ({ ...p, created: true }));
        await run.wait(1300);

        setStep(LAST + 1);
        await run.wait(2200);
      }
    }
    void (async () => {
      try {
        await loop();
      } catch (error) {
        if (error !== STOPPED) throw error;
      }
    })();
    return () => run.stop();
  }, []);

  const label = STEPS[step];

  return (
    <figure className="mx-auto w-full max-w-md lg:max-w-none">
      <div ref={area} className="relative py-6">
        <Card
          project={project}
          typing={step === 0 && project.name !== ""}
          nameRef={name}
          regionRef={region}
          previewsRef={previews}
          createRef={create}
        />
        <div
          ref={pointer}
          className="group/pointer pointer-events-none absolute top-0 left-0 z-10"
          aria-hidden
        >
          <span
            ref={wave}
            className="border-violet absolute -top-5 -left-5 size-10 rounded-full border-4 opacity-0"
          />
          <svg
            viewBox="0 0 16 22"
            className="relative w-5 origin-top-left drop-shadow-md"
          >
            <path
              d="M1 1V17L5 13.2L7.8 19.6L10.2 18.6L7.5 12.3H12.8Z"
              className="fill-ink stroke-paper"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className={cn(
              "bg-violet text-paper absolute top-7 left-3.5 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap transition-opacity duration-300 group-data-flip/pointer:right-1 group-data-flip/pointer:left-auto",
              label ? "opacity-100" : "opacity-0"
            )}
          >
            {label ?? STEPS[LAST]}
          </span>
        </div>
      </div>
      <figcaption className="mt-4 flex items-center gap-4">
        <ol className="flex flex-1 gap-1.5" aria-label="Chapters">
          {STEPS.map((title, i) => (
            <li
              key={title}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-500",
                chapterColour(i, step, still)
              )}
            >
              <span className="sr-only">{title}</span>
            </li>
          ))}
        </ol>
        <code className="text-haze min-w-0 shrink truncate font-mono text-sm">
          step(&quot;{STEPS[Math.min(Math.max(step, 0), LAST)]}&quot;)
        </code>
      </figcaption>
    </figure>
  );
}

/** The app being recorded: a new project form, in its own light colours. */
function Card({
  project,
  typing,
  nameRef,
  regionRef,
  previewsRef,
  createRef,
}: {
  project: Project;
  typing: boolean;
  nameRef: RefObject<HTMLDivElement | null>;
  regionRef: RefObject<HTMLButtonElement | null>;
  previewsRef: RefObject<HTMLButtonElement | null>;
  createRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="bg-paper rounded-3xl p-6 text-base text-[#16131f] shadow-[0_30px_80px_-30px_rgb(108_92_231/0.55)] sm:p-8">
      <span className="text-2xl font-bold tracking-tight">New project</span>
      <p className="mt-6 text-sm text-[#77738a]">Name</p>
      <div
        ref={nameRef}
        className="mt-1.5 flex h-11 items-center rounded-xl border border-[#e7e4f2] px-3.5 font-medium"
      >
        {project.name ? (
          <span className={cn(typing && "border-r-2 border-[#16131f] pr-px")}>
            {project.name}
          </span>
        ) : (
          <span className="font-normal text-[#77738a]">my-app</span>
        )}
      </div>
      <p className="mt-5 text-sm text-[#77738a]">Region</p>
      <div className="mt-1.5 grid grid-cols-2 rounded-xl bg-[#f0eef7] p-1">
        <span
          className={cn(
            "rounded-lg py-2 text-center transition-colors",
            !project.eu && "bg-paper font-medium shadow-sm"
          )}
        >
          Virginia
        </span>
        <button
          ref={regionRef}
          type="button"
          tabIndex={-1}
          className={cn(
            "rounded-lg py-2 text-center transition-colors",
            project.eu && "bg-paper font-medium shadow-sm"
          )}
        >
          Frankfurt
        </button>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <span>Preview deploys</span>
        <button
          ref={previewsRef}
          type="button"
          tabIndex={-1}
          aria-label="Preview deploys"
          aria-pressed={project.previews}
          className={cn(
            "relative h-7 w-12 rounded-full transition-colors duration-300",
            project.previews ? "bg-violet" : "bg-[#e7e4f2]"
          )}
        >
          <span
            className={cn(
              "bg-paper absolute top-1 size-5 rounded-full shadow-sm transition-[left] duration-300",
              project.previews ? "left-6" : "left-1"
            )}
          />
        </button>
      </div>
      <button
        ref={createRef}
        type="button"
        tabIndex={-1}
        className={cn(
          "text-paper mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold transition-colors duration-300",
          project.created ? "bg-[#16131f]" : "bg-violet"
        )}
      >
        {project.created ? (
          <>
            <IconCheck className="size-5" /> Project created
          </>
        ) : (
          <>Create project</>
        )}
      </button>
    </div>
  );
}

const STOPPED = new Error("stopped");

function chapterColour(i: number, step: number, still: boolean) {
  if (i < step || (i === step && still)) return "bg-violet";
  return i === step ? "bg-lavender" : "bg-line";
}

type Parts = Record<"area" | "pointer" | "wave", RefObject<HTMLElement | null>>;

/** Pauses the loop while the card is off screen or the tab is hidden, and ends it on unmount. */
class Run {
  alive = true;
  private seen = false;
  private wake: (() => void) | undefined;
  private readonly observer: IntersectionObserver;

  constructor(area: RefObject<HTMLElement | null>) {
    this.observer = new IntersectionObserver(([entry]) => {
      this.seen = entry?.isIntersecting ?? false;
      this.poke();
    });
    if (area.current) this.observer.observe(area.current);
    document.addEventListener("visibilitychange", this.poke);
  }

  private readonly poke = () => {
    if (this.wake && this.seen && !document.hidden) {
      this.wake();
      this.wake = undefined;
    }
  };

  /** Resolves after `ms` of time the card was visible for, and throws `STOPPED` once the loop is over. */
  async wait(ms: number) {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
    while (this.alive && (!this.seen || document.hidden)) {
      await new Promise<void>((resolve) => {
        this.wake = resolve;
      });
    }
    if (!this.alive) throw STOPPED;
  }

  stop() {
    this.alive = false;
    this.observer.disconnect();
    document.removeEventListener("visibilitychange", this.poke);
  }
}

/** Where an element's middle sits in the pointer's area, in pixels. */
function centre(parts: Parts, target: RefObject<HTMLElement | null>) {
  const area = parts.area.current;
  let el: HTMLElement | null = target.current;
  let x = (el?.offsetWidth ?? 0) / 2;
  let y = (el?.offsetHeight ?? 0) / 2;
  while (el && el !== area) {
    x += el.offsetLeft;
    y += el.offsetTop;
    el = el.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

const at = { x: 0, y: 0 };

/** Moves the pointer. Near the right edge its label flips to the left, as `shipcut polish` does. */
function place(parts: Parts, x: number, y: number) {
  at.x = x;
  at.y = y;
  const pointer = parts.pointer.current;
  if (!pointer) return;
  pointer.style.transform = `translate(${x}px, ${y}px)`;
  pointer.toggleAttribute(
    "data-flip",
    x > (parts.area.current?.offsetWidth ?? 0) - 180
  );
}

/** Puts the pointer on `target`, or at rest on the card's bottom right corner when there is none. */
function park(parts: Parts, target: RefObject<HTMLElement | null> | undefined) {
  const area = parts.area.current;
  if (!area) return;
  const point = target
    ? centre(parts, target)
    : { x: area.offsetWidth - 32, y: area.offsetHeight - 30 };
  place(parts, point.x, point.y);
}

/** Glides the pointer to `target` on a shallow arc, as `shipcut run --pointer` does. */
async function glide(
  run: Run,
  parts: Parts,
  target: RefObject<HTMLElement | null>
) {
  const from = { ...at };
  const to = centre(parts, target);
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const duration = Math.min(900, 250 + distance * 1.4);
  const bend = {
    x: (from.x + to.x) / 2 - (to.y - from.y) * 0.18,
    y: (from.y + to.y) / 2 + (to.x - from.x) * 0.18,
  };
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      const u = 1 - e;
      place(
        parts,
        u * u * from.x + 2 * u * e * bend.x + e * e * to.x,
        u * u * from.y + 2 * u * e * bend.y + e * e * to.y
      );
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  await run.wait(120);
}

/** A click: the arrow gives and springs back, and a violet wave spreads from its tip. */
async function press(run: Run, parts: Parts) {
  parts.wave.current?.animate(
    [
      { opacity: 0.9, transform: "scale(0.3)" },
      { opacity: 0, transform: "scale(1.6)" },
    ],
    { duration: 520, easing: "cubic-bezier(.2,.7,.3,1)" }
  );
  parts.pointer.current?.firstElementChild?.nextElementSibling?.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(0.82)" },
      { transform: "scale(1)" },
    ],
    { duration: 260, easing: "ease-out" }
  );
  await run.wait(160);
}
