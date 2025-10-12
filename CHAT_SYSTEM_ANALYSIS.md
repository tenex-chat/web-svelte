# TENEX Chat System - Complete Analysis

## Message Flow Architecture

### Event Kinds in Chat

- **kind:11** - Thread root (NDKThread)
- **kind:1111** - GenericReply (ALL messages and agent responses)
- **kind:21111** - Streaming response deltas
- **kind:513** - Conversation metadata (title, summary)
- **kind:7** - Reactions (used in brainstorm for moderator selections)
- **kind:24111/24112** - Typing indicators

## NDK's .reply() Method - What It Does Automatically

```typescript
const replyEvent = targetEvent.reply();
```

**If target is kind:1:**
- Creates kind:1 reply
- Copies existing e/p/a tags from parent
- Adds e-tag to parent

**If target is anything else (kind:11, kind:1111, etc):**
- Creates **kind:1111 (GenericReply)**
- Carries over **capital letter tags**: A, E, I, P, K
- Creates **lowercase e-tag** pointing to parent event:
  - For regular events: `["e", eventId, relayHint, parentPubkey]`
  - For replaceable: `["a", address, relayHint]`
- If parent already has E/e tags (is part of thread):
  - Preserves uppercase E tag (root reference)
  - Adds lowercase e tag (direct parent)

**CRITICAL**: .reply() creates proper NIP-22 threading structure automatically!

## Thread Creation (kind:11) - Complete Tag Structure

```typescript
const thread = new NDKThread(ndk);
thread.content = content;
thread.title = content.slice(0, 50);  // Optional

// TENEX adds these tags:
thread.tag(project.tagReference());   // ["a", "31933:pubkey:dtag", relayHint, ""]
extraTags.push(...);                  // Any additional context tags
["image", sha256, url, mimeType, size, blurhash?]
["p", agentPubkey]                    // Agent routing (SEE P-TAG LOGIC below)
["t", hashtag]                        // Auto-extracted from content via /#(\w+)/g
["mode", "voice"]                     // If autoTTS enabled

await thread.sign(undefined, { pTags: false });  // PREVENT auto p-tags!
thread.publish();
```

### P-Tag Routing Logic for New Threads

**Priority order:**
1. If `@mentions` detected → p-tag ALL mentioned agents
2. If `selectedAgent` set AND not already in mentions → p-tag selectedAgent
3. If no mentions AND no selection AND onlineAgents exist → p-tag onlineAgents[0] (Project Manager)
4. **EXCEPTION: Brainstorm mode** → see below

## Reply Creation (kind:1111) - Complete Tag Structure

```typescript
const targetEvent = replyingTo || rootEvent;  // Reply to specific message OR conversation root
const replyEvent = targetEvent.reply();       // NDK creates e/E tags!
replyEvent.content = content;

// STEP 1: Remove NDK's auto p-tags
replyEvent.tags = replyEvent.tags.filter(tag => tag[0] !== "p");

// STEP 2: Add project reference
replyEvent.tags.push(["a", project.tagId()]);  // "31933:pubkey:dtag"

// STEP 3: Add images
["image", sha256, url, mimeType, size]
["blurhash", hash]

// STEP 4: P-TAG ROUTING (if NOT brainstorm mode)
mentions.forEach(agent =>
  replyEvent.tags.push(["p", agent.pubkey])
);

if (selectedAgent && not in mentions) {
  replyEvent.tags.push(["p", selectedAgent]);
} else if (no mentions && no selection && recentMessages exist) {
  // Find most recent agent message
  const mostRecentAgent = [...recentMessages]
    .reverse()
    .find(msg => msg.event.pubkey !== user.pubkey);
  replyEvent.tags.push(["p", mostRecentAgent.pubkey]);
}

// STEP 5: Add voice mode
if (autoTTS) {
  replyEvent.tags.push(["mode", "voice"]);
}

// STEP 6: Sign and publish
await replyEvent.sign(undefined, { pTags: false });
await replyEvent.publish();
```

### P-Tag Routing Logic for Replies

**Priority order:**
1. If replying to specific message → (handled by finding most recent agent)
2. If `@mentions` in content → p-tag ALL mentioned agents
3. If `selectedAgent` set → p-tag selectedAgent
4. Fallback → p-tag most recent non-user agent from conversation
5. **EXCEPTION: Brainstorm mode** → ONLY p-tag moderator!

## Brainstorm Mode - Special Tagging

### Thread Creation (Brainstorm):
```typescript
// Before adding p-tags:
newThreadEvent.tags = newThreadEvent.tags.filter(tag => tag[0] !== "p");

// Add brainstorm tags:
["mode", "brainstorm"]
["t", "brainstorm"]
["p", moderatorPubkey]            // ONLY moderator gets p-tag!
["participant", participantPubkey1]  // All participants as "participant" tags
["participant", participantPubkey2]
["participant", participantPubkey3]
```

### Reply in Brainstorm:
```typescript
// Clear ALL p-tags
replyEvent.tags = replyEvent.tags.filter(tag => tag[0] !== "p");

// Add brainstorm mode tags
["mode", "brainstorm"]
["t", "brainstorm"]

// Copy participant tags from root
rootEvent.tags.filter(tag => tag[0] === "participant").forEach(tag =>
  if (!replyEvent.hasTag("participant", tag[1])) {
    replyEvent.tags.push(tag);
  }
);

// P-tag ONLY the moderator
const moderatorPubkey = rootEvent.tagValue("p");
replyEvent.tags.push(["p", moderatorPubkey]);
```

### Brainstorm Filtering (kind:7 Reactions):

Moderator selects responses by publishing **kind:7 (reaction) events**:

```typescript
const selectionEvent = new NDKEvent(ndk);
selectionEvent.kind = 7;
selectionEvent.tags.push(["E", rootEventId]);     // Root conversation
selectionEvent.tags.push(["e", selectedMsg1Id]);  // Selected messages
selectionEvent.tags.push(["e", selectedMsg2Id]);
```

**UI Filtering Logic:**
1. Get all kind:7 events that E-tag the root
2. Extract all e-tags from those reactions = selectedEventIds
3. Show ONLY:
   - Root event
   - Current user's messages
   - Messages with IDs in selectedEventIds
4. Hide kind:7 reactions themselves (they're just metadata)

## Message Subscription Filters

```typescript
// For regular conversations:
const filters = rootEvent ? [
  { kinds: [11, 1111, 7, 21111, 513], ...rootEvent.filter() },
  rootEvent.nip22Filter()
] : false;

// For brainstorm conversations:
const filters = rootEvent ? [
  { kinds: [1111, 7], ...rootEvent.filter() },      // Only replies & reactions
  { kinds: [1111, 7], ...rootEvent.nip22Filter() }
] : false;
```

**rootEvent.filter()** returns:
- `{ "#E": [rootEvent.id] }` - Events that E-tag this root

**rootEvent.nip22Filter()** returns:
- `{ "#e": [rootEvent.id] }` - Events that e-tag this event directly

**Combined**: Gets all events in the conversation thread (direct + nested)

## Streaming Responses (kind:21111) - Delta Reconstruction

### How Streaming Works:

1. **Agent starts responding** → publishes kind:21111 events (deltas)
2. **Each delta contains**: partial content chunk
3. **DeltaContentAccumulator** reconstructs full content from deltas
4. **When complete** → agent publishes kind:1111 with full content
5. **UI cleanup** → removes streaming session, shows final message

### Delta Processing:

```typescript
// Streaming session per pubkey
interface StreamingSession {
  syntheticId: string;           // "streaming-{pubkey}-{timestamp}"
  latestEvent: NDKEvent;         // Most recent delta
  accumulator: DeltaContentAccumulator;
  reconstructedContent: string;  // Full content so far
}

// On kind:21111 event:
let session = streamingSessions.get(event.pubkey);
if (!session) {
  // New session
  session = {
    syntheticId: `streaming-${event.pubkey}-${Date.now()}`,
    latestEvent: event,
    accumulator: new DeltaContentAccumulator(),
    reconstructedContent: accumulator.addEvent(event)
  };
} else {
  // Update existing session
  session.reconstructedContent = session.accumulator.addEvent(event);
  session.latestEvent = event;
}

// On kind:1111 event from same pubkey:
streamingSessions.delete(event.pubkey);  // Session complete!
```

### DeltaContentAccumulator:

**Purpose**: Reconstruct full content from delta events that may arrive out-of-order

**Key Features:**
- Handles out-of-order deltas
- Supports delta types: "append", "replace", "insert"
- Creates synthetic message with reconstructed content for UI

## Message Processing Pipeline

### Input: Raw NDKEvent[]
### Output: Message[] (UI-ready)

```typescript
interface Message {
  id: string;              // event.id OR synthetic ID for streaming
  event: NDKEvent;
  isReactComponent?: boolean;
  reactComponentCode?: string;
  reactComponentProps?: Record<string, any>;
}
```

### Processing Steps:

1. **Sort events** by created_at (ascending)
2. **Process each event**:
   - Skip kind:24133, kind:24134 (operations)
   - Handle kind:513 (metadata) → always show
   - Handle kind:1111 with ["component", "react"] → extract React component
   - Handle kind:21111 (streaming) → update session
   - Handle kind:24111 (typing) → create/update session
   - Handle kind:24112 (typing stop) → remove session
   - Regular events → add to finalMessages
3. **Apply view mode filtering**:
   - **Threaded**: Only direct replies to root (has lowercase e-tag to root)
   - **Flattened**: All events in conversation
   - **Brainstorm**: Only selected events (see brainstorm filtering)
4. **Add streaming sessions** as synthetic messages
5. **Sort final messages** by timestamp (with tag priority)

## Tag Structure Reference Card

### Thread (kind:11)
```
["title", "Thread title"]           // Optional
["a", "31933:pubkey:dtag"]          // Project reference
["p", agentPubkey]                  // Agent(s) to notify
["t", "hashtag"]                    // Hashtags
["mode", "voice"]                   // TTS flag
["image", sha256, url, type, size]  // Attachments
```

### Reply (kind:1111) - Created by .reply()
```
// Auto-created by NDK:
["E", rootEventId]                  // Root conversation (capital E)
["e", parentEventId, relay, pubkey] // Direct parent (lowercase e)
["A", rootAddress]                  // If root is replaceable
["K", rootKind]                     // Root event kind

// Added by TENEX:
["a", "31933:pubkey:dtag"]          // Project reference
["p", agentPubkey]                  // Routing (see p-tag logic)
["mode", "voice"]                   // TTS flag
["image", sha256, url, type, size]  // Attachments
```

### Brainstorm Thread (kind:11)
```
["mode", "brainstorm"]
["t", "brainstorm"]
["p", moderatorPubkey]              // ONLY moderator!
["participant", participantPubkey]  // Each participant (NOT p-tagged)
["a", "31933:pubkey:dtag"]          // Project
```

### Brainstorm Reply (kind:1111)
```
// NDK auto-tags:
["E", rootEventId]
["e", parentEventId, relay, pubkey]

// TENEX adds:
["mode", "brainstorm"]
["t", "brainstorm"]
["p", moderatorPubkey]              // ONLY moderator!
["participant", ...]                // Copied from root
["a", "31933:pubkey:dtag"]
```

### Moderator Selection (kind:7)
```
["E", rootEventId]                  // Root conversation
["e", selectedMsgId1]               // Selected messages
["e", selectedMsgId2]
["e", selectedMsgId3]
```

## Subscription Patterns

### Subscribe to Conversation:
```typescript
const messages = ndk.$subscribe(() => {
  if (!rootEvent) return undefined;
  return {
    filters: [
      // All event kinds in this conversation
      {
        kinds: [11, 1111, 7, 21111, 513],
        ...rootEvent.filter()     // "#E": [rootId]
      },
      // Direct replies to any event in thread
      rootEvent.nip22Filter()     // "#e": [rootId]
    ],
    closeOnEose: false,
    bufferMs: 30
  };
});
```

### Subscribe to Project Status:
```typescript
const status = ndk.$subscribe(() => ({
  filters: [{
    kinds: [24010],
    "#a": [project.tagId()]  // "31933:pubkey:dtag"
  }],
  closeOnEose: false
}));
```

## Critical Implementation Details

### 1. Why .sign() with pTags: false?

**Problem**: NDK's .sign() automatically adds p-tags for any pubkeys mentioned in content
**Solution**: TENEX needs precise control over p-tags for agent routing
**Fix**: Pass `{ pTags: false }` to prevent automatic p-tag generation

### 2. Why remove .reply()'s auto p-tags?

**Problem**: .reply() doesn't generate p-tags by default, but we need custom p-tag logic
**Solution**: TENEX adds p-tags manually based on routing logic (mentions, selected agent, or fallback)

### 3. Why use .tag() vs manual array push?

```typescript
// .tag() method:
thread.tag(project.tagReference());

// Creates proper reference tag with relay hint and marker
// Returns: ["a", "31933:pubkey:dtag", relayHint, marker]
```

### 4. Brainstorm Mode Rationale

**Why only p-tag moderator?**
- Moderator sees all responses from all participants
- Moderator uses kind:7 reactions to select best responses
- Participants don't need to see each other's responses
- This prevents notification spam to all participants

**Why use "participant" tags?**
- Documents who's involved without notifying them
- Frontend can display participant list
- Replies preserve context by copying these tags

## Implementation Plan for Svelte

### Phase 1: Utilities
- [x] Port event classes (NDKProject, etc)
- [ ] Port DeltaContentAccumulator
- [ ] Port message processor (sortEvents, processEvent, etc)
- [ ] Create brainstorm utility functions

### Phase 2: Message Display
- [ ] Message.svelte (single message display)
- [ ] MessageList.svelte (list with streaming support)
- [ ] Handle React component rendering
- [ ] Handle streaming indicators

### Phase 3: Input & Sending
- [ ] ChatInput.svelte
  - Text input with auto-expand
  - Image upload integration
  - Agent selector (p-tag routing)
  - @mention detection and autocomplete
  - Brainstorm mode toggle
- [ ] Thread creation logic
- [ ] Reply logic with proper tagging

### Phase 4: Full Chat View
- [ ] ChatView.svelte (orchestrator)
- [ ] ThreadList.svelte (conversation list)
- [ ] Navigation between conversations
- [ ] Integration with ProjectColumn

## Questions Answered

**Q: When is .reply() used?**
A: Always when creating a reply (kind:1111). It handles e/E tag creation automatically.

**Q: What tags does .reply() create?**
A: E-tag (root), e-tag (parent), carries over A/E/I/P/K uppercase tags.

**Q: Why filter out p-tags after .reply()?**
A: TENEX needs custom p-tag logic for agent routing - can't use NDK's default behavior.

**Q: What's the difference between e and E tags?**
A:
- **E (capital)**: Root conversation ID (never changes in a thread)
- **e (lowercase)**: Direct parent message ID (changes with each reply level)

**Q: How does .tag() differ from .tags.push()?**
A: .tag() calls event.tagReference() which creates properly formatted reference tags with relay hints and markers.

**Q: What's project.tagReference() vs project.tagId()?**
A:
- **tagReference()**: Returns NDKTag array `["a", "kind:pubkey:dtag", relay, marker]`
- **tagId()**: Returns string `"kind:pubkey:dtag"` (for filters)

## Next: Deep Dive into Message Processor

Now I need to understand the exact logic in messageProcessor.ts to port it correctly.
