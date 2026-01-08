import { browser } from '$app/environment';
import { ndk } from '$lib/ndk.svelte';
import { NDKProject } from '$lib/events/NDKProject';
import type { NDKSubscription, NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * Centralized store for user's projects (kind:31933).
 * Subscribes once to all user projects and provides reactive accessors.
 *
 * Features:
 * - Single persistent subscription for all user projects
 * - Deduplication by dTag, keeping only the latest version
 * - Query methods for efficient lookups
 * - Exposes project "a" tags for filtering related content (articles, etc.)
 */
class ProjectsStore {
	// Private state
	private eventMap = new Map<string, NDKProject>();
	private subscription: NDKSubscription | null = null;
	private initialized = false;

	// Public reactive state
	/** All project events, sorted by newest first */
	allProjects = $state<NDKProject[]>([]);
	/** Deduplicated projects - one per dTag, keeping only the latest version */
	projects = $state<NDKProject[]>([]);
	/** Whether the store is currently loading */
	loading = $state(false);
	/** Error state if subscription fails */
	error = $state<Error | null>(null);

	/**
	 * Array of project "a" tags for filtering related content.
	 * Format: ["31933:pubkey:dTag", ...]
	 * Use this to filter articles and other content by project.
	 */
	projectATags = $derived.by(() => {
		return this.projects
			.filter(p => p.dTag)
			.map(p => `31933:${p.pubkey}:${p.dTag}`);
	});

	/**
	 * Map of dTag -> project for efficient lookups
	 */
	projectsByDTag = $derived.by(() => {
		const map = new Map<string, NDKProject>();
		for (const project of this.projects) {
			if (project.dTag) {
				map.set(project.dTag, project);
			}
		}
		return map;
	});

	private updateState() {
		const allEvents = Array.from(this.eventMap.values());

		// Sort all events by created_at (newest first)
		const sortedEvents = allEvents.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

		// Deduplicate by dTag, keeping only the latest version
		const dTagMap = new Map<string, NDKProject>();

		for (const project of sortedEvents) {
			const dTag = project.dTag;
			if (!dTag) continue;

			const existing = dTagMap.get(dTag);
			if (!existing || (project.created_at || 0) > (existing.created_at || 0)) {
				dTagMap.set(dTag, project);
			}
		}

		// Write to reactive state only once at the end
		this.allProjects = sortedEvents;
		this.projects = Array.from(dTagMap.values());
	}

	/**
	 * Initialize the store - MUST be called from a component context
	 * (e.g. in +layout.svelte)
	 */
	init() {
		if (this.initialized || !browser) return;
		this.initialized = true;
		this.loading = true;

		let subscription: NDKSubscription | undefined;

		// React to user changes and re-subscribe
		$effect(() => {
			const currentUser = ndk.$sessions.currentUser;

			// Clean up previous subscription
			if (subscription) {
				subscription.stop();
			}

			// Reset state when user changes
			this.eventMap.clear();
			this.updateState();

			// Only subscribe if user is logged in
			if (!currentUser?.pubkey) {
				this.loading = false;
				return;
			}

			// Subscribe to user's projects
			subscription = ndk.subscribe(
				{ kinds: [31933], authors: [currentUser.pubkey] },
				{
					closeOnEose: false,
					groupable: false,
					wrap: true,
					subId: 'projects-store'
				},
				{
					onEvents: (events: NDKEvent[]) => {
						for (const event of events) {
							this.eventMap.set(event.id, NDKProject.from(event));
						}
						this.updateState();
					},
					onEvent: (event: NDKEvent) => {
						this.eventMap.set(event.id, NDKProject.from(event));
						this.updateState();
					},
					onEose: () => {
						this.loading = false;
					}
				}
			);

			this.subscription = subscription;
		});
	}

	/**
	 * Clean up the store and stop subscription
	 */
	destroy() {
		if (this.subscription) {
			this.subscription.stop();
			this.subscription = null;
		}
		this.eventMap.clear();
		this.allProjects = [];
		this.projects = [];
		this.initialized = false;
		this.loading = false;
		this.error = null;
	}

	/**
	 * Get project by dTag
	 */
	getByDTag(dTag: string): NDKProject | undefined {
		return this.projectsByDTag.get(dTag);
	}

	/**
	 * Get project by event ID
	 */
	getById(eventId: string): NDKProject | undefined {
		return this.eventMap.get(eventId);
	}

	/**
	 * Search projects by name or description
	 */
	search(query: string): NDKProject[] {
		if (!query.trim()) return this.projects;

		const lowerQuery = query.toLowerCase();
		return this.projects.filter(
			p =>
				p.name?.toLowerCase().includes(lowerQuery) ||
				p.description?.toLowerCase().includes(lowerQuery)
		);
	}
}

export const projectsStore = new ProjectsStore();
