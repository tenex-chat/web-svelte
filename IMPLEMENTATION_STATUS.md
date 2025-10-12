# TENEX-web Svelte 5 - Implementation Status

## ✅ Phase 1 Complete: Foundation & Infrastructure

### Project Setup
- [x] SvelteKit with TypeScript initialized
- [x] Bun package manager configured
- [x] Tailwind CSS 4 integrated
- [x] All NDK packages installed

### NDK Configuration
- [x] NDKSvelte instance with tenex.chat relay
- [x] SQLite WASM cache with worker mode
- [x] Signature verification worker
- [x] Session management with LocalStorage
- [x] Auto-fetch: follows, mutes, wallet, relayList

### Custom Event Classes Ported
All event classes ported from React to Svelte with proper TypeScript types:

- [x] **NDKProject** (kind 31933) - Project management
  - Properties: title, description, picture, repoUrl, hashtags
  - Agent/MCP tool management
  - NIP-33 replaceable with d-tag
  - Custom delete with "deleted" tag

- [x] **NDKAgentDefinition** (kind 4199) - Agent "class" definitions
  - Properties: name, description, role, instructions, model, picture, version
  - Tools, MCP servers, phases
  - Use criteria for automatic agent selection

- [x] **NDKProjectStatus** (kind 24010) - Real-time project status
  - Online agents with pubkeys, names, models, tools
  - Available models per project
  - Critical for agent coordination!

- [x] **NDKTask** (kind 1934) - Task management
  - Properties: title, description, projectId, assignedTo

- [x] **NDKMCPTool** (kind 4200) - MCP tool definitions
  - Properties: name, description, command, parameters, capabilities

- [x] **NDKAgentLesson** (kind 4129) - Agent learnings
  - Properties: title, lesson, metacognition, reasoning, reflection
  - Categories and hashtags

### Authentication & Routing
- [x] Login page with NIP-07 and nsec support
- [x] LoginModal component using ndk.$sessions
- [x] Protected routes (redirect to /login if not authenticated)
- [x] Auto-redirect to /projects after login
- [x] Projects list page with reactive subscription

### Infrastructure Files
```
src/
├── lib/
│   ├── ndk.svelte.ts              # NDK init + event registration
│   ├── sig-verify.worker.ts       # Signature verification worker
│   ├── constants.ts               # Event kinds, timing, limits
│   ├── components/
│   │   └── LoginModal.svelte      # Login UI
│   ├── events/
│   │   ├── NDKProject.ts
│   │   ├── NDKAgentDefinition.ts
│   │   ├── NDKProjectStatus.ts
│   │   ├── NDKTask.ts
│   │   ├── NDKMCPTool.ts
│   │   └── NDKAgentLesson.ts
│   ├── stores/
│   │   └── loginModal.svelte.ts
│   └── utils/
│       └── slugify.ts
├── routes/
│   ├── +layout.svelte             # Root layout with NDK ready + LoginModal
│   ├── +page.svelte               # Home (redirects)
│   ├── login/+page.svelte         # Login page
│   └── projects/+page.svelte      # Projects list
└── app.css                        # Tailwind imports
```

## 🚧 Phase 2: Next Steps - Chat System Deep Dive

Before implementing the chat system, we must deeply understand:

### Critical Questions to Answer:

1. **Message Subscription Architecture**
   - What filters does useChatMessages use?
   - How does it handle threaded vs flattened modes?
   - How does brainstorm mode filtering work?
   - What's the exact flow of kind:21111 → kind:1111?

2. **Message Processing Pipeline**
   - How does DeltaContentAccumulator work?
   - When do synthetic IDs get created?
   - How are streaming sessions tracked?
   - What's the exact sorting/filtering logic?

3. **Reply Construction**
   - What tags go on a new thread (kind 11)?
   - What tags go on a reply (kind 1111)?
   - How does p-tag routing work in different scenarios?
   - How does brainstorm mode change tag structure?

4. **ChatInterface Component Dependencies**
   - What hooks does it use?
   - What contexts/providers are needed?
   - What's the relationship with ChatInputArea?
   - How does navigation within chat work?

5. **Project Status Integration**
   - How often are kind:24010 events published?
   - How does the frontend subscribe to them?
   - How is agent online status determined?
   - How does model switching work (kind:24101)?

### Components to Analyze Next:

1. **ChatInterface** (`src/components/chat/ChatInterface.tsx`)
   - Main orchestrator
   - Navigation stack
   - Integration points

2. **ChatInputArea** (`src/components/chat/components/ChatInputArea.tsx`)
   - Message composition
   - Agent/model selection
   - Image upload
   - Voice input
   - Brainstorm mode

3. **useChatMessages** (`src/components/chat/hooks/useChatMessages.ts`)
   - Subscription filters
   - Event processing
   - Message state

4. **messageProcessor** (`src/components/chat/utils/messageProcessor.ts`)
   - Event sorting
   - Streaming session management
   - Brainstorm filtering
   - React component detection

5. **useThreadManagement** (`src/components/chat/hooks/useThreadManagement.ts`)
   - createThread logic
   - sendReply logic
   - Tag construction

### Implementation Order:

1. Port message utilities first (DeltaContentAccumulator, messageProcessor)
2. Create chat stores (reply context, view mode, brainstorm)
3. Build ChatMessage display component (single message)
4. Build MessageList (list of messages with streaming)
5. Build ChatInput (composition + sending)
6. Build ChatView (full orchestrator)
7. Integrate project status subscription
8. Add agent/model selectors

## Event Kinds Reference

**Messages & Replies:**
- kind:11 - Thread root
- kind:1111 - GenericReply (PRIMARY MESSAGE TYPE!)
- kind:21111 - Streaming response (deltas)
- kind:513 - Conversation metadata

**Agent System:**
- kind:4199 - Agent definitions
- kind:24010 - Project status (COORDINATION HUB)
- kind:4129 - Agent lessons

**Project Coordination:**
- kind:24000 - Project start signal
- kind:24101 - LLM config change
- kind:24111/24112 - Typing indicators
- kind:31933 - Projects

**Tools & Tasks:**
- kind:4200 - MCP tools
- kind:1934 - Tasks

## Key Implementation Patterns

### Reactive Subscriptions (Svelte 5)
```svelte
const messages = ndk.$subscribe(() => {
  if (!rootEvent) return undefined;
  return {
    filters: [
      { kinds: [11, 1111], ...rootEvent.filter() },
      rootEvent.nip22Filter()
    ],
    closeOnEose: false,
    bufferMs: 30
  };
});
```

### Session-Aware Routing
```svelte
const currentUser = $derived(ndk.$sessions.currentUser);

$effect(() => {
  if (!currentUser) {
    goto('/login');
  }
});
```

### Typed Event Classes
```svelte
const projects = ndk.$subscribe({
  filters: [{ kinds: [31933], authors: [pubkey] }],
  eventClass: NDKProject
});

// projects.events is NDKProject[]
```

## Next Session Goals

1. Deep-dive analysis of ChatInterface and all dependencies
2. Map the complete message flow from input → publish → subscribe → display
3. Understand every tag, every filter, every state transition
4. Port messageProcessor utilities
5. Build first chat component

## Questions to Ask Before Proceeding

1. **Should we port the entire chat system at once, or build incrementally?**
   - Option A: Port all chat components together (complex but complete)
   - Option B: Build minimal chat first, add features incrementally (safer)

2. **How should we handle project status subscriptions?**
   - Option A: Global store like React (Zustand → Svelte store)
   - Option B: Component-level subscriptions (more Svelte-native)

3. **What's the priority for features?**
   - Basic chat first?
   - Project management first?
   - Agent system first?

---

**Server Running**: http://localhost:5173/
**Status**: Ready to dive deep into chat system implementation!
