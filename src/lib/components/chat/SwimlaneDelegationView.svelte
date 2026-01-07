<script lang="ts">
	import type { NDKEvent, NDKUserProfile, NDKSubscription, NDKFilter } from '@nostr-dev-kit/ndk';
	import type { Message } from '$lib/utils/messageUtils';
	import { ndk } from '$lib/ndk.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import * as d3 from 'd3';
	import { GitFork, ZoomIn, ZoomOut, Maximize2, ArrowLeft } from 'lucide-svelte';
	import { conversationMetadataStore } from '$lib/stores/conversationMetadata.svelte';
	import { User } from '$lib/ndk/ui/user';
	import { generateColorFromString } from '$lib/utils/colors';

	// Layout constants
	const LANE_HEIGHT = 100;
	const MESSAGE_WIDTH = 140;
	const MESSAGE_HEIGHT = 50;
	const TIME_SCALE = 120; // pixels per time unit
	const MARGIN = { top: 80, right: 40, bottom: 60, left: 200 };
	const INITIAL_TRANSLATE_X = 0;
	const INITIAL_TRANSLATE_Y = 0;
	const ZOOM_MIN = 0.3;
	const ZOOM_MAX = 3;

	// Types for swimlane data
	interface Agent {
		pubkey: string;
		profile?: NDKUserProfile;
		color: string;
	}

	interface ConversationInfo {
		id: string;
		parentConversationId?: string;
		color: string;
		title?: string;
		rootEventId: string;
	}

	interface SwimMessage {
		id: string;
		event: NDKEvent;
		conversationId: string;
		agentPubkey: string;
		timeIndex: number;
		type: 'user' | 'agent' | 'delegation';
		delegatesToConversations?: string[];
		delegatedFromConversation?: string;
	}

	interface Props {
		rootEvent: NDKEvent;
		messages: Message[];
		currentUserPubkey?: string;
		parentEvent?: NDKEvent | null;
		onNodeClick?: (event: NDKEvent) => void;
		onNavigateBack?: () => void;
	}

	let {
		rootEvent,
		messages,
		currentUserPubkey = ndk.$currentUser?.pubkey,
		parentEvent = null,
		onNodeClick,
		onNavigateBack
	}: Props = $props();

	// DOM references
	let svgElement: SVGSVGElement | undefined = $state();
	let containerElement: HTMLDivElement | undefined = $state();

	// Layout state
	let transform = $state(`translate(${INITIAL_TRANSLATE_X}, ${INITIAL_TRANSLATE_Y})`);
	let zoomBehavior = $state<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

	// Tooltip state
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipContent = $state<SwimMessage | null>(null);

	// Profile cache
	let profileCache = new SvelteMap<string, NDKUserProfile>();

	// Delegated conversation data
	let delegatedConversations = $state(new SvelteMap<string, { events: NDKEvent[], rootEvent: NDKEvent | null }>());
	let subscriptions = $state<NDKSubscription[]>([]);

	// Build the conversation hierarchy
	// Root conversation = rootEvent (kind:1, no e-tag, no delegation tag)
	// Delegated conversations = events with q-tag pointing to them (have delegation tag pointing to parent)

	// Collect all unique agents (pubkeys) from all messages
	const agents = $derived.by(() => {
		const agentMap = new Map<string, Agent>();
		const colors = ['#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#06b6d4', '#ec4899'];
		let colorIndex = 0;

		// Add current user first if exists
		if (currentUserPubkey) {
			agentMap.set(currentUserPubkey, {
				pubkey: currentUserPubkey,
				profile: profileCache.get(currentUserPubkey),
				color: colors[colorIndex++ % colors.length]
			});
		}

		// Add agents from messages
		for (const msg of messages) {
			const pk = msg.event.pubkey;
			if (!agentMap.has(pk)) {
				agentMap.set(pk, {
					pubkey: pk,
					profile: profileCache.get(pk),
					color: colors[colorIndex++ % colors.length]
				});
			}
		}

		// Add agents from delegated conversations
		for (const [, data] of delegatedConversations) {
			for (const event of data.events) {
				const pk = event.pubkey;
				if (!agentMap.has(pk)) {
					agentMap.set(pk, {
						pubkey: pk,
						profile: profileCache.get(pk),
						color: colors[colorIndex++ % colors.length]
					});
				}
			}
		}

		return Array.from(agentMap.values());
	});

	// Build conversations info
	const conversations = $derived.by(() => {
		const convMap = new Map<string, ConversationInfo>();
		const colors = ['#f59e0b', '#8b5cf6', '#3b82f6', '#10b981', '#ef4444', '#06b6d4'];
		let colorIndex = 0;

		// Root conversation
		const rootMetadata = conversationMetadataStore.getConversationData(rootEvent.id);
		convMap.set(rootEvent.id, {
			id: rootEvent.id,
			color: colors[colorIndex++ % colors.length],
			title: rootMetadata.title || 'Root Conversation',
			rootEventId: rootEvent.id
		});

		// Find delegated conversations from q-tags
		for (const msg of messages) {
			const qTags = msg.event.getMatchingTags('q');
			for (const qTag of qTags) {
				const delegatedConvId = qTag[1];
				if (delegatedConvId && !convMap.has(delegatedConvId)) {
					const metadata = conversationMetadataStore.getConversationData(delegatedConvId);
					convMap.set(delegatedConvId, {
						id: delegatedConvId,
						parentConversationId: rootEvent.id,
						color: colors[colorIndex++ % colors.length],
						title: metadata.title || `Delegation ${colorIndex}`,
						rootEventId: delegatedConvId
					});
				}
			}
		}

		// Find nested delegations from delegated conversation events
		for (const [convId, data] of delegatedConversations) {
			for (const event of data.events) {
				const qTags = event.getMatchingTags('q');
				for (const qTag of qTags) {
					const nestedConvId = qTag[1];
					if (nestedConvId && !convMap.has(nestedConvId)) {
						const metadata = conversationMetadataStore.getConversationData(nestedConvId);
						convMap.set(nestedConvId, {
							id: nestedConvId,
							parentConversationId: convId,
							color: colors[colorIndex++ % colors.length],
							title: metadata.title || `Nested Delegation`,
							rootEventId: nestedConvId
						});
					}
				}
			}
		}

		return Array.from(convMap.values());
	});

	// Transform messages into swimlane format
	const swimMessages = $derived.by(() => {
		const result: SwimMessage[] = [];
		let timeIndex = 0;

		// Get all events sorted by timestamp
		const allEvents: { event: NDKEvent; conversationId: string }[] = [];

		// Add root conversation messages
		for (const msg of messages) {
			allEvents.push({ event: msg.event, conversationId: rootEvent.id });
		}

		// Add delegated conversation messages
		for (const [convId, data] of delegatedConversations) {
			for (const event of data.events) {
				allEvents.push({ event, conversationId: convId });
			}
		}

		// Sort by timestamp
		allEvents.sort((a, b) => (a.event.created_at ?? 0) - (b.event.created_at ?? 0));

		// Assign time indices
		const timeMap = new Map<number, number>();
		for (const { event } of allEvents) {
			const ts = event.created_at ?? 0;
			if (!timeMap.has(ts)) {
				timeMap.set(ts, timeIndex++);
			}
		}

		// Create swim messages
		for (const { event, conversationId } of allEvents) {
			const qTags = event.getMatchingTags('q');
			const delegatesToConversations = qTags.map(t => t[1]).filter(Boolean);
			const delegationTag = event.tags.find(t => t[0] === 'delegation');

			const isUser = event.pubkey === currentUserPubkey;
			const isDelegation = delegatesToConversations.length > 0;

			result.push({
				id: event.id,
				event,
				conversationId,
				agentPubkey: event.pubkey,
				timeIndex: timeMap.get(event.created_at ?? 0) ?? 0,
				type: isDelegation ? 'delegation' : (isUser ? 'user' : 'agent'),
				delegatesToConversations: delegatesToConversations.length > 0 ? delegatesToConversations : undefined,
				delegatedFromConversation: delegationTag ? delegationTag[1] : undefined
			});
		}

		return result;
	});

	// Get max time for axis
	const maxTimeIndex = $derived(Math.max(...swimMessages.map(m => m.timeIndex), 0));

	// Fetch profiles for all unique pubkeys
	async function fetchProfiles(pubkeys: string[]): Promise<void> {
		const uniquePubkeys = [...new Set(pubkeys)].filter(pk => !profileCache.has(pk));
		if (uniquePubkeys.length === 0) return;

		try {
			const users = await Promise.all(
				uniquePubkeys.map(pk => ndk.getUser({ pubkey: pk }).fetchProfile())
			);

			for (let i = 0; i < uniquePubkeys.length; i++) {
				const profile = users[i];
				if (profile) {
					profileCache.set(uniquePubkeys[i], profile);
				}
			}
		} catch (error) {
			console.error('Failed to fetch profiles:', error);
		}
	}

	// Subscribe to delegated conversations
	function subscribeToDelegatedConversations(conversationIds: string[]) {
		// Clean up existing subscriptions
		for (const sub of subscriptions) {
			sub.stop();
		}
		subscriptions = [];

		for (const convId of conversationIds) {
			if (delegatedConversations.has(convId)) continue;

			const filters: NDKFilter[] = [
				{ ids: [convId] },
				{ '#e': [convId], kinds: [1] }
			];

			const sub = ndk.subscribe(filters, {
				closeOnEose: false,
				subId: `swimlane-delegation-${convId.slice(0, 8)}`,
				onEvent: (event: NDKEvent) => {
					const existing = delegatedConversations.get(convId) || { events: [], rootEvent: null };
					if (event.id === convId) {
						existing.rootEvent = event;
					}
					if (!existing.events.find(e => e.id === event.id)) {
						existing.events = [...existing.events, event];
					}
					delegatedConversations.set(convId, existing);
				},
				onEvents: (events: NDKEvent[]) => {
					const existing = delegatedConversations.get(convId) || { events: [], rootEvent: null };
					for (const event of events) {
						if (event.id === convId) {
							existing.rootEvent = event;
						}
						if (!existing.events.find(e => e.id === event.id)) {
							existing.events.push(event);
						}
					}
					delegatedConversations.set(convId, { ...existing });
				}
			});

			subscriptions.push(sub);
		}
	}

	// Track which delegated conversations we need to fetch
	$effect(() => {
		const delegatedConvIds: string[] = [];

		// Find all q-tags in messages
		for (const msg of messages) {
			const qTags = msg.event.getMatchingTags('q');
			for (const qTag of qTags) {
				if (qTag[1] && !delegatedConvIds.includes(qTag[1])) {
					delegatedConvIds.push(qTag[1]);
				}
			}
		}

		if (delegatedConvIds.length > 0) {
			subscribeToDelegatedConversations(delegatedConvIds);
		}
	});

	// Fetch profiles when messages change
	$effect(() => {
		const pubkeys = [
			...messages.map(m => m.event.pubkey),
			...Array.from(delegatedConversations.values()).flatMap(d => d.events.map(e => e.pubkey))
		];
		if (pubkeys.length > 0) {
			fetchProfiles(pubkeys);
		}
	});

	// Cleanup subscriptions on destroy
	$effect(() => {
		return () => {
			for (const sub of subscriptions) {
				sub.stop();
			}
		};
	});

	// Setup D3 zoom
	$effect(() => {
		if (!svgElement) return;

		const svg = d3.select(svgElement);

		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([ZOOM_MIN, ZOOM_MAX])
			.on('zoom', (event) => {
				transform = event.transform.toString();
			});

		svg.call(zoom);
		svg.call(zoom.transform, d3.zoomIdentity.translate(INITIAL_TRANSLATE_X, INITIAL_TRANSLATE_Y));
		zoomBehavior = zoom;

		return () => {
			svg.on('.zoom', null);
		};
	});

	function handleZoomIn() {
		if (!svgElement || !zoomBehavior) return;
		d3.select(svgElement).transition().duration(300).call(zoomBehavior.scaleBy, 1.5);
	}

	function handleZoomOut() {
		if (!svgElement || !zoomBehavior) return;
		d3.select(svgElement).transition().duration(300).call(zoomBehavior.scaleBy, 0.67);
	}

	function handleResetView() {
		if (!svgElement || !zoomBehavior) return;
		d3.select(svgElement)
			.transition()
			.duration(300)
			.call(zoomBehavior.transform, d3.zoomIdentity.translate(INITIAL_TRANSLATE_X, INITIAL_TRANSLATE_Y));
	}

	function getAgentIndex(pubkey: string): number {
		return agents.findIndex(a => a.pubkey === pubkey);
	}

	function getMessageX(msg: SwimMessage): number {
		return MARGIN.left + msg.timeIndex * TIME_SCALE + 20;
	}

	function getMessageY(msg: SwimMessage): number {
		const agentIndex = getAgentIndex(msg.agentPubkey);
		return MARGIN.top + agentIndex * LANE_HEIGHT + (LANE_HEIGHT - MESSAGE_HEIGHT) / 2;
	}

	function getMessageClass(msg: SwimMessage): string {
		switch (msg.type) {
			case 'user': return 'fill-[#1e3a5f] stroke-[#3b82f6]';
			case 'delegation': return 'fill-[#2d1f47] stroke-[#8b5cf6]';
			default: return 'fill-[#1e3d32] stroke-[#10b981]';
		}
	}

	function getConversationColor(conversationId: string): string {
		const conv = conversations.find(c => c.id === conversationId);
		return conv?.color ?? '#666';
	}

	function getDisplayName(pubkey: string): string {
		const profile = profileCache.get(pubkey);
		if (profile?.name) return profile.name;
		if (profile?.displayName) return profile.displayName;
		return pubkey.substring(0, 8) + '...';
	}

	function truncateContent(content: string, maxLen = 20): string {
		const cleaned = content.replace(/\n/g, ' ').trim();
		if (cleaned.length <= maxLen) return cleaned;
		return cleaned.substring(0, maxLen) + '...';
	}

	function handleNodeClick(msg: SwimMessage) {
		onNodeClick?.(msg.event);
	}

	function showTooltip(event: MouseEvent, msg: SwimMessage) {
		tooltipContent = msg;
		tooltipX = event.clientX + 15;
		tooltipY = event.clientY - 10;
		tooltipVisible = true;
	}

	function hideTooltip() {
		tooltipVisible = false;
	}

	// Generate delegation link paths
	function getDelegationLinks(): { from: SwimMessage; to: SwimMessage; path: string }[] {
		const links: { from: SwimMessage; to: SwimMessage; path: string }[] = [];

		for (const msg of swimMessages) {
			if (msg.delegatesToConversations) {
				for (const targetConvId of msg.delegatesToConversations) {
					// Find the first message in the delegated conversation (the one with delegation tag)
					const targetMsg = swimMessages.find(m =>
						m.conversationId === targetConvId &&
						m.delegatedFromConversation
					);

					if (targetMsg) {
						const fromX = getMessageX(msg) + MESSAGE_WIDTH;
						const fromY = getMessageY(msg) + MESSAGE_HEIGHT / 2;
						const toX = getMessageX(targetMsg);
						const toY = getMessageY(targetMsg) + MESSAGE_HEIGHT / 2;

						const midX = (fromX + toX) / 2;
						const path = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
						links.push({ from: msg, to: targetMsg, path });
					}
				}
			}
		}

		return links;
	}

	// Generate flow lines between messages in same conversation
	function getFlowLines(): { path: string; color: string }[] {
		const lines: { path: string; color: string }[] = [];

		for (const conv of conversations) {
			const convMessages = swimMessages
				.filter(m => m.conversationId === conv.id)
				.sort((a, b) => a.timeIndex - b.timeIndex);

			for (let i = 0; i < convMessages.length - 1; i++) {
				const from = convMessages[i];
				const to = convMessages[i + 1];

				const fromX = getMessageX(from) + MESSAGE_WIDTH;
				const fromY = getMessageY(from) + MESSAGE_HEIGHT / 2;
				const toX = getMessageX(to);
				const toY = getMessageY(to) + MESSAGE_HEIGHT / 2;

				const path = `M ${fromX} ${fromY} L ${toX} ${toY}`;
				lines.push({ path, color: conv.color });
			}
		}

		return lines;
	}

	const delegationLinks = $derived(getDelegationLinks());
	const flowLines = $derived(getFlowLines());
	const totalHeight = $derived(MARGIN.top + agents.length * LANE_HEIGHT + MARGIN.bottom);
	const totalWidth = $derived(MARGIN.left + (maxTimeIndex + 2) * TIME_SCALE + MARGIN.right);
</script>

<div class="flex flex-col h-full bg-background overflow-hidden relative">
	<!-- Controls -->
	<div class="absolute top-4 right-4 z-10 flex flex-col gap-1">
		{#if parentEvent && onNavigateBack}
			<button
				class="p-2 rounded-md bg-card border border-border hover:bg-accent transition-colors"
				onclick={onNavigateBack}
				aria-label="Go back"
				title="Go back to parent"
			>
				<ArrowLeft class="h-4 w-4" />
			</button>
		{/if}
		<button
			class="p-2 rounded-md bg-card border border-border hover:bg-accent transition-colors"
			onclick={handleZoomIn}
			aria-label="Zoom in"
			title="Zoom in"
		>
			<ZoomIn class="h-4 w-4" />
		</button>
		<button
			class="p-2 rounded-md bg-card border border-border hover:bg-accent transition-colors"
			onclick={handleZoomOut}
			aria-label="Zoom out"
			title="Zoom out"
		>
			<ZoomOut class="h-4 w-4" />
		</button>
		<button
			class="p-2 rounded-md bg-card border border-border hover:bg-accent transition-colors"
			onclick={handleResetView}
			aria-label="Reset view"
			title="Reset view"
		>
			<Maximize2 class="h-4 w-4" />
		</button>
	</div>

	<!-- Conversations Panel -->
	<div class="absolute top-4 left-4 z-10 bg-card/95 border border-border rounded-lg p-3 max-w-[180px]">
		<h4 class="text-xs text-muted-foreground uppercase tracking-wider mb-2">Conversations</h4>
		{#each conversations as conv (conv.id)}
			<div class="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer text-xs">
				<div
					class="w-2 h-2 rounded-full flex-shrink-0"
					style="background-color: {conv.color};"
				></div>
				<span class="truncate text-foreground/80">{conv.title}</span>
			</div>
		{/each}
	</div>

	<!-- Legend -->
	<div class="absolute top-4 right-16 z-10 bg-card/95 border border-border rounded-lg p-3">
		<h4 class="text-xs text-muted-foreground uppercase tracking-wider mb-2">Message Types</h4>
		<div class="flex flex-col gap-1.5 text-xs">
			<div class="flex items-center gap-2">
				<div class="w-3 h-3 rounded-sm bg-[#3b82f6]"></div>
				<span>User Message</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-3 h-3 rounded-sm bg-[#10b981]"></div>
				<span>Agent Response</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-3 h-3 rounded-sm bg-[#8b5cf6]"></div>
				<span>Delegation</span>
			</div>
		</div>
	</div>

	<!-- Main Content Area -->
	<div class="flex-1 overflow-hidden relative" bind:this={containerElement}>
		{#if swimMessages.length === 0}
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="text-center text-muted-foreground">
					<GitFork class="h-12 w-12 mx-auto mb-3 opacity-50" />
					<p class="text-sm font-medium">No conversation to display</p>
					<p class="text-xs mt-1">Start a conversation to see the swimlane view</p>
				</div>
			</div>
		{:else}
			<svg
				bind:this={svgElement}
				class="w-full h-full"
				style="cursor: grab;"
				role="tree"
				aria-label="Conversation swimlane view"
			>
				<defs>
					<marker id="delegation-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
						<polygon points="0 0, 10 3.5, 0 7" fill="#8b5cf6" />
					</marker>
				</defs>

				<g {transform}>
					<!-- Swimlanes -->
					{#each agents as agent, i (agent.pubkey)}
						<g transform="translate(0, {MARGIN.top + i * LANE_HEIGHT})">
							<!-- Lane background -->
							<rect
								x={MARGIN.left}
								y="0"
								width={totalWidth - MARGIN.left}
								height={LANE_HEIGHT}
								class={i % 2 === 0 ? 'fill-white/[0.02]' : 'fill-white/[0.04]'}
								stroke="rgba(255,255,255,0.1)"
								stroke-width="1"
							/>

							<!-- Agent label -->
							<foreignObject x="10" y={(LANE_HEIGHT - 40) / 2} width={MARGIN.left - 20} height="40">
								<div class="flex items-center gap-2 h-full">
									<User.Root ndk={ndk} pubkey={agent.pubkey}>
										<User.Avatar class="w-8 h-8 rounded-full flex-shrink-0" />
									</User.Root>
									<span class="text-sm font-medium text-foreground truncate">
										{getDisplayName(agent.pubkey)}
									</span>
								</div>
							</foreignObject>
						</g>
					{/each}

					<!-- Flow lines (conversation continuity) -->
					{#each flowLines as line}
						<path
							d={line.path}
							fill="none"
							stroke={line.color}
							stroke-width="2"
							opacity="0.4"
						/>
					{/each}

					<!-- Delegation links -->
					{#each delegationLinks as link (link.from.id + '-' + link.to.id)}
						<path
							d={link.path}
							fill="none"
							stroke="#8b5cf6"
							stroke-width="2"
							stroke-dasharray="8, 4"
							marker-end="url(#delegation-arrow)"
						/>
					{/each}

					<!-- Message nodes -->
					{#each swimMessages as msg (msg.id)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<g
							transform="translate({getMessageX(msg)}, {getMessageY(msg)})"
							class="cursor-pointer"
							onclick={() => handleNodeClick(msg)}
							onkeydown={(e) => e.key === 'Enter' && handleNodeClick(msg)}
							onmouseenter={(e) => showTooltip(e, msg)}
							onmouseleave={hideTooltip}
							role="button"
							tabindex="0"
						>
							<!-- Conversation color indicator -->
							<rect
								x="-3"
								y="0"
								width="3"
								height={MESSAGE_HEIGHT}
								fill={getConversationColor(msg.conversationId)}
								rx="1"
							/>

							<!-- Message box -->
							<rect
								width={MESSAGE_WIDTH}
								height={MESSAGE_HEIGHT}
								rx="6"
								class={getMessageClass(msg)}
								stroke-width="2"
							/>

							<!-- Message content -->
							<text
								x="8"
								y="18"
								class="text-[10px] fill-foreground font-medium"
							>
								{truncateContent(msg.event.content, 18)}
							</text>

							<!-- Time indicator -->
							<text
								x="8"
								y={MESSAGE_HEIGHT - 8}
								class="text-[9px] fill-muted-foreground"
							>
								t={msg.timeIndex}
							</text>

							<!-- Delegation indicator -->
							{#if msg.type === 'delegation'}
								<circle
									cx={MESSAGE_WIDTH - 10}
									cy="10"
									r="5"
									fill="#8b5cf6"
								/>
							{/if}
						</g>
					{/each}

					<!-- Timeline axis -->
					<g transform="translate(0, {MARGIN.top + agents.length * LANE_HEIGHT + 15})">
						<line
							x1={MARGIN.left}
							y1="0"
							x2={MARGIN.left + (maxTimeIndex + 1) * TIME_SCALE}
							y2="0"
							stroke="rgba(255,255,255,0.2)"
							stroke-width="1"
						/>
						{#each Array(maxTimeIndex + 1) as _, t}
							<g transform="translate({MARGIN.left + t * TIME_SCALE + MESSAGE_WIDTH / 2}, 0)">
								<line y1="-5" y2="5" stroke="rgba(255,255,255,0.2)" />
								<text y="18" text-anchor="middle" class="text-[10px] fill-muted-foreground">
									t{t}
								</text>
							</g>
						{/each}
					</g>
				</g>
			</svg>

			<!-- Tooltip -->
			{#if tooltipVisible && tooltipContent}
				<div
					class="fixed z-50 bg-popover border border-primary/50 rounded-lg p-3 text-sm pointer-events-none max-w-[300px] shadow-lg"
					style="left: {tooltipX}px; top: {tooltipY}px;"
				>
					<div class="font-bold mb-2" style="color: {getConversationColor(tooltipContent.conversationId)};">
						{conversations.find(c => c.id === tooltipContent?.conversationId)?.title || 'Conversation'}
					</div>
					<div class="space-y-1 text-xs">
						<div><strong>From:</strong> {getDisplayName(tooltipContent.agentPubkey)}</div>
						<div><strong>Type:</strong> {tooltipContent.type}</div>
						<div><strong>Time:</strong> t={tooltipContent.timeIndex}</div>
					</div>
					<div class="mt-2 text-muted-foreground text-xs line-clamp-3">
						{tooltipContent.event.content}
					</div>
					{#if tooltipContent.delegatesToConversations}
						<div class="mt-2 text-[#8b5cf6] text-xs">
							Delegates to: {tooltipContent.delegatesToConversations.length} conversation(s)
						</div>
					{/if}
					{#if tooltipContent.delegatedFromConversation}
						<div class="mt-2 text-[#8b5cf6] text-xs">
							Delegated from parent
						</div>
					{/if}
				</div>
			{/if}

			<div class="absolute bottom-4 left-4 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded">
				Scroll to zoom &bull; Drag to pan &bull; Click node to view
			</div>
		{/if}
	</div>
</div>
