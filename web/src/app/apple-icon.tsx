import { ImageResponse } from "next/og";

// Rendered once at build time.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000000",
      }}
    >
      <svg width="82" height="120" viewBox="-0.4 -0.4 14.6 21.4">
        <path
          d="M1 1V17L5 13.2L7.8 19.6L10.2 18.6L7.5 12.3H12.8Z"
          fill="#ffffff"
          stroke="#6c5ce7"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </div>,
    size
  );
}
