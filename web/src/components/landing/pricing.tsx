import { PLANS, type Plan } from "@/app/plans";
import { Waitlist } from "@/components/landing/waitlist";

// What hosted shipcut will cost, shown before it exists so phase 2 can count
// who reserves a plan, not only who signs up. Nothing is charged from here:
// the button reserves by email, and a checkout link appears only when Polar's
// is set for the plan.

const TIERS: { plan?: Plan; name: string; price: string; lines: string[] }[] = [
  {
    name: "CLI",
    price: "Free",
    lines: [
      "Open source, MIT",
      "Records on your machine or CI runner",
      "Publishes to your own bucket",
    ],
  },
  {
    plan: "solo",
    name: PLANS.solo.name,
    price: `${PLANS.solo.price} EUR`,
    lines: [
      "One repository",
      "A comment on every PR: which chapters changed, the new clip, a frame before and after",
      "A stable link and a player for every video and screenshot",
      "90 days of run history",
    ],
  },
  {
    plan: "team",
    name: PLANS.team.name,
    price: `${PLANS.team.price} EUR`,
    lines: [
      "Up to ten repositories",
      "Everything in Solo",
      "All run history",
      "Slack notifications",
      "A player without shipcut's mark",
    ],
  },
];

export function Pricing() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="border-line mx-auto max-w-6xl border-t px-4 py-16 sm:px-8 lg:py-24"
    >
      <div className="flex flex-col gap-4">
        <h2
          id="pricing-title"
          className="flex flex-wrap items-center gap-3 text-4xl leading-tight font-black tracking-tight sm:text-5xl"
        >
          Pricing
          <span className="border-haze rounded-full border px-2.5 text-sm font-medium tracking-normal">
            hosted is coming
          </span>
        </h2>
        <p className="text-haze max-w-[52ch] text-lg leading-relaxed text-pretty">
          The CLI stays free. Hosted shipcut is for the part you should not have
          to watch: knowing which video a PR changed. Reserve a founding price
          now; it costs nothing and stays yours for as long as you keep the
          plan.
        </p>
      </div>
      <ul className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0">
        {TIERS.map((t) => (
          <li
            key={t.name}
            className="md:border-line flex flex-col gap-5 md:border-l md:px-8 md:first:border-l-0 md:first:pl-0 md:last:pr-0"
          >
            <h3 className="text-2xl font-bold tracking-tight">{t.name}</h3>
            <p className="flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight">
                {t.price}
              </span>
              {t.plan && <span className="text-haze">a month</span>}
            </p>
            <ul className="text-haze grid gap-2 text-lg leading-relaxed">
              {t.lines.map((line) => (
                <li key={line} className="text-pretty">
                  {line}
                </li>
              ))}
            </ul>
            {t.plan && (
              <Waitlist
                plan={t.plan}
                variant={t.plan === "solo" ? "default" : "outline"}
                className="mt-auto h-12 px-6 text-base"
              >
                Reserve founding price
              </Waitlist>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
