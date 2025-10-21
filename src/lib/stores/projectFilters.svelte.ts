import { browser } from '$app/environment';

/**
 * Store to persist project-specific filter settings to localStorage.
 * Each project can have its own time filter preference (e.g., "4h", "1d", "needs-response-1h", etc.)
 */

interface ProjectFilters {
	[projectId: string]: string | null;
}

const STORAGE_KEY = 'project-filters';

class ProjectFiltersStore {
	private filters = $state<ProjectFilters>({});

	constructor() {
		if (browser) {
			this.load();
		}
	}

	private load() {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				this.filters = JSON.parse(stored);
			}
		} catch (error) {
			console.error('Failed to load project filters:', error);
		}
	}

	private save() {
		if (!browser) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.filters));
		} catch (error) {
			console.error('Failed to save project filters:', error);
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
		this.save();
	}

	/**
	 * Clear the filter for a specific project
	 */
	clearFilter(projectId: string) {
		delete this.filters[projectId];
		this.save();
	}

	/**
	 * Clear all project filters
	 */
	clearAll() {
		this.filters = {};
		this.save();
	}
}

export const projectFiltersStore = new ProjectFiltersStore();
