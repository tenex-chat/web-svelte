<script lang="ts">
	import { ListTodo, RefreshCw, Check, Loader2, Circle } from 'lucide-svelte';

	interface TodoUpdateItem {
		id: string;
		status?: string;
		title?: string;
		description?: string;
	}

	interface Props {
		items: TodoUpdateItem[];
		content?: string;
	}

	let { items, content }: Props = $props();

	function getStatusIcon(status: string | undefined) {
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

	function getStatusClass(status: string | undefined): string {
		switch (status) {
			case 'done':
			case 'completed':
				return 'text-green-500';
			case 'in_progress':
				return 'text-blue-500 animate-spin';
			default:
				return 'text-muted-foreground';
		}
	}

	function formatStatus(status: string | undefined): string {
		switch (status) {
			case 'done':
			case 'completed':
				return 'completed';
			case 'in_progress':
				return 'in progress';
			default:
				return status || 'pending';
		}
	}
</script>

<div class="text-sm">
	<div class="flex items-center gap-2 text-muted-foreground mb-2">
		<ListTodo class="w-4 h-4 flex-shrink-0" />
		<RefreshCw class="w-3 h-3 flex-shrink-0" />
		<span>{content || `Updating ${items.length} todo${items.length !== 1 ? 's' : ''}`}</span>
	</div>

	{#if items.length > 0}
		<ul class="ml-6 space-y-1">
			{#each items as item}
				{@const StatusIcon = getStatusIcon(item.status)}
				<li class="flex items-center gap-2">
					<StatusIcon class="w-3.5 h-3.5 flex-shrink-0 {getStatusClass(item.status)}" />
					<span class="font-mono text-xs text-muted-foreground">{item.id}</span>
					{#if item.status}
						<span class="text-xs">→ {formatStatus(item.status)}</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
