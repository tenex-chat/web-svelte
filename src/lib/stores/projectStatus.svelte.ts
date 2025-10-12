import { browser } from '$app/environment';
import { ndk } from '$lib/ndk.svelte';
import { NDKProjectStatus, type ProjectAgent } from '$lib/events/NDKProjectStatus';

/**
 * Centralized store for project status (kind:24010)
 * Subscribes once to all status events and provides reactive accessors
 */

class ProjectStatusStore {
	// Map of project ID -> latest status event
	private statusMap = $state<Map<string, NDKProjectStatus>>(new Map());
	private initialized = false;

	/**
	 * Initialize the store - MUST be called from a component context
	 * (e.g. in +layout.svelte)
	 */
	init() {
		if (this.initialized || !browser) return;
		this.initialized = true;

		// Subscribe to ALL kind:24010 events
		const subscription = ndk.$subscribe(
			() => ({
				filters: [
					{
						kinds: [24010]
						// No project filter - get all status events
					}
				],
				closeOnEose: false,
				eventClass: NDKProjectStatus
			}),
			{ bufferMs: 100 }
		);

		// Update map when events arrive
		$effect(() => {
			const events = subscription.events as NDKProjectStatus[];

			// Group by project, keep only latest per project
			const latestByProject = new Map<string, NDKProjectStatus>();

			for (const event of events) {
				const projectId = event.projectId;
				if (!projectId) continue;

				const existing = latestByProject.get(projectId);
				if (!existing || (event.created_at || 0) > (existing.created_at || 0)) {
					latestByProject.set(projectId, event);
				}
			}

			this.statusMap = latestByProject;
		});
	}

	/**
	 * Get status for a specific project
	 */
	getStatus(projectId: string): NDKProjectStatus | undefined {
		return this.statusMap.get(projectId);
	}

	/**
	 * Check if a project is online (status < 5 minutes old)
	 */
	isProjectOnline(projectId: string): boolean {
		const status = this.statusMap.get(projectId);
		return status?.isOnline ?? false;
	}

	/**
	 * Get all online agents for a project
	 */
	getOnlineAgents(projectId: string): ProjectAgent[] {
		const status = this.statusMap.get(projectId);
		if (!status || !status.isOnline) return [];
		return status.agents;
	}

	/**
	 * Get all available models for a project
	 */
	getModels(projectId: string): string[] {
		const status = this.statusMap.get(projectId);
		if (!status) return [];
		return status.models.map((m) => m.name);
	}

	/**
	 * Get all available tools for a project
	 */
	getTools(projectId: string): string[] {
		const status = this.statusMap.get(projectId);
		if (!status) return [];

		const tools = new Set<string>();
		for (const tag of status.tags) {
			if (tag[0] === 'tool' && tag[1]) {
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
		for (const [_, status] of this.statusMap) {
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
		const models = new Set<string>();
		for (const [_, status] of this.statusMap) {
			status.models.forEach((m) => models.add(m.name));
		}
		return Array.from(models);
	}

	/**
	 * Get all unique tools across all projects
	 */
	get allTools(): string[] {
		const tools = new Set<string>();
		for (const [_, status] of this.statusMap) {
			for (const tag of status.tags) {
				if (tag[0] === 'tool' && tag[1]) {
					tools.add(tag[1]);
				}
			}
		}
		return Array.from(tools);
	}

	/**
	 * Get the full status map (for debugging or advanced use)
	 */
	get allStatus(): Map<string, NDKProjectStatus> {
		return this.statusMap;
	}
}

// Export singleton instance
export const projectStatusStore = new ProjectStatusStore();
