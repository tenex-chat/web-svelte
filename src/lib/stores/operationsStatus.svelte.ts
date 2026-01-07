import { browser } from "$app/environment";
import { ndk } from "$lib/ndk.svelte";
import { parseKind24133 } from "$lib/ndk-events/operations";
import { SvelteMap } from 'svelte/reactivity';
import { type NDKSubscription, type NDKEvent, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';

interface OperationStatus {
  agentPubkeys: string[];
  createdAt: number;
  eventId: string;  // For tiebreaker
  projectId: string;
}


/**
 * Centralized store for operations status (kind:24133)
 * Subscribes once to all status events and provides reactive accessors
 */
class OperationsStatusStore {
  // Map: eventId (the event being worked on) -> status
  private statusMap = $state<SvelteMap<string, OperationStatus>>(new SvelteMap());
  private initialized = false;

  /**
   * Initialize the store - MUST be called from a component context
   * (e.g. in +layout.svelte)
   */
  init() {
    if (this.initialized || !browser) return;
    this.initialized = true;

    let subscription: NDKSubscription | undefined;

    $effect(() => {
      if (subscription) subscription.stop();

      subscription = ndk.subscribe(
        [{ kinds: [24133], limit: 0 }],  // Live-only, all projects
        {
          cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
          subId: "operations-status-store",
          closeOnEose: false,
        },
        {
          onEvent: (event: NDKEvent) => this.processEvent(event),
          onEvents: (events: NDKEvent[]) => events.forEach(e => this.processEvent(e))
        }
      );
    });
  }

  private processEvent(event: NDKEvent) {
    const snapshot = parseKind24133(event);
    if (!snapshot) return;

    const existing = this.statusMap.get(snapshot.eId);

    // Last-write-wins with tiebreaker
    if (!existing ||
        snapshot.createdAt > existing.createdAt ||
        (snapshot.createdAt === existing.createdAt && snapshot.eventId > existing.eventId)) {
      this.statusMap.set(snapshot.eId, {
        agentPubkeys: snapshot.agentPubkeys,
        createdAt: snapshot.createdAt,
        eventId: snapshot.eventId,
        projectId: snapshot.projectId
      });
    }
  }

  /**
   * Get agent pubkeys currently working on an event
   */
  getWorkingAgents(eventId: string): string[] {
    return this.statusMap.get(eventId)?.agentPubkeys ?? [];
  }

  /**
   * Check if any agent is working on an event
   */
  isWorking(eventId: string): boolean {
    const agents = this.getWorkingAgents(eventId);
    return agents.length > 0;
  }

  /**
   * Get count of distinct events being actively worked on for a project
   */
  getActiveEventCount(projectId: string): number {
    let count = 0;
    for (const status of this.statusMap.values()) {
      if (status.projectId === projectId && status.agentPubkeys.length > 0) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get all active operations for a project (event IDs and agent pubkeys)
   */
  getActiveOperations(projectId: string): { eventIds: string[], agentPubkeys: string[] } {
    const eventIds: string[] = [];
    const agentPubkeysSet = new Set<string>();

    for (const [eventId, status] of this.statusMap.entries()) {
      if (status.projectId === projectId && status.agentPubkeys.length > 0) {
        eventIds.push(eventId);
        status.agentPubkeys.forEach(pk => agentPubkeysSet.add(pk));
      }
    }

    return { eventIds, agentPubkeys: [...agentPubkeysSet] };
  }
}

// Export singleton instance
export const operationsStatusStore = new OperationsStatusStore();
