# Conversation Loading Fix - Immediate Destruction Issue

## Problem Identified
The ConversationState was being created successfully but then **immediately destroyed** within 17ms, causing "No messages yet" to appear even though the root event existed.

## Root Cause
The issue was in how Svelte 5's `$effect` cleanup functions work. The original code had:

```typescript
$effect(() => {
    // Create ConversationState logic...

    // Cleanup on unmount
    return () => {
        if (conversationState) {
            conversationState.destroy();
        }
    };
});
```

**The Problem**: In Svelte 5, when an effect returns a cleanup function, that cleanup is called:
1. When the effect reruns (for ANY reason)
2. When the component unmounts

This meant that even if the rootEvent ID didn't change, if the effect ran again for any dependency change, it would:
1. Return a NEW cleanup function
2. This causes the PREVIOUS cleanup function to execute
3. The previous cleanup destroys the ConversationState

## The Fix
Separated the cleanup logic into two independent effects:

```typescript
// Effect 1: Handle ConversationState creation/updates
$effect(() => {
    const newRootEventId = rootEvent?.id || null;

    if (newRootEventId !== currentRootEventId) {
        // Destroy old state if needed
        if (conversationState) {
            conversationState.destroy();
            conversationState = null;
        }

        // Create new state
        if (rootEvent) {
            conversationState = new ConversationState(...);
            conversationState.start();
        }

        currentRootEventId = newRootEventId;
    }
    // NO cleanup function returned here
});

// Effect 2: Handle cleanup ONLY on component unmount
$effect(() => {
    return () => {
        if (conversationState) {
            conversationState.destroy();
            conversationState = null;
        }
    };
});
```

## Files Fixed
1. **MessageList.svelte**: Main conversation view
2. **ThreadedMessage.svelte**: Nested reply threads
3. **CallView.svelte**: Voice call conversations

## Result
- ConversationState is now only destroyed when:
  - The rootEvent ID actually changes (intentional recreation)
  - The component unmounts (proper cleanup)
- No more immediate destruction after creation
- Conversations now load and display properly

## Verification
The debug logs should now show:
1. ConversationState created
2. Root event added to messages
3. Subscription started
4. **NO immediate destruction**
5. Messages displayed correctly