import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'medium' | 'large';

interface NotificationSettings {
	projectUpdates: boolean;
	taskAssignments: boolean;
	agentResponses: boolean;
	threadReplies: boolean;
	mentions: boolean;
	soundEnabled: boolean;
}

interface UISettings {
	theme: Theme;
	fontSize: FontSize;
	compactMode: boolean;
	animationsEnabled: boolean;
	colorScheme: string;
	notifications: NotificationSettings;
}

const STORAGE_KEY = 'ui-settings';

const defaultSettings: UISettings = {
	theme: 'system',
	fontSize: 'medium',
	compactMode: false,
	animationsEnabled: true,
	colorScheme: 'default',
	notifications: {
		projectUpdates: true,
		taskAssignments: true,
		agentResponses: true,
		threadReplies: true,
		mentions: true,
		soundEnabled: true
	}
};

class UISettingsStore {
	settings = $state<UISettings>(defaultSettings);

	constructor() {
		if (browser) {
			this.load();
			this.applySettings();
		}
	}

	private load() {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				this.settings = { ...defaultSettings, ...JSON.parse(stored) };
			}
		} catch (error) {
			console.error('Failed to load UI settings:', error);
		}
	}

	private save() {
		if (!browser) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
		} catch (error) {
			console.error('Failed to save UI settings:', error);
		}
	}

	private applySettings() {
		if (!browser) return;

		// Apply theme
		this.applyTheme();

		// Apply font size
		const fontSizes = { small: '14px', medium: '16px', large: '18px' };
		document.documentElement.style.fontSize = fontSizes[this.settings.fontSize];

		// Apply compact mode
		if (this.settings.compactMode) {
			document.documentElement.classList.add('compact');
		} else {
			document.documentElement.classList.remove('compact');
		}

		// Apply animations
		if (!this.settings.animationsEnabled) {
			document.documentElement.classList.add('no-animations');
		} else {
			document.documentElement.classList.remove('no-animations');
		}

		// Apply color scheme
		document.documentElement.setAttribute('data-color-scheme', this.settings.colorScheme);
	}

	private applyTheme() {
		if (!browser) return;

		let effectiveTheme = this.settings.theme;

		if (effectiveTheme === 'system') {
			effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'dark'
				: 'light';
		}

		if (effectiveTheme === 'dark') {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}

	setTheme(theme: Theme) {
		this.settings.theme = theme;
		this.applyTheme();
		this.save();
	}

	setFontSize(fontSize: FontSize) {
		this.settings.fontSize = fontSize;
		this.applySettings();
		this.save();
	}

	setCompactMode(enabled: boolean) {
		this.settings.compactMode = enabled;
		this.applySettings();
		this.save();
	}

	setAnimationsEnabled(enabled: boolean) {
		this.settings.animationsEnabled = enabled;
		this.applySettings();
		this.save();
	}

	setColorScheme(scheme: string) {
		this.settings.colorScheme = scheme;
		this.applySettings();
		this.save();
	}

	updateNotifications(updates: Partial<NotificationSettings>) {
		this.settings.notifications = { ...this.settings.notifications, ...updates };
		this.save();
	}
}

export const uiSettingsStore = new UISettingsStore();

// Listen for system theme changes
if (browser) {
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
		if (uiSettingsStore.settings.theme === 'system') {
			uiSettingsStore.setTheme('system');
		}
	});
}
