# Mini Notes Anna App

Mini Notes is a minimal Anna-style app for the interview task. It includes a
static UI bundle, a local Executa-style summarizer tool, and a manifest that
wires the UI to the tool through Anna's local app harness.

## What is included

```text
miniapp/
├── app.json
├── manifest.json
├── package.json
├── bundle/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── icon.svg
├── executas/
│   └── mini-notes/
│       ├── mini_notes_plugin.py
│       ├── pyproject.toml
│       └── README.md
├── fixtures/
│   └── happy-path.jsonl
└── tests/
    └── test_tool_contract.py
```

## Install dependencies

Install Node dependencies for the Anna CLI:

```bash
npm install
```

The local harness also needs `uvx`. If `anna-app doctor` reports that `uv` is
missing, install it once:

```bash
python -m pip install --user uv
```

On Windows, make sure your Python user Scripts directory is on `PATH`, for
example `C:\Users\<you>\AppData\Roaming\Python\Python39\Scripts`. `npm run dev`
also prepends the common user Scripts paths automatically.

The Mini Notes tool itself uses only the Python standard library. Python 3.9+ is
enough.

Optional local Executa install:

```bash
cd executas/mini-notes
python -m pip install -e .
```

## Run the Anna local harness

From the repository root:

```bash
npm run validate
npm run doctor
npm run dev
```

Those scripts run:

```bash
anna-app validate --strict
anna-app doctor
anna-app dev
```

`anna-app dev` serves the static bundle in the local Anna harness. The UI calls:

```js
anna.tools.invoke({
  tool_id: "tool-test-mini-notes-12345678",
  method: "summarize",
  args: { notes }
});
```

The app does not create a separate business API. The Summarize button goes
through the Anna runtime host API and then into the local Executa process.

## Manually test Executa JSON-RPC

Describe:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"describe"}' | python executas/mini-notes/mini_notes_plugin.py
```

Invoke:

```bash
echo '{"jsonrpc":"2.0","id":2,"method":"invoke","params":{"tool":"summarize","arguments":{"notes":[{"order":1,"content":"修复登录 bug"},{"order":2,"content":"跟设计沟通需求"},{"order":3,"content":"准备 workshop 提纲"}]}}}' | python executas/mini-notes/mini_notes_plugin.py
```

Expected invoke result:

```json
{
  "success": true,
  "data": {
    "summary": "当前共有 3 条笔记，主要集中在开发修复、内容准备和协作事项。",
    "count": 3
  }
}
```

You can also run the included contract test:

```bash
npm test
```

## How bundle, manifest, and executas relate

`bundle/` is the UI bundle. Anna opens `bundle/index.html` inside the app
runtime iframe. `bundle/app.js` connects to the host with
`AnnaAppRuntime.connect()` and invokes the summarizer through `anna.tools.invoke`.

`manifest.json` is the Anna App contract. It declares the static bundle entry,
the window settings, the required host permission `tools.invoke`, and the
required Executa ID `tool-test-mini-notes-12345678`. The same ID is allow-listed
under `ui.host_api.tools`, so the UI can call that tool and nothing broader.

`executas/mini-notes/` is the local tool process. It implements JSON-RPC 2.0
over stdin/stdout. Anna first calls `describe` to read the tool manifest, then
calls `invoke` with `tool="summarize"` and the current notes. The tool returns a
rule-driven summary without using an external LLM or external API.

## Notes on IDs

This project uses the development ID `tool-test-mini-notes-12345678` in four
places:

- `manifest.json` required executas
- `manifest.json` UI host API allow-list
- `bundle/app.js` `TOOL_ID`
- `executas/mini-notes/mini_notes_plugin.py` `TOOL_ID`

For a real Anna platform submission, mint a tool ID in Anna and replace all four
occurrences with the minted value.

## Privacy

Notes stay in the in-memory UI state for this minimal exercise. No database,
cloud deployment, external account, or third-party API is used.
