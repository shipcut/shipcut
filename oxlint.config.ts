import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

/**
 * Rules the Ultracite presets turn on that fight the style this code is
 * written in. They catch no bugs, so they stay off. Most are Heystol's list,
 * which has the same author.
 */
const NEVER = {
  "eslint/default-case": "off",
  "eslint/func-style": "off", // `function` declarations are the house style
  "eslint/no-inline-comments": "off",
  "eslint/no-use-before-define": "off", // helpers sit below their caller
  // `void promise` is how no-floating-promises is told a promise may run on.
  "eslint/no-void": "off",
  "eslint/prefer-named-capture-group": "off",
  "eslint/require-unicode-regexp": "off",
  "import/consistent-type-specifier-style": "off",
  "promise/avoid-new": "off", // wrapping a callback API is what it is for
  "promise/prefer-await-to-callbacks": "off",
  "promise/prefer-await-to-then": "off",
  "react/function-component-definition": "off",
  "react/hook-use-state": "off",
  "typescript/consistent-return": "off",
  "typescript/no-confusing-void-expression": "off", // `() => setX(v)`
  "typescript/promise-function-async": "off",
  "typescript/strict-void-return": "off",
  "unicorn/import-style": "off",
  "unicorn/no-array-reduce": "off",
  "unicorn/no-await-expression-member": "off",
  "unicorn/no-useless-undefined": "off",
  "unicorn/prefer-ternary": "off",
  // Not in Heystol's list. The CLI's one-line guards: `if (!x) return y;`.
  "eslint/curly": "off",
  // Not in Heystol's list. `i++` in a for reads better than `i += 1`.
  "eslint/no-plusplus": "off",
} as const;

/**
 * Rules worth having that the code does not meet yet, off for now. Turn one
 * on when a change passes through the code it flags, fix what it finds
 * there, and delete its line. The count is findings when it was switched off
 * (2026-10-09).
 */
const LATER = {
  "eslint/complexity": "off", // 2
  "eslint/no-await-in-loop": "off", // 25, frame-by-frame capture is one frame at a time
  "eslint/sort-keys": "off", // 190
  "typescript/no-non-null-assertion": "off", // 44
  "typescript/no-unsafe-type-assertion": "off", // 18
  "typescript/strict-boolean-expressions": "off", // 56
  "unicorn/consistent-function-scoping": "off", // 7
} as const;

/**
 * LATER for the CLI alone: what `oxlint --fix` could not fix in `src/`,
 * `test/` and `examples/` when Ultracite came in. The web app meets them.
 */
const LATER_IN_CLI = {
  "eslint/func-names": "off", // 2
  "eslint/no-empty": "off", // 1
  "eslint/no-empty-function": "off", // 3, `.catch(() => {})` on best-effort cleanup
  "eslint/no-nested-ternary": "off", // 1
  "eslint/no-promise-executor-return": "off", // 3
  "eslint/no-shadow": "off", // 3
  "eslint/no-unmodified-loop-condition": "off", // 1
  "eslint/no-useless-escape": "off", // 1
  "eslint/prefer-const": "off", // 1
  "eslint/prefer-destructuring": "off", // 3
  "eslint/require-await": "off", // 1
  "promise/param-names": "off", // 4
  "typescript/method-signature-style": "off", // 4
  "typescript/no-base-to-string": "off", // 1
  "typescript/no-unnecessary-type-parameters": "off", // 1
  "typescript/no-unsafe-assignment": "off", // 2
  "typescript/prefer-nullish-coalescing": "off", // 3, `||` that should fall through ""
  "unicorn/no-array-for-each": "off", // 3
  "unicorn/new-for-builtins": "off", // 2
  "unicorn/no-array-sort": "off", // 7
  "unicorn/no-immediate-mutation": "off", // 1
  "unicorn/no-object-as-default-parameter": "off", // 1
  "unicorn/no-unreadable-array-destructuring": "off", // 1
  "unicorn/prefer-code-point": "off", // 1
} as const;

/**
 * Ultracite's presets plus the project's own rules. Type-aware, so oxlint
 * runs oxlint-tsgolint, which the promise rules need.
 */
export default defineConfig({
  extends: [core, react, next],
  options: { typeAware: true },
  ignorePatterns: [...core.ignorePatterns, "out/**"],
  // @shadcn/lint with the three rules Heystol chose.
  jsPlugins: [{ name: "shadcn", specifier: "@shadcn/lint" }],
  rules: {
    ...NEVER,
    ...LATER,
    "shadcn/no-arbitrary-values": [
      "error",
      {
        // Colour only: an arbitrary colour is a token the theme lacks.
        allow: [
          "layout",
          "typography",
          "spacing",
          "shape",
          "effects",
          "motion",
          "mask-*",
        ],
      },
    ],
    "shadcn/no-raw-colors": "error",
    // The React Compiler wins where rules disagree. It cannot compile `??=`
    // ("react/todo"), so the guarded assignment it wants instead is allowed.
    "typescript/prefer-nullish-coalescing": [
      "error",
      { ignoreIfStatements: true },
    ],
    "shadcn/no-unknown-classes": [
      "error",
      { allow: ["iso-plane", "iso-block", "iso-card", "cn-*"] },
    ],
  },
  overrides: [
    {
      files: ["src/**", "test/**", "examples/**"],
      rules: LATER_IN_CLI,
    },
    {
      // node:test's test() returns a promise the runner awaits itself.
      files: ["**/*.test.ts"],
      rules: { "typescript/no-floating-promises": "off" },
    },
    {
      // Vendored: the shadcn CLI writes these and rewrites them on the next
      // add, so a hand fix disappears.
      files: ["web/src/components/ui/**"],
      rules: {
        "eslint/no-shadow": "off",
        "react/button-has-type": "off",
        "shadcn/no-arbitrary-values": "off",
        "typescript/consistent-type-definitions": "off",
      },
    },
    {
      // Satori draws these images without the stylesheet, so colours are literal.
      files: ["web/src/app/opengraph-image.tsx", "web/src/app/apple-icon.tsx"],
      rules: { "shadcn/no-raw-colors": "off" },
    },
    {
      // The app the hero records wears its own light colours, not ours.
      files: ["web/src/components/landing/hero-stage.tsx"],
      rules: {
        "shadcn/no-arbitrary-values": "off",
        "shadcn/no-raw-colors": "off",
      },
    },
  ],
});
