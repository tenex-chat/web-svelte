/**
 * State store for managing expanded/collapsed state of threaded message replies
 * Uses Svelte 5 runes for reactive state management
 */

import { SvelteSet } from 'svelte/reactivity';

class ExpandedRepliesStore {
	// Set of message IDs that have their replies expanded
	private expanded = $state<SvelteSet<string>>(new SvelteSet());

	/**
	 * Check if a message's replies are expanded
	 */
	isExpanded(messageId: string): boolean {
		return this.expanded.has(messageId);
	}

	/**
	 * Toggle the expanded state for a message's replies
	 */
	toggle(messageId: string): void {
		const newSet = new SvelteSet(this.expanded);
		if (newSet.has(messageId)) {
			newSet.delete(messageId);
		} else {
			newSet.add(messageId);
		}
		this.expanded = newSet;
	}

	/**
	 * Expand a message's replies
	 */
	expand(messageId: string): void {
		if (!this.expanded.has(messageId)) {
			const newSet = new SvelteSet(this.expanded);
			newSet.add(messageId);
			this.expanded = newSet;
		}
	}

	/**
	 * Collapse a message's replies
	 */
	collapse(messageId: string): void {
		if (this.expanded.has(messageId)) {
			const newSet = new SvelteSet(this.expanded);
			newSet.delete(messageId);
			this.expanded = newSet;
		}
	}

	/**
	 * Collapse all messages
	 */
	collapseAll(): void {
		this.expanded = new SvelteSet();
	}

	/**
	 * Get a derived value that tracks expansion state
	 * Use this for reactive $derived blocks
	 */
	get expandedSet(): SvelteSet<string> {
		return this.expanded;
	}
}

// Export singleton instance
export const expandedRepliesStore = new ExpandedRepliesStore();
