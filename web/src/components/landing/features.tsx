// The three things shipcut does today, each with a small picture of itself.

const FEATURES = [
  {
    title: "Every frame, on any machine",
    text: "The page's clock moves 1/30 s per frame, so a CI runner with no GPU still records every frame of every animation.",
    picture: <Frames />,
  },
  {
    title: "Looks edited by hand",
    text: "The pointer, click waves, step labels, zoom and window frame are drawn after capture.",
    picture: <Polish />,
  },
  {
    title: "Your agent writes the script",
    text: "A Playwright file in your repo, written from our skill. You review it like any PR.",
    picture: <Script />,
  },
];

export function Features() {
  return (
    <section
      aria-labelledby="features"
      className="mx-auto max-w-6xl px-4 py-16 sm:px-8 lg:py-24"
    >
      <h2 id="features" className="sr-only">
        What shipcut does
      </h2>
      <ul className="grid gap-y-14 md:grid-cols-3 md:gap-x-10 md:gap-y-5 lg:gap-x-16">
        {FEATURES.map((f) => (
          <li
            key={f.title}
            className="md:border-line flex flex-col gap-5 md:row-span-3 md:-ml-5 md:grid md:grid-rows-subgrid md:border-l md:pl-5 md:first:ml-0 md:first:border-l-0 md:first:pl-0 lg:-ml-8 lg:pl-8"
          >
            <div className="h-36">{f.picture}</div>
            <h3 className="text-2xl font-bold tracking-tight">{f.title}</h3>
            <p className="text-haze max-w-[34ch] text-lg leading-relaxed text-pretty">
              {f.text}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Five consecutive frames of one ball, numbered. */
function Frames() {
  return (
    <div className="flex h-full items-end gap-2">
      {[118, 119, 120, 121, 122].map((n, i) => (
        <div key={n} className="flex flex-1 flex-col items-center gap-2">
          <div className="border-line relative aspect-[3/4] w-full rounded-md border">
            <span
              className="bg-lavender absolute size-2.5 rounded-full"
              style={{
                left: `${18 + i * 13}%`,
                top: `${68 - Math.sin((i / 4) * Math.PI) * 40}%`,
              }}
            />
          </div>
          <span className="text-haze font-mono text-xs tabular-nums">{n}</span>
        </div>
      ))}
    </div>
  );
}

/** A pointer mid-click, with its wave and its step label. */
function Polish() {
  return (
    <div className="from-lavender to-sky relative h-full rounded-xl bg-linear-to-br p-4">
      <div className="h-full rounded-lg bg-white" />
      <div className="absolute top-[42%] left-[38%]">
        <span className="border-violet absolute -top-4 -left-4 size-8 rounded-full border-[3px] opacity-60" />
        <svg viewBox="0 0 16 22" className="relative w-4" aria-hidden>
          <path
            d="M1 1V17L5 13.2L7.8 19.6L10.2 18.6L7.5 12.3H12.8Z"
            className="fill-ink stroke-paper"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
        <span className="bg-violet absolute top-6 left-3 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap text-white">
          Upgrade
        </span>
      </div>
    </div>
  );
}

/** The two lines of a scenario that made the hero's second chapter. */
function Script() {
  return (
    <pre className="border-line flex h-full flex-col justify-center overflow-hidden rounded-xl border px-4 font-mono text-[13px] leading-6 md:text-xs lg:text-[13px]">
      <code>
        <span className="text-lavender">step</span>(
        <span className="text-sky">&quot;Add two seats&quot;</span>);
        {"\n"}
        <span className="text-haze">await</span> page.
        <span className="text-lavender">getByRole</span>({"\n"}
        {"  "}
        <span className="text-sky">&quot;button&quot;</span>, {"{ "}name:{" "}
        <span className="text-sky">&quot;+&quot;</span>
        {" }"}
        {"\n"}).<span className="text-lavender">click</span>();
      </code>
    </pre>
  );
}
