import { browser } from "$app/environment";
import { ndk } from "$lib/ndk.svelte";
import {
  NDKProjectStatus,
  type ProjectAgent,
} from "$lib/events/NDKProjectStatus";
import { SvelteMap, SvelteSet } from 'svelte/reactivity';

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

    // Subscribe to kind:24010 events for current user
    const subscription = ndk.$subscribe(
      () => {
        const currentUser = ndk.$sessions.currentUser;
        if (!currentUser?.pubkey) {
          return {
            filters: [{ kinds: [24010], limit: 0 }],
            closeOnEose: true,
            eventClass: NDKProjectStatus,
            wrap: true,
          };
        }

        return {
          filters: [
            {
              kinds: [24010],
              "#p": [currentUser.pubkey],
            },
          ],
          eventClass: NDKProjectStatus,
          subId: "project-status-store",
          wrap: true,
          closeOnEose: false,
        };
      },
      { bufferMs: 100 },
    );

    // Update map when events arrive
    $effect(() => {
      const events = subscription.events as NDKProjectStatus[];

      // Group by project, keep only latest per project
      const latestByProject = new SvelteMap<string, NDKProjectStatus>();

      for (const event of events) {
        const projectId = event.projectId;
        if (!projectId) continue;

        // Extract dTag from projectId (format: kind:pubkey:dTag)
        // The "a" tag is in format: kind:pubkey:dTag, we want just the dTag
        let key = projectId;
        if (projectId.includes(":")) {
          const parts = projectId.split(":");
          if (parts.length >= 3) {
            key = parts[2]; // Use dTag as key
          }
        }

        const existing = latestByProject.get(key);
        if (!existing || (event.created_at || 0) > (existing.created_at || 0)) {
          latestByProject.set(key, event);
        }
      }

      this.statusMap = latestByProject;
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
