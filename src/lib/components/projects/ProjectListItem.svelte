<script lang="ts">
	import type { NDKProject } from '$lib/events/NDKProject';
	import { cn } from '$lib/utils/cn';
	import { generateColorFromString } from '$lib/utils/colors';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import { openProjects } from '$lib/stores/openProjects.svelte';
	import { ndk } from '$lib/ndk.svelte';
	import { operationsStatusStore } from '$lib/stores/operationsStatus.svelte';
	import { goto } from '$app/navigation';
	import { NDKSubscriptionCacheUsage, NDKEvent } from '@nostr-dev-kit/ndk';
	import { NDKKind } from '$lib/kinds';

	interface Props {
		project: NDKProject;
		collapsed: boolean;
	}

	const { project, collapsed }: Props = $props();

	const projectId = $derived(project.tagId());
	const isOnline = $derived(projectStatusStore.isProjectOnline(projectId));
	const isOpen = $derived(openProjects.isOpen(project));
	const projectColor = $derived(generateColorFromString(project.dTag || ''));
	const activeEventCount = $derived(operationsStatusStore.getActiveEventCount(projectId));
	let badgeHovered = $state(false);

	// Activity sparkline: subscribe to kind 1 messages for this project
	let messageTimestamps = $state<number[]>([]);
	let now = $state(Math.floor(Date.now() / 1000));

	// Update time reference every 30 seconds to shift buckets
	$effect(() => {
		const interval = setInterval(() => {
			now = Math.floor(Date.now() / 1000);
		}, 30000);
		return () => clearInterval(interval);
	});

	$effect(() => {
		if (!projectId) return;

		const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
		const sub = ndk.subscribe(
			[{ kinds: [1], '#a': [projectId], since: oneHourAgo, limit: 2000 }],
			{ cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE, closeOnEose: false, subId: 'sparkline', cacheUnconstrainFilter: [] },
			{
				onEvent: (event) => {
					if (event.created_at) {
						messageTimestamps = [...messageTimestamps, event.created_at];
					}
				}
			}
		);

		return () => sub.stop();
	});

	// Build sparkline from message timestamps
	const activityData = $derived.by(() => {
		const buckets = 12;
		const windowSeconds = 3600; // 1 hour
		const windowStart = now - windowSeconds;
		const bucketSize = windowSeconds / buckets;

		const counts = new Array(buckets).fill(0);
		for (const ts of messageTimestamps) {
			if (ts >= windowStart) {
				const bucketIndex = Math.min(buckets - 1, Math.floor((ts - windowStart) / bucketSize));
				counts[bucketIndex]++;
			}
		}
		return counts;
	});

	const hasActivity = $derived(activityData.some((v) => v > 0));

	const sparklinePaths = $derived.by(() => {
		if (!hasActivity || activityData.length === 0) return { line: '', area: '' };
		const max = Math.max(...activityData, 1);
		const points = activityData.map((v, i) => {
			const x = (i / (activityData.length - 1)) * 100;
			const y = 16 - (v / max) * 14;
			return { x, y };
		});
		const line = 'M' + points.map((p) => `${p.x},${p.y}`).join(' L');
		const area = line + ` L100,16 L0,16 Z`;
		return { line, area };
	});

	let longPressTimer: ReturnType<typeof setTimeout> | null = null;

	function handleMouseDown(event: MouseEvent) {
		event.preventDefault();
		longPressTimer = setTimeout(() => {
			// Navigate to project detail page on long press
			const projectPath = `/projects/${project.dTag || project.id}`;
			goto(projectPath);
		}, 500);
	}

	function handleMouseUp() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;

			// Normal click - toggle project
			openProjects.toggle(project);
		}
	}

	function handleMouseLeave() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	async function stopAllOperations(e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();

		const { eventIds, agentPubkeys } = operationsStatusStore.getActiveOperations(projectId);
		if (eventIds.length === 0) return;

		const event = new NDKEvent(ndk);
		event.kind = NDKKind.TenexStopCommand;
		event.content = '';
		event.tags = [['a', projectId]];
		eventIds.forEach((eId) => event.tags.push(['e', eId]));
		agentPubkeys.forEach((pk) => event.tags.push(['p', pk]));

		await event.sign();
		event.publish();
	}
</script>

<button
	onmousedown={handleMouseDown}
	onmouseup={handleMouseUp}
	onmouseleave={handleMouseLeave}
	class={cn(
		'w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-2',
		isOpen ? 'bg-primary/10 border border-primary/20 text-primary' : 'hover:bg-muted text-foreground',
		!isOnline && 'opacity-75'
	)}
	aria-label={collapsed ? (project.title || 'Untitled') : undefined}
	title={collapsed ? (project.title || 'Untitled') : undefined}
>
	<!-- Project Avatar -->
	<div class="relative flex-shrink-0">
		<div
			class="rounded-lg flex items-center justify-center text-white font-semibold w-8 h-8 text-sm"
			style="background: {projectColor}"
		>
			{project.title?.charAt(0).toUpperCase() || 'P'}
		</div>
		{#if isOnline}
			<div
				class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-card"
			></div>
		{/if}
	</div>

	{#if !collapsed}
		<div class="flex-1 min-w-0">
			<div class="font-medium text-sm truncate">{project.title || 'Untitled'}</div>
			{#if hasActivity}
				<svg viewBox="0 0 100 16" preserveAspectRatio="none" class="w-full h-3 mt-1">
					<path d={sparklinePaths.area} class="fill-green-500/20" />
					<path d={sparklinePaths.line} class="stroke-green-500 fill-none" style="stroke-width: 1.5" />
				</svg>
			{/if}
		</div>

		{#if activeEventCount > 0}
			<span
				role="button"
				tabindex="0"
				class="min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center px-1 flex-shrink-0 hover:bg-red-600 transition-colors cursor-pointer"
				onmouseenter={() => (badgeHovered = true)}
				onmouseleave={() => (badgeHovered = false)}
				onmousedown={stopAllOperations}
				onkeydown={(e) => e.key === 'Enter' && stopAllOperations(e as unknown as MouseEvent)}
				title="Stop all active operations"
			>
				{#if badgeHovered}
					✕
				{:else}
					{activeEventCount}
				{/if}
			</span>
		{/if}
	{/if}
</button>
