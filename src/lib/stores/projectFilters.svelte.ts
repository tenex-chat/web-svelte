import { browser } from '$app/environment';
import { storage } from '$lib/utils/storage.svelte';

/**
 * Store to persist project-specific filter settings.
 * Each project can have its own time filter preference (e.g., "4h", "1d", "needs-response-1h", etc.)
 */

interface ProjectFilters {
	[projectId: string]: string | null;
}

class ProjectFiltersStore {
	private filters = $state<ProjectFilters>({});

	constructor() {
		if (browser) {
			this.filters = storage.get('project-filters') ?? {};
		}
	}

	/**
	 * Get the filter for a specific project
	 */
	getFilter(projectId: string): string | null {
		return this.filters[projectId] ?? null;
	}

	/**
	 * Set the filter for a specific project
	 */
	setFilter(projectId: string, filter: string | null) {
		this.filters[projectId] = filter;
		storage.set('project-filters', this.filters);
	}

	/**
	 * Clear the filter for a specific project
	 */
	clearFilter(projectId: string) {
		delete this.filters[projectId];
		storage.set('project-filters', this.filters);
	}

	/**
	 * Clear all project filters
	 */
	clearAll() {
		this.filters = {};
		storage.set('project-filters', this.filters);
	}
}

export const projectFiltersStore = new ProjectFiltersStore();
