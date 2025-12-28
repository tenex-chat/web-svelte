<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { cn } from '$lib/utils/cn';
	import { Streamdown } from 'svelte-streamdown';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Copy, Reply, Quote, MoreVertical, Info, Eye, Hash } from 'lucide-svelte';
	import type { Message } from '$lib/utils/messageUtils';

	interface Props {
		reasoningEvent: NDKEvent;
		isLastMessage?: boolean;
		timestamp?: string;
		message?: Message;
		onReply?: (message: Message) => void;
		onQuote?: (message: Message) => void;
		onTimeClick?: (event: NDKEvent) => void;
		onShowLLMMetadata?: () => void;
		onShowRawEvent?: () => void;
	}

	let {
		reasoningEvent,
		isLastMessage = false,
		timestamp = '',
		message,
		onReply,
		onQuote,
		onTimeClick,
		onShowLLMMetadata,
		onShowRawEvent
	}: Props = $props();

	let isOpen = $state(false);
	let dropdownOpen = $state(false);

	const reasoningContent = $derived(reasoningEvent.content || '');

	// Compute stable ID for accessibility
	const contentId = $derived(
		reasoningEvent.id
			? `reasoning-content-${reasoningEvent.id}`
			: `reasoning-content-${Date.now()}`
	);
</script>

{#if reasoningContent}
	<div class="group">
		<div class="transition-all">
			<!-- Trigger Row -->
			<div class="flex items-center justify-between gap-4">
				<button
					type="button"
					onclick={() => (isOpen = !isOpen)}
					aria-expanded={isOpen}
					aria-controls={contentId}
					class="py-1 flex items-center gap-2 text-left hover:bg-muted/50 transition-colors rounded-lg"
				>
					<svg
						class={cn(
							'w-4 h-4 transition-transform text-muted-foreground flex-shrink-0',
							isOpen ? 'rotate-90' : ''
						)}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>

					<span class="text-sm text-muted-foreground inline-flex items-center gap-1.5">Thinking</span>
				</button>

				<!-- Time + Dropdown -->
				{#if timestamp || message}
					<div class="flex items-center gap-2 flex-shrink-0">
						{#if timestamp}
							<button
								type="button"
								onclick={() => onTimeClick?.(reasoningEvent)}
								class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer hover:underline"
								title="Open as root conversation"
							>
								{timestamp}
							</button>
						{/if}

						{#if message}
							<div class="transition-opacity" class:opacity-0={!dropdownOpen} class:opacity-100={dropdownOpen} class:group-hover:opacity-100={!dropdownOpen}>
								<DropdownMenu.Root bind:open={dropdownOpen}>
									<DropdownMenu.Trigger
										type="button"
										class="p-1 rounded hover:bg-secondary transition-colors"
										aria-label="Message actions"
									>
										<MoreVertical class="w-4 h-4 text-muted-foreground" />
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="end" class="w-48">
										{#if onReply}
											<DropdownMenu.Item onclick={() => onReply(message)}>
												<Reply class="mr-2 h-4 w-4" />
												<span>Reply</span>
											</DropdownMenu.Item>
										{/if}
										{#if onQuote}
											<DropdownMenu.Item onclick={() => onQuote(message)}>
												<Quote class="mr-2 h-4 w-4" />
												<span>Quote</span>
											</DropdownMenu.Item>
										{/if}
										<DropdownMenu.Item onclick={() => navigator.clipboard.writeText(message.event.content)}>
											<Copy class="mr-2 h-4 w-4" />
											<span>Copy content</span>
										</DropdownMenu.Item>
										<DropdownMenu.Item onclick={() => navigator.clipboard.writeText(message.event.inspect)}>
											<Copy class="mr-2 h-4 w-4" />
											<span>Copy raw event</span>
										</DropdownMenu.Item>
										<DropdownMenu.Item onclick={() => navigator.clipboard.writeText(message.event.encode())}>
											<Hash class="mr-2 h-4 w-4" />
											<span>Copy ID</span>
										</DropdownMenu.Item>
										<DropdownMenu.Item onclick={() => navigator.clipboard.writeText(message.event.id)}>
											<Hash class="mr-2 h-4 w-4" />
											<span>Copy Hex ID</span>
										</DropdownMenu.Item>
										<DropdownMenu.Separator />
										{#if onShowLLMMetadata}
											<DropdownMenu.Item onclick={onShowLLMMetadata}>
												<Info class="mr-2 h-4 w-4" />
												<span>View LLM metadata</span>
											</DropdownMenu.Item>
										{/if}
										{#if onShowRawEvent}
											<DropdownMenu.Item onclick={onShowRawEvent}>
												<Eye class="mr-2 h-4 w-4" />
												<span>View raw event</span>
											</DropdownMenu.Item>
										{/if}
									</DropdownMenu.Content>
								</DropdownMenu.Root>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Reasoning Content -->
			{#if isOpen}
				<div id={contentId} class="px-4 py-3 bg-card/50">
					<div class="prose prose-sm max-w-none dark:prose-invert text-foreground text-sm">
						<Streamdown
							content={reasoningContent}
							class="prose prose-sm max-w-none dark:prose-invert text-foreground text-sm"
							parseIncompleteMarkdown={true}
							animation={{ enabled: false }}
							baseTheme="tailwind"
							shikiTheme="github-dark-dimmed"
						/>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
