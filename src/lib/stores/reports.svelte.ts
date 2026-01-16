// src/lib/stores/reports.svelte.ts
import { browser } from '$app/environment';
import { ndk } from '$lib/ndk.svelte';
import { projectsStore } from '$lib/stores/projects.svelte';
import { NDKKind } from '$lib/kinds';
import { NDKArticle } from '@nostr-dev-kit/ndk';
import type { NDKSubscription, NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * Centralized store for NDKArticle (kind 30023) reports/documents.
 *
 * Provides single source of truth for all reports in the project,
 * with version history tracking for diffs and efficient querying.
 *
 * Features:
 * - Single persistent subscription for all reports (closeOnEose: false)
 * - Deduplication by slug, keeping latest version in `reports`
 * - Version history tracking via `allReports` and `versionsBySlug`
 * - Derived indexes for efficient queries by project, tag, and memorized status
 * - Query methods for accessing reports by various criteria
 */
class ReportsStore {
	// Private state
	/** Map of all report events by event ID */
	private eventMap = new Map<string, NDKArticle>();
	/** Active subscription to relay */
	private subscription: NDKSubscription | null = null;
	/** Whether the store has been initialized */
	private initialized = false;

	// Public reactive state
	/** All report events, sorted by newest first (includes all versions) */
	allReports = $state<NDKArticle[]>([]);
	/** Deduplicated reports - one per slug, keeping only the latest version */
	reports = $state<NDKArticle[]>([]);
	/** Whether the store is currently loading initial data */
	loading = $state(false);
	/** Error state if subscription fails */
	error = $state<Error | null>(null);

	// Derived values
	/**
	 * Map of slug -> array of all versions (sorted newest first)
	 * Useful for viewing version history and computing diffs
	 */
	versionsBySlug = $derived.by(() => {
		const versions = new Map<string, NDKArticle[]>();

		for (const report of this.allReports) {
			const slug = report.tagValue('d');
			if (!slug) continue;

			if (!versions.has(slug)) {
				versions.set(slug, []);
			}

			versions.get(slug)!.push(report);
		}

		// Sort each version list by created_at (newest first)
		for (const [slug, versionsList] of versions.entries()) {
			versions.set(
				slug,
				versionsList.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
			);
		}

		return versions;
	});

	/**
	 * Map of project a-tag -> array of reports tagged with that project
	 * Enables efficient lookup of reports for a specific project
	 */
	reportsByProject = $derived.by(() => {
		const byProject = new Map<string, NDKArticle[]>();

		for (const report of this.reports) {
			const projectTags = report.getMatchingTags('a');
			for (const tag of projectTags) {
				const projectATag = tag[1];
				if (!projectATag) continue;

				if (!byProject.has(projectATag)) {
					byProject.set(projectATag, []);
				}

				byProject.get(projectATag)!.push(report);
			}
		}

		return byProject;
	});

	/**
	 * Map of hashtag -> array of reports with that hashtag (t tag)
	 * Enables efficient lookup of reports by topic/category
	 */
	reportsByTag = $derived.by(() => {
		const byTag = new Map<string, NDKArticle[]>();

		for (const report of this.reports) {
			const hashtagTags = report.getMatchingTags('t');
			for (const tag of hashtagTags) {
				const hashtag = tag[1];
				if (!hashtag) continue;

				if (!byTag.has(hashtag)) {
					byTag.set(hashtag, []);
				}

				byTag.get(hashtag)!.push(report);
			}
		}

		return byTag;
	});

	/**
	 * Reports that have been marked for memorization
	 * (have a 'memorize' tag)
	 */
	memorizedReports = $derived(() => {
		return this.reports.filter((report) => {
			const tags = report.getMatchingTags('memorize');
			return tags.length > 0;
		});
	});

	// Query methods
	/**
	 * Get the latest version of a report by its slug (d tag)
	 * @param slug - The d tag value identifying the report
	 * @returns The latest version of the report, or undefined if not found
	 */
	getBySlug(slug: string): NDKArticle | undefined {
		return this.reports.find((report) => report.tagValue('d') === slug);
	}

	/**
	 * Get all reports tagged with a specific project
	 * @param projectATag - The 'a' tag value for the project (e.g., "31990:pubkey:identifier")
	 * @returns Array of reports for that project
	 */
	getByProject(projectATag: string): NDKArticle[] {
		return this.reportsByProject.get(projectATag) || [];
	}

	/**
	 * Get all reports with a specific hashtag
	 * @param tag - The hashtag to filter by (without #)
	 * @returns Array of reports with that hashtag
	 */
	getByTag(tag: string): NDKArticle[] {
		return this.reportsByTag.get(tag) || [];
	}

	/**
	 * Get all versions of a report by slug, sorted newest first
	 * @param slug - The d tag value identifying the report
	 * @returns Array of all versions of the report
	 */
	getVersions(slug: string): NDKArticle[] {
		return this.versionsBySlug.get(slug) || [];
	}

	/**
	 * Get the previous version of a report (for diff computation)
	 * @param slug - The d tag value identifying the report
	 * @param currentVersion - The current version to find the predecessor of
	 * @returns The previous version, or undefined if none exists
	 */
	getPreviousVersion(slug: string, currentVersion: NDKArticle): NDKArticle | undefined {
		const versions = this.getVersions(slug);
		const currentIndex = versions.findIndex((v) => v.id === currentVersion.id);

		if (currentIndex < 0 || currentIndex === versions.length - 1) {
			return undefined;
		}

		return versions[currentIndex + 1];
	}

	// Lifecycle methods
	/**
	 * Initialize the store and start subscription.
	 * Should be called once when the app starts (e.g., in layout).
	 * Safe to call multiple times - subsequent calls are no-ops.
	 */
	init() {
		if (!browser || this.initialized) return;

		this.initialized = true;
		this.loading = true;
		this.error = null;

		let subscription: NDKSubscription | undefined;
		let lastProjectATagsKey = '';

		// React to project changes and re-subscribe
		$effect(() => {
			const projectATags = projectsStore.projectATags;

			// Only restart subscription if project tags actually changed (prevents reactivity loop)
			const newKey = projectATags.join(',');
			if (newKey === lastProjectATagsKey) {
				return;
			}
			lastProjectATagsKey = newKey;

			// Clean up previous subscription
			if (subscription) {
				subscription.stop();
			}

			// Reset state when projects change
			this.eventMap.clear();
			this.updateState();

			// Only subscribe if there are projects to filter by
			if (projectATags.length === 0) {
				this.loading = false;
				return;
			}

			try {
				// Subscribe to articles tagged with user's projects
				subscription = ndk.subscribe(
					{ kinds: [NDKKind.Article as number], '#a': projectATags },
					{
						closeOnEose: false,
						groupable: false,
						wrap: true,
						subId: 'reports-store'
					},
					{
						onEvents: (events: NDKEvent[]) => {
							this.processBulkEvents(events.map(e => NDKArticle.from(e)));
						},
						onEvent: (event: NDKEvent) => {
							this.processSingleEvent(NDKArticle.from(event));
						},
						onEose: () => {
							this.loading = false;
						}
					}
				);

				this.subscription = subscription;
			} catch (err) {
				this.error = err as Error;
				this.loading = false;
			}
		});
	}

	/**
	 * Clean up the store, stop subscription, and reset state.
	 * Call this when the store is no longer needed.
	 */
	destroy() {
		if (this.subscription) {
			this.subscription.stop();
			this.subscription = null;
		}

		this.eventMap.clear();
		this.allReports = [];
		this.reports = [];
		this.initialized = false;
		this.loading = false;
		this.error = null;
	}

	// Private processing methods
	/**
	 * Process multiple events at once (typically from initial fetch)
	 */
	private processBulkEvents(events: NDKArticle[]) {
		for (const event of events) {
			this.eventMap.set(event.id, event);
		}
		this.updateState();
	}

	/**
	 * Process a single event (typically from real-time updates)
	 */
	private processSingleEvent(event: NDKArticle) {
		this.eventMap.set(event.id, event);
		this.updateState();
	}

	/**
	 * Update the public state arrays from the internal event map.
	 * - allReports: all events sorted by newest first
	 * - reports: deduplicated by slug, keeping only latest version
	 */
	private updateState() {
		const allEvents = Array.from(this.eventMap.values());

		// Sort all events by created_at (newest first)
		const sortedEvents = allEvents.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

		// Deduplicate by slug (d tag), keeping only the latest version
		const slugMap = new Map<string, NDKArticle>();

		for (const report of sortedEvents) {
			const slug = report.tagValue('d');
			if (!slug) continue;

			const existing = slugMap.get(slug);
			if (!existing || (report.created_at || 0) > (existing.created_at || 0)) {
				slugMap.set(slug, report);
			}
		}

		// Write to reactive state only once at the end
		this.allReports = sortedEvents;
		this.reports = Array.from(slugMap.values());
	}
}

export const reportsStore = new ReportsStore();
