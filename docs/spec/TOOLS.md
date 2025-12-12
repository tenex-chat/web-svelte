# Tooling & Agent Control Protocol

This document details the **Model Context Protocol (MCP) Tooling** implementation and the **Agent Nudge** control mechanism within TENEX.

## 1. MCP Tools (Kind `4200`)

TENEX uses the Model Context Protocol (MCP) to define tools that agents can execute. These tools are defined as Nostr events (Kind `4200`).

### Schema (Kind `4200`)

| Field | Description |
| :--- | :--- |
| **Kind** | `4200` |
| **Tag: `name`** | The display name of the tool (e.g., "Bash", "Write File"). |
| **Tag: `command`** | The CLI command or function identifier to execute. |
| **Tag: `params`** | JSON string defining the JSON Schema for the tool's parameters. |
| **Content** | A human-readable description of what the tool does. |
| **Tag: `capability`** | (Optional) Tags like `fs`, `network`, `shell` to gate access. |

### Tool Execution Flow

1.  **Agent Request:** The LLM generates a tool call structure (usually a JSON block).
2.  **Orchestrator Execution:**
    *   The backend (or local electron process) parses the request.
    *   It validates the request against the tool definition.
    *   It executes the logic (e.g., runs `grep` in the container).
3.  **Result Publication:**
    *   The result is published as a **Kind `1111` (Generic Reply)** event.
    *   **Tag: `tool`**: The name of the tool executed (e.g., "Bash").
    *   **Tag: `tool-args`**: The input arguments used (JSON string).
    *   **Content**: The standard output (stdout/stderr) of the tool.

---

## 2. Client-Side Rendering

The frontend does not just dump text for tool outputs. It uses specialized **Renderers** based on the `tool` tag.

### Renderer Registry (`src/lib/components/chat/tools/ToolRenderer.svelte`)

The client inspects the `tool` tag of an event and delegates to a specific component:

| Tool Name | Renderer Component | Visual Behavior |
| :--- | :--- | :--- |
| `Bash` / `shell` | `BashToolRenderer` | Shows command prompt `$` icon and truncates long commands. |
| `Read` / `cat` | `ReadToolRenderer` | Shows "Read `<filename>`" with file icon. |
| `Write` / `edit` | `WriteToolRenderer` | Shows "Wrote to `<filename>`" with file icon. |
| `Glob` / `ls` | `GlobToolRenderer` | Shows file tree pattern. |
| *Default* | `DefaultToolRenderer` | Generic "Used Tool: `<Name>`" badge. |

### Path Normalization
File paths in tool calls are often absolute (server-side). The client normalizes these for display using the Project's `d-tag` (Slug) and `branch` tags.
*   **Raw:** `/home/user/projects/tenex-v2/src/main.ts`
*   **Display:** `src/main.ts`

---

## 3. Agent Nudges (Kind `4201`)

"Nudges" are reusable system prompt snippets that users can inject into a conversation to steer agent behavior without typing out long instructions.

### Schema (Kind `4201`)

| Field | Description |
| :--- | :--- |
| **Kind** | `4201` |
| **Tag: `title`** | Short label (e.g., "Be Concise", "Think Step-by-Step"). |
| **Tag: `description`** | UI tooltip description. |
| **Content** | The actual prompt text to inject (e.g., "Please keep your response under 50 words."). |
| **Tag: `t`** | Hashtags for categorization. |

### Usage Protocol

1.  **Selection:** User types `/` in the Chat Input or uses the "Nudge Selector" menu.
2.  **Tagging:** When the message is sent (Kind `1` or `11`), the client adds a `['nudge', <Nudge_EventID>]` tag.
3.  **Inference:** The Agent (Backend) resolves this tag, fetches the content of the `4201` event, and appends it to the System Prompt for that specific generation cycle.

### UX Integration
*   **Autocomplete:** Typing `/` triggers a popup list of available Nudges.
*   **Pills:** Selected nudges appear as removable pills above the chat input.
*   **Creation:** Users can create new Nudges directly from the UI, which are saved as Kind `4201` events to their pubkey.
