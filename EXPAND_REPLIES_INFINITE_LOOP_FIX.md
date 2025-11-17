# Fix for Expand Replies Infinite Loop

## Issue
When clicking "x replies >" button to expand replies in ThreadedMessage component, the app would enter an infinite loop with error:
- `effect_update_depth_exceeded`
- `infinite_loop_guard`

## Root Cause
The `expandedRepliesStore` was creating a **new SvelteSet instance** on every operation (toggle, expand, collapse):

```typescript
// OLD - Creates new SvelteSet, triggers excessive reactivity
toggle(messageId: string): void {
    const newSet = new SvelteSet(this.expanded); // NEW SET!
    if (newSet.has(messageId)) {
        newSet.delete(messageId);
    } else {
        newSet.add(messageId);
    }
    this.expanded = newSet; // Replaces entire set
}
```

This caused:
1. Every toggle creates a new SvelteSet
2. This triggers all reactive dependencies to update
3. ThreadedMessage's `$derived` values recalculate
4. Effects re-run
5. Creates a cascade of updates leading to infinite loop

## Solution
Fixed by **mutating the existing SvelteSet** instead of creating new ones:

```typescript
// NEW - Mutates existing SvelteSet, proper reactivity
toggle(messageId: string): void {
    if (this.expanded.has(messageId)) {
        this.expanded.delete(messageId); // Direct mutation
    } else {
        this.expanded.add(messageId); // Direct mutation
    }
}
```

## Files Changed
1. **src/lib/stores/expandedReplies.svelte.ts**:
   - `toggle()`: Now uses direct `.add()` and `.delete()`
   - `expand()`: Now uses direct `.add()`
   - `collapse()`: Now uses direct `.delete()`

2. **src/lib/components/chat/ThreadedMessage.svelte**:
   - Simplified cleanup effect
   - Added debug logging to track issues

## Why This Works
- SvelteSet is designed to be **mutable** and reactive
- Direct mutations (.add, .delete) trigger proper fine-grained updates
- No unnecessary object creation = no excessive reactivity
- Svelte can track exactly what changed instead of replacing entire store

## Result
✅ Clicking "x replies >" now properly expands/collapses replies without infinite loops
✅ Performance improved - no unnecessary re-renders
✅ Proper reactive updates only when needed