import { browser } from '$app/environment';
import { storage } from '$lib/utils/storage.svelte';

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
	streamingResponsesEnabled: boolean;
	showReasoningEvents: boolean;
	showMessageInfo: boolean;
	colorScheme: string;
	notifications: NotificationSettings;
}

const defaultSettings: UISettings = {
	theme: 'system',
	fontSize: 'medium',
	compactMode: false,
	animationsEnabled: true,
	streamingResponsesEnabled: true,
	showReasoningEvents: true,
	showMessageInfo: true,
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
		const stored = storage.get('ui-settings');
		if (stored) {
			this.settings = { ...defaultSettings, ...stored };
		}
	}

	private save() {
		if (!browser) return;
		storage.set('ui-settings', this.settings);
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

	setStreamingResponsesEnabled(enabled: boolean) {
		this.settings.streamingResponsesEnabled = enabled;
		this.save();
	}

	setShowReasoningEvents(enabled: boolean) {
		this.settings.showReasoningEvents = enabled;
		this.save();
	}

	setShowMessageInfo(enabled: boolean) {
		this.settings.showMessageInfo = enabled;
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
