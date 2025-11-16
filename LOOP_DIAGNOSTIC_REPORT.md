# Streaming Message Loop Diagnostic Report

## Problem Summary
A loop occurs when streaming responses (kind 21111) and final messages (kind 1111) arrive, causing the same streaming events to be reprocessed repeatedly.

## Root Cause Analysis

### The Loop Mechanism

**Location**: `src/lib/components/chat/MessageList.svelte` lines 259-267

The problematic code:
```typescript
streamingEvents
    .filter(e => e.pubkey === event.pubkey)
    .forEach(e => processedStreamingEvents.delete(e.id));
```

### How The Loop Works

1. **Initial State**:
   - Streaming events (kind 21111) arrive from an agent
   - Events are processed via `streamingMessageStore.processStreamingEvent()`
   - Event IDs are added to `processedStreamingEvents` Set

2. **Final Message Arrives** (kind 1111):
   - Effect detects the final message
   - Calls `streamingMessageStore.clearSession(event.pubkey)` ✅ (correct)
   - Adds final message ID to `processedFinalEvents` Set ✅ (correct)
   - **PROBLEM**: Deletes ALL streaming event IDs for that pubkey from `processedStreamingEvents` ❌

3. **Loop Trigger**:
   - Streaming events are still present in `messagesSubscription.events`
   - But their IDs are no longer in `processedStreamingEvents`
   - Next effect run treats them as "new" events
   - They get reprocessed via `streamingMessageStore.processStreamingEvent()`
   - This creates/updates streaming sessions that should be cleared
   - Store mutations trigger `flatMessages` derived to recalculate
   - Process repeats

### Why This Happens

The subscription has `closeOnEose: false`, keeping it open to receive new events. The subscription maintains ALL received events in `messagesSubscription.events`, including:
- Old streaming events (21111)
- The final message (1111)

When we delete streaming event IDs from tracking, we're telling the effect "you haven't seen these before", even though:
1. They were already processed
2. A final message has arrived for that pubkey
3. The streaming session was already cleared

### Potential Triggers for Re-runs

The effect runs when `messagesSubscription.events` changes, which can happen when:
1. New events arrive from the relay
2. The subscription receives duplicate events (multiple filters can match the same event)
3. Buffer timeout (30ms) causes batched updates

## Diagnostics Added

### 1. Duplicate Event Detection
**Location**: Lines 152-166

Checks if the same event appears multiple times in the subscription (possible due to overlapping filters).

### 2. Reprocessing Detection
**Location**: Lines 186-219

Detects when streaming events are being reprocessed after their pubkey received a final message. This is the smoking gun that confirms the loop.

### 3. Deletion Tracking
**Location**: Lines 131, 257, 231-267

Tracks which pubkeys have had their streaming events deleted from tracking, and logs warnings when this happens.

### 4. Effect Run Summary
**Location**: Lines 286-295

Provides a comprehensive summary of each effect run, including:
- New vs reprocessed events
- Current tracking set sizes
- Loop detection status

## Expected Diagnostic Output

When the bug occurs, you should see:

```
[DIAGNOSTIC] ⚠️ DELETING STREAMING EVENTS FROM TRACKING
[DIAGNOSTIC] 🔄 REPROCESSING streaming event (LOOP DETECTED!)
[DIAGNOSTIC] ❌ LOOP CONFIRMED: Reprocessed events count: X
[DIAGNOSTIC] 🐛 ROOT CAUSE: Lines 259-267 delete streaming events from tracking
[DIAGNOSTIC] ═══ EFFECT #X SUMMARY ═══ { loopDetected: '🔴 YES - BUG ACTIVE!' }
```

## Hypothesis for the Fix

**Remove lines 259-267** (the deletion of streaming events from tracking).

### Why This Should Work:

1. Streaming events should remain marked as "processed" even after a final message arrives
2. The streaming session is already cleared via `clearSession()` (line 245)
3. The `flatMessages` derived (lines 305-350) properly filters out streaming events and only includes active sessions from the store
4. There's no need to reprocess old streaming events once they've been accumulated and finalized

### What to Verify After Fix:

1. Streaming events are processed only once
2. Final messages properly clear sessions
3. No duplicate synthetic messages appear in the UI
4. The `flatMessages` derived correctly shows only active streaming sessions

## Testing Instructions

1. Start the dev server: `npm run dev`
2. Open browser console
3. Interact with an agent that sends streaming responses
4. Watch for the diagnostic logs
5. When a final message arrives, check if you see the `🔄 REPROCESSING` and `❌ LOOP CONFIRMED` messages

## Related Files

- `src/lib/components/chat/MessageList.svelte` - Main component with the bug
- `src/lib/utils/streamingMessageStore.svelte.ts` - Global store for streaming sessions
- `src/lib/utils/messageProcessor.ts` - Message processing logic (has similar but separate logic)
- `src/lib/utils/DeltaContentAccumulator.ts` - Accumulates delta content

## Questions to Answer

1. **Why was the deletion code added in the first place?**
   - Check git history for the commit that added lines 259-267
   - Understand the original intent

2. **Are there duplicate events in the subscription?**
   - The duplicate detection diagnostic will show this
   - May indicate overlapping filter issue

3. **What triggers the effect to re-run?**
   - Store mutations from `clearSession()` don't trigger this effect
   - Most likely new events arriving or buffer timeout
   - Or the effect depends on other reactive values

## Next Steps

1. ✅ Run the application and collect diagnostic logs
2. ⏸️ Confirm the loop is happening via the diagnostic output
3. ⏸️ Check git blame for lines 259-267 to understand original intent
4. ⏸️ Test the fix by commenting out lines 259-267
5. ⏸️ If fix works, verify no regressions in edge cases
6. ⏸️ Remove diagnostic code once confirmed fixed
