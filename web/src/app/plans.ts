// The paid plans the landing offers at a founding price before hosted shipcut
// exists. `checkout` names the env variable that may hold the plan's Polar
// checkout link; with none set, a reservation is an email and nothing else.

export const PLANS = {
  solo: { name: "Solo", price: 29, checkout: "POLAR_CHECKOUT_SOLO" },
  team: { name: "Team", price: 99, checkout: "POLAR_CHECKOUT_TEAM" },
} as const;

export type Plan = keyof typeof PLANS;
