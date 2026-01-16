import { browser } from '$app/environment';
import { ndk } from '$lib/ndk.svelte';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { openProjects } from './openProjects.svelte';
import { globalFilterStore } from './globalFilter.svelte';
import { storage } from '$lib/utils/storage.svelte';

// ==================== Reusable Thread Utilities ====================

/** Check if event is a root thread (no e-tags) */
export const isRootThread = (e: NDKEvent) => !e.tags.some(t => t[0] === 'e');

/** Check if event is a reply (has e-tags) */
export const isReply = (e: NDKEvent) => e.tags.some(t => t[0] === 'e');

/** Get parent thread IDs from an event's e-tags */
export const getParentIds = (e: NDKEvent) => e.tags.filter(t => t[0] === 'e').map(t => t[1]);

/** Get activity time (latest reply or thread creation) */
export const getActivityTime = (thread: NDKEvent, metadata: Map<string, ThreadMetadata>) =>
	metadata.get(thread.id)?.latestReply?.created_at || thread.created_at || 0;

/** Sort threads by activity (most recent first) */
export const sortByActivity = (threads: NDKEvent[], metadata: Map<string, ThreadMetadata>) =>
	[...threads].sort((a, b) => getActivityTime(b, metadata) - getActivityTime(a, metadata));

/** Build thread metadata map from threads and replies */
export function buildThreadMetadata(threads: NDKEvent[], replies: NDKEvent[]): Map<string, ThreadMetadata> {
	const metadata = new Map<string, ThreadMetadata>();
	for (const thread of threads) {
		metadata.set(thread.id, { latestReply: null });
	}
	for (const reply of replies) {
		for (const parentId of getParentIds(reply)) {
			const meta = metadata.get(parentId);
			if (meta && (!meta.latestReply || (reply.created_at || 0) > (meta.latestReply.created_at || 0))) {
				meta.latestReply = reply;
			}
		}
	}
	return metadata;
}

/** Get the project tagId from an event's 'a' tag */
export function getProjectTagId(event: NDKEvent): string | undefined {
	return event.tags.find(t => t[0] === 'a')?.[1];
}

// ==================== Types ====================

export interface ThreadMetadata {
	latestReply: NDKEvent | null;
}

export interface HierarchicalThread {
	thread: NDKEvent;
	depth: number;
	isLastChild: boolean;
	hasChildren: boolean;
	childCount: number;
}

// Time filter thresholds in seconds
const TIME_THRESHOLDS: Record<string, number> = {
	'1h': 3600,
	'4h': 14400,
	'1d': 86400,
	'3d': 259200,
	'7d': 604800
};

/**
 * Centralized thread store that subscribes to all open projects.
 * Recreates subscription when open projects change.
 */
class ThreadStore {
	private debouncedEvents = $state<NDKEvent[]>([]);
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private _collapsedIds = $state<Set<string>>(new Set());
	private initialized = false;

	/**
	 * Initialize the store - MUST be called from a component context
	 * (e.g. in +layout.svelte)
	 */
	init() {
		if (this.initialized || !browser) return;
		this.initialized = true;

		// Subscribe reactively to open projects
		const sub = ndk.$subscribe(() => {
			const projectTagIds = openProjects.projects.map(p => p.tagId());

			// If no projects open, return empty filter that won't match anything
			if (projectTagIds.length === 0) {
				return {
					filters: [],
					closeOnEose: false
				};
			}

			return {
				filters: [{ kinds: [1], '#a': projectTagIds, limit: 501 }],
				cacheUnconstrainFilter: [],
				closeOnEose: false
			};
		});

		$effect(() => {
			const events = sub.events;
			if (this.debounceTimer) clearTimeout(this.debounceTimer);
			this.debounceTimer = setTimeout(() => { this.debouncedEvents = events; }, 150);
		});
	}

	// Threads = root events (no e-tags), Replies = events with e-tags
	private threads = $derived(this.debouncedEvents.filter(e => !e.tags.some(t => t[0] === 'e')));
	private replies = $derived(this.debouncedEvents.filter(e => e.tags.some(t => t[0] === 'e')));
	private archivedIds = $derived(new Set(Object.keys(storage.getArchivedConversations())));

	/** Map of thread ID -> latest reply */
	readonly threadMetadata = $derived.by(() => {
		const metadata = new Map<string, ThreadMetadata>();
		for (const thread of this.threads) {
			metadata.set(thread.id, { latestReply: null });
		}
		for (const reply of this.replies) {
			for (const tag of reply.tags) {
				if (tag[0] !== 'e') continue;
				const meta = metadata.get(tag[1]);
				if (meta && (!meta.latestReply || (reply.created_at || 0) > (meta.latestReply.created_at || 0))) {
					meta.latestReply = reply;
				}
			}
		}
		return metadata;
	});

	/** Get threads filtered by project */
	private getFilteredThreads(projectTagId?: string) {
		let result = this.threads.filter(t => t.created_at !== undefined);

		// Filter by project if specified
		if (projectTagId) {
			result = result.filter(t => getProjectTagId(t) === projectTagId);
		}

		// Filter: archived
		if (!globalFilterStore.showArchived) {
			result = result.filter(t => !this.archivedIds.has(t.id));
		}

		// Filter: time
		const threshold = TIME_THRESHOLDS[globalFilterStore.value ?? ''];
		if (threshold) {
			const now = Math.floor(Date.now() / 1000);
			result = result.filter(t => (now - getActivityTime(t, this.threadMetadata)) <= threshold);
		}

		return sortByActivity(result, this.threadMetadata);
	}

	/** Build hierarchical threads from sorted threads */
	private buildHierarchy(sortedThreads: NDKEvent[]): HierarchicalThread[] {
		const parentToChildren = new Map<string, NDKEvent[]>();
		const childIds = new Set<string>();

		// Build parent-child relationships
		for (const thread of sortedThreads) {
			const parentId = thread.tags.find(t => t[0] === 'delegation')?.[1];
			if (parentId) {
				childIds.add(thread.id);
				if (!parentToChildren.has(parentId)) parentToChildren.set(parentId, []);
				parentToChildren.get(parentId)!.push(thread);
			}
		}

		// Sort children
		for (const children of parentToChildren.values()) {
			sortByActivity(children, this.threadMetadata);
		}

		// Count descendants recursively
		const countDescendants = (id: string): number => {
			const children = parentToChildren.get(id) || [];
			return children.reduce((sum, c) => sum + 1 + countDescendants(c.id), 0);
		};

		// Flatten hierarchy
		const result: HierarchicalThread[] = [];
		const addThread = (thread: NDKEvent, depth: number, isLastChild: boolean) => {
			const children = parentToChildren.get(thread.id) || [];
			result.push({
				thread,
				depth,
				isLastChild,
				hasChildren: children.length > 0,
				childCount: countDescendants(thread.id)
			});
			if (!this._collapsedIds.has(thread.id)) {
				children.forEach((child, i) => addThread(child, depth + 1, i === children.length - 1));
			}
		};

		const roots = sortedThreads.filter(t => !childIds.has(t.id));
		roots.forEach((t, i) => addThread(t, 0, i === roots.length - 1));
		return result;
	}

	/**
	 * Get hierarchical threads for a specific project
	 */
	getHierarchicalThreads(projectTagId: string): HierarchicalThread[] {
		const sorted = this.getFilteredThreads(projectTagId);
		return this.buildHierarchy(sorted);
	}

	/**
	 * Get all hierarchical threads across all open projects
	 */
	get allHierarchicalThreads(): HierarchicalThread[] {
		const sorted = this.getFilteredThreads();
		return this.buildHierarchy(sorted);
	}

	get collapsedIds(): Set<string> {
		return this._collapsedIds;
	}

	toggleCollapse(threadId: string) {
		const newSet = new Set(this._collapsedIds);
		newSet.has(threadId) ? newSet.delete(threadId) : newSet.add(threadId);
		this._collapsedIds = newSet;
	}
}

// Export singleton instance
export const threadStore = new ThreadStore();
