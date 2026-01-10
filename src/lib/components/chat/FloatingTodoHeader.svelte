<script lang="ts">
	import { ListTodo, Check, Loader2, Circle, ChevronDown, ChevronRight, GripVertical } from 'lucide-svelte';
	import type { TodoItem } from '$lib/utils/todoAggregator';

	interface Props {
		items: TodoItem[];
	}

	let { items }: Props = $props();

	// Expanded by default (not collapsed)
	let isExpanded = $state(true);

	// Dragging state
	let isDragging = $state(false);
	let position = $state({ x: 16, y: 16 }); // Initial position (top-right offset from container)
	let dragStart = $state({ x: 0, y: 0 });
	let elementStart = $state({ x: 0, y: 0 });

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

	function handleMouseDown(e: MouseEvent) {
		// Only start drag from the grip handle
		if (!(e.target as HTMLElement).closest('.drag-handle')) return;

		isDragging = true;
		dragStart = { x: e.clientX, y: e.clientY };
		elementStart = { x: position.x, y: position.y };

		e.preventDefault();
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;

		const deltaX = e.clientX - dragStart.x;
		const deltaY = e.clientY - dragStart.y;

		// Note: x is used for 'right' position, so we subtract deltaX
		// (dragging right = positive deltaX = decrease right value = move right)
		position = {
			x: elementStart.x - deltaX,
			y: elementStart.y + deltaY
		};
	}

	function handleMouseUp() {
		isDragging = false;
	}

	// Add global mouse event listeners when dragging
	$effect(() => {
		if (isDragging) {
			window.addEventListener('mousemove', handleMouseMove);
			window.addEventListener('mouseup', handleMouseUp);

			return () => {
				window.removeEventListener('mousemove', handleMouseMove);
				window.removeEventListener('mouseup', handleMouseUp);
			};
		}
	});
</script>

<div
	class="fixed z-50 bg-background/70 backdrop-blur-md border border-border/50 rounded-lg shadow-lg transition-shadow {isDragging ? 'shadow-xl cursor-grabbing' : ''}"
	style="right: {position.x}px; top: {position.y}px; max-width: 320px; min-width: 220px;"
	role="region"
	aria-label="Todo list"
	onmousedown={handleMouseDown}
>
	<!-- Header with drag handle -->
	<div class="flex items-center gap-2 px-3 py-2.5 border-b border-border/30">
		<!-- Drag handle -->
		<div
			class="drag-handle cursor-grab text-muted-foreground/60 hover:text-muted-foreground transition-colors {isDragging ? 'cursor-grabbing' : ''}"
			title="Drag to move"
		>
			<GripVertical class="w-4 h-4" />
		</div>

		<!-- Expand/Collapse button -->
		<button
			type="button"
			class="flex items-center gap-2 flex-1 min-w-0 hover:bg-muted/30 rounded px-1.5 py-1 -mx-1 transition-colors cursor-pointer"
			onclick={toggleExpanded}
		>
			<!-- Chevron -->
			<div class="text-muted-foreground">
				{#if isExpanded}
					<ChevronDown class="w-3.5 h-3.5" />
				{:else}
					<ChevronRight class="w-3.5 h-3.5" />
				{/if}
			</div>

			<!-- Todo icon -->
			<ListTodo class="w-4 h-4 text-primary flex-shrink-0" />

			<!-- Collapsed view: show active item -->
			{#if !isExpanded && activeItem}
				{@const StatusIcon = getStatusIcon(activeItem.status)}
				<div class="flex items-center gap-1.5 flex-1 min-w-0">
					<StatusIcon class="w-3 h-3 flex-shrink-0 {getStatusClass(activeItem.status)}" />
					<span class="text-xs truncate text-foreground">
						{activeDisplayText}
					</span>
				</div>
			{:else if !isExpanded}
				<span class="text-xs text-muted-foreground">Todos</span>
			{:else}
				<span class="text-xs font-medium text-foreground">Todos</span>
			{/if}
		</button>

		<!-- Progress counter -->
		<span class="text-xs text-muted-foreground flex-shrink-0">
			{completedCount}/{items.length}
		</span>

		<!-- Progress bar -->
		<div class="w-12 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
			<div
				class="h-full bg-green-500 transition-all duration-300"
				style="width: {items.length > 0 ? (completedCount / items.length) * 100 : 0}%"
			></div>
		</div>
	</div>

	<!-- Expanded view: show all items -->
	{#if isExpanded}
		<div class="px-3 py-2.5 max-h-64 overflow-y-auto">
			<ul class="space-y-1.5">
				{#each items as item (item.id)}
					{@const StatusIcon = getStatusIcon(item.status)}
					<li class="flex items-start gap-2 text-xs">
						<StatusIcon class="w-3.5 h-3.5 flex-shrink-0 mt-0.5 {getStatusClass(item.status)}" />
						<div class="flex-1 min-w-0">
							<span class="{item.status === 'done' || item.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}">
								{item.title}
							</span>
							{#if item.description && item.status === 'in_progress'}
								<p class="text-[10px] text-orange-500/80 mt-0.5 leading-tight">{item.description}</p>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
