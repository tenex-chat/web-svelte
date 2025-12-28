import { browser } from '$app/environment';
import { storage } from '$lib/utils/storage.svelte';

/**
 * Store to persist global conversation filter setting.
 * A single filter that applies to all projects (e.g., "4h", "1d", "needs-response-1h", etc.)
 */

class GlobalFilterStore {
	private filter = $state<string | null>(null);

	constructor() {
		if (browser) {
			this.filter = storage.get('global-filter') ?? null;
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
}

export const globalFilterStore = new GlobalFilterStore();
