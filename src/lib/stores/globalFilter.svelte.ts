import { browser } from '$app/environment';
import { storage } from '$lib/utils/storage.svelte';

/**
 * Store to persist global conversation filter setting.
 * A single filter that applies to all projects (e.g., "4h", "1d", "needs-response-1h", etc.)
 * Also includes a toggle for filtering to only show conversations started by the current user.
 */

class GlobalFilterStore {
	private filter = $state<string | null>(null);
	private _onlyByMe = $state<boolean>(true);

	constructor() {
		if (browser) {
			this.filter = storage.get('global-filter') ?? null;
			// Default to true if not set
			const storedOnlyByMe = storage.get('global-filter-only-by-me');
			this._onlyByMe = storedOnlyByMe ?? true;
		}
	}

	/**
	 * Get the current global filter
	 */
	get value(): string | null {
		return this.filter;
	}

	/**
	 * Get the onlyByMe filter state
	 */
	get onlyByMe(): boolean {
		return this._onlyByMe;
	}

	/**
	 * Set the global filter
	 */
	set(filter: string | null) {
		this.filter = filter;
		storage.set('global-filter', filter);
	}

	/**
	 * Set the onlyByMe filter
	 */
	setOnlyByMe(value: boolean) {
		this._onlyByMe = value;
		storage.set('global-filter-only-by-me', value);
	}

	/**
	 * Toggle the onlyByMe filter
	 */
	toggleOnlyByMe() {
		this.setOnlyByMe(!this._onlyByMe);
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
