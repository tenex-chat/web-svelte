import { browser } from '$app/environment';
import { storage } from '$lib/utils/storage.svelte';

type Theme = 'light' | 'dark';

class ThemeStore {
	theme = $state<Theme>('light');

	constructor() {
		if (browser) {
			this.init();
		}
	}

	private init() {
		// Check storage first
		const stored = storage.theme;

		if (stored === 'light' || stored === 'dark') {
			this.theme = stored;
		} else {
			// Check system preference
			const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			this.theme = prefersDark ? 'dark' : 'light';
		}

		// Apply theme
		this.applyTheme();

		// Listen for system preference changes
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
			// Only update if user hasn't set a preference
			if (!storage.theme) {
				this.theme = e.matches ? 'dark' : 'light';
				this.applyTheme();
			}
		});
	}

	private applyTheme() {
		if (!browser) return;

		const root = document.documentElement;

		if (this.theme === 'dark') {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}
	}

	setTheme(newTheme: Theme) {
		this.theme = newTheme;
		this.applyTheme();
		storage.theme = newTheme;
	}

	toggle() {
		this.setTheme(this.theme === 'light' ? 'dark' : 'light');
	}
}

export const themeStore = new ThemeStore();
