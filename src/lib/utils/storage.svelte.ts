import { browser } from '$app/environment';
import { toastStore } from '$lib/stores/toast.svelte';
import type { AIConfig } from '$lib/stores/aiConfig.svelte';

/**
 * Storage schema defining all localStorage keys and their types.
 * This is the single source of truth for all storage keys in the application.
 */
export type StorageSchema = {
	// Simple UI settings
	'theme-preference': 'light' | 'dark';
	'tenex-sidebar-collapsed': boolean;

	// Complex settings objects
	'ui-settings': {
		theme: 'light' | 'dark' | 'system';
		fontSize: 'small' | 'medium' | 'large';
		compactMode: boolean;
		animationsEnabled: boolean;
		streamingResponsesEnabled: boolean;
		showReasoningEvents: boolean;
		showMessageInfo: boolean;
		colorScheme: string;
		notifications: {
			projectUpdates: boolean;
			taskAssignments: boolean;
			agentResponses: boolean;
			threadReplies: boolean;
			mentions: boolean;
			soundEnabled: boolean;
		};
	};

	'ai-config-v2': AIConfig;
	'llm-configs': AIConfig['llmConfigs'];
	'active-llm-config-id': string | null;
	'ui-llm-configs': AIConfig['uiLLMConfigs'];

	'relay-settings': string[];

	// Draft management
	'message-drafts': Record<string, string>;
	'draft-timestamps': Record<string, number>;

	// Project management
	'tenex:openProjects': string[];
	'project-filters': Record<string, string | null>;
	'tenex:projectGroups': Array<{
		id: string;
		name: string;
		projectIds: string[];
		createdAt: number;
		pinned?: boolean;
	}>;
	'tenex:selectedProjectGroup': string | null;

	// Additional stores
	'blossom-settings': {
		servers: Array<{
			url: string;
			name?: string;
			status?: 'online' | 'offline' | 'checking';
			lastChecked?: number;
		}>;
		uploadConfig: {
			maxSizeMB: number;
			compressImages: boolean;
			stripExif: boolean;
		};
	};
	'tenex:call-settings': {
		inputDeviceId: string | null;
		outputDeviceId: string | null;
		inputVolume: number;
		noiseSuppression: boolean;
		echoCancellation: boolean;
		voiceActivityDetection: boolean;
		vadSensitivity: number;
		vadMode: 'disabled' | 'auto' | 'push-to-talk';
		interruptionMode: 'disabled' | 'headphones';
		interruptionSensitivity: 'low' | 'medium' | 'high';
	};
	'tenex-windows': any[];
	'last-inbox-visit': number;
	'saved_nudges': string[];
};

type StorageKey = keyof StorageSchema;

/**
 * Reactive localStorage service with type safety and error handling.
 * Maintains Svelte 5 reactive state that automatically syncs with localStorage.
 */
class StorageService {
	private state = $state<Partial<StorageSchema>>({});
	private initialized = false;

	constructor() {
		if (browser) {
			this.init();
		}
	}

	private init(): void {
		this.loadAll();
		this.setupStorageListener();
		this.initialized = true;
	}

	/**
	 * Load all values from localStorage on initialization
	 */
	private loadAll(): void {
		const keys: StorageKey[] = [
			'theme-preference',
			'tenex-sidebar-collapsed',
			'ui-settings',
			'ai-config-v2',
			'llm-configs',
			'active-llm-config-id',
			'ui-llm-configs',
			'relay-settings',
			'message-drafts',
			'draft-timestamps',
			'tenex:openProjects',
			'project-filters',
			'tenex:projectGroups',
			'tenex:selectedProjectGroup',
			'blossom-settings',
			'tenex:call-settings',
			'tenex-windows',
			'last-inbox-visit',
			'saved_nudges'
		];

		for (const key of keys) {
			try {
				const item = localStorage.getItem(key);
				if (item !== null) {
					this.state[key] = JSON.parse(item) as any;
				}
			} catch (error) {
				console.error(`[StorageService] Failed to load ${key}:`, error);
				// Continue with undefined value
			}
		}
	}

	/**
	 * Set up listener for cross-tab storage changes
	 */
	private setupStorageListener(): void {
		window.addEventListener('storage', (e: StorageEvent) => {
			if (e.key && e.newValue) {
				try {
					this.state[e.key as StorageKey] = JSON.parse(e.newValue) as any;
				} catch {
					// Ignore invalid data from other tabs
				}
			} else if (e.key && e.newValue === null) {
				// Key was removed in another tab
				delete this.state[e.key as StorageKey];
			}
		});
	}

	/**
	 * Persist a value to localStorage
	 */
	private persist<K extends StorageKey>(key: K, value: StorageSchema[K]): void {
		if (!browser) return;

		try {
			const serialized = JSON.stringify(value);
			localStorage.setItem(key, serialized);
		} catch (error) {
			console.error(`[StorageService] Failed to persist ${key}:`, error);

			// Show user-friendly error message
			if (error instanceof Error) {
				if (error.name === 'QuotaExceededError') {
					toastStore.error('Storage limit reached. Some settings may not be saved.');
				} else {
					toastStore.error('Failed to save settings. Check browser storage permissions.');
				}
			}
		}
	}

	/**
	 * Get a value from storage
	 */
	get<K extends StorageKey>(key: K): StorageSchema[K] | undefined {
		return this.state[key];
	}

	/**
	 * Set a value in storage
	 */
	set<K extends StorageKey>(key: K, value: StorageSchema[K]): void {
		this.state[key] = value;
		this.persist(key, value);
	}

	/**
	 * Remove a value from storage
	 */
	remove<K extends StorageKey>(key: K): void {
		delete this.state[key];
		if (browser) {
			try {
				localStorage.removeItem(key);
			} catch (error) {
				console.error(`[StorageService] Failed to remove ${key}:`, error);
			}
		}
	}

	/**
	 * Clear all storage
	 */
	clear(): void {
		this.state = {};
		if (browser) {
			try {
				localStorage.clear();
			} catch (error) {
				console.error('[StorageService] Failed to clear storage:', error);
			}
		}
	}

	// ========== Convenience getters/setters for common keys ==========

	get theme(): 'light' | 'dark' | undefined {
		return this.state['theme-preference'];
	}

	set theme(value: 'light' | 'dark') {
		this.set('theme-preference', value);
	}

	get sidebarCollapsed(): boolean {
		return this.state['tenex-sidebar-collapsed'] ?? false;
	}

	set sidebarCollapsed(value: boolean) {
		this.set('tenex-sidebar-collapsed', value);
	}

	// ========== Draft management ==========

	getDraft(conversationId: string): string | undefined {
		const drafts = this.state['message-drafts'];
		return drafts?.[conversationId];
	}

	setDraft(conversationId: string, content: string): void {
		const drafts = { ...(this.state['message-drafts'] ?? {}), [conversationId]: content };
		this.set('message-drafts', drafts);

		// Update timestamp
		const timestamps = {
			...(this.state['draft-timestamps'] ?? {}),
			[conversationId]: Date.now()
		};
		this.set('draft-timestamps', timestamps);
	}

	clearDraft(conversationId: string): void {
		const drafts = { ...(this.state['message-drafts'] ?? {}) };
		delete drafts[conversationId];
		this.set('message-drafts', drafts);

		const timestamps = { ...(this.state['draft-timestamps'] ?? {}) };
		delete timestamps[conversationId];
		this.set('draft-timestamps', timestamps);
	}

	getDraftTimestamp(conversationId: string): number | undefined {
		const timestamps = this.state['draft-timestamps'];
		return timestamps?.[conversationId];
	}

	// ========== Project filters ==========

	getProjectFilter(projectId: string): string | null | undefined {
		const filters = this.state['project-filters'];
		return filters?.[projectId];
	}

	setProjectFilter(projectId: string, filter: string | null): void {
		const filters = { ...(this.state['project-filters'] ?? {}), [projectId]: filter };
		this.set('project-filters', filters);
	}

	clearProjectFilter(projectId: string): void {
		const filters = { ...(this.state['project-filters'] ?? {}) };
		delete filters[projectId];
		this.set('project-filters', filters);
	}
}

/**
 * Singleton storage service instance
 */
export const storage = new StorageService();
