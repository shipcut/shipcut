import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // The docs are wrapped by hand; Ultracite's "never" unwraps every paragraph.
  proseWrap: "preserve",
});
