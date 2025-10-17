import { browser } from '$app/environment';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import type { NDKProject } from '$lib/events/NDKProject';
import { isElectron } from '$lib/utils/electron';

export type WindowType = 'chat' | 'settings' | 'agent' | 'document' | 'hashtag' | 'call';

export interface WindowConfig {
	id: string;
	type: WindowType;
	title: string;
	project?: NDKProject;
	data?: any; // thread event, agent, etc.
	isDetached: boolean;
	position?: { x: number; y: number };
	size?: { width: number; height: number };
	zIndex: number;
}

class WindowManager {
	private windowsArray = $state<WindowConfig[]>([]);
	private nextZIndex = $state(1000);

	constructor() {
		if (browser) {
			this.loadFromStorage();
		}
	}

	private loadFromStorage() {
		try {
			const saved = localStorage.getItem('tenex-windows');
			if (saved) {
				const data = JSON.parse(saved);
				// Don't restore windows on load - start fresh
				// Could restore detached windows if desired
			}
		} catch (e) {
			console.error('Failed to load windows from storage:', e);
		}
	}

	private saveToStorage() {
		try {
			const detachedWindows = this.windowsArray.filter((w) => w.isDetached);
			localStorage.setItem('tenex-windows', JSON.stringify(detachedWindows));
		} catch (e) {
			console.error('Failed to save windows to storage:', e.messge);
		}
	}

	/**
	 * Open a window (drawer or detached)
	 */
	open(config: Omit<WindowConfig, 'id' | 'zIndex' | 'isDetached'>) {
		const id = crypto.randomUUID();
		const window: WindowConfig = {
			...config,
			id,
			isDetached: false,
			zIndex: this.nextZIndex++
		};
		this.windowsArray = [...this.windowsArray, window];
		this.saveToStorage();
		return id;
	}

	/**
	 * Open a chat conversation
	 */
	openChat(project: NDKProject, thread?: NDKEvent) {
		const title = thread?.tagValue('title') || 'New Conversation';
		return this.open({
			type: 'chat',
			title,
			project,
			data: { thread }
		});
	}

	/**
	 * Open project settings
	 */
	openSettings(project: NDKProject) {
		return this.open({
			type: 'settings',
			title: `${project.title} - Settings`,
			project
		});
	}

	/**
	 * Open agent details
	 */
	openAgent(project: NDKProject, agentPubkey: string, agentName: string) {
		return this.open({
			type: 'agent',
			title: agentName,
			project,
			data: { agentPubkey, agentName }
		});
	}

	/**
	 * Open a voice call - always opens as detached window with phone aspect ratio
	 */
	openCall(project: NDKProject, thread?: NDKEvent) {
		const id = crypto.randomUUID();

		// iPhone-like dimensions (9:19.5 aspect ratio, similar to iPhone 14/15)
		const width = 390;
		const height = 844;

		// Center the call window on screen
		const x = Math.max(100, (globalThis.innerWidth - width) / 2);
		const y = Math.max(100, (globalThis.innerHeight - height) / 2);

		// Ensure call window is above all other windows
		const maxZIndex = Math.max(...this.windowsArray.map(w => w.zIndex), this.nextZIndex - 1);
		const zIndex = maxZIndex + 1;
		this.nextZIndex = zIndex + 1;

		const window: WindowConfig = {
			id,
			type: 'call',
			title: `Voice Call - ${project.title}`,
			project,
			data: { thread },
			isDetached: true,
			position: { x, y },
			size: { width, height },
			zIndex
		};

		this.windowsArray = [...this.windowsArray, window];
		this.saveToStorage();
		return id;
	}

	/**
	 * Close a window
	 */
	close(id: string) {
		this.windowsArray = this.windowsArray.filter((w) => w.id !== id);
		this.saveToStorage();
	}

	/**
	 * Close all windows
	 */
	closeAll() {
		this.windowsArray = [];
		this.saveToStorage();
	}

	/**
	 * Detach window (convert drawer to floating window)
	 */
	detach(id: string, position?: { x: number; y: number }) {
		const index = this.windowsArray.findIndex((w) => w.id === id);
		if (index === -1) return;

		const window = this.windowsArray[index];

		// In Electron, create a native window
		if (isElectron() && globalThis.window?.electron) {
			const { ipcRenderer } = globalThis.window.electron;
			const url = this.buildWindowUrl(window);
			ipcRenderer.send('open-window', {
				url,
				title: window.title,
				width: window.size?.width || 800,
				height: window.size?.height || 600
			});
			// Close the drawer since it's now a native window
			this.close(id);
			return;
		}

		// In browser, convert to floating window
		const updatedWindow = {
			...window,
			isDetached: true,
			position: position || { x: 100, y: 100 },
			size: window.size || { width: 800, height: 600 },
			zIndex: this.nextZIndex++
		};

		this.windowsArray = [
			...this.windowsArray.slice(0, index),
			updatedWindow,
			...this.windowsArray.slice(index + 1)
		];
		this.saveToStorage();
	}

	/**
	 * Build URL for window based on type and data
	 */
	private buildWindowUrl(window: WindowConfig): string {
		const params = new URLSearchParams();
		params.set('type', window.type);

		if (window.project) {
			params.set('projectId', window.project.tagId());
		}
		if (window.data?.thread) {
			params.set('threadId', window.data.thread.id);
		}
		if (window.data?.agentPubkey) {
			params.set('agentPubkey', window.data.agentPubkey);
		}
		if (window.data?.agentName) {
			params.set('agentName', window.data.agentName);
		}

		return `/window?${params.toString()}`;
	}

	/**
	 * Re-attach window (convert floating to drawer)
	 */
	attach(id: string) {
		const index = this.windowsArray.findIndex((w) => w.id === id);
		if (index === -1) return;

		const window = this.windowsArray[index];
		const updatedWindow = {
			...window,
			isDetached: false,
			position: undefined,
			zIndex: this.nextZIndex++
		};

		this.windowsArray = [
			...this.windowsArray.slice(0, index),
			updatedWindow,
			...this.windowsArray.slice(index + 1)
		];
		this.saveToStorage();
	}

	/**
	 * Bring window to front
	 */
	focus(id: string) {
		const index = this.windowsArray.findIndex((w) => w.id === id);
		if (index === -1) return;

		const window = this.windowsArray[index];
		const updatedWindow = {
			...window,
			zIndex: this.nextZIndex++
		};

		this.windowsArray = [
			...this.windowsArray.slice(0, index),
			updatedWindow,
			...this.windowsArray.slice(index + 1)
		];
	}

	/**
	 * Update window position (for dragging)
	 */
	updatePosition(id: string, position: { x: number; y: number }) {
		const index = this.windowsArray.findIndex((w) => w.id === id);
		if (index === -1) return;

		const window = this.windowsArray[index];
		if (!window.isDetached) return;

		const updatedWindow = {
			...window,
			position
		};

		this.windowsArray = [
			...this.windowsArray.slice(0, index),
			updatedWindow,
			...this.windowsArray.slice(index + 1)
		];
		this.saveToStorage();
	}

	/**
	 * Update window size (for resizing)
	 */
	updateSize(id: string, size: { width: number; height: number }) {
		const index = this.windowsArray.findIndex((w) => w.id === id);
		if (index === -1) return;

		const window = this.windowsArray[index];
		if (!window.isDetached) return;

		const updatedWindow = {
			...window,
			size
		};

		this.windowsArray = [
			...this.windowsArray.slice(0, index),
			updatedWindow,
			...this.windowsArray.slice(index + 1)
		];
		this.saveToStorage();
	}

	/**
	 * Update window data (for chat threads, etc.)
	 */
	updateWindowData(id: string, data: any, title?: string) {
		const index = this.windowsArray.findIndex((w) => w.id === id);
		if (index === -1) return;

		const window = this.windowsArray[index];
		const updatedWindow = {
			...window,
			data,
			...(title && { title })
		};

		this.windowsArray = [
			...this.windowsArray.slice(0, index),
			updatedWindow,
			...this.windowsArray.slice(index + 1)
		];
		this.saveToStorage();
	}

	/**
	 * Get a specific window
	 */
	get(id: string): WindowConfig | undefined {
		return this.windowsArray.find((w) => w.id === id);
	}

	/**
	 * Get all windows
	 */
	get all(): WindowConfig[] {
		return [...this.windowsArray].sort((a, b) => a.zIndex - b.zIndex);
	}

	/**
	 * Get drawer windows (not detached)
	 */
	get drawers(): WindowConfig[] {
		return this.all.filter((w) => !w.isDetached);
	}

	/**
	 * Get detached windows (floating)
	 */
	get detached(): WindowConfig[] {
		return this.all.filter((w) => w.isDetached);
	}

	/**
	 * Get the active drawer (top drawer)
	 */
	get activeDrawer(): WindowConfig | undefined {
		const drawers = this.drawers;
		return drawers.length > 0 ? drawers[drawers.length - 1] : undefined;
	}
}

export const windowManager = new WindowManager();
