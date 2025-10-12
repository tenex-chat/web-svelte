import { browser } from '$app/environment';

const STORAGE_KEY = 'tenex-sidebar-collapsed';

class SidebarCollapsedStore {
	collapsed = $state<boolean>(false);

	constructor() {
		if (browser) {
			const stored = localStorage.getItem(STORAGE_KEY);
			this.collapsed = stored === 'true';
		}
	}

	toggle() {
		this.collapsed = !this.collapsed;
		if (browser) {
			localStorage.setItem(STORAGE_KEY, String(this.collapsed));
		}
	}

	set(value: boolean) {
		this.collapsed = value;
		if (browser) {
			localStorage.setItem(STORAGE_KEY, String(value));
		}
	}
}

export const sidebarCollapsedStore = new SidebarCollapsedStore();
