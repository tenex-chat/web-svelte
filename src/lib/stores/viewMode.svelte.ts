import { browser } from '$app/environment';
import { storage } from '$lib/utils/storage.svelte';

export type ViewMode = 'projects' | 'status' | 'graph';

class ViewModeStore {
	private mode = $state<ViewMode>('projects');

	constructor() {
		if (browser) {
			this.mode = (storage.get('tenex:viewMode') as ViewMode) ?? 'projects';
		}
	}

	get value(): ViewMode {
		return this.mode;
	}

	set(mode: ViewMode) {
		this.mode = mode;
		if (browser) {
			storage.set('tenex:viewMode', mode);
		}
	}
}

export const viewModeStore = new ViewModeStore();
