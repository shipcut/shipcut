// The stored data. A web UI reads these shapes straight from Blob, so a change
// here is a change to every manifest already published.

/** One file of a run, as measured on disk. */
export type RunFile = {
  /** File name inside the run, e.g. `01-landing.png`, `video.mp4`. */
  name: string;
  contentType: string;
  bytes: number;
  width?: number;
  height?: number;
  /** Seconds, for a video or a GIF. */
  duration?: number;
  /** Milliseconds from the start of the recording, for a shot. */
  at?: number;
};

/** A chapter a scenario marked with `step(title)`. `caption: false` keeps it out of `shots caption`. */
export type Step = { title: string; at: number; caption?: false };

/** `[ms, x, y]`: milliseconds from the start of the video and CSS pixels of the viewport. */
export type Point = [number, number, number];

/** What the pointer did under `--pointer`: where it pressed, and every point of its way there. */
export type Events = { clicks: Point[]; moves: Point[] };

/** `run.json`: what `shots run` writes next to the files. */
export interface Run {
  /** `YYYYMMDD-HHMMSS-<scenario>`, UTC, so ids sort by time. */
  id: string;
  scenario: string;
  base: string;
  /** CSS pixels, and the scale that multiplies them into the files' pixels. */
  viewport: { width: number; height: number; scale: number };
  /** Recorded as a phone: touch and the mobile viewport. */
  mobile?: boolean;
  preset?: string;
  locale?: string;
  dark: boolean;
  steps: Step[];
  files: RunFile[];
  /** Under `--pointer`: the pointer's clicks and path, which `shots polish` draws. */
  events?: Events;
  /** The video's wall-clock length and how many repaints Chromium sent, for `shots measure`. */
  recording?: { seconds: number; repaints: number };
  /** The caller's repository, when the run started inside one. */
  git?: { commit: string; branch: string; remote?: string };
  createdAt: string;
}

/** `<project>/<run-id>/manifest.json`: the run plus where it lives. */
export interface Manifest extends Omit<Run, "files"> {
  project: string;
  title?: string;
  files: (RunFile & { url: string })[];
}

/** One row of `<project>/index.json`, newest first. */
export type IndexEntry = {
  id: string;
  title?: string;
  scenario: string;
  createdAt: string;
  manifest: string;
  /** The first image, for a thumbnail. */
  cover?: string;
  files: number;
};
