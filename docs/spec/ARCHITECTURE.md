# System Architecture

This document describes the technical architecture, data flow, and state management strategies of TENEX.

## 1. High-Level Architecture

TENEX is a **Client-Relay-Client** system. There is no central HTTP API for business logic.

*   **Frontend (The Client):** Svelte 5 + SvelteKit + Electron.
    *   Handles UI, Signing, NDK Cache, and State Aggregation.
*   **Relays (The Database):** Standard Nostr Relays.
    *   Store all state events.
*   **Orchestrator / Agents (The Backend):**
    *   Autonomous services listening to relays.
    *   They see `Project` events, `AgentRequest` events, and `ProjectStart` signals.
    *   They spin up Docker containers/processes for the requested **Agent Instances**.

## 2. State Management Strategy

The frontend relies heavily on **Runes** (Svelte 5 reactivity) and specialized Stores.

### A. The NDK Singleton (`src/lib/ndk.svelte.ts`)
*   Wraps `@nostr-dev-kit/svelte`.
*   Manages the connection to relays.
*   Handles the User Session (`currentUser`).
*   Provides `ndk.$subscribe` for reactive queries.

### B. Project Status Store (`projectStatus.svelte.ts`)
*   **Purpose:** Aggregates Kind `24010` (ProjectStatus) events.
*   **Logic:**
    *   Subscribes to `24010` for visible projects.
    *   Parses tags to determine:
        *   `isOnline`: Timestamp check (within last 5 mins).
        *   `activeAgents`: Map of Pubkeys -> Names.
        *   `worktrees`: Active git branches.
*   **Usage:** UI binds to `projectStatusStore.isProjectOnline(id)` to show the green dot.

### C. Conversation State (`conversation-state.svelte.ts`)
*   **Scope:** Instantiated per active chat view.
*   **Responsibility:**
    *   Subscribes to Thread messages (`11`, `1111`) + Metadata (`513`).
    *   **Simplicity:** Handles only final messages (kind 1111), no streaming delta processing.
    *   **Optimistic Updates:** Immediate UI reflection before relay confirmation.

### D. Inbox Store (`inbox.svelte.ts`)
*   **Purpose:** Global notification center.
*   **Logic:**
    *   Subscribes to mentions/replies tagging the user.
    *   Groups by `E` tag (Context) to avoid duplicate rows for the same thread.
    *   Persists `lastVisit` timestamp to local storage for "Unread" badges.

## 3. Data Flow & Subscriptions

### The "Project View" Pattern
When a user opens a project column:
1.  **Mount:** Component creates a subscription for:
    *   `ProjectStatus` (Kind 24010).
    *   `ProjectMetadata` (Kind 31933/Replaceable).
2.  **Tab Selection (Chat):**
    *   Subscribes to `Thread` roots (Kind 11) tagged with project `a` tag.
    *   Subscribes to `Reply` (Kind 1111) summaries.
3.  **Drill Down (Specific Thread):**
    *   `ChatView` instantiates `ConversationState`.
    *   Subscribes to all events with `E` tag matching thread ID.

### The "Agent Instantiation" Flow
This is the bridge between Definition and Instance.

1.  **User** creates `AgentDefinition` (Kind 4199).
2.  **User** adds reference to `Project` (Kind 31933) tags: `['agent', <DefID>]`.
3.  **User** sends `ProjectStart` (Kind 24000).
4.  **Backend Orchestrator**:
    *   Sees `24000`.
    *   Fetches Project event.
    *   Reads `agent` tags -> Fetches `AgentDefinition` events.
    *   **Instantiates** a process for each definition.
    *   Generates/Loads a **Keypair** for that instance.
    *   Publishes `ProjectStatus` (Kind 24010) linking `['agent', <InstancePubkey>, <DefName>]`.
5.  **Frontend**:
    *   Sees `24010`.
    *   Maps `InstancePubkey` to `DefName` for UI display.
    *   User mentions `@DefName` -> UI resolves to `InstancePubkey` for `p` tag.

## 4. Key Libraries & Dependencies

*   `@nostr-dev-kit/ndk`: Core protocol logic.
*   `@nostr-dev-kit/svelte`: Svelte bindings.
*   `tailwindcss`: Styling.
*   `lucide-svelte`: Icons.
*   `electron`: Desktop wrapper (file system access for "Local" tools).

## 5. Security & Verification

*   **Signer:** NIP-07 or Local Nsec (encrypted in memory).
*   **Permissions:** Projects define scope.
*   **Content:** All rendered markdown is sanitized.
*   **Tool Execution:**
    *   If running via Electron (local agent), tools run on user machine.
    *   If running via Cloud Orchestrator, tools run in sandboxed containers.

## 6. Rebuilding Guidelines

To rebuild this app:
1.  **Start with the Stores:** Replicate `ConversationState` logic first. Focus on threading structure.
2.  **Implement NDK:** Ensure robust connection management.
3.  **Build the UI Shell:** Sidebar + Multi-column layout.
4.  **Wire up the Project Status:** Crucial for "Agent Presence".
5.  **Implement Chat:** The core value loop.
