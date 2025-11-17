# Event-Driven Streaming Implementation

## Overview
Successfully refactored the streaming message handling from O(n²) array-based reactive processing to O(1) event-driven Map-based approach.

## Key Changes

### 1. New ConversationState Class
- **Location**: `/src/lib/stores/conversation-state.svelte.ts`
- Uses `SvelteMap` from `svelte/reactivity` for proper Svelte 5 reactivity
- Event-driven processing with `ndk.subscribe()` and `onEvent` callback
- Map-based state management for O(1) lookups and updates
- Conversation-scoped (no global state)
- Automatic cleanup on destroy

### 2. Component Updates
- **MessageList.svelte**: Now uses ConversationState instead of processEventsToMessages
- **ThreadedMessage.svelte**: Uses ConversationState for reply processing
- **CallView.svelte**: Replaced subscription with ConversationState

### 3. Memory Leak Fix
- Removed global `finalizedStreamingIds` Set from `messageProcessor.ts`
- All state is now conversation-scoped and cleaned up on unmount

## Performance Improvements

### Before (Array-based Reactive)
- **Complexity**: O(n²) - reprocessed ALL events on every change
- **Memory**: Unbounded growth from global `finalizedStreamingIds` Set
- **Array allocations**: New array on every event

### After (Event-driven Map)
- **Complexity**: O(1) per event, O(n log n) only when rebuilding display array
- **Memory**: Conversation-scoped with automatic cleanup
- **Map updates**: Only modified entries

## How It Works

1. **Event Arrival**: NDK subscription calls `onEvent` callback
2. **O(1) Processing**: Event is processed and Map entry updated
3. **Reactive Display**: `displayMessages` derived rebuilds sorted array
4. **UI Update**: Components react to changes in displayMessages

## Event Types Handled

- **Kind 1111 (GenericReply)**: Final messages that replace streaming
- **Kind 21111 (TenexStreamingResponse)**: Streaming deltas accumulated
- **Kind 21081 (TenexAgentTypingStart)**: Typing indicators
- **Kind 21082 (TenexAgentTypingStop)**: Remove typing indicators
- **Kind 7**: Moderation/selection events for brainstorm mode
- **Other kinds**: Regular messages

## Key Design Decisions

1. **SvelteMap for Reactivity**: Using Svelte's reactive Map ensures proper UI updates
2. **Event-driven vs Reactive**: Process events as they arrive rather than reprocessing arrays
3. **Map-based State**: O(1) lookups and updates instead of array filtering
4. **Conversation Scoping**: Each conversation manages its own state
5. **Natural Finalization**: Streaming replaced by final messages automatically

## Testing Checklist

- [x] Build passes without errors
- [ ] Single streaming message updates correctly
- [ ] Streaming to final message transition works
- [ ] Multiple concurrent conversations don't interfere
- [ ] Typing indicators appear/disappear correctly
- [ ] Memory is properly cleaned up on unmount
- [ ] Threaded view shows correct replies
- [ ] Brainstorm mode filtering works

## Clean Refactor Complete

The implementation is complete with a clean refactor:
- **NO deprecation warnings** - removed `processEventsToMessages` entirely
- **NO backwards compatibility** - clean, modern implementation only
- All components use the event-driven ConversationState approach
- messageProcessor.ts now only exports the Message type and sortEvents utility
- All streaming logic is encapsulated in ConversationState class