import { browser } from "$app/environment";
import { ndk } from "$lib/ndk.svelte";
import {
  NDKProjectStatus,
  type ProjectAgent,
} from "$lib/events/NDKProjectStatus";
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { type NDKSubscription, type NDKEvent, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';

/**
 * Centralized store for project status (kind:24010)
 * Subscribes once to all status events and provides reactive accessors
 */

class ProjectStatusStore {
  // Map of project ID -> latest status event
  private statusMap = $state<SvelteMap<string, NDKProjectStatus>>(new SvelteMap());
  private initialized = false;

  /**
   * Initialize the store - MUST be called from a component context
   * (e.g. in +layout.svelte)
   */
  init() {
    if (this.initialized || !browser) return;
    this.initialized = true;

    let subscription: NDKSubscription | undefined;

    // React to user changes and re-subscribe
    $effect(() => {
      const currentUser = ndk.$sessions.currentUser;

      // Clean up previous subscription
      if (subscription) {
        subscription.stop();
      }

      // Create filters based on current user
      const filters = !currentUser?.pubkey
        ? [{ kinds: [24010], limit: 0 }]
        : [{ kinds: [24010], "#p": [currentUser.pubkey], limit: 0 }];

      // Subscribe with incremental event processing
      subscription = ndk.subscribe(
        filters,
        {
          cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
          subId: "project-status-store",
          closeOnEose: false,
          wrap: true
        },
        {
          onEvent: (event: NDKEvent) => {
            const statusEvent = event as NDKProjectStatus;
            const projectId = statusEvent.projectId;
            if (!projectId) return;

            // Extract dTag as key
            const key = this.extractDTag(projectId);

            // Last-write-wins: only update if this event is newer
            const existing = this.statusMap.get(key);
            if (!existing || (statusEvent.created_at || 0) > (existing.created_at || 0)) {
              this.statusMap.set(key, statusEvent);
            }
          }
        }
      );

      subscription.start();
    });
  }

  /**
   * Helper to extract dTag from projectId
   */
  private extractDTag(projectId: string): string {
    if (projectId.includes(":")) {
      const parts = projectId.split(":");
      if (parts.length >= 3) {
        return parts[2]; // Return dTag
      }
    }
    return projectId;
  }

  /**
   * Get status for a specific project
   */
  getStatus(projectId: string): NDKProjectStatus | undefined {
    const key = this.extractDTag(projectId);
    return this.statusMap.get(key);
  }

  /**
   * Check if a project is online (status < 5 minutes old)
   */
  isProjectOnline(projectId: string): boolean {
    const status = this.getStatus(projectId);
    return status?.isOnline ?? false;
  }

  /**
   * Get all online agents for a project
   */
  getOnlineAgents(projectId: string): ProjectAgent[] {
    const status = this.getStatus(projectId);
    if (!status || !status.isOnline) return [];
    return status.agents;
  }

  /**
   * Get all available models for a project
   */
  getModels(projectId: string): string[] {
    const status = this.getStatus(projectId);
    if (!status) return [];
    return status.models.map((m) => m.name);
  }

  /**
   * Get all available tools for a project
   */
  getTools(projectId: string): string[] {
    const status = this.getStatus(projectId);
    if (!status) return [];

    const tools = new SvelteSet<string>();
    for (const tag of status.tags) {
      if (tag[0] === "tool" && tag[1]) {
        tools.add(tag[1]);
      }
    }
    return Array.from(tools);
  }

  /**
   * Get specific agent by pubkey for a project
   */
  getAgent(projectId: string, agentPubkey: string): ProjectAgent | undefined {
    const agents = this.getOnlineAgents(projectId);
    return agents.find((a) => a.pubkey === agentPubkey);
  }

  /**
   * Get which model a specific agent is using
   */
  getAgentModel(projectId: string, agentName: string): string | undefined {
    const agents = this.getOnlineAgents(projectId);
    const agent = agents.find((a) => a.name === agentName);
    return agent?.model;
  }

  /**
   * Get which tools a specific agent has
   */
  getAgentTools(projectId: string, agentName: string): string[] {
    const agents = this.getOnlineAgents(projectId);
    const agent = agents.find((a) => a.name === agentName);
    return agent?.tools || [];
  }

  /**
   * Get all worktrees for a project
   * Returns array of branch names, with the first being the default branch
   */
  getWorktrees(projectId: string): string[] {
    const status = this.getStatus(projectId);
    if (!status) return [];
    return status.worktrees;
  }

  /**
   * Get the default worktree for a project
   */
  getDefaultWorktree(projectId: string): string | undefined {
    const status = this.getStatus(projectId);
    return status?.defaultWorktree;
  }

  /**
   * Get all online project IDs
   */
  get onlineProjects(): string[] {
    const online: string[] = [];
    for (const [projectId, status] of this.statusMap) {
      if (status.isOnline) {
        online.push(projectId);
      }
    }
    return online;
  }

  /**
   * Get count of online agents across all projects
   */
  get totalOnlineAgents(): number {
    let count = 0;
    for (const status of this.statusMap.values()) {
      if (status.isOnline) {
        count += status.agents.length;
      }
    }
    return count;
  }

  /**
   * Get all unique models across all projects
   */
  get allModels(): string[] {
    const models = new SvelteSet<string>();
    for (const status of this.statusMap.values()) {
      status.models.forEach((m) => models.add(m.name));
    }
    return Array.from(models);
  }

  /**
   * Get all unique tools across all projects
   */
  get allTools(): string[] {
    const tools = new SvelteSet<string>();
    for (const status of this.statusMap.values()) {
      for (const tag of status.tags) {
        if (tag[0] === "tool" && tag[1]) {
          tools.add(tag[1]);
        }
      }
    }
    return Array.from(tools);
  }

  /**
   * Get the full status map (for debugging or advanced use)
   */
  get allStatus(): SvelteMap<string, NDKProjectStatus> {
    return this.statusMap;
  }
}

// Export singleton instance
export const projectStatusStore = new ProjectStatusStore();
