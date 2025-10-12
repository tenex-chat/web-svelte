# Phase 1: Core Infrastructure - COMPLETE ✅

## What We've Built

### 1. Project Setup
- ✅ SvelteKit project initialized with TypeScript
- ✅ Bun package manager configured
- ✅ Tailwind CSS 4 integrated
- ✅ All NDK dependencies installed

### 2. NDK Configuration
- ✅ NDKSvelte instance initialized with `wss://tenex.chat`
- ✅ SQLite WASM cache with worker mode enabled
- ✅ Signature verification worker set up
- ✅ Session management with LocalStorage persistence
- ✅ Auto-fetches: follows, mutes, wallet, relayList

### 3. Custom Event Classes
- ✅ **NDKProject** (kind 31933) - Fully ported from React
  - Manages project metadata, agents, MCP tools, hashtags
  - NIP-33 replaceable event with d-tag support
  - Custom delete method with "deleted" tag republishing
  - Registered with NDK for automatic class instantiation

### 4. Infrastructure Files
```
/TENEX-web-svelte5
├── src/
│   ├── lib/
│   │   ├── ndk.svelte.ts              # NDK initialization
│   │   ├── sig-verify.worker.ts       # Signature verification worker
│   │   ├── events/
│   │   │   └── NDKProject.ts          # Custom project event class
│   │   ├── stores/                    # (ready for state management)
│   │   └── utils/
│   │       └── slugify.ts             # Text slugification utility
│   ├── routes/
│   │   ├── +layout.svelte             # Root layout with NDK ready check
│   │   └── +page.svelte               # Status page
│   └── app.css                        # Tailwind imports
├── static/
│   ├── worker.js                      # SQLite WASM worker
│   └── sql-wasm.wasm                  # SQLite WASM binary
├── scripts/
│   └── copy-wasm.js                   # Copies WASM files to static/
└── Configuration files
```

## Critical Discoveries from React App Analysis

### Event Kinds & Their Roles

**Standard Nostr Kinds:**
- kind:0 - User/Agent profiles (metadata)
- kind:1 - Text notes (used in feed/hashtags)
- kind:3 - Contact lists (follows)
- kind:7 - Reactions (used in brainstorm mode for moderator selections)
- kind:11 - Thread root events
- kind:1063 - File metadata (NIP-94 for Blossom uploads)
- kind:1111 - GenericReply (PRIMARY MESSAGE TYPE - NOT kind 1!)
- kind:1934 - Tasks (NDKTask)
- kind:30023 - Long-form articles (documentation)

**Custom Application Kinds:**
- kind:513 - Conversation metadata (titles, summaries) - real-time updates
- kind:3199 - Agent requests (agents requesting to join user's account)
- kind:4129 - Agent lessons (learnings from interactions)
- kind:4199 - Agent definitions (the "class" definition)
- kind:4200 - MCP tool definitions
- kind:13199 - Agent request list (user's approved agents)
- kind:14199 - Agent ownership claims
- kind:21111 - Streaming responses (delta-based content reconstruction)
- kind:24000 - Project start signal (brings project online)
- kind:24010 - Project status (real-time agent/model/tool roster)
- kind:24019 - Force release (emergency project/agent release)
- kind:24101 - LLM config change (model switching)
- kind:24111 - Typing indicator start
- kind:24112 - Typing indicator stop
- kind:24133 - Operation status
- kind:31933 - Projects (NIP-33 replaceable)
- kind:34199 - Agent definition packs (collections of agents)

### Agent System Architecture

**Agent Definition (kind 4199)** = The "class" definition
- Contains: name, description, role, instructions (system prompt), useCriteria, version
- Has: tools[], mcpServers[], phases[]
- Replaceable event with d-tag (slug)
- Users can fork/clone definitions

**Agent Instance (npub)** = The running instance
- Just a pubkey on Nostr
- Publishes kind:0 metadata
- Can reference its definition via 'e' tag in kind:0
- Comes online by publishing kind:24010 status events

**Critical Flow:**
1. Backend agent starts → publishes kind:24010 with project tagId
2. Frontend subscribes to kind:24010 events → updates project status store
3. Online agents shown in UI → user can @mention or select
4. P-tags in messages route to specific agents

### Message & Reply Construction

**Thread Creation (kind 11):**
```typescript
const thread = new NDKThread(ndk);
thread.content = content;
thread.title = content.slice(0, 50);
thread.tag(project.tagReference()); // 'a' tag with NIP-33 coordinate
thread.tags.push(['p', agentPubkey]); // Routes to specific agent(s)
thread.tags.push(['t', hashtag]); // Hashtags
thread.tags.push(['mode', 'voice']); // For TTS
// Brainstorm mode:
thread.tags.push(['mode', 'brainstorm']);
thread.tags.push(['p', moderatorPubkey]); // ONLY moderator
thread.tags.push(['participant', ...participantPubkeys]); // Participants
```

**Reply Construction (kind 1111):**
```typescript
const reply = targetEvent.reply(); // Creates proper e/E tags
reply.content = content;
reply.tags = reply.tags.filter(tag => tag[0] !== 'p'); // Remove NDK's auto p-tags
reply.tags.push(['a', project.tagId()]); // Project reference
reply.tags.push(['p', selectedAgentPubkey]); // Route to agent
// For images:
reply.tags.push(['image', sha256, url, mimeType, size]);
reply.tags.push(['blurhash', hash]);
```

### Brainstorm Mode Mechanism

**Encoding:**
- Root event has `['mode', 'brainstorm']` and `['t', 'brainstorm']`
- ONE `p` tag for moderator pubkey
- Multiple `['participant', pubkey]` tags for participants (NOT p-tagged!)

**Filtering:**
- kind:7 (reaction) events from moderator select responses
- kind:7 E-tags the root, e-tags point to selected messages
- UI filters to show only: root + user messages + moderator-selected agent responses

**Replies in Brainstorm:**
- All replies preserve brainstorm tags
- All replies p-tag ONLY the moderator
- All replies preserve participant tags

### Project Status (kind 24010) Critical Details

Published by backend Project Manager to declare online status:

**Tags:**
```
['a', '<project_tagId>']           # Which project this status is for
['agent', pubkey, slug, model, 'global'?]  # Online agents
['model', slug, provider]           # Available models
['tool', name, description]         # Available tools
```

**How Frontend Uses It:**
1. Global subscription in projects store: `kinds: [24010], '#p': [userPubkey]`
2. Events processed to extract online agents, models, tools per project
3. Agent selector shows only currently online agents
4. Model selector shows agent's current model from status
5. P-tag routing uses this to know which agents to send messages to

### Message Streaming (kind 21111)

**Delta Reconstruction:**
- Each kind:21111 event contains a delta (chunk) of content
- DeltaContentAccumulator reconstructs full content from deltas
- Supports out-of-order arrival
- Creates synthetic message ID to represent streaming session
- When kind:1111 arrives with same pubkey → session complete, show final message

### P-Tag Routing Logic

**For New Threads:**
1. If @mentions exist → p-tag all mentioned agents
2. If selectedAgent set → p-tag selectedAgent
3. If no mentions/selection → p-tag first online agent (Project Manager)

**For Replies:**
1. If replying to specific message → p-tag that message's author
2. If @mentions exist → p-tag all mentioned agents
3. If selectedAgent set → p-tag selectedAgent
4. Fallback → p-tag most recent non-user agent
5. **Exception**: Brainstorm mode ONLY p-tags moderator!

### Conversation Metadata (kind 513)

**Purpose**: Update conversation titles/summaries in real-time
**Tags:**
```
['e', conversationId]    # Which conversation
['title', titleText]      # New title
['summary', summaryText]  # New summary
```
**Usage**: Separate subscription in chat to display/update metadata

## Next Steps: Deep Component Analysis Required

Before porting ANY component, we must deeply understand:

### Questions to Answer Per Component:

1. **What Nostr events does it subscribe to?**
   - Which kinds?
   - What filters?
   - Why those specific filters?

2. **What state does it manage?**
   - Local UI state?
   - Derived from events?
   - Shared with other components?

3. **What events does it publish?**
   - Which kinds?
   - What tags?
   - Why those tags?

4. **What are its dependencies?**
   - Other components?
   - Stores?
   - Hooks?

5. **What are the edge cases?**
   - Empty states?
   - Error states?
   - Loading states?

### Component Priority for Migration:

**Must Understand First:**
1. ProjectColumn (the main project view container)
2. ChatInterface (orchestrates chat UI)
3. ChatInputArea (message composition & sending)
4. ThreadedMessage (recursive message display)
5. useChatMessages hook → MessageList.svelte pattern

**Then:**
6. AgentSelector (critical for p-tag routing)
7. ModelSelector (model switching via kind:24101)
8. Project management components
9. Agent definition management
10. Settings & configuration

## Key Implementation Patterns to Follow

### 1. Subscription Pattern (from Voces)
```svelte
<script lang="ts">
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
</script>

{#each messages.events as message}
  <Message event={message} />
{/each}
```

### 2. Reactive Filtering
Use arrow functions for dynamic filters that update subscriptions automatically.

### 3. No Manual Cleanup
Subscriptions automatically stop when component unmounts.

### 4. Store Integration
Use `$derived` for computed state from subscriptions.

## Architectural Questions to Resolve

### 1. Project Store Strategy
**React**: Zustand store with manual subscription management
**Svelte Options**:
- A) Use `ndk.$subscribe()` directly in components (Voces pattern)
- B) Create a reactive store that wraps subscriptions
- **Recommendation**: Option A - direct subscriptions, derived state where needed

### 2. Message Processing
**React**: processEventsToMessages() utility function
**Svelte**:
- Keep utility function for processing logic?
- Or integrate into reactive $derived?
- **Recommendation**: Keep utility, wrap in $derived for reactivity

### 3. Navigation
**React**: TanStack Router with programmatic navigation
**Svelte**: SvelteKit's file-based routing
- Route params: `/projects/[projectId]` instead of `/projects/$projectId`
- Navigation via `goto()` instead of `navigate()`

## Critical Implementation Notes

### Do NOT Port Blindly:
- Don't just convert JSX to Svelte syntax
- Understand WHY each piece of code exists
- Many React hooks can be eliminated with Svelte's reactivity
- Stores in React ≠ stores in Svelte 5

### Must Ask Before Implementing:
- Complex state management patterns
- Subscription optimization strategies
- Event tag structures (if unclear)
- P-tag routing logic
- Any feature that seems hacky

### Refer to Voces for:
- How to use `ndk.$subscribe()` with dynamic filters
- Session management patterns
- Worker/cache integration
- Component composition patterns

## Development Workflow

For each component to port:
1. **Read the entire React component** (not just a glance)
2. **Trace all dependencies** (hooks, stores, contexts it uses)
3. **Understand event subscriptions** (what it listens to, why)
4. **Understand event publishing** (what it sends, tag structure)
5. **Map state transitions** (how state flows through the component)
6. **Ask clarifying questions** when logic is unclear
7. **Implement in Svelte** with clean, modern patterns
8. **Test thoroughly** before moving to next component

## Test Checklist (Current)

- [x] SvelteKit app starts without errors
- [x] NDK connects to tenex.chat relay
- [x] SQLite WASM cache initializes
- [x] Signature verification worker loads
- [x] Tailwind CSS renders correctly
- [x] NDKProject class registered
- [ ] Login flow (pending)
- [ ] Project subscription (pending)
- [ ] Chat interface (pending)

## Server Running

Dev server is live at: http://localhost:5173/
Shows infrastructure status page confirming all core systems operational.

---

**Ready for next phase once we deeply understand the components we're about to port.**
