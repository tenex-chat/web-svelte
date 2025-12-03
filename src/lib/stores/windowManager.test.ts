import { describe, it, expect, beforeEach } from 'vitest';
import { windowManager } from './windowManager.svelte';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { NDKSvelte } from '@nostr-dev-kit/svelte';
import type { NDKProject } from '$lib/events/NDKProject';

describe('WindowManager - openCall', () => {
	let ndk: NDKSvelte;
	let mockProject: NDKProject;

	beforeEach(() => {
		ndk = new NDKSvelte({
			explicitRelayUrls: ['wss://tenex.chat/']
		});

		// Create a minimal mock project
		const projectEvent = new NDKEvent(ndk, {
			kind: 30001,
			pubkey: 'testpubkey',
			created_at: Math.floor(Date.now() / 1000),
			tags: [
				['d', 'test-project'],
				['title', 'Test Project']
			],
			content: '',
			id: 'test-event-id',
			sig: 'test-sig'
		});

		mockProject = projectEvent as unknown as NDKProject;
		mockProject.title = 'Test Project';

		// Clear any existing windows
		windowManager.closeAll();
	});

	it('should create a call window with correct configuration', () => {
		const windowId = windowManager.openCall(mockProject);

		const window = windowManager.get(windowId);

		expect(window).toBeDefined();
		expect(window?.type).toBe('call');
		expect(window?.title).toContain('Voice Call');
		expect(window?.title).toContain('Test Project');
		expect(window?.project).toBe(mockProject);
		expect(window?.isDetached).toBe(true);
	});

	it('should create a call window with iPhone-like dimensions', () => {
		const windowId = windowManager.openCall(mockProject);

		const window = windowManager.get(windowId);

		expect(window?.size?.width).toBe(390);
		expect(window?.size?.height).toBe(844);
	});

	it('should position call window centered on screen', () => {
		const windowId = windowManager.openCall(mockProject);

		const window = windowManager.get(windowId);

		expect(window?.position).toBeDefined();
		expect(window?.position?.x).toBeGreaterThanOrEqual(0);
		expect(window?.position?.y).toBeGreaterThanOrEqual(0);
	});

	it('should create call window with higher z-index than existing windows', () => {
		// Create a chat window first
		const chatWindowId = windowManager.openChat(mockProject);
		const chatWindow = windowManager.get(chatWindowId);

		// Create a call window
		const callWindowId = windowManager.openCall(mockProject);
		const callWindow = windowManager.get(callWindowId);

		expect(callWindow?.zIndex).toBeGreaterThan(chatWindow?.zIndex || 0);
	});

	it('should include optional thread data when provided', () => {
		const threadEvent = new NDKEvent(ndk, {
			kind: 1,
			pubkey: 'testpubkey',
			created_at: Math.floor(Date.now() / 1000),
			tags: [['title', 'Test Thread']],
			content: 'Test content',
			id: 'thread-event-id',
			sig: 'thread-sig'
		});

		const windowId = windowManager.openCall(mockProject, threadEvent);

		const window = windowManager.get(windowId);

		expect(window?.data?.thread).toBe(threadEvent);
	});
});
