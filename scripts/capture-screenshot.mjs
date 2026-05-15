import { chromium } from "playwright";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const appUrl = new URL("../bundle/index.html", import.meta.url).href;
const output = resolve(root, "assets/screenshot-1.png");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1264, height: 940 }, deviceScaleFactor: 1 });

await page.addInitScript(() => {
  window.AnnaAppRuntime = {
    async connect() {
      return {
        tools: {
          async invoke(request) {
            const notes = request.args.notes || [];
            return {
              success: true,
              data: {
                summary: `当前共有 ${notes.length} 条笔记，主要集中在开发修复、内容准备和协作事项。`,
                count: notes.length,
                categories: ["开发修复", "内容准备", "协作事项"],
                tags: ["work", "demo", "dev"],
                highlights: notes.map((note) => note.content).slice(0, 3),
                action_items: [
                  "处理开发修复事项：修复登录 bug",
                  "确认协作细节：跟设计沟通需求",
                  "推进内容准备：准备 workshop 提纲",
                ],
                suggested_next_step: "建议先处理开发修复类笔记，再补充沟通和内容准备事项。",
                orders: notes.map((note) => note.order),
              },
            };
          },
        },
        window: {
          async set_title() {},
        },
      };
    },
  };
});

await page.goto(appUrl);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByLabel("New note").fill("修复登录 bug 并确认回归测试");
await page.locator("#tag-input").fill("dev, work");
await page.getByRole("button", { name: "Save" }).click();
await page.getByLabel("New note").fill("跟设计沟通需求和交互细节");
await page.locator("#tag-input").fill("design, work");
await page.getByRole("button", { name: "Save" }).click();
await page.getByLabel("New note").fill("准备 workshop 提纲和 demo flow");
await page.locator("#tag-input").fill("demo, content");
await page.getByRole("button", { name: "Save" }).click();
await page.getByRole("button", { name: "Summarize" }).click();
await page.getByText("Summarized 3 visible notes").waitFor();

await page.screenshot({ path: output });
await browser.close();
