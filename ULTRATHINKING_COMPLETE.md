# TENEX Chat System - Ultra-Analysis Complete ✅

## Complete Tag Structure Understanding

### NDK's .reply() - What It Does

```typescript
const replyEvent = parentEvent.reply();
```

**Auto-creates these tags:**
- `["E", rootConversationId]` - Root conversation (capital E)
- `["e", parentEventId, relayHint, parentPubkey]` - Direct parent (lowercase e)
- `["A", rootAddress]` - If root is replaceable (capital A)
- `["K", rootKind]` - Root event kind
- Carries over existing A/E/I/P uppercase tags

**CRITICAL**: Creates proper NIP-22 threading automatically!

### Thread Creation Flow (kind:11)

```typescript
const thread = new NDKThread(ndk);
thread.content = "User's message";
thread.title = content.slice(0, 50);

// Add project reference
thread.tag(project.tagReference());
// Creates: ["a", "31933:pubkey:dtag", relayHint, marker]

// Add images
thread.tags.push(["image", sha256, url, mimeType, size]);
thread.tags.push(["blurhash", blurhash]);

// Extract and add hashtags from content
const hashtags = content.match(/#(\w+)/g);
hashtags.forEach(tag => thread.tags.push(["t", tag.slice(1).toLowerCase()]));

// P-TAG ROUTING - THE HEART OF AGENT COMMUNICATION:
// Priority 1: If @mentions detected
mentions.forEach(agent => thread.tags.push(["p", agent.pubkey]));

// Priority 2: If selectedAgent and not in mentions
if (selectedAgent && !mentions.includes(selectedAgent)) {
  thread.tags.push(["p", selectedAgent]);
}

// Priority 3: Fallback to Project Manager (first online agent)
if (mentions.length === 0 && !selectedAgent && onlineAgents.length > 0) {
  thread.tags.push(["p", onlineAgents[0].pubkey]);  // PM always first!
}

// Voice mode
if (autoTTS) thread.tags.push(["mode", "voice"]);

// BRAINSTORM MODE - COMPLETELY DIFFERENT:
if (brainstormSession?.enabled) {
  // Clear ALL p-tags first!
  thread.tags = thread.tags.filter(tag => tag[0] !== "p");

  // Add brainstorm tags
  thread.tags.push(["mode", "brainstorm"]);
  thread.tags.push(["t", "brainstorm"]);

  // P-tag ONLY the moderator
  thread.tags.push(["p", moderatorPubkey]);

  // Add participants WITHOUT p-tagging
  participantPubkeys.forEach(pubkey => {
    thread.tags.push(["participant", pubkey]);
  });
}

// Sign with pTags:false to prevent NDK auto-adding more p-tags
await thread.sign(undefined, { pTags: false });
thread.publish();
```

### Reply Creation Flow (kind:1111)

```typescript
const targetEvent = replyingTo || rootEvent;
const replyEvent = targetEvent.reply();  // NDK creates e/E/A tags!

replyEvent.content = "User's reply";

// STEP 1: Remove ALL p-tags that NDK might have added
replyEvent.tags = replyEvent.tags.filter(tag => tag[0] !== "p");

// STEP 2: Add project reference
if (project) {
  replyEvent.tags.push(["a", project.tagId()]);  // "31933:pubkey:dtag"
}

// STEP 3: Add images
images.forEach(img => {
  replyEvent.tags.push(["image", img.sha256, img.url, img.mimeType, img.size]);
  if (img.blurhash) replyEvent.tags.push(["blurhash", img.blurhash]);
});

// STEP 4: P-TAG ROUTING (if NOT brainstorm)
if (!isBrainstormConversation(rootEvent)) {
  // Add p-tags for @mentions
  mentions.forEach(agent => replyEvent.tags.push(["p", agent.pubkey]));

  // If selectedAgent and not in mentions
  if (selectedAgent && !mentions.some(m => m.pubkey === selectedAgent)) {
    replyEvent.tags.push(["p", selectedAgent]);
  }
  // Fallback: p-tag most recent non-user agent
  else if (!hasUnresolvedMentions && mentions.length === 0 && !selectedAgent) {
    const mostRecentAgent = [...recentMessages]
      .reverse()
      .find(msg => msg.event.pubkey !== user.pubkey);
    if (mostRecentAgent) {
      replyEvent.tags.push(["p", mostRecentAgent.pubkey]);
    }
  }
}

// STEP 5: Voice mode
if (autoTTS) replyEvent.tags.push(["mode", "voice"]);

// STEP 6: BRAINSTORM MODE (if in brainstorm conversation)
if (isBrainstormConversation(rootEvent)) {
  // Clear ALL p-tags
  replyEvent.tags = replyEvent.tags.filter(tag => tag[0] !== "p");

  // Add brainstorm mode tags
  if (!replyEvent.hasTag("mode", "brainstorm")) {
    replyEvent.tags.push(["mode", "brainstorm"]);
  }
  if (!replyEvent.hasTag("t", "brainstorm")) {
    replyEvent.tags.push(["t", "brainstorm"]);
  }

  // Preserve participant tags from root
  const participantTags = rootEvent.tags.filter(tag => tag[0] === "participant");
  participantTags.forEach(pTag => {
    if (!replyEvent.hasTag("participant", pTag[1])) {
      replyEvent.tags.push(pTag);
    }
  });

  // P-tag ONLY the moderator
  const moderatorPubkey = rootEvent.tagValue("p");
  if (moderatorPubkey) {
    replyEvent.tags.push(["p", moderatorPubkey]);
  }
}

// Sign and publish
await replyEvent.sign(undefined, { pTags: false });
await replyEvent.publish();
```

## Message Subscription - The Complete Picture

### Regular Conversation:
```typescript
const messages = ndk.$subscribe(() => {
  if (!rootEvent) return undefined;
  return {
    filters: [
      {
        kinds: [11, 1111, 7, 21111, 513],  // All message types
        ...rootEvent.filter()               // { "#e": [rootId] }
      },
      rootEvent.nip22Filter()              // { "#E": [rootId] }
    ],
    closeOnEose: false,
    bufferMs: 30
  };
});
```

**What this gets:**
- All events with `["e", rootId]` (lowercase e-tag)
- All events with `["E", rootId]` (uppercase E-tag)
- Covers entire conversation tree!

### Brainstorm Conversation:
```typescript
const messages = ndk.$subscribe(() => {
  if (!rootEvent) return undefined;
  return {
    filters: [
      {
        kinds: [1111, 7],            // Only replies and reactions
        ...rootEvent.filter()        // { "#e": [rootId] }
      },
      {
        kinds: [1111, 7],
        ...rootEvent.nip22Filter()   // { "#E": [rootId] }
      }
    ],
    closeOnEose: false
  };
});
```

**Why only kind:1111 and kind:7?**
- kind:1111 - Agent responses
- kind:7 - Moderator selections
- Filters out streaming (kind:21111) to reduce noise

## Streaming Response Reconstruction

### The Delta Flow:

```
Agent starts typing
  ↓
kind:21111 event #1: ["sequence", "0"], content: "Hello"
  ↓
kind:21111 event #2: ["sequence", "1"], content: " world"
  ↓
kind:21111 event #3: ["sequence", "2"], content: "!"
  ↓
Accumulator reconstructs: "Hello world!"
  ↓
Agent finishes
  ↓
kind:1111 (final): content: "Hello world!"
  ↓
Session deleted, show final message
```

### Out-of-Order Handling:

```
Receive: sequence 2 → "!"
Store: Map { 2 => "!" }
Reconstruct: "!"

Receive: sequence 0 → "Hello"
Store: Map { 0 => "Hello", 2 => "!" }
Reconstruct: "Hello!"

Receive: sequence 1 → " world"
Store: Map { 0 => "Hello", 1 => " world", 2 => "!" }
Reconstruct: "Hello world!"
```

**Key insight**: Always sort by sequence before joining!

## Brainstorm Mode - The Complete Picture

### Why It Exists:
Get multiple agent responses to same prompt, have moderator choose best one.

### How It Works:

**1. Thread Creation:**
```typescript
Thread tags:
["mode", "brainstorm"]
["t", "brainstorm"]
["p", moderatorPubkey]              // ONLY moderator notified!
["participant", agentPubkey1]        // Agent 1 (NOT notified)
["participant", agentPubkey2]        // Agent 2 (NOT notified)
["participant", agentPubkey3]        // Agent 3 (NOT notified)
```

**2. Agents Respond:**
Each participant agent sees the thread (via backend filtering) and responds with kind:1111

**3. Moderator Reviews:**
All responses visible to moderator. Moderator publishes kind:7 reactions:
```typescript
Reaction event:
["E", rootThreadId]          // Root conversation
["e", goodResponseId1]       // Selected response 1
["e", goodResponseId2]       // Selected response 2
```

**4. UI Filters:**
- Show root event (always)
- Show user's messages (always)
- Show ONLY responses with IDs in the kind:7 e-tags
- Hide the kind:7 reactions themselves

**5. Replies in Brainstorm:**
All replies preserve participant tags and p-tag ONLY moderator

### Critical Implementation Detail:

**Q: Why not p-tag all participants in thread?**
**A**: Would spam ALL agents with every message! Instead:
- Moderator gets p-tagged (sees everything)
- Participants listed in "participant" tags (context only)
- Backend agents filter by participant tags to know they should respond

## Filter Methods Reference

### event.filter()
Returns events that reference this event with **lowercase** tags:
- Regular events: `{ "#e": [eventId] }`
- Replaceable: `{ "#a": [address] }`

### event.nip22Filter()
Returns events that reference this event with **UPPERCASE** tags:
- Regular events: `{ "#E": [eventId] }`
- Replaceable: `{ "#A": [address] }`

### Combined in subscription:
```typescript
[
  { kinds: [1111], ...rootEvent.filter() },      // Direct replies
  rootEvent.nip22Filter()                         // Root references
]
```
Gets the entire conversation tree!

## Implementation Checklist

### Utilities ✅
- [x] DeltaContentAccumulator
- [x] messageProcessor (sortEvents, processEvent, processEventsToMessages)
- [x] Event kind constants

### Next: Chat Components
- [ ] ChatInput.svelte
  - Text input with Enter/Cmd+Enter handling
  - Agent selector (for p-tag routing)
  - @mention detection and autocomplete
  - Image upload
  - Brainstorm mode toggle
  - Thread creation vs reply logic
- [ ] Message.svelte (single message display)
- [ ] MessageList.svelte (list with streaming)
- [ ] ChatView.svelte (full orchestrator)
- [ ] ThreadList.svelte (conversation list)

### Critical Questions for Next Phase:

**Q1: How should we handle @mention autocomplete in Svelte?**
- React uses custom hook with cursor position tracking
- Svelte could use $effect with input binding

**Q2: How should streaming sessions be reactive?**
- Option A: Process in $derived
- Option B: Process in $effect and update state
- **Recommendation**: $derived with processEventsToMessages

**Q3: Should we build chat incrementally or all at once?**
- Option A: ChatInput first (can send messages)
- Option B: MessageList first (can see messages)
- Option C: Both together (can test complete flow)
- **Recommendation**: Both together - need to test end-to-end

## What Makes TENEX Special

**Not just a chat app** - it's an **agent orchestration platform**:

1. **kind:24010 (Project Status)** - Backend publishes real-time roster of online agents/models
2. **P-tag routing** - Messages route to specific agents via p-tags
3. **kind:24101 (LLM Config)** - Switch agent's model mid-conversation
4. **Brainstorm mode** - Multi-agent parallel responses with moderator selection
5. **kind:21111 streaming** - Real-time delta reconstruction
6. **MCP tools** - Agents can use external tools (kind:4200)
7. **Agent definitions** - kind:4199 defines agent's behavior/capabilities

Every detail matters for the agent coordination to work correctly!

---

**Ready to build the chat interface with complete understanding of the message flow!**
