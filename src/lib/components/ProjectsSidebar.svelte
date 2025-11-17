<script lang="ts">
	import type { NDKProject } from '$lib/events/NDKProject';
	import { ndk } from '$lib/ndk.svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { User } from '$lib/ndk/ui/user';
	import { openProjects } from '$lib/stores/openProjects.svelte';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import { sidebarCollapsedStore } from '$lib/stores/sidebarCollapsed.svelte';
	import { inboxStore } from '$lib/stores/inbox.svelte';
	import { uiSettingsStore } from '$lib/stores/uiSettings.svelte';
	import { cn } from '$lib/utils/cn';
	import { registerShortcut } from '$lib/utils/keyboardShortcuts';
	import * as DropdownMenu from './ui/dropdown-menu';
	import CreateProjectDialog from './dialogs/CreateProjectDialog.svelte';
	import CreateProjectGroupDialog from './dialogs/CreateProjectGroupDialog.svelte';
	import GlobalSearchDialog from './dialogs/GlobalSearchDialog.svelte';
	import InboxPopover from './inbox/InboxPopover.svelte';
	import ProjectStatusDebug from './debug/ProjectStatusDebug.svelte';
	import ProjectListItem from './projects/ProjectListItem.svelte';
	import {
		Plus,
		Bot,
		Wrench,
		Settings,
		Moon,
		Sun,
		Monitor,
		Bug,
		LogOut,
		Layers,
		ChevronDown,
		Pencil,
		Trash2,
		Pin
	} from 'lucide-svelte';
	import {
		projectGroupsStore,
		saveProjectGroup,
		updateProjectGroup,
		deleteProjectGroup,
		selectedProjectGroupStore,
		type ProjectGroup
	} from '$lib/utils/projectGroups';
	import { generateColorFromString, generateLinearGradientFromHsl } from '$lib/utils/colors';

	interface Props {
		projects: NDKProject[];
	}

	let { projects }: Props = $props();

	// State
	let createDialogOpen = $state(false);
	let createGroupDialogOpen = $state(false);
	let searchDialogOpen = $state(false);
	let inboxPopoverOpen = $state(false);
	let debugDialogOpen = $state(false);
	let userMenuOpen = $state(false);
	let projectGroupMenuOpen = $state(false);
	let longPressTimer: NodeJS.Timeout | null = null;
	let longPressProjectId: string | null = null;
	let editingGroup = $state<ProjectGroup | null>(null);
	let showPinnedPopover = $state(false);
	let popoverButtonRef: HTMLButtonElement | null = null;

	// Derived state
	const collapsed = $derived(sidebarCollapsedStore.collapsed);
	const projectGroups = $derived($projectGroupsStore);

	// Common button classes
	const iconButtonClass = 'h-5 w-5 flex items-center justify-center hover:bg-muted rounded text-foreground';

	// Get the currently selected group (single find)
	const currentGroup = $derived(
		$selectedProjectGroupStore
			? projectGroups.find((g) => g.id === $selectedProjectGroupStore) || null
			: null
	);

	// Derive name, color, and gradient from currentGroup
	const currentGroupName = $derived(currentGroup?.name || 'Projects');
	const currentGroupColor = $derived(
		currentGroup ? generateColorFromString(currentGroup.name) : null
	);

	// Background style for gradient (single style string)
	const backgroundStyle = $derived(
		currentGroupColor
			? `background: ${generateLinearGradientFromHsl(currentGroupColor)}; opacity: 1;`
			: 'opacity: 0;'
	);

	// Get pinned groups
	const pinnedGroups = $derived(projectGroups.filter((g) => g.pinned));

	// Calculate popover position
	const popoverPosition = $derived(() => {
		if (!popoverButtonRef) return { top: 0, left: 0 };
		const rect = popoverButtonRef.getBoundingClientRect();
		return {
			top: rect.top,
			left: rect.right + 8
		};
	});

	// Filtered projects based on selected group
	const filteredProjects = $derived(() => {
		if (!currentGroup) {
			return projects; // Show all projects
		}

		return projects.filter((project) => {
			const projectId = project.dTag || project.id || '';
			return currentGroup.projectIds.includes(projectId);
		});
	});

	// Initialize inbox
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

	// Project Group handlers
	function handleSelectGroup(groupId: string | null) {
		selectedProjectGroupStore.set(groupId);
		projectGroupMenuOpen = false;
	}

	function handleCreateGroup(groupName: string, projectIds: string[]) {
		const newGroup = saveProjectGroup(groupName, projectIds);
		// Optionally select the newly created group
		handleSelectGroup(newGroup.id);
	}

	function handleOpenCreateGroupDialog() {
		projectGroupMenuOpen = false;
		editingGroup = null;
		createGroupDialogOpen = true;
	}

	function handleEditGroup(group: ProjectGroup, event: Event) {
		event.stopPropagation();
		projectGroupMenuOpen = false;
		editingGroup = group;
		createGroupDialogOpen = true;
	}

	function handleUpdateGroup(groupName: string, projectIds: string[]) {
		if (!editingGroup) return;

		updateProjectGroup(editingGroup.id, {
			name: groupName,
			projectIds
		});

		editingGroup = null;
	}

	function handleDeleteGroup() {
		if (!editingGroup) return;

		deleteProjectGroup(editingGroup.id);

		// If the deleted group was selected, reset to showing all projects
		if ($selectedProjectGroupStore === editingGroup.id) {
			selectedProjectGroupStore.set(null);
		}

		// Close the dialog
		editingGroup = null;
		createGroupDialogOpen = false;
	}

	function handleTogglePin(groupId: string, event: Event) {
		event.stopPropagation();
		projectGroupsStore.togglePin(groupId);
	}

	// User menu handlers
	function handleLogout() {
		if (ndk.$currentUser) {
			ndk.$sessions.logout(ndk.$currentUser.pubkey);
		}
		window.location.href = '/';
	}

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
</script>

<div
	class={cn(
		'bg-card border-r border-border flex flex-col transition-all duration-300 relative overflow-hidden',
		collapsed ? 'w-16' : 'w-64',
		browser && window.electron ? 'pt-10' : ''
	)}
	data-collapsed={collapsed}
>
	<!-- Gradient background when group is selected -->
	<div
		class="absolute top-0 left-0 right-0 bottom-0 pointer-events-none z-0 transition-opacity duration-300"
		style={backgroundStyle}
	></div>
	<!-- Electron Title Bar Drag Region (only in sidebar) -->
	{#if browser && window.electron}
		<div class="electron-titlebar-sidebar"></div>
	{/if}

	<!-- Header -->
	<div class="border-b border-border px-3 py-3 relative z-10">
		<div class="flex items-center justify-between">
			{#if !collapsed}
				<a href="/projects" class="flex items-center gap-2 flex-1 hover:opacity-80 transition-opacity text-foreground">
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
				<a href="/projects" class="flex items-center justify-center w-10 h-10 hover:opacity-80 transition-opacity text-foreground" aria-label="TENEX home" title="TENEX">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
						/>
					</svg>
				</a>
			{/if}

			<button
				onclick={() => sidebarCollapsedStore.toggle()}
				class="w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors text-foreground"
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
	<div class="flex-1 overflow-y-auto relative z-10">
		<!-- Projects Section -->
		<div class="p-2">
			<!-- Pinned Groups -->
			{#if pinnedGroups.length > 0}
				{#if collapsed}
					<!-- Collapsed: Show only current group with popover on hover -->
					<div class="px-2 py-1 mb-2 flex justify-center">
						<button
							bind:this={popoverButtonRef}
							onmouseenter={() => showPinnedPopover = true}
							onmouseleave={() => showPinnedPopover = false}
							onclick={() => handleSelectGroup(currentGroup?.id || null)}
							class={cn(
								'w-8 h-8 rounded transition-all flex items-center justify-center',
								currentGroup ? 'ring-2 ring-offset-1 ring-offset-card' : 'opacity-60 hover:opacity-100'
							)}
							style={currentGroup ? `background-color: ${currentGroupColor}; ring-color: ${currentGroupColor}` : 'background-color: hsl(220, 10%, 50%)'}
							title={currentGroupName}
							aria-label={currentGroupName}
						></button>
					</div>
				{:else}
					<!-- Expanded: Show all pinned groups horizontally -->
					<div class="flex gap-1 px-2 py-1 mb-2 items-center">
						{#each pinnedGroups as group (group.id)}
							<button
								onclick={() => handleSelectGroup(group.id)}
								class={cn(
									'w-6 h-6 rounded transition-all flex items-center justify-center',
									$selectedProjectGroupStore === group.id ? 'ring-2 ring-offset-1 ring-offset-card' : 'opacity-60 hover:opacity-100'
								)}
								style="background-color: {generateColorFromString(group.name)}; ring-color: {generateColorFromString(group.name)}"
								title={group.name}
								aria-label={`Select ${group.name}`}
							></button>
						{/each}
					</div>
				{/if}
			{/if}

			{#if !collapsed}
				<div class="flex items-center justify-between px-2 py-1 mb-1">
					<!-- Project Group Dropdown -->
					<DropdownMenu.Root bind:open={projectGroupMenuOpen}>
						<DropdownMenu.Trigger
							class="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
						>
							{currentGroupName}
							<ChevronDown class="w-3 h-3" />
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="start" class="w-64">
							<DropdownMenu.Item onclick={() => handleSelectGroup(null)}>
								<span class={cn(!$selectedProjectGroupStore && 'font-semibold')}>Projects</span>
							</DropdownMenu.Item>
							{#if projectGroups.length > 0}
								<DropdownMenu.Separator />
								{#each projectGroups as group (group.id)}
									<div class="flex items-center">
										<DropdownMenu.Item
											onclick={() => handleSelectGroup(group.id)}
											class="flex-1"
										>
											<div
												class="w-3 h-3 rounded mr-2 flex-shrink-0"
												style="background-color: {generateColorFromString(group.name)}"
											></div>
											<span class={cn($selectedProjectGroupStore === group.id && 'font-semibold')}>
												{group.name}
											</span>
										</DropdownMenu.Item>
										<button
											onclick={(e) => handleTogglePin(group.id, e)}
											class={cn(
												'px-2 py-1.5 hover:bg-muted rounded transition-colors',
												group.pinned && 'text-primary'
											)}
											aria-label={group.pinned ? 'Unpin group' : 'Pin group'}
											title={group.pinned ? 'Unpin group' : 'Pin group'}
										>
											<Pin class={cn('h-3.5 w-3.5', group.pinned ? '' : 'text-muted-foreground hover:text-foreground')} />
										</button>
										<button
											onclick={(e) => handleEditGroup(group, e)}
											class="px-2 py-1.5 hover:bg-muted rounded transition-colors"
											aria-label="Edit group"
											title="Edit group"
										>
											<Pencil class="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
										</button>
									</div>
								{/each}
							{/if}
							<DropdownMenu.Separator />
							<DropdownMenu.Item onclick={handleOpenCreateGroupDialog}>
								<Plus class="mr-2 h-3 w-3" />
								<span>Create Project Group</span>
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>

					<div class="flex items-center gap-0.5">
						<button
							onclick={() => (searchDialogOpen = true)}
							class={iconButtonClass}
							aria-label="Global Search (⌘K)"
							title="Global Search (⌘K)"
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
						<button
							onclick={() => (createDialogOpen = true)}
							class={cn(iconButtonClass, '-mr-1')}
							aria-label="Create new project"
							title="Create new project"
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
				{#if filteredProjects().length === 0}
					{#if !collapsed}
						<div class="text-center py-8 text-muted-foreground text-sm">
							{$selectedProjectGroupStore ? 'No projects in this group' : 'No projects yet'}
						</div>
					{/if}
				{:else}
					{#each filteredProjects() as project (project.dTag || project.id)}
						<ProjectListItem
							{project}
							collapsed={collapsed}
							onmousedown={(e) =>
								handleProjectMouseDown(project.dTag || project.id || '', e)}
							onmouseup={() => handleProjectMouseUp(project)}
							onmouseleave={handleProjectMouseLeave}
						/>
					{/each}
				{/if}
			</div>
		</div>
	</div>

	<!-- Inbox Section -->
	<div class="border-t border-border px-3 py-2 relative z-10">
		<InboxPopover bind:open={inboxPopoverOpen}>
			<button
				class={cn(
					'flex items-center rounded hover:bg-muted transition-colors text-foreground',
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
							class="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg animate-pulse"
						>
							{inboxStore.unreadCount > 9 ? '9+' : inboxStore.unreadCount}
						</div>
					{/if}
				</div>
				{#if !collapsed}
					<span class="flex-1 text-left text-sm">Inbox</span>
					{#if inboxStore.unreadCount > 0}
						<span class="px-1.5 py-0.5 text-xs font-medium bg-muted text-foreground rounded">
							{inboxStore.unreadCount}
						</span>
					{/if}
					<kbd
						class="px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground bg-muted border border-border rounded"
					>
						⌘I
					</kbd>
				{/if}
			</button>
		</InboxPopover>
	</div>

	<!-- Footer - User Profile -->
	<div class="border-t border-border p-3 relative z-10">
		<DropdownMenu.Root bind:open={userMenuOpen}>
			<DropdownMenu.Trigger
				class={cn(
					'flex items-center rounded hover:bg-muted transition-colors',
					collapsed ? 'w-10 h-10 justify-center' : 'w-full gap-2 px-2 py-2'
				)}
			>
				{#if ndk.$currentUser?.pubkey}
					<User.Root {ndk} pubkey={ndk.$currentUser.pubkey}>
						<User.Avatar class="w-8 h-8" />
						{#if !collapsed}
							<div class="flex-1 text-left min-w-0">
								<div class="text-sm font-medium truncate text-foreground">
									<User.Name />
								</div>
							</div>
						{/if}
					</User.Root>
				{/if}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="start" side="top" class="w-56">
				<DropdownMenu.Item onclick={() => (createDialogOpen = true)}>
					<Plus class="mr-2 h-4 w-4" />
					<span>New project</span>
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onclick={() => goto('/agents')}>
					<Bot class="mr-2 h-4 w-4" />
					<span>Agents</span>
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => goto('/tools')}>
					<Wrench class="mr-2 h-4 w-4" />
					<span>MCP Tools</span>
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => goto('/nudges')}>
					<Layers class="mr-2 h-4 w-4" />
					<span>Agent Nudges</span>
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => goto('/settings')}>
					<Settings class="mr-2 h-4 w-4" />
					<span>Settings</span>
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Sub>
					<DropdownMenu.SubTrigger>
						<Moon class="mr-2 h-4 w-4" />
						<span>Theme</span>
					</DropdownMenu.SubTrigger>
					<DropdownMenu.SubContent>
						<DropdownMenu.Item onclick={() => uiSettingsStore.setTheme('light')}>
							<Sun class="mr-2 h-4 w-4" />
							<span>Light</span>
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => uiSettingsStore.setTheme('dark')}>
							<Moon class="mr-2 h-4 w-4" />
							<span>Dark</span>
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => uiSettingsStore.setTheme('system')}>
							<Monitor class="mr-2 h-4 w-4" />
							<span>System</span>
						</DropdownMenu.Item>
					</DropdownMenu.SubContent>
				</DropdownMenu.Sub>
				<DropdownMenu.Separator />
				<DropdownMenu.Sub>
					<DropdownMenu.SubTrigger>
						<Bug class="mr-2 h-4 w-4" />
						<span>Debug</span>
					</DropdownMenu.SubTrigger>
					<DropdownMenu.SubContent>
						<DropdownMenu.Item onclick={() => (debugDialogOpen = true)}>
							<span>Project Status Debug Tool</span>
						</DropdownMenu.Item>
					</DropdownMenu.SubContent>
				</DropdownMenu.Sub>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onclick={handleLogout}>
					<LogOut class="mr-2 h-4 w-4" />
					<span>Logout</span>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</div>

<!-- Popover for pinned groups (rendered outside sidebar to avoid clipping) -->
{#if showPinnedPopover && pinnedGroups.length > 1 && collapsed}
	<div
		class="fixed bg-popover border border-border rounded-lg shadow-lg p-2 z-[100] min-w-[160px]"
		style="top: {popoverPosition().top}px; left: {popoverPosition().left}px;"
		onmouseenter={() => showPinnedPopover = true}
		onmouseleave={() => showPinnedPopover = false}
	>
		<div class="text-xs font-medium text-muted-foreground mb-2 px-2">Pinned Groups</div>
		<div class="flex flex-col gap-1">
			{#each pinnedGroups as group (group.id)}
				<button
					onclick={() => {
						handleSelectGroup(group.id);
						showPinnedPopover = false;
					}}
					class={cn(
						'flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted transition-colors text-left',
						$selectedProjectGroupStore === group.id && 'bg-muted'
					)}
				>
					<div
						class="w-4 h-4 rounded flex-shrink-0"
						style="background-color: {generateColorFromString(group.name)}"
					></div>
					<span class="text-sm text-foreground truncate">{group.name}</span>
				</button>
			{/each}
		</div>
	</div>
{/if}

<!-- Dialogs -->
<CreateProjectDialog bind:open={createDialogOpen} />
<CreateProjectGroupDialog
	bind:open={createGroupDialogOpen}
	{projects}
	editingGroup={editingGroup}
	onSave={editingGroup ? handleUpdateGroup : handleCreateGroup}
	onDelete={handleDeleteGroup}
/>
<GlobalSearchDialog bind:open={searchDialogOpen} />
<ProjectStatusDebug bind:open={debugDialogOpen} />
