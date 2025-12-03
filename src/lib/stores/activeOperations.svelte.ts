import { ndk } from '$lib/ndk.svelte';
import { parseKind24133, type Kind24133Snapshot } from '$lib/ndk-events/operations';
import type { NDKFilter, NDKEvent, NDKSubscription } from '@nostr-dev-kit/ndk';

/**
 * Create a reactive subscription to active operations for a specific event
 * Returns a function that should be used inside a component's $derived
 */
export function createOperationsSubscription(eventId: string | undefined, projectId: string | undefined) {
  if (!eventId || !projectId) {
    return () => [];
  }

  // Track the latest snapshot state reactively
  let latestSnapshot = $state<Kind24133Snapshot | null>(null);
  let latestCreatedAt = 0;
  let latestEventId = "";

  // Create subscription with incremental event processing
  const filters: NDKFilter[] = [
    {
      kinds: [24133],
      "#a": [projectId],
      "#e": [eventId],
      limit: 0, // Live-only telemetry
    }
  ];

  const subscription: NDKSubscription = ndk.subscribe(
    filters,
    {
      closeOnEose: false,
    },
    {
      onEvent: (event: NDKEvent) => {
        const snapshot = parseKind24133(event);
        if (!snapshot || snapshot.eId !== eventId || snapshot.projectId !== projectId) return;

        // Last-write-wins logic
        if (snapshot.createdAt > latestCreatedAt) {
          latestSnapshot = snapshot;
          latestCreatedAt = snapshot.createdAt;
          latestEventId = snapshot.eventId;
        } else if (snapshot.createdAt === latestCreatedAt && snapshot.eventId > latestEventId) {
          latestSnapshot = snapshot;
          latestEventId = snapshot.eventId;
        }
      }
    }
  );

  subscription.start();

  // Return a function that just reads the reactive state
  return (): string[] => latestSnapshot?.agentPubkeys ?? [];
}