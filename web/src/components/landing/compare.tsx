import { Clip } from "./clip";

// The evidence for the headline: the booking recorded twice on the same box,
// a real-time screencast on the left, as Playwright's own video records, and
// shipcut's frame-by-frame mode on the right. Both slowed down so the
// dropped frames show.
export function Compare() {
  return (
    <section
      aria-labelledby="compare"
      className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-8 lg:grid-cols-5 lg:items-center lg:gap-12 lg:py-24"
    >
      <h2
        id="compare"
        className="text-4xl leading-tight font-black tracking-tight text-balance sm:text-5xl lg:col-span-2"
      >
        Same page, same box, recorded two ways.
      </h2>
      <figure className="lg:col-span-3">
        <div className="grid grid-cols-2 gap-4 pb-3 text-sm leading-snug">
          <p>
            <span className="font-medium">
              Real time, as Playwright records
            </span>
            <br />
            <span className="text-haze">2.8 frames a second</span>
          </p>
          <p>
            <code className="font-mono font-medium">--frame-by-frame</code>
            <br />
            <span className="text-haze">30 frames a second, every one</span>
          </p>
        </div>
        <Clip
          src="/landing/compare.mp4"
          poster="/landing/compare.jpg"
          className="aspect-[1104/960]"
        />
        <figcaption className="text-haze pt-3 text-sm">
          Recorded 2026-10-07 on a 4-vCPU server with no GPU, slowed down 4x.
        </figcaption>
      </figure>
    </section>
  );
}
