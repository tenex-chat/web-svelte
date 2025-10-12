<script lang="ts">
	import type { NDKProject } from '$lib/events/NDKProject';
	import { ndk } from '$lib/ndk.svelte';
	import { Avatar } from '@nostr-dev-kit/svelte';
	import { openProjects } from '$lib/stores/openProjects.svelte';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import { sidebarCollapsedStore } from '$lib/stores/sidebarCollapsed.svelte';
	import { inboxStore } from '$lib/stores/inbox.svelte';
	import { uiSettingsStore } from '$lib/stores/uiSettings.svelte';
	import { cn } from '$lib/utils/cn';
	import { registerShortcut } from '$lib/utils/keyboardShortcuts';
	import DropdownMenu, { type DropdownMenuItem } from './ui/DropdownMenu.svelte';
	import Tooltip from './ui/Tooltip.svelte';
	import CreateProjectDialog from './dialogs/CreateProjectDialog.svelte';
	import GlobalSearchDialog from './dialogs/GlobalSearchDialog.svelte';
	import InboxPopover from './inbox/InboxPopover.svelte';
	import ProjectStatusDebug from './debug/ProjectStatusDebug.svelte';

	interface Props {
		projects: NDKProject[];
	}

	let { projects }: Props = $props();

	// State
	let createDialogOpen = $state(false);
	let searchDialogOpen = $state(false);
	let inboxPopoverOpen = $state(false);
	let debugDialogOpen = $state(false);
	let userMenuOpen = $state(false);
	let longPressTimer: NodeJS.Timeout | null = null;
	let longPressProjectId: string | null = null;

	// Derived state
	const collapsed = $derived(sidebarCollapsedStore.collapsed);
	const currentUser = $derived(ndk.$sessions?.[0]);
	const userProfile = $derived(
		currentUser ? ndk.$subscribe({ kinds: [0], authors: [currentUser.pubkey] }, { wrap: true }) : null
	);
	const profile = $derived(userProfile?.events?.[0] ? JSON.parse(userProfile.events[0].content) : null);

	// Initialize inbox store
	$effect(() => {
		inboxStore.init();
		return () => inboxStore.destroy();
	});

	// Keyboard shortcuts
	$effect(() => {
		const cleanupSearch = registerShortcut('k', () => (searchDialogOpen = true), { metaKey: true });
		const cleanupInbox = registerShortcut('i', () => (inboxPopoverOpen = !inboxPopoverOpen), {
			metaKey: true
		});
		const cleanupSidebar = registerShortcut('b', () => sidebarCollapsedStore.toggle(), {
			metaKey: true
		});

		return () => {
			cleanupSearch();
			cleanupInbox();
			cleanupSidebar();
		};
	});

	// User menu items
	const userMenuItems: DropdownMenuItem[] = [
		{
			label: 'New project',
			icon: '➕',
			onClick: () => (createDialogOpen = true)
		},
		{ separator: true },
		{
			label: 'Agents',
			icon: '🤖',
			href: '/agents'
		},
		{
			label: 'MCP Tools',
			icon: '🔧',
			href: '/mcp-tools'
		},
		{
			label: 'Settings',
			icon: '⚙️',
			href: '/settings'
		},
		{ separator: true },
		{
			label: 'Theme',
			icon: '🌙',
			submenu: [
				{ label: 'Light', icon: '☀️', onClick: () => uiSettingsStore.setTheme('light') },
				{ label: 'Dark', icon: '🌙', onClick: () => uiSettingsStore.setTheme('dark') },
				{ label: 'System', icon: '💻', onClick: () => uiSettingsStore.setTheme('system') }
			]
		},
		{ separator: true },
		{
			label: 'Debug',
			icon: '🐛',
			submenu: [
				{
					label: 'Project Status Debug Tool',
					onClick: () => (debugDialogOpen = true)
				}
			]
		},
		{ separator: true },
		{
			label: 'Logout',
			icon: '🚪',
			onClick: () => {
				if (currentUser) {
					ndk.logout(currentUser.pubkey);
				}
				window.location.href = '/';
			}
		}
	];

	function handleProjectClick(project: NDKProject) {
		openProjects.toggle(project);
	}

	function handleProjectMouseDown(projectId: string, event: MouseEvent) {
		event.preventDefault();
		longPressProjectId = projectId;
		longPressTimer = setTimeout(() => {
			// Navigate to project detail page on long press
			window.location.href = `/projects/${projectId}`;
		}, 500);
	}

	function handleProjectMouseUp(project: NDKProject) {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}

		// If it wasn't a long press, handle normal click
		if (longPressProjectId === (project.dTag || project.id)) {
			handleProjectClick(project);
		}
		longPressProjectId = null;
	}

	function handleProjectMouseLeave() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		longPressProjectId = null;
	}

	// Generate project color from dTag
	function getProjectColor(project: NDKProject): string {
		const str = project.dTag || '';
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = (hash << 5) - hash + str.charCodeAt(i);
			hash = hash & hash;
		}
		const hue = Math.abs(hash) % 360;
		return `hsl(${hue}, 65%, 55%)`;
	}
</script>

<div
	class={cn(
		'bg-white border-r border-gray-200 flex flex-col transition-all duration-300',
		collapsed ? 'w-16' : 'w-64'
	)}
	data-collapsed={collapsed}
>
	<!-- Header -->
	<div class="border-b border-gray-200 px-3 py-3">
		<div class="flex items-center justify-between">
			{#if !collapsed}
				<a href="/projects" class="flex items-center gap-2 flex-1 hover:opacity-80 transition-opacity">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
						/>
					</svg>
					<span class="font-bold">TENEX</span>
				</a>
			{:else}
				<Tooltip text="TENEX" side="right">
					<a href="/projects" class="flex items-center justify-center w-10 h-10 hover:opacity-80 transition-opacity" aria-label="TENEX home">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
							/>
						</svg>
					</a>
				</Tooltip>
			{/if}

			<button
				onclick={() => sidebarCollapsedStore.toggle()}
				class="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
				aria-label="Toggle sidebar"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d={collapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'}
					/>
				</svg>
			</button>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto">
		<!-- Projects Section -->
		<div class="p-2">
			{#if !collapsed}
				<div class="flex items-center justify-between px-2 py-1 mb-1">
					<span class="text-xs font-medium text-gray-500">Projects</span>
					<div class="flex items-center gap-0.5">
						<Tooltip text="Global Search (⌘K)" side="bottom">
							<button
								onclick={() => (searchDialogOpen = true)}
								class="h-5 w-5 flex items-center justify-center hover:bg-gray-100 rounded"
								aria-label="Global Search"
							>
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
									/>
								</svg>
							</button>
						</Tooltip>
						<button
							onclick={() => (createDialogOpen = true)}
							class="h-5 w-5 flex items-center justify-center hover:bg-gray-100 rounded -mr-1"
							aria-label="Create new project"
						>
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 4v16m8-8H4"
								/>
							</svg>
						</button>
					</div>
				</div>
			{/if}

			<div class="flex flex-col gap-1">
				{#if projects.length === 0}
					{#if !collapsed}
						<div class="text-center py-8 text-muted-foreground text-sm">No projects yet</div>
					{/if}
				{:else}
					{#each projects as project (project.dTag || project.id)}
						{@const projectId = project.tagId()}
						{@const isOnline = projectStatusStore.isProjectOnline(projectId)}
						{@const isOpen = openProjects.isOpen(project)}
						{@const projectColor = getProjectColor(project)}

						<Tooltip text={collapsed ? project.title || 'Untitled' : ''} side="right">
							<button
								onmousedown={(e) =>
									handleProjectMouseDown(project.dTag || project.id || '', e)}
								onmouseup={() => handleProjectMouseUp(project)}
								onmouseleave={handleProjectMouseLeave}
								class={cn(
									'w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2',
									isOpen ? 'bg-blue-50 border border-blue-200 text-blue-900' : 'hover:bg-gray-100 text-gray-700',
									!isOnline && 'opacity-75'
								)}
							>
								<!-- Project Avatar -->
								<div class="relative flex-shrink-0">
									<div
										class={cn(
											'rounded-lg flex items-center justify-center text-white font-semibold',
											collapsed ? 'w-8 h-8 text-sm' : 'w-8 h-8 text-sm'
										)}
										style="background: {projectColor}"
									>
										{project.title?.charAt(0).toUpperCase() || 'P'}
									</div>
									{#if isOnline}
										<div
											class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-white"
										></div>
									{/if}
								</div>

								{#if !collapsed}
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm truncate">{project.title || 'Untitled'}</div>
										<div class="text-xs text-gray-500">
											{project.agents.length} agents
										</div>
									</div>

									{#if isOpen}
										<svg class="w-3.5 h-3.5 flex-shrink-0 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
											<path
												fill-rule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clip-rule="evenodd"
											/>
										</svg>
									{/if}
								{/if}
							</button>
						</Tooltip>
					{/each}
				{/if}
			</div>
		</div>
	</div>

	<!-- Inbox Section -->
	<div class="border-t border-gray-200 px-3 py-2">
		<InboxPopover bind:open={inboxPopoverOpen}>
			<button
				class={cn(
					'flex items-center rounded hover:bg-gray-100 transition-colors',
					collapsed ? 'w-10 h-10 justify-center' : 'w-full gap-2 px-3 py-2'
				)}
				aria-label="Inbox"
			>
				<div class="relative">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
						/>
					</svg>
					{#if inboxStore.unreadCount > 0}
						<div
							class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg animate-pulse"
						>
							{inboxStore.unreadCount > 9 ? '9+' : inboxStore.unreadCount}
						</div>
					{/if}
				</div>
				{#if !collapsed}
					<span class="flex-1 text-left text-sm">Inbox</span>
					{#if inboxStore.unreadCount > 0}
						<span class="px-1.5 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded">
							{inboxStore.unreadCount}
						</span>
					{/if}
					<kbd
						class="px-1.5 py-0.5 text-[9px] font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded"
					>
						⌘I
					</kbd>
				{/if}
			</button>
		</InboxPopover>
	</div>

	<!-- Footer - User Profile -->
	<div class="border-t border-gray-200 p-3">
		<DropdownMenu items={userMenuItems} bind:open={userMenuOpen} align="start" side="top">
			<button
				class={cn(
					'flex items-center rounded hover:bg-gray-100 transition-colors',
					collapsed ? 'w-10 h-10 justify-center' : 'w-full gap-2 px-2 py-2'
				)}
			>
				{#if currentUser?.pubkey}
					<Avatar {ndk} pubkey={currentUser.pubkey} size={32} />
				{:else}
					<div class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white font-semibold text-sm">
						U
					</div>
				{/if}
				{#if !collapsed}
					<div class="flex-1 text-left min-w-0">
						<div class="text-sm font-medium truncate">
							{profile?.name || profile?.displayName || 'User'}
						</div>
						<div class="text-xs text-gray-500 truncate">
							{profile?.nip05 || currentUser?.npub?.slice(0, 12) + '...' || ''}
						</div>
					</div>
				{/if}
			</button>
		</DropdownMenu>
	</div>
</div>

<!-- Dialogs -->
<CreateProjectDialog bind:open={createDialogOpen} />
<GlobalSearchDialog bind:open={searchDialogOpen} />
<ProjectStatusDebug bind:open={debugDialogOpen} />
