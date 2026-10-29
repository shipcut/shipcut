// The stored data. A web UI reads these shapes straight from the bucket, so a change
// here is a change to every manifest already published.

export interface RunFile {
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
}

/**
 * `caption: false` keeps it out of `shipcut caption`, `zoom: false` out of `polish --zoom`.
 * `say` is the line `shipcut narrate` speaks over the step.
 */
export interface Step {
  title: string;
  at: number;
  caption?: false;
  zoom?: false;
  say?: string;
}

/** `[ms, x, y]`: milliseconds from the start of the video and CSS pixels of the viewport. */
export type Point = [number, number, number];

export interface Events {
  clicks: Point[];
  moves: Point[];
}

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
  /** Under `--pointer`: the pointer's clicks and path, which `shipcut polish` draws. */
  events?: Events;
  /** The video's wall-clock length and how many repaints Chromium sent, for `shipcut measure`. */
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
export interface IndexEntry {
  id: string;
  title?: string;
  scenario: string;
  createdAt: string;
  manifest: string;
  /** The first image, for a thumbnail. */
  cover?: string;
  files: number;
}
