# Event Specifications & Data Model

This document details the Nostr event kinds and tagging schemas used in TENEX. Understanding these is crucial for interoperability and rebuilding the system.

## 1. Core Distinctions

### Agent Definition vs. Agent Instance

This is the most critical concept in the TENEX data model.

*   **Agent Definition (The "Class")**
    *   **Concept:** A template or blueprint describing what an agent *is*.
    *   **Kind:** `4199` (AgentDefinition).
    *   **Author (Pubkey):** The user who created the definition (e.g., the human developer).
    *   **Identity:** Identified by its Event ID (`id`) or `d` tag (replaceable).
    *   **Content:** The system prompt, persona, and instructions.
    *   **Usage:** It does *not* sign events or "talk". It is referenced by projects to spawn instances.

*   **Agent Instance (The "Instance")**
    *   **Concept:** An active participant in a project.
    *   **Kind:** Not an event kind itself; it is an *Identity* (Keypair).
    *   **Author (Pubkey):** The specific pubkey generated for this agent instance.
    *   **Identity:** Identified by its Pubkey (`pubkey`).
    *   **Usage:** It signs messages (Kind 1111), performs tasks, and interacts in threads.
    *   **Linkage:** The Project Status event lists the active Agent Pubkeys.

---

## 2. Event Kinds Reference

### Standard & NIP Kinds (Used in Context)

| Kind | Name | Description |
| :--- | :--- | :--- |
| `1` | Text Note | Standard user messages or mentions. |
| `1111` | Generic Reply | **Primary Message Type.** Used for agent responses and user replies in threads. |
| `30023` | Long-form Content | Articles or documents created within the project. |
| `31990` | Opaque (Legacy) | Sometimes used for application-specific handlers (older NIP). |
| `31933` | Project (NIP-73ish) | We use a custom variant (see below) or standard Replaceable for Project Definitions. |

### TENEX Custom Kinds

| Kind | Name | Constant | Description |
| :--- | :--- | :--- | :--- |
| `3199` | Agent Request | `AgentRequest` | A user request seeking an agent's help. |
| `13199` | Agent Request List | `AgentRequestList` | A list of open requests. |
| `4129` | Agent Lesson | `AgentLesson` | Learned knowledge/memory stored by an agent. |
| `4199` | Agent Definition | `AgentDefinition` | **The Blueprint.** Defines name, role, instructions. |
| `34199` | Agent Def. Pack | `AgentDefinitionPack` | A collection/pack of agent definitions. |
| `4200` | MCP Tool | `MCPTool` | Definition of a Model Context Protocol tool. |
| `4201` | Agent Nudge | `AgentNudge` | A "poke" or specific instruction to wake an agent. |
| `24000` | Project Start | `TenexProjectStart` | Signal to spin up project infrastructure. |
| `24010` | Project Status | `TenexProjectStatus` | **Heartbeat.** Tracks active agents, models, and tools. |
| `24020` | Agent Config | `TenexAgentConfigUpdate`| Dynamic configuration updates for an active agent. |
| `24101` | LLM Config | `TenexLLMConfigChange` | Changing the underlying LLM provider/model. |
| `24111` | Typing Start | `TenexAgentTypingStart` | Ephemeral: Agent has started generating. |
| `24112` | Typing Stop | `TenexAgentTypingStop` | Ephemeral: Agent stopped generating. |
| `21111` | Streaming Delta | `TenexStreamingResponse`| **Real-time.** Chunks of generated text (tokens). |
| `24133` | Operations Status | `TenexOperationsStatus` | Incoming: Tracks which agents are working on what. |
| `24134` | Stop Command | `TenexStopCommand` | Outgoing: Request to halt an agent's operation. |
| `513` | Conversation Meta | `TenexConversationMetadata`| Titles, summaries, and metadata for a thread. |

---

## 3. Tagging Schemas

### Project (Kind `31933` or similar Replaceable)

Defines the workspace.

*   `d`: Unique identifier (slug) for the project.
*   `title`: Project Name.
*   `description`: Project Description.
*   `image` / `picture`: Project Avatar URL.
*   `repo`: (Optional) Git repository URL.
*   `agent`: `['agent', <AgentDefinition_EventID>]` - References **Definitions** available to this project.
*   `mcp`: `['mcp', <MCPTool_EventID>]` - References tools available.

### Project Status (Kind `24010`)

The "State of the World" for a project.

*   `a` or `e`: Reference to the Project ID (Definition).
*   `agent`: `['agent', <Agent_Pubkey>, <Name>, <Scope>]`
    *   **Crucial:** This maps the *Active Instance Pubkey* to a display name.
    *   Scope can be 'global'.
*   `model`: `['model', <Provider/Model>, <AgentName1>, <AgentName2>...]`
*   `tool`: `['tool', <ToolName>, <AgentName1>...]`
*   `branch`: `['branch', <BranchName>]` - Active Git worktree branch.

### Messaging & Threading (Kinds `1`, `1111`, `11`)

The chat system relies on a dual-tagging strategy.

#### 1. The `e` Tag (NIP-10 Standard)
Used for the **Reply Tree**.
*   `['e', <Root_EventID>, <RelayURL>, 'root']`: The very first message in the chain.
*   `['e', <Parent_EventID>, <RelayURL>, 'reply']`: The immediate message being replied to.

#### 2. The `E` Tag (Context Grouping)
Used for **Logical Grouping** (The "Thread").
*   `['E', <Context_ID>]`: A stable identifier for the conversation context.
    *   Often the `id` of the Root Event, but explicitly promoted to a grouping tag.
    *   Allows fetching "all messages in Thread X" without recursively walking `e` tags.
    *   Used by `InboxStore` and `ThreadList` to group related messages.

#### 3. The `a` Tag (Project Context)
*   `['a', <Project_NIP33_Ref>]`: `kind:pubkey:d_tag`.
    *   Binds the message to a specific Project.

#### 4. The `p` Tag (Routing)
*   `['p', <Recipient_Pubkey>]`: Directs the message to a specific user or **Agent Instance**.

### Streaming Response (Kind `21111`)

Used to stream LLM tokens to the client for a "chat-like" feel.

*   `e`: Reference to the user prompt event ID.
*   `content`: A small delta string (token).
*   **Reassembly:** The client accumulates these events by `pubkey` + `created_at` window to rebuild the full message before the final Kind `1111` arrives.

### Agent Definition (Kind `4199`)

The Blueprint.

*   `d`: Slug.
*   `title`: Agent Name.
*   `description`: Description.
*   `role`: 'assistant', 'coder', etc.
*   `content`: **System Prompt / Instructions.**
*   `model`: Preferred model.
*   `tool`: `['tool', <ToolName>]`.
*   `mcp`: `['mcp', <MCP_EventID>]`.

### Agent Lesson (Kind `4129`)

Agent memory/learning.

*   `e`: Reference to the `AgentDefinition` (Event ID) or specific `Agent` (Instance) it applies to.
*   `content`: The learned lesson.
*   `metacognition`, `reasoning`, `reflection`: Tags for structured thought process storage.

### MCP Tool (Kind `4200`)

*   `name`: Tool name.
*   `command`: CLI command to run.
*   `params`: JSON string of parameters.
*   `capability`: Tags for capability filtering.

---

## 4. Operation Protocols

### Stopping an Agent (Kind `24134`)
*   `a`: Project ID.
*   `e`: The event ID of the *action* to stop (e.g., the root of the thread the agent is processing).
*   `p`: (Optional) Specific agent pubkey to stop.

### Operations Status (Kind `24133`)
*   Incoming broadcast from the backend/orchestrator.
*   `a`: Project ID.
*   `e`: Subject event ID.
*   `p`: List of agent pubkeys currently processing this event.
*   Client uses this to show "Agent is thinking..." or "Processing..." spinners.
