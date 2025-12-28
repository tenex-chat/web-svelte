# User Experience & Navigation Flow

This document outlines the visual hierarchy, screen transitions, and user interaction flows within TENEX.

## 1. Global Hierarchy

The app follows a "Telegram-like" navigation model with three main levels:

1.  **Sidebar:** Global Navigation & Project Selection.
2.  **Project Column (Multi-View):** Project-specific context (Tabs, Settings).
3.  **Detail View:** The active workspace (Chat, Document, Feed).

---

## 2. Screen Specifications

### A. Login / Splash Screen
*   **Condition:** No `currentUser` in NDK session.
*   **Elements:**
    *   Large branding "TENEX".
    *   "Get Started" button triggering `loginModal`.
    *   **Login Modal:** Options for NIP-07 (Extension), Nsec login, or generating a new key.

### B. Sidebar (Leftmost Rail)
*   **Width:** Narrow, collapsible.
*   **Content:**
    *   **Top:** User Avatar/Profile.
    *   **Middle:** List of Projects (Kind `31933`).
        *   Grouped by "Project Groups" (Pinned vs. All).
        *   Each item shows Project Avatar + Title.
    *   **Bottom:**
        *   **Inbox:** Badge with unread count.
        *   **Settings:** Global app settings.
        *   **Theme Toggle:** Light/Dark mode.
*   **Action:** Clicking a project adds it to the "Open Projects" store.

### C. Multi-Project View (Main Area)
*   **Layout:** Horizontal scrolling flex container.
*   **Behavior:** Allows multiple projects to be open simultaneously side-by-side (like decks).
*   **Component:** `MultiProjectView` -> `ProjectColumn`.

### D. Project Column (The Core Interface)
*   **Header:**
    *   Project Title & Avatar.
    *   **Status Dot:** Green if online (based on `ProjectStatus` events), Grey if offline.
        *   *Interaction:* Click dot to send `TenexProjectStart` (24000).
    *   **Settings Gear:** Opens Project Settings.
*   **Tab Bar:**
    1.  **Chat:** Conversation threads.
    2.  **Docs:** Long-form content (`30023`).
    3.  **Agents:** List of active agents.
    4.  **Tags:** Hashtag filter.
    5.  **Feed:** Raw event feed.
*   **Tab Content:** See Section 3.

---

## 3. Tab Interactions

### Chat Tab (Default)
1.  **Thread List:**
    *   Shows list of conversations grouped by `E` tag.
    *   **Filter:** "All", "Active 1h/4h/1d", "Needs Response".
    *   **Item:** Title (from metadata 513 or content), Last Reply Time, Participant Avatars.
2.  **Chat View (Drill-down):**
    *   Clicking a thread opens the full chat history.
    *   **Header:** Thread Title, Participants.
    *   **Message List:**
        *   Rendered markdown.
        *   **Agent Thoughts:** `<AIReasoningBlock>` collapsible section for "Chain of Thought".
        *   **Tool Usage:** Specific renderers for tools like `bash`, `write_file`, `read_file`.
    *   **Input Area:**
        *   Textarea with auto-expand.
        *   **Mentions (@):** Trigger Agent Selector.
        *   **Nudges (/):** Trigger Nudge Selector.
        *   **Context Banner:** "Replying to..." indicator.

### Docs Tab
*   **List:** Documents created in this project.
*   **Action:** "+" button to create new Markdown document.
*   **View:** Markdown editor/viewer.

### Agents Tab
*   **List:** Shows *Active Agent Instances* (from `ProjectStatus`).
*   **Status:** Online/Offline indicators.
*   **Action:** Click to open a direct chat or configure.

---

## 4. Key Workflows

### Creating a Project
1.  Sidebar "+" button -> `CreateProjectDialog`.
2.  **Input:** Title, Description, Image URL.
3.  **Actions:**
    *   Generates keys for the project? (Or just the definition event).
    *   Publishes Kind `31933`.
4.  **Result:** Project appears in sidebar.

### Starting a Conversation
1.  Open Project -> Chat Tab.
2.  Click "+" (New Chat).
3.  **Input:** Type message in `ChatInput`.
    *   Select specific Agent (optional p-tag).
    *   Select Git Worktree (optional branch tag).
4.  **Send:** Publishes Kind `11` (Thread Root).

### Agent Configuration (Instantiation)
1.  Project Settings -> Agents.
2.  **Add Agent:**
    *   Browse **Agent Definitions** (Kind `4199`).
    *   "Invite" -> Creates reference in Project metadata.
    *   (Backend orchestration picks this up and spawns the **Instance** with a pubkey).

### The "Inbox" Flow
1.  Global "Inbox" button in sidebar.
2.  **Popover/View:** Lists recent mentions (Kind `1`) and replies (Kind `1111`) tagging the user.
3.  **Unread:** Highlighted based on `lastVisit` timestamp.
4.  **Action:** Clicking an item navigates to the specific Project -> Chat -> Thread.

### Agent Response Flow
1.  User sends prompt.
2.  **UI State:** Shows "Agent Typing..." (Kind `24111`).
3.  **Completion:** Receives Kind `1111` (Final response).
    *   UI displays the final message.

---

## 5. UI Components & Design System

*   **Framework:** Svelte 5 + Tailwind CSS.
*   **Theme:** Shadcn-like aesthetic.
*   **Glassmorphism:** Used for overlay panels and input areas (`bg-card/40 backdrop-blur-xl`).
*   **Colors:**
    *   **Project Colors:** Deterministically generated from Project Slug/ID.
    *   **Agent Badges:** Purple/Green distinct from Users.
