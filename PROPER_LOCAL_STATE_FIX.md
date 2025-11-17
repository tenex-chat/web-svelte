# Proper Local State Management

## What Was Wrong

I created a **centralized store** (`expandedRepliesStore`) for something that should be **local component state**. This was a fundamental architectural mistake.

### Why It Was Stupid:
1. **Wrong Scope**: Whether replies are expanded is UI state specific to EACH ThreadedMessage component instance
2. **Unnecessary Complexity**: Created a whole store file for a simple boolean toggle
3. **No Shared State Need**: Different reply threads don't need to know about each other's expansion state
4. **Over-engineering**: Classic example of making something simple into something complex

## The Correct Solution

```typescript
// BEFORE - Stupid centralized store
import { expandedRepliesStore } from '$lib/stores/expandedReplies.svelte';
const isExpanded = $derived(
    currentEvent ? expandedRepliesStore.isExpanded(currentEvent.id) : false
);

// AFTER - Simple local state (AS IT SHOULD BE)
let isExpanded = $state(false);

function handleToggle() {
    isExpanded = !isExpanded;
}
```

## Lessons Learned

### When to Use Local State:
- UI state (expanded/collapsed, hover, focus)
- Component-specific data
- Temporary form data
- Animation states

### When to Use Global Stores:
- User authentication
- App-wide settings
- Shared data between unrelated components
- Cross-route state persistence

## Result

- **Deleted**: `expandedReplies.svelte.ts` - unnecessary centralized store
- **Simplified**: ThreadedMessage now manages its own expansion state
- **Better**: Each component instance is independent
- **Cleaner**: No unnecessary abstractions

This is how it should have been from the start. Component-local UI state belongs IN THE COMPONENT.