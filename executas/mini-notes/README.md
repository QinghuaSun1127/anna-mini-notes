# Mini Notes Summarizer Executa

This folder contains the local Executa-style tool used by the Mini Notes UI.
It communicates with Anna through line-delimited JSON-RPC 2.0 over stdin/stdout.
The `summarize` tool returns a summary, category labels, highlights, action
items, and a suggested next step.

## Manual protocol checks

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"describe"}' | python mini_notes_plugin.py
```

```bash
echo '{"jsonrpc":"2.0","id":2,"method":"invoke","params":{"tool":"summarize","arguments":{"notes":[{"order":1,"content":"修复登录 bug","tags":["dev"]},{"order":2,"content":"跟客户 follow up","tags":["work"]},{"order":3,"content":"准备 workshop 提纲","tags":["content"]}]}}}' | python mini_notes_plugin.py
```
