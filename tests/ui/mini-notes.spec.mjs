import { expect, test } from "@playwright/test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP_URL = new URL("../../bundle/index.html", import.meta.url).href;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__miniNotesInvokes = [];
    window.AnnaAppRuntime = {
      async connect() {
        return {
          tools: {
            async invoke(request) {
              const notes = request.args.notes || [];
              window.__miniNotesInvokes.push(notes);
              return {
                success: true,
                data: {
                  summary: `Mock summary for ${notes.length} note${notes.length === 1 ? "" : "s"}.`,
                  count: notes.length,
                  categories: notes.some((note) => note.content.includes("bug")) ? ["开发修复"] : [],
                  tags: [...new Set(notes.flatMap((note) => note.tags || []))],
                  highlights: notes.map((note) => note.content).slice(0, 3),
                  action_items: notes.map((note) => `Review: ${note.content}`).slice(0, 4),
                  suggested_next_step: "Mock next step.",
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

  await page.goto(APP_URL);
  await expect(page.locator("#connection-label")).toHaveText("Connected to Anna runtime");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("adds tagged notes, filters them, and summarizes visible or all notes", async ({ page }) => {
  await addNote(page, "review Anna demo flow", "demo, review");
  await addNote(page, "fix login bug", "dev, bug");

  await expect(page.locator("#note-count")).toHaveText("2 notes");
  await page.getByPlaceholder("Search notes or tags").fill("demo");
  await expect(page.locator("#note-count")).toHaveText("1 of 2 notes");
  await expect(page.getByText("review Anna demo flow")).toBeVisible();
  await expect(page.getByText("fix login bug")).toBeHidden();

  await page.locator("#summary-scope").selectOption("visible");
  await page.getByRole("button", { name: "Summarize" }).click();
  await expect(page.getByText("Summarized 1 visible note")).toBeVisible();
  await expect(page.getByText("Mock summary for 1 note.")).toBeVisible();

  await page.locator("#summary-scope").selectOption("all");
  await page.getByRole("button", { name: "Summarize" }).click();
  await expect(page.getByText("Summarized 2 all notes")).toBeVisible();
  await expect(page.getByText("Mock summary for 2 notes.")).toBeVisible();

  const invokedSizes = await page.evaluate(() => window.__miniNotesInvokes.map((notes) => notes.length));
  expect(invokedSizes).toEqual([1, 2]);

  await page.getByRole("button", { name: "Copy" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
});

test("persists notes, supports delete undo, imports markdown, and exports markdown", async ({ page }) => {
  await addNote(page, "persisted note", "keep");
  await page.reload();
  await expect(page.getByText("persisted note")).toBeVisible();

  await page.locator(".delete-note").click();
  await expect(page.getByText("Note deleted.")).toBeVisible();
  await expect(page.locator("#note-count")).toHaveText("0 notes");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("#note-count")).toHaveText("1 note");
  await expect(page.getByText("persisted note")).toBeVisible();

  const markdownPath = await createImportFile();
  await page.locator("#import-file").setInputFiles(markdownPath);
  await expect(page.getByText("已导入 2 条笔记。")).toBeVisible();
  await expect(page.getByText("imported first note")).toBeVisible();
  await expect(page.getByText("#imported")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^mini-notes-\d{4}-\d{2}-\d{2}\.md$/);
});

async function addNote(page, content, tags = "") {
  await page.getByLabel("New note").fill(content);
  await page.locator("#tag-input").fill(tags);
  await page.getByRole("button", { name: "Save" }).click();
}

async function createImportFile() {
  const dir = await mkdtemp(join(tmpdir(), "mini-notes-"));
  const file = join(dir, "import.md");
  await writeFile(
    file,
    `# Mini Notes Export

## Notes

### Note 1

imported first note

Tags: #imported #work

### Note 2

imported second note
`,
    "utf-8",
  );
  return file;
}
