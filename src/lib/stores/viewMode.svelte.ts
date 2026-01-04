import { browser } from '$app/environment';
import { storage } from '$lib/utils/storage.svelte';

export type ViewMode = 'projects' | 'status';

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

	toggle() {
		this.set(this.mode === 'projects' ? 'status' : 'projects');
	}
}

export const viewModeStore = new ViewModeStore();
