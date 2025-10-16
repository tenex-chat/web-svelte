import { browser } from '$app/environment';

export interface BlossomServer {
	url: string;
	name?: string;
	status?: 'online' | 'offline' | 'checking';
	lastChecked?: number;
}

export interface BlossomUploadConfig {
	maxSizeMB: number;
	compressImages: boolean;
	stripExif: boolean;
}

interface BlossomSettings {
	servers: BlossomServer[];
	uploadConfig: BlossomUploadConfig;
}

const STORAGE_KEY = 'blossom-settings';

const defaultSettings: BlossomSettings = {
	servers: [],
	uploadConfig: {
		maxSizeMB: 10,
		compressImages: true,
		stripExif: true
	}
};

class BlossomSettingsStore {
	settings = $state<BlossomSettings>(defaultSettings);

	constructor() {
		if (browser) {
			this.load();
		}
	}

	private load() {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				this.settings = { ...defaultSettings, ...JSON.parse(stored) };
			}
		} catch (error) {
			console.error('Failed to load blossom settings:', error);
		}
	}

	private save() {
		if (!browser) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
		} catch (error) {
			console.error('Failed to save blossom settings:', error);
		}
	}

	addServer(url: string, name?: string) {
		const normalizedUrl = url.trim().replace(/\/$/, '');

		if (this.settings.servers.some((s) => s.url === normalizedUrl)) {
			throw new Error('Server already exists');
		}

		this.settings.servers = [
			...this.settings.servers,
			{
				url: normalizedUrl,
				name: name?.trim() || normalizedUrl,
				status: 'checking'
			}
		];
		this.save();
		this.checkServerStatus(normalizedUrl);
	}

	removeServer(url: string) {
		this.settings.servers = this.settings.servers.filter((s) => s.url !== url);
		this.save();
	}

	async checkServerStatus(url: string) {
		const serverIndex = this.settings.servers.findIndex((s) => s.url === url);
		if (serverIndex === -1) return;

		try {
			const response = await fetch(url, { method: 'HEAD' });
			const newServers = [...this.settings.servers];
			newServers[serverIndex] = {
				...newServers[serverIndex],
				status: response.ok ? 'online' : 'offline',
				lastChecked: Date.now()
			};
			this.settings.servers = newServers;
			this.save();
		} catch {
			const newServers = [...this.settings.servers];
			newServers[serverIndex] = {
				...newServers[serverIndex],
				status: 'offline',
				lastChecked: Date.now()
			};
			this.settings.servers = newServers;
			this.save();
		}
	}

	async checkAllServers() {
		for (const server of this.settings.servers) {
			await this.checkServerStatus(server.url);
		}
	}

	updateUploadConfig(config: Partial<BlossomUploadConfig>) {
		this.settings.uploadConfig = { ...this.settings.uploadConfig, ...config };
		this.save();
	}
}

export const blossomSettingsStore = new BlossomSettingsStore();
