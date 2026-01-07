import { browser } from '$app/environment';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { NDKProject } from '$lib/events/NDKProject';
import { isElectron } from '$lib/utils/electron';
import { storage } from '$lib/utils/storage.svelte';
import { ndk } from '$lib/ndk.svelte';
import { NDKKind } from '$lib/kinds';

export type WindowType = 'chat' | 'settings' | 'agent' | 'document' | 'hashtag' | 'call' | 'debug-events';

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

	// Stack of drawer window IDs - top of stack is the currently visible drawer
	private drawerStack = $state<string[]>([]);
	// Flag to track if the drawer is currently visible (vs hidden/closed)
	private drawerVisible = $state(false);

	// Remember the last detached window size for new windows
	private lastDetachedSize = $state<{ width: number; height: number }>({ width: 500, height: 700 });

	constructor() {
		if (browser) {
			this.loadFromStorage();
		}
	}

	private loadFromStorage() {
		const saved = storage.get('tenex-windows');
		if (saved) {
			// Don't restore windows on load - start fresh
			// Could restore detached windows if desired
		}

		// Load last detached window size
		const savedSize = storage.get('tenex-detached-window-size');
		if (savedSize && savedSize.width && savedSize.height) {
			this.lastDetachedSize = savedSize;
		}
	}

	private saveToStorage() {
		const detachedWindows = this.windowsArray.filter((w) => w.isDetached);

		// Transform windows to serializable format (remove circular references from NDK objects)
		const serializableWindows = detachedWindows.map((w) => ({
			id: w.id,
			type: w.type,
			title: w.title,
			projectTagId: w.project?.tagId(),
			threadId: w.data?.thread?.id,
			agentPubkey: w.data?.agentPubkey,
			agentName: w.data?.agentName,
			isDetached: w.isDetached,
			position: w.position,
			size: w.size,
			zIndex: w.zIndex
		}));

		storage.set('tenex-windows', serializableWindows);
	}

	/**
	 * Open a window (drawer or detached)
	 * For drawers, this pushes onto the stack instead of creating separate drawers
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

		// Push to drawer stack and make visible
		this.drawerStack = [...this.drawerStack, id];
		this.drawerVisible = true;

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
	 * Open a chat conversation directly as a detached (floating) window
	 */
	openChatDetached(project: NDKProject, thread?: NDKEvent, position?: { x: number; y: number }) {
		const id = crypto.randomUUID();
		const title = thread?.tagValue('title') || 'New Conversation';

		// Use remembered size or default
		const width = this.lastDetachedSize.width;
		const height = this.lastDetachedSize.height;

		// Calculate position - use provided position or center on screen
		const x = position?.x ?? Math.max(50, (globalThis.innerWidth - width) / 2);
		const y = position?.y ?? Math.max(50, (globalThis.innerHeight - height) / 2);

		// Ensure window is above all other windows
		const maxZIndex = Math.max(...this.windowsArray.map(w => w.zIndex), this.nextZIndex - 1);
		const zIndex = maxZIndex + 1;
		this.nextZIndex = zIndex + 1;

		const window: WindowConfig = {
			id,
			type: 'chat',
			title,
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
	 * Open a chat from an event (resolves project and thread automatically)
	 * Use this when you have an event from inbox/notifications
	 */
	async openChatFromEvent(event: NDKEvent): Promise<string | null> {
		// Get project reference from 'a' tag
		const aTag = event.tagValue('a');
		if (!aTag) {
			console.warn('Cannot open chat: event has no project reference (a tag)');
			return null;
		}

		// Fetch the project
		const projectEvent = await ndk.fetchEvent({ kinds: [NDKKind.Project], '#d': [aTag.split(':')[2]], authors: [aTag.split(':')[1]] });
		if (!projectEvent) {
			console.warn('Cannot open chat: project not found for', aTag);
			return null;
		}
		const project = NDKProject.from(projectEvent);

		// Find the root thread
		// If the event has e-tags, look for the root; otherwise, the event itself is the root
		const eTags = event.tags.filter(t => t[0] === 'e');
		let thread: NDKEvent | undefined;

		if (eTags.length === 0) {
			// This event is a root thread
			thread = event;
		} else {
			// Find the root event - look for e-tag with 'root' marker or use the first e-tag
			const rootTag = eTags.find(t => t[3] === 'root') || eTags[0];
			if (rootTag) {
				const rootEvent = await ndk.fetchEvent(rootTag[1]);
				thread = rootEvent || event;
			} else {
				thread = event;
			}
		}

		return this.openChat(project, thread);
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
	 * Close a window completely (removes from stack and windows array)
	 * For drawers: also removes from stack
	 */
	close(id: string) {
		const window = this.windowsArray.find((w) => w.id === id);

		// Remove from windows array
		this.windowsArray = this.windowsArray.filter((w) => w.id !== id);

		// If it was a drawer, remove from stack
		if (window && !window.isDetached) {
			this.drawerStack = this.drawerStack.filter((wid) => wid !== id);
		}

		this.saveToStorage();
	}

	/**
	 * Close the drawer panel (hides it but preserves the stack)
	 * The stack remains intact so reopening will show the top item
	 */
	closeDrawer() {
		this.drawerVisible = false;
	}

	/**
	 * Navigate back in the drawer stack (pop from stack)
	 * If at the bottom of the stack, closes the drawer
	 */
	navigateBack() {
		if (this.drawerStack.length <= 1) {
			// At bottom of stack, close the drawer
			this.drawerVisible = false;
			return;
		}

		// Pop the top item from the stack
		const poppedId = this.drawerStack[this.drawerStack.length - 1];
		this.drawerStack = this.drawerStack.slice(0, -1);

		// Also remove the window config for the popped item
		this.windowsArray = this.windowsArray.filter((w) => w.id !== poppedId);
		this.saveToStorage();
	}

	/**
	 * Close all windows
	 */
	closeAll() {
		this.windowsArray = [];
		this.drawerStack = [];
		this.drawerVisible = false;
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

		// Remove from drawer stack since it's becoming detached
		this.drawerStack = this.drawerStack.filter((wid) => wid !== id);

		// In browser, convert to floating window using remembered size
		const updatedWindow = {
			...window,
			isDetached: true,
			position: position || { x: 100, y: 100 },
			size: window.size || this.lastDetachedSize,
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

		// Add back to drawer stack and make visible
		this.drawerStack = [...this.drawerStack, id];
		this.drawerVisible = true;

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

		// Remember this size for new windows
		this.lastDetachedSize = size;
		storage.set('tenex-detached-window-size', size);
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
	 * @deprecated Use currentDrawer instead for the visible drawer
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
	 * Get the currently visible drawer (top of stack)
	 * Returns undefined if drawer is closed/hidden
	 */
	get currentDrawer(): WindowConfig | undefined {
		if (!this.drawerVisible || this.drawerStack.length === 0) {
			return undefined;
		}
		const topId = this.drawerStack[this.drawerStack.length - 1];
		return this.windowsArray.find((w) => w.id === topId);
	}

	/**
	 * Check if drawer is currently visible
	 */
	get isDrawerOpen(): boolean {
		return this.drawerVisible && this.drawerStack.length > 0;
	}

	/**
	 * Get the number of items in the drawer stack
	 */
	get drawerStackSize(): number {
		return this.drawerStack.length;
	}

	/**
	 * Check if we can navigate back (more than one item in stack)
	 */
	get canNavigateBack(): boolean {
		return this.drawerStack.length > 1;
	}

	/**
	 * Get the active drawer (top drawer)
	 * @deprecated Use currentDrawer instead
	 */
	get activeDrawer(): WindowConfig | undefined {
		return this.currentDrawer;
	}
}

export const windowManager = new WindowManager();
