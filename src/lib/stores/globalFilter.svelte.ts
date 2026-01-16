import { browser } from '$app/environment';
import { storage } from '$lib/utils/storage.svelte';

/**
 * Store to persist global conversation filter setting.
 * A single filter that applies to all projects (e.g., "4h", "1d", etc.)
 */

class GlobalFilterStore {
	private filter = $state<string | null>(null);
	private _showArchived = $state<boolean>(false);

	constructor() {
		if (browser) {
			this.filter = storage.get('global-filter') ?? null;
			// Default to false if not set
			const storedShowArchived = storage.get('global-filter-show-archived');
			this._showArchived = storedShowArchived ?? false;
		}
	}

	/**
	 * Get the current global filter
	 */
	get value(): string | null {
		return this.filter;
	}

	/**
	 * Set the global filter
	 */
	set(filter: string | null) {
		this.filter = filter;
		storage.set('global-filter', filter);
	}

	/**
	 * Clear the global filter
	 */
	clear() {
		this.filter = null;
		storage.set('global-filter', null);
	}

	/**
	 * Get the showArchived filter state
	 */
	get showArchived(): boolean {
		return this._showArchived;
	}

	/**
	 * Set the showArchived filter
	 */
	setShowArchived(value: boolean) {
		this._showArchived = value;
		storage.set('global-filter-show-archived', value);
	}

	/**
	 * Toggle the showArchived filter
	 */
	toggleShowArchived() {
		this.setShowArchived(!this._showArchived);
	}
}

export const globalFilterStore = new GlobalFilterStore();
