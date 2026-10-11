import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

// Satori reads no woff2, so it takes the static Satoshi TTFs that
// scripts/satoshi.ts fetches next to the site's variable font.

export const alt = "shipcut: demo videos of your app, every frame, even on CI.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#000000";
const PAPER = "#ffffff";
const VIOLET = "#6c5ce7";
const HAZE = "#a49fc0";
const LAVENDER = "#e4ddff";
// The recorded app's own light colours, as in the hero.
const APP_TEXT = "#16131f";
const APP_MUTED = "#77738a";
const APP_TRACK = "#f0eef7";
const APP_EDGE = "#e7e4f2";

const POINTER = "M1 1V17L5 13.2L7.8 19.6L10.2 18.6L7.5 12.3H12.8Z";
// Satori has no text-wrap: balance.
const HEADLINE = ["Demo videos", "of your app,", "every frame,", "even on CI."];

const fonts = await Promise.all(
  (
    [
      ["Satoshi-Medium.ttf", 500],
      ["Satoshi-Bold.ttf", 700],
      ["Satoshi-Black.ttf", 900],
    ] as const
  ).map(async ([file, weight]) => ({
    name: "Satoshi",
    data: await readFile(join(process.cwd(), "src/fonts", file)),
    weight,
    style: "normal" as const,
  }))
);

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: INK,
        color: PAPER,
        fontFamily: "Satoshi",
        padding: "64px 72px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 620,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="26" height="36" viewBox="0 0 16 22">
              <path
                d={POINTER}
                fill={PAPER}
                stroke={VIOLET}
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
              shipcut
            </span>
          </div>
          <span style={{ fontSize: 26, fontWeight: 500, color: HAZE }}>
            Open-source CLI for Playwright
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 78,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: -2.7,
          }}
        >
          {HEADLINE.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <div style={{ fontSize: 26, fontWeight: 500, color: HAZE }}>
          shipcut.dev
        </div>
      </div>
      <Card />
    </div>,
    { ...size, fonts }
  );
}

function Card() {
  return (
    <div
      style={{
        position: "absolute",
        left: 760,
        top: 96,
        width: 420,
        display: "flex",
        flexDirection: "column",
        background: PAPER,
        color: APP_TEXT,
        borderRadius: 32,
        padding: 34,
        fontSize: 22,
        fontWeight: 500,
        boxShadow: "0 30px 80px -20px rgba(108, 92, 231, 0.6)",
      }}
    >
      <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.6 }}>
        New project
      </span>
      <span style={{ marginTop: 22, fontSize: 18, color: APP_MUTED }}>
        Name
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 8,
          height: 54,
          padding: "0 18px",
          borderRadius: 14,
          border: `1.5px solid ${APP_EDGE}`,
          fontWeight: 700,
        }}
      >
        acme-web
      </div>
      <span style={{ marginTop: 18, fontSize: 18, color: APP_MUTED }}>
        Region
      </span>
      <div
        style={{
          display: "flex",
          marginTop: 8,
          padding: 5,
          borderRadius: 14,
          background: APP_TRACK,
        }}
      >
        <span
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            padding: "9px 0",
          }}
        >
          Virginia
        </span>
        <span
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            padding: "9px 0",
            borderRadius: 10,
            background: PAPER,
            fontWeight: 700,
          }}
        >
          Frankfurt
        </span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 22,
        }}
      >
        <span>Preview deploys</span>
        <span
          style={{
            display: "flex",
            width: 58,
            height: 34,
            padding: 4,
            borderRadius: 17,
            background: VIOLET,
            justifyContent: "flex-end",
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              background: PAPER,
            }}
          />
        </span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginTop: 26,
          height: 58,
          borderRadius: 14,
          background: VIOLET,
          color: PAPER,
          fontWeight: 700,
        }}
      >
        Create project
      </div>
      <Pointer />
    </div>
  );
}

function Pointer() {
  return (
    <div
      style={{
        position: "absolute",
        left: 356,
        top: 380,
        display: "flex",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -26,
          top: -26,
          width: 52,
          height: 52,
          borderRadius: 26,
          // Lavender, not the video's violet, which would vanish on the button.
          border: `5px solid ${LAVENDER}`,
          opacity: 0.8,
        }}
      />
      <svg width="28" height="38" viewBox="0 0 16 22">
        <path
          d={POINTER}
          fill={INK}
          stroke={PAPER}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
      <span
        style={{
          position: "absolute",
          right: 10,
          top: 34,
          padding: "8px 18px",
          borderRadius: 999,
          background: VIOLET,
          color: PAPER,
          fontSize: 22,
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        Create project
      </span>
    </div>
  );
}
