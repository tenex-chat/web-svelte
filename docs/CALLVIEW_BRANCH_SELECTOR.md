# CallView Branch Selector Feature

## Overview
The CallView component now includes a branch/worktree selector, allowing users to specify which Git branch agents should work on during voice calls. This ensures that all messages published from the CallView include the correct `branch` tag, providing essential context for agents to operate on the appropriate codebase.

## Motivation
Previously, the CallView component did not provide a way for users to specify which branch agents should target during voice conversations. This meant:
- Agents might work on the wrong branch
- No visibility into which branch was being targeted
- Inconsistent behavior between text chat (ChatInput) and voice calls (CallView)

The branch selector solves these issues by providing a unified interface across both text and voice interactions.

## Implementation

### Component Architecture

#### CallView.svelte
The main voice call interface component has been enhanced with branch selection capabilities.

**Key Changes**:
1. Import `WorktreeSelector` component from chat components
2. Add worktree state management
3. Include branch tags in published messages
4. Derive default branch from conversation context

### State Management

#### Worktree State
```typescript
// Get available worktrees from project status store
const availableWorktrees = $derived(
  projectId ? projectStatusStore.getWorktrees(projectId) : []
);

// Get default worktree from project
const defaultWorktree = $derived(
  projectId ? projectStatusStore.getDefaultWorktree(projectId) : null
);

// User's manual selection
let selectedWorktree: string | null = $state(null);
```

#### Default Branch Logic
The component intelligently derives the default branch from recent conversation messages:

```typescript
const defaultWorktreeFromMessages = $derived.by(() => {
  if (availableWorktrees.length === 0) return null;

  // If there are recent messages, find the most recent branch tag
  if (messages.length > 0) {
    const recentWorktree = [...messages].reverse().find((msg) => {
      const branchTag = msg.event.tags.find((tag) => tag[0] === 'branch' && tag[1]);
      return branchTag !== undefined;
    });

    if (recentWorktree) {
      const branchTag = recentWorktree.event.tags.find(
        (tag) => tag[0] === 'branch' && tag[1]
      );
      return branchTag?.[1] || null;
    }
  }

  // Otherwise, default to the first worktree (default branch)
  return defaultWorktree ?? null;
});
```

#### Current Worktree
The active branch is determined by this priority:
1. User's manual selection (if any)
2. Derived default from recent messages
3. Project's default branch

```typescript
const currentWorktree = $derived(selectedWorktree || defaultWorktreeFromMessages);
```

### Message Publishing

Both thread creation and reply functions now include the branch tag:

#### Creating New Thread
```typescript
async function createThread(
  content: string,
  _mentions: any[],
  _images: any[],
  _autoTTS: boolean,
  selectedAgent: string | null
): Promise<NDKEvent | null> {
  const thread = new NDKThread(ndk);
  thread.content = content;
  thread.title = content.slice(0, 50);

  // ... other tags ...

  // Add branch tag if specified
  if (currentWorktree) {
    thread.tags.push(['branch', currentWorktree]);
  }

  await thread.sign(undefined, { pTags: false });
  await thread.publish();

  return thread;
}
```

#### Sending Reply
```typescript
async function sendReply(
  content: string,
  _mentions: any[],
  _images: any[],
  _autoTTS: boolean,
  _messages: any[],
  selectedAgent: string | null
): Promise<NDKEvent | null> {
  const reply = localRootEvent.reply();
  reply.content = content;

  // ... other tags ...

  // Add branch tag if specified
  if (currentWorktree) {
    reply.tags.push(['branch', currentWorktree]);
  }

  await reply.sign(undefined, { pTags: false });
  await reply.publish();

  return reply;
}
```

### UI Components

#### WorktreeSelector Integration
The WorktreeSelector component is placed in the CallView header, next to the AgentSelector:

```svelte
<div class="flex items-center gap-3">
  <h2 class="text-lg font-medium text-foreground">
    {project?.title || 'Voice Call'}
  </h2>

  {#if onlineAgents.length > 0}
    <AgentSelector
      agents={onlineAgents}
      selectedAgent={selectedAgentPubkey}
      defaultAgent={defaultAgent}
      currentModel={activeProjectAgent?.model}
      onSelect={handleAgentSelect}
      onConfigure={handleAgentConfigure}
    />
  {/if}

  {#if availableWorktrees.length > 0}
    <WorktreeSelector
      worktrees={availableWorktrees}
      selectedWorktree={selectedWorktree}
      defaultWorktree={defaultWorktreeFromMessages}
      onSelect={(branch) => (selectedWorktree = branch)}
    />
  {/if}
</div>
```

## User Flow

### Default Behavior
1. User starts a voice call from a project
2. CallView opens with branch selector visible (if worktrees exist)
3. Branch selector displays the default branch (from recent messages or project default)
4. User speaks their message
5. Message is published with the current branch tag
6. Agents receive message and work on the specified branch

### Manual Branch Selection
1. User clicks the branch selector dropdown
2. Available branches are displayed
3. User selects a different branch
4. Subsequent messages include the newly selected branch tag
5. Agents switch to working on the new branch

### Conversation Continuity
1. User sends a message on `feature-auth` branch
2. Agent responds (also tagged with `feature-auth`)
3. User starts a new call in the same conversation
4. CallView automatically selects `feature-auth` based on recent messages
5. Conversation continues seamlessly on the same branch

## Tag Structure

### Branch Tag Format
```
["branch", <branch-name>]
```

### Example Event with Branch Tag
```json
{
  "kind": 11,
  "content": "Please add unit tests for the authentication module",
  "tags": [
    ["a", "31933:pubkey:my-project"],
    ["p", "agent-pubkey"],
    ["mode", "voice"],
    ["branch", "feature-auth"]
  ]
}
```

## Integration with Project Status Store

The CallView leverages the centralized `projectStatusStore` to retrieve worktree information:

### Available Methods
- `getWorktrees(projectId)` - Returns array of available branch names
- `getDefaultWorktree(projectId)` - Returns the default branch name

### Example Usage
```typescript
const projectId = $derived(project?.tagId());
const availableWorktrees = $derived(
  projectId ? projectStatusStore.getWorktrees(projectId) : []
);
const defaultWorktree = $derived(
  projectId ? projectStatusStore.getDefaultWorktree(projectId) : null
);
```

## Consistency with ChatInput

The implementation mirrors the ChatInput component's branch selection logic:

### Shared Patterns
1. **Same Component** - Both use `WorktreeSelector.svelte`
2. **Same State Logic** - Both derive default from recent messages
3. **Same Tag Format** - Both publish `["branch", <branch-name>]` tags
4. **Same Priority** - Both prioritize: selected → recent → default

### Benefits
- Consistent user experience across text and voice interfaces
- Agents receive the same context regardless of input method
- Easier to maintain with shared code and patterns

## Code Changes Summary

### Files Modified
- `/src/lib/components/call/CallView.svelte`

### Lines Added
- Import statement for `WorktreeSelector` (line 14)
- Worktree state declarations (lines 40-47)
- Default worktree derivation logic (lines 68-90)
- Branch tag in `createThread` (lines 181-184)
- Branch tag in `sendReply` (lines 233-236)
- WorktreeSelector UI component (lines 374-381)

### Total Changes
- **6 sections modified**
- **~40 lines added**
- **0 lines removed**
- **100% backward compatible**

## Testing Considerations

### Manual Testing Checklist
- [ ] Branch selector appears when worktrees exist
- [ ] Branch selector hidden when no worktrees available
- [ ] Default branch auto-selected from recent messages
- [ ] Manual branch selection persists during call
- [ ] Branch tag included in published threads
- [ ] Branch tag included in published replies
- [ ] Dropdown displays all available branches
- [ ] Conversation continuity maintained across calls

### Edge Cases
- Project with no worktrees → Selector hidden, no branch tag
- Project with one worktree → Shows default, no need to switch
- Conversation with mixed branches → Uses most recent
- New conversation → Uses project default

## Performance Impact

### Memory
- **Negligible** - Only stores selected branch string (null or ~10-30 chars)
- No additional subscriptions or event storage

### Network
- **Zero increase** - Branch data already fetched by `projectStatusStore`
- One additional tag per message (~15-30 bytes)

### Rendering
- **Minimal** - WorktreeSelector uses Portal for dropdown
- Dropdown only rendered when open
- Reactive derivations cached by Svelte

## Future Enhancements

### Potential Improvements
- [ ] Show current branch in call status display
- [ ] Branch indicator in voice visualizer
- [ ] Auto-switch branch based on agent recommendations
- [ ] Branch history in conversation
- [ ] "Recently used branches" quick selector
- [ ] Branch creation from CallView
- [ ] Visual diff of branch changes during call

### Integration Opportunities
- [ ] Link to branch in project settings
- [ ] Show branch commits in timeline
- [ ] Branch-specific conversation filtering
- [ ] Multi-branch conversation support
- [ ] Branch merge conflict warnings

## Related Documentation
- [ChatInput.svelte](../src/lib/components/chat/ChatInput.svelte) - Text input with branch selector
- [WorktreeSelector.svelte](../src/lib/components/chat/WorktreeSelector.svelte) - Shared branch selector component
- [PROJECT_STATUS_STORE.md](./PROJECT_STATUS_STORE.md) - Centralized project status management
- [CallView.svelte](../src/lib/components/call/CallView.svelte) - Voice call interface implementation

## Nostr Event Structure

### Thread Event (kind:11)
```json
{
  "kind": 11,
  "content": "Conversation title/first message",
  "tags": [
    ["a", "31933:project-owner-pubkey:project-dtag"],
    ["p", "agent-pubkey"],
    ["mode", "voice"],
    ["branch", "main"]
  ],
  "created_at": 1735858800
}
```

### Reply Event (kind:1111)
```json
{
  "kind": 1111,
  "content": "Follow-up message in conversation",
  "tags": [
    ["e", "root-thread-event-id", "", "root"],
    ["e", "parent-event-id", "", "reply"],
    ["a", "31933:project-owner-pubkey:project-dtag"],
    ["p", "agent-pubkey"],
    ["mode", "voice"],
    ["branch", "main"]
  ],
  "created_at": 1735858860
}
```

## Best Practices

### For Users
1. **Check the branch** - Verify correct branch before starting call
2. **Switch explicitly** - Don't rely on defaults for critical work
3. **Mention in message** - Can also verbally specify branch for clarity
4. **Review history** - Check message tags to confirm branch context

### For Developers
1. **Always check `currentWorktree`** - Don't assume branch exists
2. **Use derived state** - Wrap worktree logic in `$derived()`
3. **Follow ChatInput pattern** - Keep implementations consistent
4. **Test edge cases** - Verify behavior with no worktrees
5. **Validate branch names** - Ensure branch exists before publishing

### For Agents
1. **Read branch tag** - Check `["branch", ...]` in message tags
2. **Switch context** - Change working directory to specified branch
3. **Validate branch** - Confirm branch exists before operating
4. **Preserve branch** - Include branch tag in response messages
5. **Handle missing** - Default to main/master if no branch specified

## Deployment Notes

### Requirements
- Requires `projectStatusStore` to be initialized
- Requires `WorktreeSelector` component to be available
- Compatible with existing CallView functionality
- No database migrations needed
- No API changes required

### Rollout Strategy
1. Deploy to staging environment
2. Test with multiple projects
3. Verify branch tags in published events
4. Monitor agent responses for branch context
5. Deploy to production
6. Update user documentation

### Rollback Plan
If issues occur:
1. No data corruption (events already published)
2. Previous CallView version works without branch tags
3. Agents can operate without branch context
4. Simply revert component changes
5. Branch selector will be hidden but functionality preserved

## Conclusion

The CallView branch selector feature provides a seamless way for users to specify Git branches during voice calls, ensuring agents have proper context for their operations. By mirroring the ChatInput implementation, we maintain consistency across the application while providing powerful branching capabilities for voice-based development workflows.

**Key Achievements**:
✅ Unified branch selection across text and voice interfaces
✅ Intelligent default branch detection from conversation context
✅ Clean, consistent UI integrated into existing CallView
✅ Zero breaking changes to existing functionality
✅ Minimal performance overhead
✅ Full backward compatibility with agents that don't use branch tags

This feature empowers users to have productive voice conversations with agents while maintaining precise control over which branch of code is being discussed and modified.
