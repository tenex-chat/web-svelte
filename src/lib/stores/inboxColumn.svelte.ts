import { browser } from '$app/environment';
import { storage } from '$lib/utils/storage.svelte';

const STORAGE_KEY = 'tenex:inboxColumnOpen';

function loadFromStorage(): boolean {
	if (!browser) return false;
	return storage.get(STORAGE_KEY) ?? false;
}

function saveToStorage(isOpen: boolean) {
	if (!browser) return;
	storage.set(STORAGE_KEY, isOpen);
}

export const inboxColumnStore = (() => {
	let isOpen = $state<boolean>(loadFromStorage());

	return {
		get isOpen() {
			return isOpen;
		},
		toggle() {
			isOpen = !isOpen;
			saveToStorage(isOpen);
		},
		open() {
			isOpen = true;
			saveToStorage(true);
		},
		close() {
			isOpen = false;
			saveToStorage(false);
		}
	};
})();
