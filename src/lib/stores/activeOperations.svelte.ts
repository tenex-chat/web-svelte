import { ndk } from '$lib/ndk.svelte';
import { parseKind24133, type Kind24133Snapshot } from '$lib/ndk-events/operations';
import type { NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * Create a reactive subscription to active operations for a specific event
 * Returns a function that should be used inside a component's $derived
 */
export function createOperationsSubscription(eventId: string | undefined, projectId: string | undefined) {
  if (!eventId || !projectId) {
    return () => [];
  }

  // Create subscription for kind 24133 events
  const subscription = ndk.$subscribe(() => {
    const filters: NDKFilter[] = [
      {
        kinds: [24133],
        "#a": [projectId],
        "#e": [eventId],
        limit: 0, // Live-only telemetry
      }
    ];

    return {
      filters,
      closeOnEose: false,
      bufferMs: 100
    };
  });

  // Return a function that processes events when called inside $derived
  return () => {
    const events = subscription.events;

    // Process all events and find the latest snapshot
    let latestSnapshot: Kind24133Snapshot | null = null;
    let latestCreatedAt = 0;

    events.forEach((event: NDKEvent) => {
      const snapshot = parseKind24133(event);
      if (!snapshot || snapshot.eId !== eventId) return;
      if (snapshot.projectId !== projectId) return;

      // Last-write-wins logic
      if (snapshot.createdAt > latestCreatedAt) {
        latestSnapshot = snapshot;
        latestCreatedAt = snapshot.createdAt;
      } else if (
        snapshot.createdAt === latestCreatedAt &&
        snapshot.eventId > (latestSnapshot?.eventId || "")
      ) {
        latestSnapshot = snapshot;
      }
    });

    // Return array of agent pubkeys that are currently active
    return latestSnapshot?.agentPubkeys || [];
  };
}