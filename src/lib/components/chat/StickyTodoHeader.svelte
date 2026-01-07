<script lang="ts">
	import { ListTodo, Check, Loader2, Circle, ChevronDown, ChevronRight } from 'lucide-svelte';
	import type { TodoItem } from '$lib/utils/todoAggregator';

	interface Props {
		items: TodoItem[];
	}

	let { items }: Props = $props();

	// Collapsed by default
	let isExpanded = $state(false);

	function getStatusIcon(status: string) {
		switch (status) {
			case 'done':
			case 'completed':
				return Check;
			case 'in_progress':
				return Loader2;
			default:
				return Circle;
		}
	}

	function getStatusClass(status: string): string {
		switch (status) {
			case 'done':
			case 'completed':
				return 'text-green-500';
			case 'in_progress':
				return 'text-orange-500 animate-spin';
			default:
				return 'text-muted-foreground';
		}
	}

	// Count by status
	const completedCount = $derived(items.filter(i => i.status === 'done' || i.status === 'completed').length);

	// Get the current active item (first in_progress, or first pending if no in_progress)
	const activeItem = $derived.by(() => {
		const inProgress = items.find(i => i.status === 'in_progress');
		if (inProgress) return inProgress;
		const pending = items.find(i => i.status === 'pending' || !i.status);
		return pending || null;
	});

	// Use activeForm for display text when collapsed (shows the -ing form)
	const activeDisplayText = $derived(activeItem?.description || activeItem?.title || '');

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}
</script>

<div class="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/50 shadow-sm">
	<button
		type="button"
		class="w-full px-4 py-2 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
		onclick={toggleExpanded}
	>
		<!-- Expand/Collapse chevron -->
		<div class="text-muted-foreground">
			{#if isExpanded}
				<ChevronDown class="w-4 h-4" />
			{:else}
				<ChevronRight class="w-4 h-4" />
			{/if}
		</div>

		<!-- Todo icon -->
		<ListTodo class="w-4 h-4 text-primary flex-shrink-0" />

		<!-- Collapsed view: show active item -->
		{#if !isExpanded && activeItem}
			{@const StatusIcon = getStatusIcon(activeItem.status)}
			<div class="flex items-center gap-2 flex-1 min-w-0">
				<StatusIcon class="w-3.5 h-3.5 flex-shrink-0 {getStatusClass(activeItem.status)}" />
				<span class="text-sm truncate text-foreground">
					{activeDisplayText}
				</span>
			</div>
		{:else if !isExpanded}
			<span class="text-sm text-muted-foreground">Todo List</span>
		{/if}

		<!-- Progress counter -->
		<span class="text-xs text-muted-foreground ml-auto flex-shrink-0">
			{completedCount}/{items.length}
		</span>

		<!-- Progress bar -->
		<div class="w-16 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
			<div
				class="h-full bg-green-500 transition-all duration-300"
				style="width: {items.length > 0 ? (completedCount / items.length) * 100 : 0}%"
			></div>
		</div>
	</button>

	<!-- Expanded view: show all items -->
	{#if isExpanded}
		<div class="px-4 pb-3 pt-1 border-t border-border/30">
			<ul class="space-y-1.5">
				{#each items as item (item.id)}
					{@const StatusIcon = getStatusIcon(item.status)}
					<li class="flex items-start gap-2 text-sm">
						<StatusIcon class="w-4 h-4 flex-shrink-0 mt-0.5 {getStatusClass(item.status)}" />
						<div class="flex-1 min-w-0">
							<span class="{item.status === 'done' || item.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}">
								{item.title}
							</span>
							{#if item.description && item.status === 'in_progress'}
								<p class="text-xs text-orange-500/80 mt-0.5">{item.description}</p>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
