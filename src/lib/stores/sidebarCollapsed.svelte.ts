import { browser } from '$app/environment';
import { storage } from '$lib/utils/storage.svelte';

class SidebarCollapsedStore {
	collapsed = $state<boolean>(false);

	constructor() {
		if (browser) {
			this.collapsed = storage.sidebarCollapsed;
		}
	}

	toggle() {
		this.collapsed = !this.collapsed;
		storage.sidebarCollapsed = this.collapsed;
	}

	set(value: boolean) {
		this.collapsed = value;
		storage.sidebarCollapsed = value;
	}
}

export const sidebarCollapsedStore = new SidebarCollapsedStore();
