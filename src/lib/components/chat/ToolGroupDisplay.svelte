<script lang="ts">
	import type { Message } from '$lib/utils/messageUtils';
	import {
		ChevronDown,
		ChevronRight,
		Settings,
		FileText,
		Pencil,
		Terminal,
		Users,
		Search,
		Brain
	} from 'lucide-svelte';
	import { slide } from 'svelte/transition';
	import {
		getToolGroupDisplayText,
		getIndividualToolDisplayText,
		getToolGroupIcon,
		getToolActionInfo,
		getToolCategoryIcon
	} from '$lib/utils/toolDisplayUtils';
	import { parseToolArgs } from '$lib/utils/toolPaths';
	import AIReasoningBlock from './AIReasoningBlock.svelte';
	import { ndk } from '$lib/ndk.svelte';
	import { User } from '$lib/ndk/ui/user';

	interface Props {
		tools: Message[];
		thinking?: Message[];
		isActive: boolean;
		isConsecutive: boolean;
		hasNextConsecutive: boolean;
	}

	let { tools, thinking = [], isActive, isConsecutive, hasNextConsecutive }: Props = $props();

	let isExpanded = $state(false);
	let expandedToolIds = $state<Set<string>>(new Set());

	const hasThinking = $derived(thinking.length > 0);
	const toolCount = $derived(tools.length);

	function toggleToolArgs(toolId: string) {
		const newSet = new Set(expandedToolIds);
		if (newSet.has(toolId)) {
			newSet.delete(toolId);
		} else {
			newSet.add(toolId);
		}
		expandedToolIds = newSet;
	}

	// Get display text using the utility
	const displayText = $derived(
		getToolGroupDisplayText({
			tools,
			isActive
		})
	);

	// Get the dominant icon for the group
	const groupIcon = $derived(getToolGroupIcon(tools));

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	// Get the icon component based on category
	function getIconComponent(iconName: string) {
		switch (iconName) {
			case 'file-text':
				return FileText;
			case 'pencil':
				return Pencil;
			case 'terminal':
				return Terminal;
			case 'users':
				return Users;
			case 'search':
				return Search;
			default:
				return Settings;
		}
	}

	const IconComponent = $derived(getIconComponent(groupIcon));

	// Get the pubkey of the agent (from the first tool or thinking message)
	const agentPubkey = $derived(tools[0]?.event.pubkey || thinking[0]?.event.pubkey);
</script>

<div class="px-4 py-1">
	<div class="flex gap-3">
		<!-- Avatar column spacer with continuous border line -->
		{#if isConsecutive}
			<div class="w-9 flex-shrink-0 relative">
				<div class="absolute left-1/2 -translate-x-1/2 inset-y-0 border-l border-border/60"></div>
				<div
					class="absolute left-1/2 -translate-x-1/2 top-2.5 w-1.5 h-1.5 bg-muted-foreground/80 rounded-full z-10"
				></div>
			</div>
		{:else}
			<div class="w-9 flex-shrink-0 relative">
				{#if agentPubkey}
					<User.Root {ndk} pubkey={agentPubkey}>
						<User.Avatar class="w-9 h-9 rounded-full" />
					</User.Root>
				{/if}
				{#if hasNextConsecutive}
					<div class="absolute left-1/2 -translate-x-1/2 top-9 bottom-0 border-l border-border/60"
					></div>
				{/if}
			</div>
		{/if}

		<!-- Tool group content -->
		<div class="flex-1 min-w-0">
			{#if !isConsecutive && agentPubkey}
				<div class="flex items-center gap-2 mb-1">
					<User.Root {ndk} pubkey={agentPubkey}>
						<User.Name class="text-sm font-medium text-foreground" />
					</User.Root>
				</div>
			{/if}
			{#if toolCount === 1 && !hasThinking}
				<!-- Single tool without thinking: render inline using display text -->
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<IconComponent class="w-4 h-4 flex-shrink-0" />
					<span>{displayText}</span>
				</div>
			{:else if toolCount === 0 && hasThinking}
				<!-- Only thinking, no tools: just show brain icon -->
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<Brain class="w-4 h-4 flex-shrink-0" />
				</div>
			{:else}
				<!-- Multiple tools or has thinking: collapsible group -->
				<button
					type="button"
					onclick={toggleExpanded}
					class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
				>
					{#if isExpanded}
						<ChevronDown class="w-4 h-4 flex-shrink-0" />
					{:else}
						<ChevronRight class="w-4 h-4 flex-shrink-0" />
					{/if}
					{#if hasThinking}
						<Brain class="w-4 h-4 flex-shrink-0" />
					{/if}
					<IconComponent class="w-4 h-4 flex-shrink-0" />
					<span>{displayText}</span>
				</button>

				<!-- Expanded content -->
				{#if isExpanded}
					<div transition:slide={{ duration: 200 }} class="mt-2 ml-6 space-y-2">
						<!-- Render thinking blocks first -->
						{#each thinking as thinkingMsg (thinkingMsg.id)}
							<div class="py-1">
								<AIReasoningBlock
									reasoningEvent={thinkingMsg.event}
									isStreaming={false}
									isLastMessage={false}
								/>
							</div>
						{/each}

						<!-- Render individual tools -->
						{#each tools as tool (tool.id)}
							{@const action = getToolActionInfo(tool.event)}
							{@const toolIcon = getToolCategoryIcon(action.category)}
							{@const ToolIcon = getIconComponent(toolIcon)}
							{@const args = parseToolArgs(tool.event)}
							{@const isToolExpanded = expandedToolIds.has(tool.id)}
							<div class="py-1">
								<button
									type="button"
									onclick={() => toggleToolArgs(tool.id)}
									class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
								>
									{#if args}
										{#if isToolExpanded}
											<ChevronDown class="w-3 h-3 flex-shrink-0" />
										{:else}
											<ChevronRight class="w-3 h-3 flex-shrink-0" />
										{/if}
									{/if}
									<ToolIcon class="w-4 h-4 flex-shrink-0" />
									<span>{getIndividualToolDisplayText(tool.event)}</span>
								</button>
								{#if isToolExpanded && args}
									<pre class="mt-1 ml-7 p-2 bg-muted/50 rounded text-xs overflow-x-auto">{JSON.stringify(args, null, 2)}</pre>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
