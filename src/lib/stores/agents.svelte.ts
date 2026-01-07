import { ndk } from '$lib/ndk.svelte';
import { NDKKind } from '$lib/kinds';
import type { NDKEvent, NDKSubscription } from '@nostr-dev-kit/ndk';
import { NDKAgentDefinition } from '$lib/events/NDKAgentDefinition';
import { browser } from '$app/environment';

/**
 * Centralized store for agent definitions (kind 4199).
 * Uses a persistent subscription (closeOnEose: false) to keep agents always up-to-date.
 * Components should pull from this store instead of creating their own subscriptions.
 */
class AgentStore {
	/** Raw agent definition events */
	private eventMap = new Map<string, NDKEvent>();
	private subscription: NDKSubscription | null = null;
	private initialized = false;

	/** All agent definition events, sorted by newest first */
	allAgents = $state<NDKAgentDefinition[]>([]);

	/**
	 * Deduplicated agents - grouped by pubkey:slug, keeping only the latest version.
	 * This is what most components should use.
	 */
	agents = $state<NDKAgentDefinition[]>([]);

	private updateState() {
		const allEvents = Array.from(this.eventMap.values());

		// Convert to NDKAgentDefinition and sort by newest first
		const agentDefs = allEvents
			.map(event => NDKAgentDefinition.from(event))
			.sort((a, b) => {
				const timeA = a.created_at || 0;
				const timeB = b.created_at || 0;
				return timeB - timeA;
			});

		this.allAgents = agentDefs;

		// Deduplicate by pubkey:slug (or pubkey:name), keeping the latest version
		const agentGroups = new Map<string, NDKAgentDefinition[]>();

		for (const agent of agentDefs) {
			const identifier = agent.slug || agent.dTag || agent.name || agent.id;
			const key = `${agent.pubkey}:${identifier}`;

			if (!agentGroups.has(key)) {
				agentGroups.set(key, []);
			}
			agentGroups.get(key)!.push(agent);
		}

		// For each group, keep only the latest version
		const latestAgents: NDKAgentDefinition[] = [];

		agentGroups.forEach((groupAgents) => {
			if (groupAgents.length === 1) {
				latestAgents.push(groupAgents[0]);
			} else {
				// Sort by created_at timestamp (newest first) and version number
				const sorted = groupAgents.sort((a, b) => {
					const timeA = a.created_at || 0;
					const timeB = b.created_at || 0;
					if (timeA !== timeB) {
						return timeB - timeA;
					}

					const versionA = parseInt(a.version || '0');
					const versionB = parseInt(b.version || '0');
					return versionB - versionA;
				});

				latestAgents.push(sorted[0]);
			}
		});

		this.agents = latestAgents;
	}

	init() {
		if (!browser || this.initialized) return;
		this.initialized = true;

		// Create persistent subscription for agent definition events
		this.subscription = ndk.subscribe(
			{ kinds: [NDKKind.AgentDefinition as number] },
			{
				closeOnEose: false,
				groupable: false,
				subId: 'agents-store',
				onEvents: (events: NDKEvent[]) => {
					for (const event of events) {
						this.eventMap.set(event.id, event);
					}
					this.updateState();
				},
				onEvent: (event: NDKEvent) => {
					this.eventMap.set(event.id, event);
					this.updateState();
				}
			}
		);
	}

	destroy() {
		if (this.subscription) {
			this.subscription.stop();
			this.subscription = null;
		}
		this.eventMap.clear();
		this.allAgents = [];
		this.agents = [];
		this.initialized = false;
	}

	/**
	 * Get agent by event ID
	 */
	getById(eventId: string): NDKAgentDefinition | undefined {
		const event = this.eventMap.get(eventId);
		if (event) {
			return NDKAgentDefinition.from(event);
		}
		return undefined;
	}

	/**
	 * Get agents owned by a specific pubkey
	 */
	getByOwner(pubkey: string): NDKAgentDefinition[] {
		return this.agents.filter(agent => agent.pubkey === pubkey);
	}

	/**
	 * Get agents NOT owned by a specific pubkey (subscribed)
	 */
	getSubscribed(pubkey: string): NDKAgentDefinition[] {
		return this.agents.filter(agent => agent.pubkey !== pubkey);
	}

	/**
	 * Search agents by name, description, or role
	 */
	search(query: string): NDKAgentDefinition[] {
		if (!query.trim()) return this.agents;

		const lowerQuery = query.toLowerCase();
		return this.agents.filter(agent =>
			agent.name?.toLowerCase().includes(lowerQuery) ||
			agent.description?.toLowerCase().includes(lowerQuery) ||
			agent.role?.toLowerCase().includes(lowerQuery)
		);
	}

	/**
	 * Filter agents that are not in the given list of IDs
	 */
	excludeIds(excludeIds: string[]): NDKAgentDefinition[] {
		const excludeSet = new Set(excludeIds);
		return this.agents.filter(agent => !excludeSet.has(agent.id));
	}
}

export const agentStore = new AgentStore();
