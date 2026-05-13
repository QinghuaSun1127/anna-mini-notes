const TOOL_ID = "tool-test-mini-notes-12345678";
const TOOL_METHOD = "summarize";

const els = {
  input: document.querySelector("#note-input"),
  save: document.querySelector("#save-note"),
  summarize: document.querySelector("#summarize-notes"),
  list: document.querySelector("#note-list"),
  count: document.querySelector("#note-count"),
  hint: document.querySelector("#input-hint"),
  summary: document.querySelector("#summary-output"),
  connection: document.querySelector("#connection-label"),
};

let anna = null;
let notes = [];
let nextOrder = 1;

async function init() {
  bindEvents();
  render();

  try {
    if (typeof AnnaAppRuntime === "undefined") {
      throw new Error("AnnaAppRuntime SDK is not available");
    }
    anna = await AnnaAppRuntime.connect();
    els.connection.textContent = "Connected to Anna runtime";
    await anna.window.set_title({ title: "Mini Notes" }).catch(() => {});
  } catch (error) {
    anna = createPreviewRuntime();
    els.connection.textContent = "Standalone preview";
    console.warn("[mini-notes] using preview runtime:", error?.message || error);
  }
}

function bindEvents() {
  els.input.addEventListener("input", () => {
    els.hint.textContent = `${els.input.value.length} / 240`;
  });

  els.input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      saveNote();
    }
  });

  els.save.addEventListener("click", saveNote);
  els.summarize.addEventListener("click", summarizeNotes);
}

function saveNote() {
  const content = els.input.value.trim();
  if (!content) {
    els.input.focus();
    return;
  }

  notes.push({
    order: nextOrder,
    content,
    created_at: new Date().toISOString(),
  });
  nextOrder += 1;
  els.input.value = "";
  els.hint.textContent = "0 / 240";
  els.summary.textContent = "笔记已更新，点击 Summarize 生成最新总结。";
  render();
  els.input.focus();
}

async function summarizeNotes() {
  setBusy(true);
  try {
    const result = await anna.tools.invoke({
      tool_id: TOOL_ID,
      method: TOOL_METHOD,
      args: { notes },
    });
    const payload = unwrapInvokeResult(result);
    els.summary.textContent = payload.summary || "暂无可总结的笔记。";
  } catch (error) {
    els.summary.textContent = `Summarize failed: ${error?.message || error}`;
  } finally {
    setBusy(false);
  }
}

function unwrapInvokeResult(result) {
  if (result?.success === false) {
    throw new Error(result.error || "tool returned an error");
  }
  if (result?.success === true && result.data) {
    return result.data;
  }
  return result || {};
}

function render() {
  els.count.textContent = `${notes.length} note${notes.length === 1 ? "" : "s"}`;
  els.summarize.disabled = notes.length === 0;
  els.list.innerHTML = "";

  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No notes yet.";
    els.list.appendChild(empty);
    return;
  }

  for (const note of notes) {
    const item = document.createElement("li");
    item.className = "note-item";

    const body = document.createElement("div");
    const content = document.createElement("div");
    content.className = "note-content";
    content.textContent = note.content;
    const meta = document.createElement("div");
    meta.className = "note-meta";
    meta.textContent = `#${note.order} · ${formatTime(note.created_at)}`;
    body.append(content, meta);

    const remove = document.createElement("button");
    remove.className = "delete-note";
    remove.type = "button";
    remove.title = "Delete note";
    remove.setAttribute("aria-label", `Delete note ${note.order}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      notes = notes.filter((candidate) => candidate.order !== note.order);
      els.summary.textContent = "笔记已删除，点击 Summarize 生成最新总结。";
      render();
    });

    item.append(body, remove);
    els.list.appendChild(item);
  }
}

function setBusy(isBusy) {
  els.summarize.disabled = isBusy || notes.length === 0;
  els.summarize.textContent = isBusy ? "Summarizing..." : "Summarize";
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function createPreviewRuntime() {
  return {
    tools: {
      async invoke({ args }) {
        return localRuleSummary(args?.notes || []);
      },
    },
    window: {
      async set_title() {},
    },
  };
}

function localRuleSummary(currentNotes) {
  const count = currentNotes.length;
  if (!count) return { summary: "暂无笔记可总结。" };

  const categories = classify(currentNotes.map((note) => note.content).join(" "));
  const categoryText = categories.length ? `，主要集中在${joinChinese(categories)}` : "";
  return {
    summary: `当前共有 ${count} 条笔记${categoryText}。`,
  };
}

function classify(text) {
  const groups = [
    { label: "开发修复", words: ["bug", "fix", "修复", "登录", "代码", "开发"] },
    { label: "客户跟进", words: ["客户", "follow", "跟进", "会议"] },
    { label: "内容准备", words: ["workshop", "提纲", "内容", "准备", "想法"] },
    { label: "协作事项", words: ["设计", "需求", "协作", "review"] },
  ];
  const lower = text.toLowerCase();
  return groups
    .filter((group) => group.words.some((word) => lower.includes(word.toLowerCase())))
    .map((group) => group.label);
}

function joinChinese(items) {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]}和${items[1]}`;
  return `${items.slice(0, -1).join("、")}和${items.at(-1)}`;
}

document.addEventListener("DOMContentLoaded", init);
