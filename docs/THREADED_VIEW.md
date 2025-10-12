# Threaded View Feature

## Overview
The threaded view feature provides a hierarchical display of conversation messages, showing the reply structure with visual nesting and connecting lines. Users can toggle between threaded (nested) and flattened (chronological) views.

## View Modes

### Threaded Mode (Default)
- Messages are displayed in a tree structure
- Replies are indented under their parents
- Visual connecting lines show parent-child relationships
- Reply dots indicate thread connections
- Maximum nesting depth of 5 levels to prevent extreme indentation

### Flattened Mode
- All messages displayed chronologically
- No nesting or indentation
- Simple linear view
- Useful for reading all messages in order

## Visual Design

### Thread Indicators
```
Message 1
│
├─ Reply 1.1
│  │
│  └─ Reply 1.1.1
│
└─ Reply 1.2
```

**Elements:**
- **Vertical lines**: Connect parent to children (gray, 2px width)
- **Reply dots**: Small circles at reply connection points
- **Indentation**: 16px per nesting level
- **Colors**: Gray lines and dots for subtle visual hierarchy

## Implementation

### Architecture

#### 1. Tree Builder (`threadBuilder.ts`)
Converts flat message list to hierarchical tree:

```typescript
interface ThreadedMessage extends Message {
  replies: ThreadedMessage[];
  depth: number;
  parentId?: string;
}

function buildMessageTree(messages: Message[], rootEvent: NDKEvent | null): ThreadedMessage[]
```

**Algorithm:**
1. Create map of all messages for quick lookup
2. Find parent references from e-tags (lowercase 'e' = parent)
3. Build parent-child relationships
4. Calculate depth for each message
5. Sort replies chronologically within each level
6. Return root-level messages

**Parent Detection:**
- Uses lowercase 'e' tags for parent references
- Looks for tag with `marker: 'reply'` or without marker
- Ignores root event ID (uppercase 'E' tag)

#### 2. Threaded Message Component (`ThreadedMessage.svelte`)
Recursive component for rendering nested messages:

```svelte
<ThreadedMessage message={message} maxDepth={5} />
```

**Features:**
- Recursive rendering of replies
- Dynamic indentation based on depth
- Visual thread lines positioned correctly
- Reply indicator dots at connection points
- Self-referencing for nested replies

**Styling:**
```css
padding-left: {depth * 16}px  /* Indent each level */
thread-line left: {(depth - 1) * 16 + 12}px  /* Position line */
reply-dot left: -{depth * 16 - 4}px  /* Position dot */
```

#### 3. Message List (`MessageList.svelte`)
Orchestrates view mode and rendering:

```typescript
const messageTree = $derived.by(() => {
  if (viewMode === 'threaded') {
    return buildMessageTree(flatMessages, rootEvent);
  }
  return [];
});
```

**Process:**
1. Subscribe to all conversation events
2. Process events to flat message list (with streaming)
3. Build tree structure if threaded mode
4. Render with appropriate component

#### 4. Chat View (`ChatView.svelte`)
Provides view mode toggle and state management:

```typescript
let viewMode = $state<ThreadViewMode>('threaded');

function toggleViewMode() {
  viewMode = viewMode === 'threaded' ? 'flattened' : 'threaded';
}
```

**UI:**
- Toggle button in chat header
- Icon changes based on mode
- Label shows current mode ("Threaded" or "Flat")

## How It Works

### Building the Tree

1. **Start with Flat Messages:**
   ```typescript
   const flatMessages = processEventsToMessages(events, rootEvent, 'flattened')
   ```

2. **Create Message Map:**
   ```typescript
   const messageMap = new Map<string, ThreadedMessage>();
   messages.forEach(message => {
     messageMap.set(message.id, {
       ...message,
       replies: [],
       depth: 0,
       parentId: undefined
     });
   });
   ```

3. **Build Relationships:**
   ```typescript
   messages.forEach(message => {
     const eTags = message.event.getMatchingTags('e');
     const parentTag = eTags.find(tag =>
       tag[3] === 'reply' || (!tag[3] && tag[1] !== rootEvent?.id)
     );

     if (parentTag) {
       const parent = messageMap.get(parentTag[1]);
       if (parent) {
         threadedMsg.parentId = parentTag[1];
         threadedMsg.depth = parent.depth + 1;
         parent.replies.push(threadedMsg);
       }
     }
   });
   ```

4. **Extract Roots:**
   ```typescript
   const rootMessages = Array.from(messageMap.values())
     .filter(msg => !msg.parentId || msg.event.id === rootEvent?.id);
   ```

### Rendering the Tree

**Threaded Mode:**
```svelte
{#each messageTree as message (message.id)}
  <ThreadedMessage {message} />
{/each}
```

**Flattened Mode:**
```svelte
{#each displayMessages as message (message.id)}
  <Message {message} />
{/each}
```

### Thread Lines Calculation

For depth = 3 (3 levels deep):
- **Indent**: 3 × 16px = 48px
- **Line position**: (3-1) × 16 + 12 = 44px from left
- **Dot position**: -(3 × 16 - 4) = -44px from message

## Tag Structure

### Parent References (lowercase 'e')
```
["e", "<parent-message-id>", "<relay-hint>", "reply"]
```

### Root References (uppercase 'E')
```
["E", "<root-thread-id>", "<relay-hint>"]
```

### How NDK Creates These
When using `event.reply()`:
```typescript
const reply = rootEvent.reply();
// Auto-creates:
// - ["E", rootId] for root reference
// - ["e", parentId, "", "reply"] for parent reference
```

## Performance Considerations

### Tree Building
- **Complexity**: O(n) where n = number of messages
- **Memory**: Creates new tree structure, but messages are shared references
- **Optimization**: Map-based lookup for O(1) parent finding

### Rendering
- **Component reuse**: Message component reused in both modes
- **Recursive rendering**: Efficient with Svelte's reactivity
- **Max depth limit**: Prevents excessive nesting and performance issues

### Reactivity
- **Derived state**: `$derived.by()` automatically rebuilds tree when messages change
- **Conditional rendering**: Only builds tree in threaded mode
- **Efficient updates**: Svelte only re-renders changed branches

## User Experience

### Switching Modes
1. Click toggle button in chat header
2. Icon and label update immediately
3. Messages re-render in new layout
4. Scroll position preserved when possible

### Reading Threads
**Threaded Mode:**
- Easy to follow conversation branches
- See reply context immediately
- Understand conversation structure
- Good for complex multi-party discussions

**Flattened Mode:**
- See all messages in order
- No nesting confusion
- Simple chronological reading
- Good for catching up on activity

## Edge Cases Handled

### Orphaned Messages
- Messages with non-existent parent IDs
- **Solution**: Treated as root-level messages

### Circular References
- Parent pointing to child pointing to parent
- **Solution**: Map-based tracking prevents infinite loops

### Missing E-tags
- Events without proper parent tags
- **Solution**: Falls back to root-level display

### Deep Nesting
- Conversations with 10+ levels
- **Solution**: Max depth limit of 5 prevents UI issues

### Mixed Event Types
- Streaming responses (kind:21111)
- Metadata events (kind:513)
- Reactions (kind:7)
- **Solution**: All processed uniformly in flat list first

## Future Enhancements

### Collapsible Threads
- [ ] Click to collapse/expand reply branches
- [ ] Collapse long threads automatically
- [ ] "Show N more replies" buttons

### Thread Preview
- [ ] Show reply count on messages
- [ ] Preview first few words of replies
- [ ] Hover to preview full thread

### Visual Improvements
- [ ] Color-coded threads by author
- [ ] Highlight active thread path
- [ ] Fade out off-topic branches
- [ ] Thread minimap for long conversations

### Navigation
- [ ] Jump to parent/child messages
- [ ] Keyboard shortcuts for thread navigation
- [ ] "View in context" button for deep replies

### Performance
- [ ] Virtual scrolling for long threads
- [ ] Lazy loading of deep reply branches
- [ ] Pagination for very long conversations

## Code Organization

```
src/lib/utils/
├── threadBuilder.ts          # Tree building logic
└── messageProcessor.ts       # Flat message processing

src/lib/components/chat/
├── ThreadedMessage.svelte    # Recursive threaded renderer
├── Message.svelte            # Single message display
├── MessageList.svelte        # View mode orchestration
└── ChatView.svelte           # Toggle and state management
```

## Testing Scenarios

### Basic Threading
1. Create thread (kind:11)
2. Reply to thread → indent by 1
3. Reply to reply → indent by 2
4. Verify connecting lines

### Complex Threads
1. Create thread with multiple replies at same level
2. Each reply has its own sub-replies
3. Verify tree structure is correct
4. Toggle between modes

### Edge Cases
1. Message with missing parent → shows at root
2. Very deep nesting (6+ levels) → stops at max depth
3. Rapid message arrival → tree rebuilds correctly
4. Streaming responses → integrated properly

## Best Practices

### When to Use Threaded
- Complex multi-agent discussions
- Branching conversation topics
- Following specific reply chains
- Understanding conversation structure

### When to Use Flattened
- Catching up on activity
- Reading chronologically
- Simple back-and-forth
- Searching for specific messages

## Related Documentation
- [CHAT_SYSTEM_ANALYSIS.md](./CHAT_SYSTEM_ANALYSIS.md) - Complete tag structure
- [ULTRATHINKING_COMPLETE.md](./ULTRATHINKING_COMPLETE.md) - Threading deep-dive
- [messageProcessor.ts](../src/lib/utils/messageProcessor.ts) - Flat processing
- [threadBuilder.ts](../src/lib/utils/threadBuilder.ts) - Tree building
