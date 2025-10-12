import { browser } from '$app/environment';

export type KeyboardShortcut = {
	key: string;
	metaKey?: boolean;
	ctrlKey?: boolean;
	shiftKey?: boolean;
	altKey?: boolean;
	handler: (event: KeyboardEvent) => void;
};

class KeyboardShortcutManager {
	private shortcuts: KeyboardShortcut[] = [];
	private listening = false;

	register(shortcut: KeyboardShortcut) {
		this.shortcuts.push(shortcut);
		this.startListening();

		// Return cleanup function
		return () => {
			this.unregister(shortcut);
		};
	}

	unregister(shortcut: KeyboardShortcut) {
		const index = this.shortcuts.indexOf(shortcut);
		if (index !== -1) {
			this.shortcuts.splice(index, 1);
		}

		if (this.shortcuts.length === 0) {
			this.stopListening();
		}
	}

	private startListening() {
		if (this.listening || !browser) return;

		this.listening = true;
		document.addEventListener('keydown', this.handleKeyDown);
	}

	private stopListening() {
		if (!this.listening || !browser) return;

		this.listening = false;
		document.removeEventListener('keydown', this.handleKeyDown);
	}

	private handleKeyDown = (event: KeyboardEvent) => {
		// Don't trigger shortcuts when typing in inputs
		const target = event.target as HTMLElement;
		if (
			target.tagName === 'INPUT' ||
			target.tagName === 'TEXTAREA' ||
			target.isContentEditable
		) {
			return;
		}

		for (const shortcut of this.shortcuts) {
			const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
			const metaMatch = shortcut.metaKey ? event.metaKey || event.ctrlKey : true;
			const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey : true;
			const shiftMatch = shortcut.shiftKey ? event.shiftKey : true;
			const altMatch = shortcut.altKey ? event.altKey : true;

			if (keyMatch && metaMatch && ctrlMatch && shiftMatch && altMatch) {
				event.preventDefault();
				shortcut.handler(event);
				break;
			}
		}
	};

	destroy() {
		this.shortcuts = [];
		this.stopListening();
	}
}

export const keyboardShortcutManager = new KeyboardShortcutManager();

// Helper function for registering shortcuts in Svelte components
export function registerShortcut(
	key: string,
	handler: (event: KeyboardEvent) => void,
	options: {
		metaKey?: boolean;
		ctrlKey?: boolean;
		shiftKey?: boolean;
		altKey?: boolean;
	} = {}
) {
	return keyboardShortcutManager.register({
		key,
		handler,
		...options
	});
}
