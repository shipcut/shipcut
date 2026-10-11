# Посты о запуске

Черновики к срезу 4 из `docs/prd/02-launch.md`. shipcut выходит как открытый
бесплатный CLI, без сервиса и без обещаний на потом. Тексты постов
по-английски, заметки для Романа по-русски. Каждая цифра в постах взята из
"Итога" `docs/prd/01-picture.md` или `docs/prd/02-launch.md`; новых не
добавлять.

- Каждый пост говорит, что делает shipcut, дает `npm install -g shipcut` и
  ссылку на репозиторий `https://github.com/shipcut/shipcut`.
- Посты от первого лица Романа, с личных аккаунтов. Публикует Роман.
- Порядок: сначала X и Threads, потом Show HN, сообщество Playwright и
  Indie Hackers в любом порядке, по одному, чтобы успевать отвечать.
- Ролики по именам, из R2, их можно скачать на телефон и загрузить в пост:
  - booking, 18.00 с:
    https://media.shipcut.dev/heystol/20261008-120850-booking/video-polished-clip.mp4
  - board, 17.17 с:
    https://media.shipcut.dev/heystol/20261008-085616-board/video-polished-clip.mp4
  - events, 20.83 с:
    https://media.shipcut.dev/heystol/20261008-140834-events/video-polished-clip.mp4
  - setup, 23.40 с:
    https://media.shipcut.dev/heystol/20261008-092738-setup/video-polished-clip.mp4
  - booking в `story`, для Threads и сторис, 17.60 с:
    https://media.shipcut.dev/heystol/20261008-121515-booking/video-polished-clip.mp4

## До первого поста

- `shipcut@0.1.0` опубликован в npm, и `npm install -g shipcut` ставит
  рабочий CLI. Без этого строка установки в каждом посте неправда.
- README начинается с установки из npm.
- Ролики играют в Safari, X и Threads, подписи читаются на телефоне.

## X и Threads

Проверить в день публикации:

- Принимает ли X H.264 level 5.0 для 1920x1200. Если нет,
  `shipcut clip --width 1728` (1728x1080, level 4).
- X режет охват постам со ссылкой в теле, поэтому ссылка и команда идут
  первым ответом, сразу за постом. В Threads их можно оставить в теле.

### Пост 1, запуск, booking

```
shipcut is open source. It turns a Playwright script into a demo video like this one: every frame rendered on a virtual clock, so it's smooth even on a slow CI runner, with the pointer, zoom and labels drawn on top. My coding agent wrote the script from the app's source. When the UI changes, I re-run it.
```

Первый ответ, с картинкой фрагмента `booking.ts`:

```
npm install -g shipcut
https://github.com/shipcut/shipcut
```

### Пост 2, board

```
The owner's side of my booking app, recorded by shipcut. Drag a booking to an earlier slot, mark the guests arrived. The pointer, clicks and zoom are drawn after capture from an event log, so they stay smooth however slowly the page paints.
```

### Пост 3, events

```
Two people in one demo. The owner creates an event and copies its link, a guest opens it and books a seat. One Playwright script, one browser window, one shipcut run. When the UI changes, I re-run it.
```

### Пост 4, setup

```
A venue's first launch, from setup to its booking page. On my 4-vCPU server with no GPU, a screencast of this app got 2-4 fps. shipcut renders it frame by frame on a virtual clock and keeps every animation frame.
```

Под постами 2-4 тот же первый ответ, что под постом 1, без картинки.

## Show HN

Ссылка поста ведет на репозиторий. Текст идет первым комментарием автора.
Проверить в день публикации: текущие правила Show HN.

### Заголовок

```
Show HN: shipcut – demo videos from Playwright scripts, rendered frame by frame
```

### Первый комментарий

```
I build a booking app, and every UI change made its demo video a little more wrong. So the demo became a TypeScript file next to the app's code that drives the page through Playwright. My coding agent writes these from the app's source and a skill file in the repo, and I review them like any PR. When the UI changes, I re-run it.

Getting a video I'd want to post was the hard part. On my 4-vCPU server with no GPU, a screencast of the app got 2-4 frames a second, and Playwright's own video is a screencast too. So shipcut doesn't record in real time. Chromium draws each frame on a virtual clock that moves exactly 1/30 s per frame (HeadlessExperimental.beginFrame), so every animation frame lands in the video however slow the machine is. A second pass draws the pointer, a wave on each click, zoom toward the action, a window frame and chapter labels from the event log, so changing them doesn't need a new run. Emails and phone numbers get blurred in the page before a frame is taken.

Some numbers. On a test page that animates every frame, a real-time recording got 215 of 300 frames in 10 s; shipcut gets all 300. Two runs of the same script come out the same length, with clicks within a frame of each other. The cost is time: a 17 s video takes 54 s to record at 1280x800.

It's a CLI, MIT:

  npm install -g shipcut

It needs ffmpeg built with librsvg and Playwright's Chromium. Frame-by-frame works on Linux, so a CI runner works too; on a Mac it records in real time. Publishing goes to your own Cloudflare R2 bucket, if you want it at all; locally it's just mp4 and png in a folder.
```

## Сообщество Playwright

Проверить в день публикации: какой канал Discord или GitHub Discussions
допускает показ проектов. В Discord сообщение ограничено 2000 знаками
(проверить), поэтому есть короткая версия; полная подходит для Discussions.

Ролик events: на нем нашлась находка про сеть, форма события после сохранения
приходила пустой.

### Заголовок

```
Frame-by-frame video of a Playwright page with HeadlessExperimental.beginFrame
```

### Полная версия

```
I record demo videos of a web app with Playwright, and on a 4-vCPU VPS with no GPU they stuttered. A screencast gets a frame only when Chromium paints. That's CDP `Page.startScreencast`, and Playwright's `recordVideo` uses it too in Chromium, as does the newer `page.screencast`, whatever `fps` you ask for. With software rasterization my app painted 2-4 times a second, and a 0.4 s pointer glide drawn by the page came out as 2 frames. A CI runner is about the same kind of machine.

So I stopped recording in real time and render frame by frame on a virtual clock:

1. `HeadlessExperimental.beginFrame` needs a target created with `enableBeginFrameControl`, and only `Target.createTarget` takes that flag. I create the page over a browser CDP session in the context's `browserContextId` and let Playwright adopt it (`context.waitForEvent("page")`). `goto`, clicks, waits, the keyboard, screenshots and the context's storage state all work. It needs Chromium's headless shell, which Playwright runs by default, on Linux or Windows; Chrome on macOS doesn't support it.
2. `Emulation.setVirtualTimePolicy({ policy: "pause" })` returns `virtualTimeTicksBase`. Before each frame: policy `pauseIfNetworkFetchesPending` with a budget of 1000/30 ms, wait for `Emulation.virtualTimeBudgetExpired`, then `beginFrame` with `frameTimeTicks = base + n * 1000/30` and a `screenshot`. When I stamped frames from my own clock instead, animations froze, and a popup stayed half-transparent.
3. The script's waits have to count frames. With the stock `waitForTimeout`, 6.9 s of script gave 2.5 s of video.

On a test page that animates every frame, 10 s of video now has all 300 `requestAnimationFrame` ticks; the screencast got 215. The cost is time: a 1280x800 frame takes 80-90 ms here, so recording runs about 3 times longer than the video.

Then the part I didn't expect. After a `beginFrame` that takes a screenshot, Chromium delivers no network response to the page until the next `beginFrame`. With `pauseIfNetworkFetchesPending` that's a deadlock. The next frame waits for the clock, the clock waits for the response, the response waits for a frame. Every `fetch()` held the clock until my 5 s timeout, though the server answered in 0.3 s. In my first recording of the video above, the event form came back empty after saving because of it.

The fix is a second `beginFrame` after every screenshot frame, with `noDisplayUpdates: true` and stamped 0.001 ms later. One stamped with the previous frame's time never completes. Responses go through, and a GET or POST costs 10 ms of page time instead of 5.5 s of waiting. Caveats:

- `requestAnimationFrame` now runs twice per frame. Animations that read the time are unchanged; ones that count calls run twice as fast.
- A streamed response read in chunks still held the clock in 1 of 9 runs. For those, and for SSE or long polls, the clock runs past pending requests after 5 s of real time, and the request gets named in the log.
- Sending the empty frame only while a request was pending was worse: in 2 of 4 runs that frame never completed.

puppeteer-capture and HeyGen's HyperFrames take the same approach; I didn't find one ready for Playwright, so it's an open source CLI now, MIT: `npm install -g shipcut`. The code is `frameByFrame` in `src/run.ts`: https://github.com/shipcut/shipcut
```

### Короткая версия для Discord

```
Frame-by-frame video of a Playwright page, on a virtual clock.

On a 4-vCPU VPS with no GPU, a screencast of my app got 2-4 frames a second, and a 0.4 s pointer glide came out as 2 frames. So I render instead. I create the page with `Target.createTarget({ enableBeginFrameControl: true })` and let Playwright adopt it, `Emulation.setVirtualTimePolicy` moves the clock 1/30 s per frame, and `HeadlessExperimental.beginFrame` takes each screenshot. 10 s of video gets all 300 rAF ticks, and recording takes about 3x real time. It needs the headless shell, on Linux or Windows.

One thing I didn't expect. After a `beginFrame` with a screenshot, Chromium delivers no network response until the next `beginFrame`. With `pauseIfNetworkFetchesPending` that deadlocks, and every `fetch()` held the clock 5 s though the server answered in 0.3 s. The fix is a second `beginFrame` after each screenshot frame, with `noDisplayUpdates: true` and stamped 0.001 ms later. Now a request costs 10 ms of page time. The price is that rAF runs twice per frame.

It's an open source CLI, MIT: `npm install -g shipcut`
Code: `frameByFrame` in `src/run.ts`, https://github.com/shipcut/shipcut
```

## Indie Hackers

Проверить в день публикации: текущие правила о продуктах и ссылках, и
последние посты в выбранной группе. Если ссылки в теле поста режутся, ссылку
дать в первом комментарии.

Ролик booking в начале поста.

### Заголовок

```
My demo video went stale with every UI change, so I turned it into a script
```

### Текст

```
I build Heystol, a booking app for small venues. Every UI change made the demo video a little more wrong, and re-recording it by hand after each release was never going to happen.

So the demo became a script. A TypeScript file next to the app's code drives the page through Playwright. It picks a day and a time, fills in the form, confirms. My coding agent writes these from the app's source and a skill file, and I review them like any PR. When the UI changes, I re-run the script and get a new video.

That part was easy. Getting a video I'd want to post was not. On my server, 4 shared vCPUs and no GPU, a screencast of the app got 2-4 frames a second. So shipcut doesn't record in real time. Chromium draws each frame on a virtual clock that moves exactly 1/30 s per frame, so every animation frame lands in the video however slow the machine is. A second pass draws what moves on top: the pointer, a wave on each click, zoom toward the action, a window frame, chapter labels. Emails and phone numbers get blurred in the page itself, before Chromium draws the frame.

Some numbers from that work.

- On a test page that animates every frame, a real-time recording let the page run 215 of 300 animation frames in 10 s. Now all 300 make it.
- 8 frames after a click, the real-time recording still didn't show the calendar popup. Now it's open on the 4th frame.
- The pointer used to jump, 2 frames per move. Now it moves at 30 fps.
- Two runs of the same booking script come out the same length, with chapters and clicks within a frame of each other.
- It costs time. A 17 s video takes 54 s to record at 1280x800.

It's free and open source, MIT. Install it with `npm install -g shipcut`; it needs ffmpeg built with librsvg and Playwright's Chromium. Frame-by-frame works on Linux, so a CI runner works too; on a Mac it records in real time. The code and the docs: https://github.com/shipcut/shipcut
```

## Готовые ответы

На частые вопросы, чтобы отвечать одинаково.

**Как поставить.**

```
npm install -g shipcut, then npx playwright@1.63 install chromium. You also need ffmpeg built with librsvg (Ubuntu's is). Point your coding agent at skills/shipcut/SKILL.md in the repo and it writes the first script from your app's source. No account, and no bucket needed for a local video. Stuck? Open an issue: https://github.com/shipcut/shipcut/issues
```

Минор Playwright в команде сверить с README из PR #1 в день публикации.

**"AutoDemo (demowright) already does this."**

```
They do the script-in-the-repo part, yes. As far as I can tell they record in real time, so on a slow runner the animations come out choppy. shipcut draws every frame on a virtual clock and adds the pointer, zoom and frame after capture. Your coding agent writes the script in TypeScript from the skill.
```

**"Does it work on a Mac?"**

```
Recording works, frame-by-frame doesn't. Chrome on macOS doesn't let you drive frames, so on a Mac it records in real time and comes out less smooth. Run it in CI or in a Linux container for the smooth version.
```

**"Windows?"**

```
Untested. The frame-by-frame part should work there, the rest nobody has tried yet. If you do, an issue with what broke helps.
```

**"How long does a recording take?"**

```
Longer than the video. A 17 s video takes 54 s to record at 1280x800 on 4 vCPUs, and 2 min 25 s at 2x for 1920x1200 output.
```

**"Why not Playwright's own video? It has 60 fps and a cursor now."**

```
It's still a screencast: a frame lands when Chromium paints, and on a slow runner the encoder repeats the last one, at 60 fps as much as at 30. On my 4 vCPUs with no GPU that's 2-4 real frames a second on a heavy page. shipcut asks Chromium for each frame on a virtual clock that moves 1/30 s a frame, so every animation frame is a real paint, and Playwright's waits keep working. If your runner paints fast enough, Playwright's video is fine. The pointer, zoom and labels are drawn after capture from the event log, so changing them is a flag, not a re-run.
```

**"No voice-over? Everyone else has TTS."**

```
No voice-over and no music, on purpose. These videos play where sound is off by default: a feed, a PR, a changelog. The step labels say what a voice would.
```

**"How is this different from ScreenCI / Argo / Screenwright?"**

```
Same shape: a script in the repo, a video out. Two differences I can back. As far as I can tell they capture in real time, so on a slow runner the video is as choppy as the page painted; shipcut renders each frame on a virtual clock and gets every animation frame on 4 vCPUs with no GPU. And the pointer, zoom and labels are drawn after capture from the event log, so changing them is a flag, not a re-run. If you want hosting with a stable link, ScreenCI has it; shipcut is a CLI and keeps the files on your disk or in your own bucket.
```

**"What happens when a selector breaks?"**

```
The run fails: exit 1 and a failed.png of the page at the moment the selector didn't match. Nothing gets published from a broken run. The scenario lives next to the code, so it changes in the same PR as the UI, by the same agent, and getByRole locators survive most markup changes.
```

**"Is there a paid version?"**

```
No. It's a CLI under MIT, and that's the whole product. Publishing goes to your own R2 bucket; run, polish and clip write plain mp4 and png to a folder, and you can put those anywhere.
```
