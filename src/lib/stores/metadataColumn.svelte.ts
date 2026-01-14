import { browser } from '$app/environment';
import { storage } from '$lib/utils/storage.svelte';

function loadFromStorage(): boolean {
	if (!browser) return false;
	return storage.get('tenex:metadataColumnOpen') ?? false;
}

function saveToStorage(isOpen: boolean) {
	if (!browser) return;
	storage.set('tenex:metadataColumnOpen', isOpen);
}

export const metadataColumnStore = (() => {
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
