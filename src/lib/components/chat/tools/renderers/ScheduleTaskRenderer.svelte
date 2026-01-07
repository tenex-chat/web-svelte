<script lang="ts">
	import { Clock, Bot, FileText, ChevronDown, ChevronUp } from 'lucide-svelte';

	interface ScheduleTaskArgs {
		title?: string;
		prompt?: string;
		schedule?: string;
		targetAgent?: string;
	}

	interface Props {
		args: ScheduleTaskArgs | null;
	}

	let { args }: Props = $props();

	let isPromptExpanded = $state(false);

	const title = $derived(args?.title || 'Scheduled Task');
	const prompt = $derived(args?.prompt || '');
	const schedule = $derived(args?.schedule || '');
	const targetAgent = $derived(args?.targetAgent || '');

	// Convert cron expression to human-readable format
	const humanReadableSchedule = $derived.by(() => {
		if (!schedule) return '';

		const parts = schedule.trim().split(/\s+/);

		// Standard cron format: minute hour day month day-of-week
		if (parts.length !== 5) return schedule;

		const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

		// Handle common patterns
		if (schedule === '0 0 * * *') return 'Daily at midnight';
		if (schedule === '0 12 * * *') return 'Daily at noon';
		if (schedule === '0 9 * * 1-5') return 'Weekdays at 9 AM';
		if (schedule === '0 0 1 * *') return 'Monthly at midnight';
		if (schedule === '0 0 * * 0') return 'Weekly on Sunday at midnight';

		// Handle */N patterns for hours
		if (hour.startsWith('*/')) {
			const interval = parseInt(hour.substring(2));
			if (!isNaN(interval)) {
				return `Every ${interval} hour${interval > 1 ? 's' : ''}`;
			}
		}

		// Handle */N patterns for minutes
		if (minute.startsWith('*/')) {
			const interval = parseInt(minute.substring(2));
			if (!isNaN(interval)) {
				return `Every ${interval} minute${interval > 1 ? 's' : ''}`;
			}
		}

		// Handle */N patterns for days
		if (dayOfMonth.startsWith('*/')) {
			const interval = parseInt(dayOfMonth.substring(2));
			if (!isNaN(interval)) {
				return `Every ${interval} day${interval > 1 ? 's' : ''}`;
			}
		}

		// Fallback to showing the cron expression
		return schedule;
	});

	const togglePrompt = () => {
		isPromptExpanded = !isPromptExpanded;
	};
</script>

<div class="flex flex-col gap-3 text-sm">
	<!-- Header with icon -->
	<div class="flex items-center gap-2 text-primary">
		<Clock class="w-4 h-4 flex-shrink-0" />
		<span class="font-medium">Scheduled task: {title}</span>
	</div>

	<!-- Details section -->
	<div class="pl-6 space-y-2">
		<!-- Schedule -->
		{#if schedule}
			<div class="flex items-start gap-2">
				<div class="flex-1 space-y-0.5">
					<div class="text-xs text-muted-foreground font-medium uppercase tracking-wide">Schedule</div>
					<div class="text-sm text-foreground">
						{humanReadableSchedule}
						<span class="text-xs text-muted-foreground">({schedule})</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- Target Agent -->
		{#if targetAgent}
			<div class="flex items-start gap-2">
				<Bot class="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
				<div class="space-y-0.5">
					<div class="text-xs text-muted-foreground font-medium uppercase tracking-wide">Target Agent</div>
					<div class="text-sm text-foreground font-medium">{targetAgent}</div>
				</div>
			</div>
		{/if}

		<!-- Prompt (collapsible) -->
		{#if prompt}
			<div class="space-y-2 pt-1">
				<button
					onclick={togglePrompt}
					class="flex items-center gap-2 text-xs text-primary font-medium uppercase tracking-wide hover:opacity-80 transition-opacity"
				>
					{#if isPromptExpanded}
						<ChevronUp class="w-3 h-3" />
						<span>Hide Prompt</span>
					{:else}
						<ChevronDown class="w-3 h-3" />
						<span>Show Prompt</span>
					{/if}
				</button>

				{#if isPromptExpanded}
					<div class="bg-muted/50 border border-border rounded-md p-3 animate-in fade-in">
						<div class="flex items-start gap-2">
							<FileText class="w-4 h-4 flex-shrink-0 text-primary mt-0.5" />
							<p class="text-sm text-foreground whitespace-pre-wrap break-words">{prompt}</p>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
