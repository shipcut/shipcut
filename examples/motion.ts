// Every frame of this page differs, for 10 s: the worst case for the recorder,
// and the page `shipcut measure` judges its frame rate on.
import type { Scenario } from "../src/run.ts";
const PAGE = `<body style="margin:0;background:#000;color:#fff;font:600 40px system-ui"><div id=c>0</div>
<div id=b style="width:60px;height:60px;background:#fff"></div><p style="font-size:14px">${"The quick brown fox jumps over the lazy dog. ".repeat(40)}</p>
<script>let i=0;const f=(t)=>{c.textContent=++i;b.style.transform='translateX('+(t/10%300)+'px)';requestAnimationFrame(f)};requestAnimationFrame(f)</script>`;
const scenario: Scenario = async ({ page, step }) => {
  step("Motion");
  await page.setContent(PAGE);
  await page.waitForTimeout(10_000);
  console.error(`rAF ticks: ${await page.locator("#c").textContent()}`);
};
export default scenario;
