// The changelog's entries, newest first.

export interface Entry {
  id: string;
  /** ISO date the change landed on `main`. */
  date: string;
  title: string;
  text: string[];
  video: {
    src: string;
    /** A frame of the video itself, small, in web/public/changelog/. */
    poster: string;
    label: string;
  };
}

const MEDIA = "https://media.shipcut.dev/heystol";

export const ENTRIES: Entry[] = [
  {
    id: "publish-to-r2",
    date: "2026-10-09",
    title: "Publishing to Cloudflare R2",
    text: [
      "shipcut publish uploads a run's video, shots and manifest to a Cloudflare R2 bucket, through R2's S3 API with no SDK.",
      "Every video on this page plays from there.",
    ],
    video: {
      src: `${MEDIA}/20261008-092738-setup/video-polished-clip.mp4`,
      poster: "/changelog/setup.jpg",
      label: "Heystol: an owner sets up a new venue and opens its page.",
    },
  },
  {
    id: "requests-no-longer-stall",
    date: "2026-10-08",
    title: "Requests no longer stall a frame-by-frame recording",
    text: [
      "A page's fetch() used to hold the virtual clock for five seconds, and a form could come back empty. Now shipcut asks Chromium for an empty frame right after each one, and that lets the responses through.",
      "shipcut recorded this video right after the fix.",
    ],
    video: {
      src: `${MEDIA}/20261008-140834-events/video-polished-clip.mp4`,
      poster: "/changelog/events.jpg",
      label: "Heystol: an owner creates an event, and a guest books a seat.",
    },
  },
  {
    id: "polish",
    date: "2026-10-07",
    title: "A video that looks edited by hand",
    text: [
      "shipcut polish draws the pointer, a wave on each click, the step's title beside the pointer, a zoom towards the clicks and a rounded window on a background.",
      "All of it comes from the run's event log after capture, so it moves at 30 frames a second however slowly the page paints.",
    ],
    video: {
      src: `${MEDIA}/20261008-120850-booking/video-polished-clip.mp4`,
      poster: "/changelog/booking.jpg",
      label: "Heystol: a guest books a table.",
    },
  },
  {
    id: "frame-by-frame",
    date: "2026-10-07",
    title: "Every frame, on a virtual clock",
    text: [
      "shipcut run --frame-by-frame moves the page's clock 1/30 of a second per frame, so a machine with no GPU records every frame of every animation.",
      "It needs Chromium's headless shell. It is built and tested on Linux; Chrome on macOS cannot be driven frame by frame.",
    ],
    video: {
      src: `${MEDIA}/20261008-085616-board/video-polished-clip.mp4`,
      poster: "/changelog/board.jpg",
      label: "Heystol: an owner drags a booking to another time on the board.",
    },
  },
];
