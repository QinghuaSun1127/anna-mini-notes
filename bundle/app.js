const TOOL_ID = "tool-test-mini-notes-12345678";
const TOOL_METHOD = "summarize";
const STORAGE_KEY = "anna-mini-notes:v1";

const els = {
  input: document.querySelector("#note-input"),
  tagInput: document.querySelector("#tag-input"),
  save: document.querySelector("#save-note"),
  summarize: document.querySelector("#summarize-notes"),
  clear: document.querySelector("#clear-notes"),
  import: document.querySelector("#import-notes"),
  importFile: document.querySelector("#import-file"),
  export: document.querySelector("#export-notes"),
  copy: document.querySelector("#copy-summary"),
  scope: document.querySelector("#summary-scope"),
  search: document.querySelector("#note-search"),
  list: document.querySelector("#note-list"),
  count: document.querySelector("#note-count"),
  hint: document.querySelector("#input-hint"),
  summary: document.querySelector("#summary-output"),
  undoBar: document.querySelector("#undo-bar"),
  undoMessage: document.querySelector("#undo-message"),
  undoAction: document.querySelector("#undo-action"),
  connection: document.querySelector("#connection-label"),
};

let anna = null;
let notes = [];
let nextOrder = 1;
let editingOrder = null;
let searchTerm = "";
let lastSummaryText = "";
let undoSnapshot = null;

async function init() {
  loadNotes();
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
    anna = createUnavailableRuntime();
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
  els.clear.addEventListener("click", clearNotes);
  els.import.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", importMarkdown);
  els.export.addEventListener("click", exportMarkdown);
  els.copy.addEventListener("click", copySummary);
  els.scope.addEventListener("change", render);
  els.undoAction.addEventListener("click", restoreUndo);
  els.search.addEventListener("input", () => {
    searchTerm = els.search.value.trim().toLowerCase();
    editingOrder = null;
    render();
  });
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
    tags: parseTags(els.tagInput.value),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  nextOrder += 1;
  els.input.value = "";
  els.tagInput.value = "";
  els.hint.textContent = "0 / 240";
  clearUndo();
  persistNotes();
  setSummaryMessage("笔记已更新，点击 Summarize 生成最新总结。");
  render();
  els.input.focus();
}

async function summarizeNotes() {
  const targetNotes = getSummaryNotes();
  setBusy(true);
  try {
    const result = await anna.tools.invoke({
      tool_id: TOOL_ID,
      method: TOOL_METHOD,
      args: { notes: targetNotes },
    });
    const payload = unwrapInvokeResult(result);
    renderSummary(payload, getSummaryScopeLabel(targetNotes.length));
  } catch (error) {
    setSummaryMessage(`Summarize failed: ${error?.message || error}`);
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
  const visibleNotes = getVisibleNotes();
  const totalLabel = `${notes.length} note${notes.length === 1 ? "" : "s"}`;
  els.count.textContent = searchTerm ? `${visibleNotes.length} of ${totalLabel}` : totalLabel;
  els.summarize.disabled = getSummaryNotes().length === 0;
  els.export.disabled = visibleNotes.length === 0;
  els.clear.disabled = notes.length === 0;
  els.list.innerHTML = "";

  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No notes yet.";
    els.list.appendChild(empty);
    return;
  }

  if (visibleNotes.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No matching notes.";
    els.list.appendChild(empty);
    return;
  }

  for (const note of visibleNotes) {
    const item = document.createElement("li");
    item.className = "note-item";

    const body = document.createElement("div");
    const isEditing = editingOrder === note.order;
    let editInput = null;

    if (isEditing) {
      editInput = document.createElement("textarea");
      editInput.className = "edit-note-input";
      editInput.maxLength = 240;
      editInput.rows = 3;
      editInput.value = note.content;
      body.appendChild(editInput);

      const editTags = document.createElement("input");
      editTags.className = "edit-tags-input";
      editTags.type = "text";
      editTags.maxLength = 80;
      editTags.value = (note.tags || []).join(", ");
      body.appendChild(editTags);
    } else {
      const content = document.createElement("div");
      content.className = "note-content";
      content.textContent = note.content;
      body.appendChild(content);

      const tags = renderTagChips(note.tags || []);
      if (tags) {
        body.appendChild(tags);
      }
    }

    const meta = document.createElement("div");
    meta.className = "note-meta";
    meta.textContent = `#${note.order} · ${formatTime(note.updated_at || note.created_at)}`;
    body.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "note-actions";

    if (isEditing) {
      const saveEdit = document.createElement("button");
      saveEdit.className = "small-action primary-action";
      saveEdit.type = "button";
      saveEdit.textContent = "Save";
      saveEdit.addEventListener("click", () => {
        const editTags = item.querySelector(".edit-tags-input");
        saveEditedNote(note.order, editInput, editTags);
      });

      const cancel = document.createElement("button");
      cancel.className = "small-action";
      cancel.type = "button";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => {
        editingOrder = null;
        render();
      });

      actions.append(saveEdit, cancel);
    } else {
      const edit = document.createElement("button");
      edit.className = "small-action";
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => {
        editingOrder = note.order;
        render();
        requestAnimationFrame(() => {
          const input = els.list.querySelector(".edit-note-input");
          input?.focus();
          input?.setSelectionRange(input.value.length, input.value.length);
        });
      });

      actions.appendChild(edit);
    }

    const remove = document.createElement("button");
    remove.className = "delete-note";
    remove.type = "button";
    remove.title = "Delete note";
    remove.setAttribute("aria-label", `Delete note ${note.order}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      captureUndo("Note deleted.", notes, nextOrder);
      notes = notes.filter((candidate) => candidate.order !== note.order);
      editingOrder = editingOrder === note.order ? null : editingOrder;
      persistNotes();
      setSummaryMessage("笔记已删除，点击 Summarize 生成最新总结。");
      render();
    });

    actions.appendChild(remove);
    item.append(body, actions);
    els.list.appendChild(item);
  }
}

function saveEditedNote(order, input, tagInput) {
  const content = input.value.trim();
  if (!content) {
    input.focus();
    return;
  }

  const updatedAt = new Date().toISOString();
  notes = notes.map((note) => {
    if (note.order !== order) {
      return note;
    }
    return {
      ...note,
      content,
      tags: parseTags(tagInput?.value || ""),
      updated_at: updatedAt,
    };
  });
  editingOrder = null;
  clearUndo();
  persistNotes();
  setSummaryMessage("笔记已编辑，点击 Summarize 生成最新总结。");
  render();
}

function clearNotes() {
  if (notes.length === 0) {
    return;
  }
  if (!window.confirm("Clear all notes?")) {
    return;
  }

  captureUndo("All notes cleared.", notes, nextOrder);
  notes = [];
  nextOrder = 1;
  editingOrder = null;
  persistNotes();
  setSummaryMessage("所有笔记已清空。");
  render();
  els.input.focus();
}

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return;
    }
    notes = parsed
      .map((note, index) => ({
        order: Number.isFinite(Number(note.order)) ? Number(note.order) : index + 1,
        content: String(note.content || "").trim().slice(0, 240),
        tags: Array.isArray(note.tags) ? normalizeTags(note.tags) : [],
        created_at: note.created_at || new Date().toISOString(),
        updated_at: note.updated_at || note.created_at || new Date().toISOString(),
      }))
      .filter((note) => note.content);
    nextOrder = notes.reduce((max, note) => Math.max(max, note.order), 0) + 1;
  } catch (error) {
    console.warn("[mini-notes] failed to load saved notes:", error);
    notes = [];
    nextOrder = 1;
  }
}

function persistNotes() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    console.warn("[mini-notes] failed to persist notes:", error);
    setSummaryMessage("笔记已更新，但浏览器本地存储不可用。");
  }
}

function getVisibleNotes() {
  if (!searchTerm) {
    return notes;
  }
  return notes.filter((note) => noteMatchesSearch(note, searchTerm));
}

function getSummaryNotes() {
  return els.scope.value === "all" ? notes : getVisibleNotes();
}

function getSummaryScopeLabel(count) {
  const scope = els.scope.value === "all" ? "all" : "visible";
  return `${count} ${scope} note${count === 1 ? "" : "s"}`;
}

function noteMatchesSearch(note, term) {
  const haystack = [
    note.content,
    ...(note.tags || []),
  ].join(" ").toLowerCase();
  return haystack.includes(term);
}

function parseTags(value) {
  return normalizeTags(String(value || "").split(","));
}

function normalizeTags(values) {
  const seen = new Set();
  const tags = [];
  for (const value of values) {
    const tag = String(value || "").trim().replace(/^#/, "").slice(0, 24);
    if (!tag) {
      continue;
    }
    const key = tag.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    tags.push(tag);
  }
  return tags.slice(0, 6);
}

function renderTagChips(tags) {
  if (!tags.length) {
    return null;
  }
  const chips = document.createElement("div");
  chips.className = "note-tags";
  for (const tag of tags) {
    const chip = document.createElement("button");
    chip.className = "note-tag";
    chip.type = "button";
    chip.textContent = `#${tag}`;
    chip.addEventListener("click", () => {
      els.search.value = tag;
      searchTerm = tag.toLowerCase();
      render();
    });
    chips.appendChild(chip);
  }
  return chips;
}

function renderSummary(payload, scopeLabel) {
  els.summary.innerHTML = "";
  lastSummaryText = formatSummaryText(payload);
  els.copy.disabled = !lastSummaryText;

  if (scopeLabel) {
    const meta = document.createElement("div");
    meta.className = "summary-meta";
    meta.textContent = `Summarized ${scopeLabel}`;
    els.summary.appendChild(meta);
  }

  const summary = document.createElement("p");
  summary.className = "summary-text";
  summary.textContent = payload.summary || "暂无可总结的笔记。";
  els.summary.appendChild(summary);

  if (Array.isArray(payload.categories) && payload.categories.length > 0) {
    const chips = document.createElement("div");
    chips.className = "summary-chips";
    for (const category of payload.categories) {
      const chip = document.createElement("span");
      chip.className = "summary-chip";
      chip.textContent = category;
      chips.appendChild(chip);
    }
    els.summary.appendChild(chips);
  }

  if (Array.isArray(payload.tags) && payload.tags.length > 0) {
    const chips = document.createElement("div");
    chips.className = "summary-chips";
    for (const tag of payload.tags) {
      const chip = document.createElement("span");
      chip.className = "summary-chip";
      chip.textContent = `#${tag}`;
      chips.appendChild(chip);
    }
    els.summary.appendChild(chips);
  }

  if (Array.isArray(payload.action_items) && payload.action_items.length > 0) {
    els.summary.appendChild(createSummaryList("Action items", payload.action_items));
  }

  if (Array.isArray(payload.highlights) && payload.highlights.length > 0) {
    els.summary.appendChild(createSummaryList("Highlights", payload.highlights));
  }

  if (payload.suggested_next_step) {
    const nextStep = document.createElement("p");
    nextStep.className = "next-step";
    nextStep.textContent = payload.suggested_next_step;
    els.summary.appendChild(nextStep);
  }
}

function createSummaryList(title, items) {
  const section = document.createElement("div");
  section.className = "summary-group";

  const heading = document.createElement("h3");
  heading.textContent = title;
  section.appendChild(heading);

  const list = document.createElement("ul");
  for (const item of items) {
    const row = document.createElement("li");
    row.textContent = typeof item === "string" ? item : item.text || String(item);
    list.appendChild(row);
  }
  section.appendChild(list);
  return section;
}

function setSummaryMessage(message) {
  els.summary.innerHTML = "";
  els.summary.textContent = message;
  lastSummaryText = "";
  els.copy.disabled = true;
}

function setBusy(isBusy) {
  els.summarize.disabled = isBusy || getSummaryNotes().length === 0;
  els.summarize.textContent = isBusy ? "Summarizing..." : "Summarize";
}

function captureUndo(message, previousNotes, previousNextOrder) {
  undoSnapshot = {
    message,
    notes: previousNotes.map((note) => ({ ...note, tags: [...(note.tags || [])] })),
    nextOrder: previousNextOrder,
    searchTerm,
  };
  els.undoMessage.textContent = message;
  els.undoBar.hidden = false;
}

function restoreUndo() {
  if (!undoSnapshot) {
    return;
  }

  notes = undoSnapshot.notes.map((note) => ({ ...note, tags: [...(note.tags || [])] }));
  nextOrder = undoSnapshot.nextOrder;
  searchTerm = undoSnapshot.searchTerm;
  els.search.value = searchTerm;
  editingOrder = null;
  persistNotes();
  setSummaryMessage("已恢复上一步操作。");
  clearUndo();
  render();
}

function clearUndo() {
  undoSnapshot = null;
  els.undoBar.hidden = true;
  els.undoMessage.textContent = "";
}

async function copySummary() {
  if (!lastSummaryText) {
    return;
  }

  try {
    await navigator.clipboard.writeText(lastSummaryText);
    els.copy.textContent = "Copied";
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = lastSummaryText;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    els.copy.textContent = "Copied";
  }

  window.setTimeout(() => {
    els.copy.textContent = "Copy";
  }, 1200);
}

function exportMarkdown() {
  const visibleNotes = getVisibleNotes();
  if (visibleNotes.length === 0) {
    return;
  }

  const markdown = buildMarkdown(visibleNotes);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mini-notes-${formatDateForFile(new Date())}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function importMarkdown() {
  const file = els.importFile.files?.[0];
  els.importFile.value = "";
  if (!file) {
    return;
  }

  try {
    const markdown = await file.text();
    const imported = parseMarkdownNotes(markdown);
    if (imported.length === 0) {
      setSummaryMessage("没有找到可导入的笔记。");
      return;
    }

    captureUndo("Notes imported.", notes, nextOrder);
    const now = new Date().toISOString();
    for (const note of imported) {
      notes.push({
        order: nextOrder,
        content: note.content,
        tags: note.tags,
        created_at: now,
        updated_at: now,
      });
      nextOrder += 1;
    }
    persistNotes();
    setSummaryMessage(`已导入 ${imported.length} 条笔记。`);
    render();
  } catch (error) {
    setSummaryMessage(`Import failed: ${error?.message || error}`);
  }
}

function buildMarkdown(items) {
  const lines = [
    "# Mini Notes Export",
    "",
    `Exported: ${new Date().toLocaleString()}`,
  ];

  if (searchTerm) {
    lines.push(`Filter: ${searchTerm}`);
  }

  lines.push("", "## Notes", "");
  for (const note of items) {
    lines.push(`### Note ${note.order}`);
    lines.push("");
    lines.push(note.content);
    if (note.tags?.length) {
      lines.push("");
      lines.push(`Tags: ${note.tags.map((tag) => `#${tag}`).join(" ")}`);
    }
    lines.push("");
  }

  if (lastSummaryText) {
    lines.push("## Latest Summary", "", lastSummaryText, "");
  }

  return `${lines.join("\n").trim()}\n`;
}

function parseMarkdownNotes(markdown) {
  const blocks = String(markdown || "")
    .replace(/\r\n/g, "\n")
    .split(/\n### Note\s+\d+[^\n]*\n/g)
    .slice(1);

  return blocks
    .map(parseMarkdownNoteBlock)
    .filter((note) => note.content)
    .slice(0, 100);
}

function parseMarkdownNoteBlock(block) {
  const lines = block.split("\n");
  const contentLines = [];
  let tags = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      break;
    }
    if (line.startsWith("Tags:")) {
      tags = normalizeTags(line.replace("Tags:", "").split(/\s+/).map((tag) => tag.replace(/^#/, "")));
      continue;
    }
    contentLines.push(line);
  }

  const content = contentLines.join("\n").trim().slice(0, 240);
  return { content, tags };
}

function formatSummaryText(payload) {
  const lines = [payload.summary || "暂无可总结的笔记。"];

  if (Array.isArray(payload.categories) && payload.categories.length) {
    lines.push("", `Categories: ${payload.categories.join(", ")}`);
  }
  if (Array.isArray(payload.tags) && payload.tags.length) {
    lines.push("", `Tags: ${payload.tags.map((tag) => `#${tag}`).join(" ")}`);
  }
  if (Array.isArray(payload.action_items) && payload.action_items.length) {
    lines.push("", "Action items:");
    payload.action_items.forEach((item) => lines.push(`- ${item}`));
  }
  if (Array.isArray(payload.highlights) && payload.highlights.length) {
    lines.push("", "Highlights:");
    payload.highlights.forEach((item) => lines.push(`- ${item}`));
  }
  if (payload.suggested_next_step) {
    lines.push("", `Next step: ${payload.suggested_next_step}`);
  }

  return lines.join("\n");
}

function formatDateForFile(date) {
  return date.toISOString().slice(0, 10);
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function createUnavailableRuntime() {
  return {
    tools: {
      async invoke() {
        throw new Error("Anna runtime is required to summarize notes");
      },
    },
    window: {
      async set_title() {},
    },
  };
}

document.addEventListener("DOMContentLoaded", init);
