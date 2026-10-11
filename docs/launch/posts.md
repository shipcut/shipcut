# Публикации запуска, этап 2

Черновики к срезу 3 из `docs/prd/02-demand.md`. Тексты постов по-английски,
заметки для Романа по-русски. Каждая цифра в постах взята из "Итога"
`docs/prd/01-picture.md` или `docs/prd/02-demand.md`; новых не добавлять.

- `{LANDING_URL}` станет `https://shipcut.dev`. Каждая ссылка несет свой
  `utm_source`: `x`, `threads`, `ih`, `reddit`, `playwright`.
- Репозиторий `https://github.com/shipcut/shipcut` открывается в день первого
  поста. Почта для связи `hello@shipcut.dev`.
- Ролики по именам. Это файлы из таблицы "Ролики, 2026-10-08", выложенные в
  R2, так что их можно скачать на телефон и загрузить в пост:
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
- Последняя строка каждого поста, кроме вопроса в r/SaaS, это
  `want to run it on your app? reply`. Сигнал считается по ответам на нее.
  Где ссылка допустима в теле поста, за ней идет `or clone it:` со ссылкой
  на репозиторий: клоны видны в GitHub Insights и тоже считаются.
- X режет охват постам со ссылкой в теле (разведка рынка, 2026-10-09),
  поэтому в постах X ссылок нет: лендинг и репозиторий идут первым ответом к
  каждому посту, см. "Первый ответ". В Threads те же две строки можно
  оставить в теле поста.
- Посты от первого лица Романа, с личных X и Threads.

## Проверить один раз, до первого поста

На 2026-10-09 сделаны первые два пункта, остальные за Романом.

- Лендинг открывается по домену, ролик играет на телефоне и на десктопе.
  Сделано 2026-10-09, проверено в headless Chromium.
- Тестовое письмо из формы списка ожидания дошло, и письмо снаружи на
  `hello@shipcut.dev` тоже: адрес стоит в ответе "как поставить". Сделано
  2026-10-09.
- Визит виден в Vercel Web Analytics. Тариф Pro не показывает `utm_source`,
  для этого нужен аддон Web Analytics Plus за 10 USD в месяц. Поэтому лендинг сам шлет
  custom event `Visit` со свойством `source`, когда в адресе есть
  `utm_source`, и `Waitlist` с тем же `source` после записи. Источники
  смотреть в Analytics, вкладка Events.
- Репозиторий открыт, у него есть лицензия, README ставит CLI без локальных
  путей (`heavy`, `~/.local/bin`). Пост в Indie Hackers называет CLI open
  source, а без лицензии это неправда.
- Чек-лист Романа из среза 6 этапа 1 заполнен: четыре ролика играют в Safari,
  X и Threads, подписи читаются на телефоне, почта и телефон не читаются.

## План

Четыре места раз в два дня, как в PRD, затем остальные три поста в X. Даты
это предложение, двигать можно.

| Дата           | Где                         | Ролик      |
| -------------- | --------------------------- | ---------- |
| 2026-10-14, ср | X и Threads, пост 1, запуск | booking    |
| 2026-10-16, пт | Indie Hackers               | booking    |
| 2026-10-18, вс | r/SaaS                      | без ролика |
| 2026-10-20, вт | Сообщество Playwright       | events     |
| 2026-10-22, чт | X и Threads, пост 2         | board      |
| 2026-10-24, сб | X и Threads, пост 3         | events     |
| 2026-10-26, пн | X и Threads, пост 4         | setup      |

Окно 14 дней кончается 2026-10-28. Посты 2-4 можно вставить и в промежутки
первой недели, если ответов на первые места мало.

## X и Threads

Проверить в день публикации:

- Принимает ли X H.264 level 5.0 для 1920x1200. Если нет,
  `shipcut clip --width 1728` (1728x1080, level 4).
- Ссылки в X только в первом ответе, см. ниже. Первый ответ публикуется
  сразу за постом, пока он не набрал показов.
- Threads получает тот же текст в тот же день, со `utm_source=threads`.
  Ролик загружается без звука и играет.
- Прочитать последние посты в ленте, чтобы попасть в тон.

Пост 1 запускает проект. К его первому ответу хорошо встает картинка
фрагмента `booking.ts`, того же, что на лендинге: сценарий в кадре и есть
отличие от агента по промпту.

### Пост 1, запуск, booking

```
shipcut is open source today. This demo of my booking app is a Playwright script in the repo. My coding agent wrote it, I reviewed it like any PR, and when the UI changes I re-run it. A re-render on every deploy is next.
want to run it on your app? reply
```

### Пост 2, board

```
The owner's side of my booking app. Drag a booking to an earlier slot, mark the guests arrived. shipcut draws the pointer, clicks and zoom after capture, so they stay smooth however slowly the page paints.
want to run it on your app? reply
```

### Пост 3, events

```
Two people in one demo. The owner creates an event and copies its link, a guest opens it and books a seat. shipcut records it from one Playwright script in one browser window. When the UI changes, I re-run it.
want to run it on your app? reply
```

### Пост 4, setup

```
A venue's first launch, from setup to its booking page. On my 4-vCPU server with no GPU, a screencast of this app got 2-4 fps. shipcut renders it frame by frame on a virtual clock and keeps every animation frame.
want to run it on your app? reply
```

### Первый ответ, под каждым постом в X

Та же пара строк под каждым из четырех постов, под постом 1 с картинкой
`booking.ts`. В Threads эти две строки идут в теле поста перед последней.

```
The script and the CLI: {LANDING_URL}?utm_source=x
or clone it: https://github.com/shipcut/shipcut
```

## Indie Hackers

Проверить в день публикации: текущие правила о продуктах и ссылках, и
последние посты в выбранной группе. Если ссылки в теле поста запрещены или
режутся, ссылку на лендинг дать в первом комментарии.

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

What doesn't exist yet: a re-render on every deploy from CI, a stable link and a player that update with it, run history. That's what I'm deciding whether to build. The CLI is open source: https://github.com/shipcut/shipcut. Linux, so a CI runner; on a Mac it records in real time.

The video above is a guest booking a table. The script that made it is on the landing page: {LANDING_URL}?utm_source=ih

want to run it on your app? reply, or clone it: https://github.com/shipcut/shipcut
```

## r/SaaS

Проверить в день публикации: правила сабреддита о самопродвижении и ссылках,
минимальная карма аккаунта, обязательный flair, последние посты с похожими
вопросами.

Это вопрос, не запуск. В посте нет ссылки, имени продукта и ролика. Вопрос
"want to run it on your app? reply" стоит в комментарии со ссылкой, а не в
посте: в посте он сделал бы из вопроса рекламу. Комментарий только по
просьбе, в ответ тому, кто спросил.

### Заголовок

```
How do you keep your demo video current after UI changes?
```

### Текст

```
Every UI change makes a product demo video a little more wrong: a renamed button, a screen that moved, a step that's gone. Re-recording by hand after every release is a chore, so in practice the video falls behind.

For my own app, the demo is now a Playwright script in the repo. My coding agent writes it from the app's source, I review it like any PR, and when the UI changes I re-run it. A second pass draws the pointer, zoom and chapter labels on top, so it doesn't look like a test recording. It works for one app and one person. I don't know yet if it holds up for a team.

How do you handle it? Re-record every release, leave the old video up, switch to screenshots or GIFs, something automated? And what finally makes you update it?
```

### Комментарий, когда спросят

```
It's called shipcut: {LANDING_URL}?utm_source=reddit

Today it's an open-source CLI. The script lives in your repo. shipcut renders every frame on a virtual clock, so the video is smooth even on a slow machine, then draws the pointer and zoom on top. A re-render on every deploy and a stable link are next.

want to run it on your app? reply, or clone it: https://github.com/shipcut/shipcut
```

## Сообщество Playwright

Проверить в день публикации: какой канал Discord или GitHub Discussions
допускает показ проектов, и последние посты в нем. В Discord сообщение
ограничено 2000 знаками (проверить), поэтому есть короткая версия; полная
подходит для Discussions.

Ролик events: на нем нашлась находка про сеть, форма события после сохранения
приходила пустой. Первым спросят "где репо", ответ уже в тексте.

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

puppeteer-capture and HeyGen's HyperFrames take the same approach; I didn't find one ready for Playwright. Mine is `frameByFrame` in `src/run.ts`: https://github.com/shipcut/shipcut

want to run it on your app? reply
```

### Короткая версия для Discord

```
Frame-by-frame video of a Playwright page, on a virtual clock.

On a 4-vCPU VPS with no GPU, a screencast of my app got 2-4 frames a second, and a 0.4 s pointer glide came out as 2 frames. So I render instead. I create the page with `Target.createTarget({ enableBeginFrameControl: true })` and let Playwright adopt it, `Emulation.setVirtualTimePolicy` moves the clock 1/30 s per frame, and `HeadlessExperimental.beginFrame` takes each screenshot. 10 s of video gets all 300 rAF ticks, and recording takes about 3x real time. It needs the headless shell, on Linux or Windows.

One thing I didn't expect. After a `beginFrame` with a screenshot, Chromium delivers no network response until the next `beginFrame`. With `pauseIfNetworkFetchesPending` that deadlocks, and every `fetch()` held the clock 5 s though the server answered in 0.3 s. The fix is a second `beginFrame` after each screenshot frame, with `noDisplayUpdates: true` and stamped 0.001 ms later. Now a request costs 10 ms of page time. The price is that rAF runs twice per frame.

Code: `frameByFrame` in `src/run.ts`, https://github.com/shipcut/shipcut
Details: {LANDING_URL}?utm_source=playwright

want to run it on your app? reply
```

## Готовые ответы

На частые вопросы, чтобы отвечать в течение дня одинаково. Каждый человек,
который спросил "как поставить", идет в таблицу "Итога" сильным сигналом.

**Как поставить.**

```
Linux or a CI runner. It's a CLI for now: npm install -g shipcut, then npx playwright@1.63 install chromium. You also need ffmpeg built with librsvg. Point your coding agent at the skill in the package (skills/shipcut/SKILL.md) and it writes the first script from your app's source. Stuck? Reply here or write to hello@shipcut.dev. No account, no bucket needed for a local video.
```

Windows здесь не назван: `PRODUCT.md` говорит, что покадровый рендер на нем
работает, но CLI целиком на Windows не проверялся. Добавить, если README к
запуску скажет иначе.

**"AutoDemo (demowright) already does this."**

```
They do the script-in-the-repo part, yes. As far as I can tell they record in real time, so on a slow runner the animations come out choppy. shipcut draws every frame on a virtual clock and adds the pointer, zoom and frame after capture. Your coding agent writes the script in TypeScript from the skill. A stable link and a player that update on deploy are next.
```

PRD советует показывать это роликом рядом с их роликом, а не словами. Если
ответ не убедил, это тоже строка в таблице.

**"Does it work on a Mac?"**

```
Recording works, frame-by-frame doesn't. Chrome on macOS doesn't let you drive frames, so on a Mac it records in real time and comes out less smooth. Run it in CI or in a Linux container for the smooth version.
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
No voice-over and no music, on purpose. These videos play where sound is off by default: a feed, a PR, a changelog. The step labels say what a voice would. If a voice track is the thing you need, say so; it isn't on the list yet.
```

**"How is this different from ScreenCI / Argo / Screenwright?"**

```
Same shape: a script in the repo, a video out. Two differences I can back. As far as I can tell they capture in real time, so on a slow runner the video is as choppy as the page painted; shipcut renders each frame on a virtual clock and gets every animation frame on 4 vCPUs with no GPU. And the pointer, zoom and labels are drawn after capture from the event log, so changing them is a flag, not a re-run. ScreenCI hosts the result with a stable link and re-records from CI; shipcut puts the files in your own R2 bucket, and the hosted link and the CI step are what I'm deciding whether to build. If you want hosting today, ScreenCI has it.
```

**"What happens when a selector breaks?"**

```
The run fails: exit 1 and a failed.png of the page at the moment the selector didn't match. Nothing gets published from a broken run. The scenario lives next to the code, so it changes in the same PR as the UI, by the same agent, and getByRole locators survive most markup changes.
```

**"R2 lock-in?"**

```
Only publish touches R2. run, polish and clip write plain mp4 and png to a folder on disk, and you can put those anywhere. publish signs its own S3 requests to your bucket, no SDK, no account with me, and the files stay yours. A hosted link is coming for people who don't want a bucket at all.
```

## Что изменили решения Романа

Открытые вопросы 2 и 4 решены 2026-10-08: репозиторий открывается в день
первого поста, посты идут с личных аккаунтов. Поэтому ссылка на репо стоит в
тексте без оговорок, а ответ "как поставить" ведет в README. Вопросы 3 и 5
текстов не меняют.
