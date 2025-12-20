<script lang="ts">
	import type { Message } from '$lib/utils/messageUtils';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import {
		ChevronDown,
		ChevronRight,
		Settings,
		FileText,
		Pencil,
		Terminal,
		Users,
		Search,
		Brain,
		MoreVertical,
		Copy,
		Reply,
		Quote,
		Info,
		Eye,
		Hash
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
	import LLMMetadataDialog from './LLMMetadataDialog.svelte';
	import { ndk } from '$lib/ndk.svelte';
	import { User } from '$lib/ndk/ui/user';
	import { formatTimestamp } from '$lib/utils/time';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

	interface Props {
		tools: Message[];
		thinking?: Message[];
		isActive: boolean;
		isConsecutive: boolean;
		hasNextConsecutive: boolean;
		onReply?: (message: Message) => void;
		onQuote?: (message: Message) => void;
		onTimeClick?: (event: NDKEvent) => void;
	}

	let { tools, thinking = [], isActive, isConsecutive, hasNextConsecutive, onReply, onQuote, onTimeClick }: Props = $props();

	let isExpanded = $state(false);
	let expandedToolIds = $state<Set<string>>(new Set());
	let dropdownOpenIds = $state<Set<string>>(new Set());
	let showRawEventFor = $state<Message | null>(null);
	let showLLMMetadata = $state(false);
	let llmMetadataEvent = $state<Message | null>(null);

	function openLLMMetadata(msg: Message) {
		llmMetadataEvent = msg;
		showLLMMetadata = true;
	}

	function isDropdownOpen(id: string) {
		return dropdownOpenIds.has(id);
	}

	function setDropdownOpen(id: string, open: boolean) {
		const newSet = new Set(dropdownOpenIds);
		if (open) {
			newSet.add(id);
		} else {
			newSet.delete(id);
		}
		dropdownOpenIds = newSet;
	}

	const hasThinking = $derived(thinking.length > 0);
	const toolCount = $derived(tools.length);

	// Combined list of thinking and tools sorted chronologically
	type GroupItem = { type: 'thinking'; message: Message } | { type: 'tool'; message: Message };
	const chronologicalItems = $derived((): GroupItem[] => {
		const items: GroupItem[] = [
			...thinking.map((m) => ({ type: 'thinking' as const, message: m })),
			...tools.map((m) => ({ type: 'tool' as const, message: m }))
		];
		return items.sort((a, b) => (a.message.event.created_at ?? 0) - (b.message.event.created_at ?? 0));
	});

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
						<!-- Render items chronologically -->
						{#each chronologicalItems() as item (item.message.id)}
							{#if item.type === 'thinking'}
								<AIReasoningBlock
									reasoningEvent={item.message.event}
									isStreaming={false}
									isLastMessage={false}
									timestamp={item.message.event.created_at ? formatTimestamp(item.message.event.created_at) : ''}
									message={item.message}
									{onReply}
									{onQuote}
									{onTimeClick}
									onShowLLMMetadata={() => openLLMMetadata(item.message)}
									onShowRawEvent={() => (showRawEventFor = item.message)}
								/>
							{:else}
								{@const tool = item.message}
								{@const action = getToolActionInfo(tool.event)}
								{@const toolIcon = getToolCategoryIcon(action.category)}
								{@const ToolIcon = getIconComponent(toolIcon)}
								{@const args = parseToolArgs(tool.event)}
								{@const isToolExpanded = expandedToolIds.has(tool.id)}
								{@const toolTimestamp = tool.event.created_at ? formatTimestamp(tool.event.created_at) : ''}
								{@const toolDropdownOpen = isDropdownOpen(tool.id)}
								<div class="group/tool">
									<div class="flex items-center justify-between gap-4">
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

										<!-- Time + Dropdown -->
										<div class="flex items-center gap-2 flex-shrink-0">
											{#if toolTimestamp}
												<button
													type="button"
													onclick={() => onTimeClick?.(tool.event)}
													class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer hover:underline"
													title="Open as root conversation"
												>
													{toolTimestamp}
												</button>
											{/if}

											<div class="transition-opacity {toolDropdownOpen ? 'opacity-100' : 'opacity-0 group-hover/tool:opacity-100'}">
												<DropdownMenu.Root open={toolDropdownOpen} onOpenChange={(open) => setDropdownOpen(tool.id, open)}>
													<DropdownMenu.Trigger
														type="button"
														class="p-1 rounded hover:bg-secondary transition-colors"
														aria-label="Message actions"
													>
														<MoreVertical class="w-4 h-4 text-muted-foreground" />
													</DropdownMenu.Trigger>
													<DropdownMenu.Content align="end" class="w-48">
														{#if onReply}
															<DropdownMenu.Item onclick={() => onReply(tool)}>
																<Reply class="mr-2 h-4 w-4" />
																<span>Reply</span>
															</DropdownMenu.Item>
														{/if}
														{#if onQuote}
															<DropdownMenu.Item onclick={() => onQuote(tool)}>
																<Quote class="mr-2 h-4 w-4" />
																<span>Quote</span>
															</DropdownMenu.Item>
														{/if}
														<DropdownMenu.Item onclick={() => navigator.clipboard.writeText(tool.event.content)}>
															<Copy class="mr-2 h-4 w-4" />
															<span>Copy content</span>
														</DropdownMenu.Item>
														<DropdownMenu.Item onclick={() => navigator.clipboard.writeText(tool.event.inspect)}>
															<Copy class="mr-2 h-4 w-4" />
															<span>Copy raw event</span>
														</DropdownMenu.Item>
														<DropdownMenu.Item onclick={() => navigator.clipboard.writeText(tool.event.encode())}>
															<Hash class="mr-2 h-4 w-4" />
															<span>Copy ID</span>
														</DropdownMenu.Item>
														<DropdownMenu.Item onclick={() => navigator.clipboard.writeText(tool.event.id)}>
															<Hash class="mr-2 h-4 w-4" />
															<span>Copy Hex ID</span>
														</DropdownMenu.Item>
														<DropdownMenu.Separator />
														<DropdownMenu.Item onclick={() => openLLMMetadata(tool)}>
															<Info class="mr-2 h-4 w-4" />
															<span>View LLM metadata</span>
														</DropdownMenu.Item>
														<DropdownMenu.Item onclick={() => (showRawEventFor = tool)}>
															<Eye class="mr-2 h-4 w-4" />
															<span>View raw event</span>
														</DropdownMenu.Item>
													</DropdownMenu.Content>
												</DropdownMenu.Root>
											</div>
										</div>
									</div>
									{#if isToolExpanded && args}
										<pre class="mt-1 ml-7 p-2 bg-muted/50 rounded text-xs overflow-x-auto">{JSON.stringify(args, null, 2)}</pre>
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>

<!-- Raw Event Dialog -->
{#if showRawEventFor}
	<div
		class="fixed inset-0 bg-overlay/50 dark:bg-overlay/70 flex items-center justify-center z-50"
		onclick={() => (showRawEventFor = null)}
		onkeydown={(e) => {
			if (e.key === 'Escape') showRawEventFor = null;
		}}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="bg-card rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<div class="flex items-center justify-between px-4 py-3 border-b border-border">
				<h3 class="font-semibold text-foreground">Raw Event</h3>
				<button
					type="button"
					onclick={() => (showRawEventFor = null)}
					class="p-1 rounded hover:bg-muted transition-colors"
					aria-label="Close"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
			<div class="flex-1 overflow-y-auto p-4">
				<pre
					class="text-xs bg-muted text-foreground rounded p-4 overflow-x-auto">{JSON.stringify(showRawEventFor.event.rawEvent(), null, 2)}</pre>
			</div>
			<div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
				<button
					type="button"
					onclick={() => {
						if (showRawEventFor) {
							navigator.clipboard.writeText(JSON.stringify(showRawEventFor.event.rawEvent(), null, 2));
						}
					}}
					class="px-3 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 dark:hover:bg-primary transition-colors"
				>
					Copy JSON
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- LLM Metadata Dialog -->
{#if llmMetadataEvent}
	<LLMMetadataDialog bind:open={showLLMMetadata} event={llmMetadataEvent.event} />
{/if}
