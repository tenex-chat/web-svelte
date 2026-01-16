<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKSubscriptionCacheUsage, type NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { openProjects } from '$lib/stores/openProjects.svelte';
	import { conversationMetadataStore } from '$lib/stores/conversationMetadata.svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import { globalFilterStore } from '$lib/stores/globalFilter.svelte';
	import { isRootThread, getParentIds } from '$lib/stores/threadStore.svelte';
	import { isAskEvent, hasAskQuestions, parseAskQuestions } from '$lib/utils/askTags';
	import { generateColorFromString } from '$lib/utils/colors';
	import { storage } from '$lib/utils/storage.svelte';
	import { User } from '$lib/ndk/ui/user';
	import { cn } from '$lib/utils/cn';
	import * as d3 from 'd3';
	import { Network, ZoomIn, ZoomOut, Maximize2, MessageSquare, HelpCircle, X } from 'lucide-svelte';
	import TimeAgo from '$lib/components/common/TimeAgo.svelte';
	import AskQuestionsBlock from '$lib/components/chat/AskQuestionsBlock.svelte';

	// Time filter thresholds in seconds
	const TIME_THRESHOLDS: Record<string, number> = {
		'1h': 3600,
		'4h': 14400,
		'1d': 86400,
		'3d': 259200,
		'7d': 604800
	};

	// Layout constants
	const NODE_WIDTH = 240;
	const NODE_HEIGHT = 100;
	const ASK_NODE_WIDTH = 200;
	const ASK_NODE_HEIGHT = 80;
	const ZOOM_MIN = 0.2;
	const ZOOM_MAX = 3;

	interface GraphNode {
		id: string;
		type: 'conversation' | 'ask';
		event: NDKEvent;
		project?: NDKProject;
		title: string;
		agentPubkey?: string;
		statusLabel?: string;
		isAnswered?: boolean;
		latestReplyTime: number;
		x?: number;
		y?: number;
		fx?: number | null;
		fy?: number | null;
	}

	interface GraphLink {
		source: string | GraphNode;
		target: string | GraphNode;
		type: 'delegation' | 'ask';
	}

	// DOM references
	let svgElement: SVGSVGElement | undefined = $state();
	let containerElement: HTMLDivElement | undefined = $state();

	// State
	let transform = $state('translate(0, 0) scale(1)');
	let zoomBehavior = $state<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
	let simulation = $state<d3.Simulation<GraphNode, GraphLink> | null>(null);
	let nodes = $state<GraphNode[]>([]);
	let links = $state<GraphLink[]>([]);

	// Ask modal state
	let askModalOpen = $state(false);
	let selectedAskEvent = $state<NDKEvent | null>(null);

	// Subscribe to threads from all opened projects
	let allThreads = $state<Map<string, NDKEvent[]>>(new Map());
	let allReplies = $state<Map<string, NDKEvent[]>>(new Map());
	let threadMetadataMap = $state<Map<string, { replyCount: number; latestReplyTime: number }>>(
		new Map()
	);

	$effect(() => {
		const projects = openProjects.projects;
		const projectTagIds = projects.map((p) => p.tagId()).filter((id): id is string => !!id);

		if (projectTagIds.length === 0) {
			allThreads = new Map();
			allReplies = new Map();
			threadMetadataMap = new Map();
			return;
		}

		const projectThreads = new Map<string, NDKEvent[]>();
		const projectReplies = new Map<string, NDKEvent[]>();
		const metadataMap = new Map<string, { replyCount: number; latestReplyTime: number }>();

		const subscription = ndk.subscribe(
			[
				{
					kinds: [1],
					'#a': projectTagIds,
					limit: 500
				}
			],
			{
				cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE,
				groupable: false,
				subId: 'delegation-graph',
				cacheUnconstrainFilter: []
			},
			{
				onEvent: (event: NDKEvent) => {
					const aTag = event.tags.find((t) => t[0] === 'a' && projectTagIds.includes(t[1]));
					if (!aTag) return;
					const projectTagId = aTag[1];

					if (isRootThread(event)) {
						const existing = projectThreads.get(projectTagId) || [];
						if (!existing.find((e) => e.id === event.id)) {
							projectThreads.set(projectTagId, [...existing, event]);
							allThreads = new Map(projectThreads);
						}
					} else {
						// Reply
						const existing = projectReplies.get(projectTagId) || [];
						if (!existing.find((e) => e.id === event.id)) {
							projectReplies.set(projectTagId, [...existing, event]);
							allReplies = new Map(projectReplies);
						}

						for (const threadId of getParentIds(event)) {
							const existingMeta = metadataMap.get(threadId) || {
								replyCount: 0,
								latestReplyTime: 0
							};
							existingMeta.replyCount++;
							if ((event.created_at || 0) > existingMeta.latestReplyTime) {
								existingMeta.latestReplyTime = event.created_at || 0;
							}
							metadataMap.set(threadId, existingMeta);
							threadMetadataMap = new Map(metadataMap);
						}
					}
				}
			}
		);

		return () => subscription.stop();
	});

	// Get archived conversation IDs
	const archivedIds = $derived(new Set(Object.keys(storage.getArchivedConversations())));

	// Build graph data
	$effect(() => {
		const projects = openProjects.projects;
		const graphNodes: GraphNode[] = [];
		const graphLinks: GraphLink[] = [];
		const nodeIds = new Set<string>();

		// Build conversation nodes
		for (const project of projects) {
			const projectTagId = project.tagId();
			if (!projectTagId) continue;

			const threads = allThreads.get(projectTagId) || [];
			const replies = allReplies.get(projectTagId) || [];

			for (const thread of threads) {
				// Apply filters
				const threadMeta = threadMetadataMap.get(thread.id);
				const latestReplyTime = threadMeta?.latestReplyTime || thread.created_at || 0;

				// Time filter
				const threshold = TIME_THRESHOLDS[globalFilterStore.value ?? ''];
				if (threshold) {
					const now = Math.floor(Date.now() / 1000);
					if (now - latestReplyTime > threshold) continue;
				}

				// Archived filter
				if (!globalFilterStore.showArchived && archivedIds.has(thread.id)) continue;

				const metadata = conversationMetadataStore.getConversationData(thread.id);

				graphNodes.push({
					id: thread.id,
					type: 'conversation',
					event: thread,
					project,
					title:
						metadata.title ||
						thread.tagValue('title') ||
						thread.content?.slice(0, 50) ||
						'Untitled',
					agentPubkey: thread.pubkey,
					statusLabel: metadata.statusLabel,
					latestReplyTime
				});
				nodeIds.add(thread.id);

				// Find q-tags (delegations to other conversations)
				const qTags = thread.getMatchingTags('q');
				for (const qTag of qTags) {
					const targetId = qTag[1];
					if (targetId) {
						graphLinks.push({
							source: thread.id,
							target: targetId,
							type: 'delegation'
						});
					}
				}
			}

			// Find ask events in replies
			for (const reply of replies) {
				if (isAskEvent(reply) && hasAskQuestions(reply)) {
					// Check if answered by looking for replies to this ask
					const askReplies = replies.filter((r) =>
						r.tags.some((t) => t[0] === 'e' && t[1] === reply.id)
					);
					const isAnswered = askReplies.length > 0;

					const questions = parseAskQuestions(reply);

					graphNodes.push({
						id: reply.id,
						type: 'ask',
						event: reply,
						title: questions?.title || 'Question',
						agentPubkey: reply.pubkey,
						isAnswered,
						latestReplyTime: reply.created_at || 0
					});
					nodeIds.add(reply.id);

					// Link ask to its parent conversation
					const parentIds = getParentIds(reply);
					for (const parentId of parentIds) {
						if (nodeIds.has(parentId) || threads.some((t) => t.id === parentId)) {
							graphLinks.push({
								source: parentId,
								target: reply.id,
								type: 'ask'
							});
						}
					}
				}
			}
		}

		// Filter links to only include those with valid nodes
		const validLinks = graphLinks.filter(
			(link) =>
				nodeIds.has(typeof link.source === 'string' ? link.source : link.source.id) &&
				nodeIds.has(typeof link.target === 'string' ? link.target : link.target.id)
		);

		nodes = graphNodes;
		links = validLinks;
	});

	// Setup D3 force simulation
	$effect(() => {
		if (!svgElement || !containerElement || nodes.length === 0) return;

		const width = containerElement.clientWidth;
		const height = containerElement.clientHeight;

		// Create simulation
		const sim = d3
			.forceSimulation<GraphNode>(nodes)
			.force(
				'link',
				d3
					.forceLink<GraphNode, GraphLink>(links)
					.id((d) => d.id)
					.distance(200)
			)
			.force('charge', d3.forceManyBody().strength(-500))
			.force('center', d3.forceCenter(width / 2, height / 2))
			.force(
				'collision',
				d3.forceCollide<GraphNode>().radius((d) => (d.type === 'ask' ? 60 : 80))
			)
			.on('tick', () => {
				nodes = [...nodes];
			});

		simulation = sim;

		// Setup zoom
		const svg = d3.select(svgElement);
		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([ZOOM_MIN, ZOOM_MAX])
			.on('zoom', (event) => {
				transform = event.transform.toString();
			});

		svg.call(zoom);
		svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8));
		zoomBehavior = zoom;

		return () => {
			sim.stop();
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
		if (!svgElement || !zoomBehavior || !containerElement) return;
		const width = containerElement.clientWidth;
		const height = containerElement.clientHeight;
		d3
			.select(svgElement)
			.transition()
			.duration(300)
			.call(zoomBehavior.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8));
	}

	function handleNodeClick(node: GraphNode) {
		if (node.type === 'ask' && !node.isAnswered) {
			selectedAskEvent = node.event;
			askModalOpen = true;
		} else if (node.type === 'conversation' && node.project) {
			windowManager.openChat(node.project, node.event);
		}
	}

	function getNodeX(node: GraphNode): number {
		return (node.x ?? 0) - (node.type === 'ask' ? ASK_NODE_WIDTH / 2 : NODE_WIDTH / 2);
	}

	function getNodeY(node: GraphNode): number {
		return (node.y ?? 0) - (node.type === 'ask' ? ASK_NODE_HEIGHT / 2 : NODE_HEIGHT / 2);
	}

	function getLinkPath(link: GraphLink): string {
		const source = typeof link.source === 'string' ? nodes.find((n) => n.id === link.source) : link.source;
		const target = typeof link.target === 'string' ? nodes.find((n) => n.id === link.target) : link.target;
		if (!source || !target) return '';

		const sx = source.x ?? 0;
		const sy = source.y ?? 0;
		const tx = target.x ?? 0;
		const ty = target.y ?? 0;

		const midX = (sx + tx) / 2;
		const midY = (sy + ty) / 2;

		return `M ${sx} ${sy} Q ${midX} ${midY - 50}, ${tx} ${ty}`;
	}
</script>

<div class="flex-1 flex flex-col h-full overflow-hidden bg-background relative">
	<!-- Header -->
	<div class="p-6 pb-0">
		<h1 class="text-2xl font-bold text-foreground mb-2">Delegation Graph</h1>
		<p class="text-muted-foreground text-sm">
			Visual map of conversation delegations and pending questions
		</p>
	</div>

	<!-- Controls -->
	<div class="absolute top-20 right-4 z-10 flex flex-col gap-1">
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

	<!-- Legend -->
	<div class="absolute top-20 left-4 z-10 bg-card/95 border border-border rounded-lg p-3">
		<h4 class="text-xs text-muted-foreground uppercase tracking-wider mb-2">Legend</h4>
		<div class="flex flex-col gap-1.5 text-xs">
			<div class="flex items-center gap-2">
				<div class="w-4 h-3 rounded-sm bg-card border-2 border-primary"></div>
				<span>Conversation</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-3 rounded-sm bg-purple-500/20 border-2 border-purple-500"></div>
				<span>Unanswered Question</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-4 h-3 rounded-sm bg-muted border-2 border-muted-foreground"></div>
				<span>Answered Question</span>
			</div>
			<div class="flex items-center gap-2 mt-1">
				<div class="w-6 h-0.5 bg-primary"></div>
				<span>Delegation</span>
			</div>
			<div class="flex items-center gap-2">
				<div class="w-6 h-0.5 bg-purple-500 border-dashed" style="border-top: 2px dashed"></div>
				<span>Question Link</span>
			</div>
		</div>
	</div>

	<!-- Graph Area -->
	<div class="flex-1 overflow-hidden relative" bind:this={containerElement}>
		{#if nodes.length === 0}
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="text-center text-muted-foreground">
					<Network class="h-16 w-16 mx-auto mb-4 opacity-50" />
					<h2 class="text-xl font-semibold text-foreground mb-2">No conversations to display</h2>
					<p class="text-sm">Open projects and create conversations to see the delegation graph</p>
				</div>
			</div>
		{:else}
			<svg bind:this={svgElement} class="w-full h-full" style="cursor: grab;">
				<defs>
					<marker
						id="arrow-delegation"
						markerWidth="10"
						markerHeight="7"
						refX="9"
						refY="3.5"
						orient="auto"
					>
						<polygon points="0 0, 10 3.5, 0 7" class="fill-primary" />
					</marker>
					<marker
						id="arrow-ask"
						markerWidth="10"
						markerHeight="7"
						refX="9"
						refY="3.5"
						orient="auto"
					>
						<polygon points="0 0, 10 3.5, 0 7" class="fill-purple-500" />
					</marker>
				</defs>

				<g {transform}>
					<!-- Links -->
					{#each links as link (`${typeof link.source === 'string' ? link.source : link.source.id}-${typeof link.target === 'string' ? link.target : link.target.id}`)}
						<path
							d={getLinkPath(link)}
							fill="none"
							class={link.type === 'delegation' ? 'stroke-primary' : 'stroke-purple-500'}
							stroke-width="2"
							stroke-dasharray={link.type === 'ask' ? '8, 4' : 'none'}
							marker-end={link.type === 'delegation' ? 'url(#arrow-delegation)' : 'url(#arrow-ask)'}
						/>
					{/each}

					<!-- Nodes -->
					{#each nodes as node (node.id)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<g
							transform="translate({getNodeX(node)}, {getNodeY(node)})"
							class="cursor-pointer"
							onclick={() => handleNodeClick(node)}
							onkeydown={(e) => e.key === 'Enter' && handleNodeClick(node)}
							role="button"
							tabindex="0"
						>
							{#if node.type === 'conversation'}
								<!-- Conversation Card -->
								<rect
									width={NODE_WIDTH}
									height={NODE_HEIGHT}
									rx="8"
									class="fill-card stroke-2"
									style="stroke: {node.statusLabel ? generateColorFromString(node.statusLabel) : 'hsl(var(--border))'}"
								/>

								<!-- Status indicator -->
								{#if node.statusLabel}
									<rect
										x="0"
										y="0"
										width="4"
										height={NODE_HEIGHT}
										rx="2"
										style="fill: {generateColorFromString(node.statusLabel)}"
									/>
								{/if}

								<!-- Title -->
								<foreignObject x="12" y="8" width={NODE_WIDTH - 24} height="24">
									<div class="text-sm font-medium text-foreground truncate">
										{node.title}
									</div>
								</foreignObject>

								<!-- Agent avatar and status -->
								<foreignObject x="12" y="36" width={NODE_WIDTH - 24} height="32">
									<div class="flex items-center gap-2">
										{#if node.agentPubkey}
											<User.Root ndk={ndk} pubkey={node.agentPubkey}>
												<User.Avatar class="w-6 h-6 rounded-full" />
											</User.Root>
										{/if}
										{#if node.statusLabel}
											<span
												class="text-xs px-2 py-0.5 rounded-full"
												style="background-color: {generateColorFromString(node.statusLabel).replace(')', ', 0.2)')}; color: {generateColorFromString(node.statusLabel)}"
											>
												{node.statusLabel}
											</span>
										{/if}
									</div>
								</foreignObject>

								<!-- Time -->
								<foreignObject x="12" y={NODE_HEIGHT - 24} width={NODE_WIDTH - 24} height="20">
									<div class="flex items-center gap-2 text-xs text-muted-foreground">
										<MessageSquare class="w-3 h-3" />
										<TimeAgo timestamp={node.latestReplyTime} />
									</div>
								</foreignObject>
							{:else}
								<!-- Ask Card -->
								<rect
									width={ASK_NODE_WIDTH}
									height={ASK_NODE_HEIGHT}
									rx="8"
									class={cn(
										'stroke-2',
										node.isAnswered
											? 'fill-muted stroke-muted-foreground'
											: 'fill-purple-500/10 stroke-purple-500'
									)}
								/>

								<!-- Pulsing indicator for unanswered -->
								{#if !node.isAnswered}
									<circle cx={ASK_NODE_WIDTH - 12} cy="12" r="4" class="fill-purple-500 animate-pulse" />
								{/if}

								<!-- Question icon -->
								<foreignObject x="12" y="12" width="20" height="20">
									<HelpCircle
										class={cn('w-5 h-5', node.isAnswered ? 'text-muted-foreground' : 'text-purple-500')}
									/>
								</foreignObject>

								<!-- Title -->
								<foreignObject x="36" y="12" width={ASK_NODE_WIDTH - 48} height="24">
									<div
										class={cn(
											'text-sm font-medium truncate',
											node.isAnswered ? 'text-muted-foreground' : 'text-purple-500'
										)}
									>
										{node.title}
									</div>
								</foreignObject>

								<!-- Status -->
								<foreignObject x="12" y={ASK_NODE_HEIGHT - 28} width={ASK_NODE_WIDTH - 24} height="20">
									<div class="text-xs text-muted-foreground">
										{node.isAnswered ? 'Answered' : 'Awaiting response'}
									</div>
								</foreignObject>
							{/if}
						</g>
					{/each}
				</g>
			</svg>

			<div class="absolute bottom-4 left-4 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded">
				Scroll to zoom &bull; Drag to pan &bull; Click to interact
			</div>
		{/if}
	</div>
</div>

<!-- Ask Question Modal -->
{#if askModalOpen && selectedAskEvent}
	{@const questions = parseAskQuestions(selectedAskEvent)}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50"
		onclick={() => (askModalOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (askModalOpen = false)}
		role="presentation"
	>
		<div
			class="relative w-full max-w-lg max-h-[90vh] bg-card rounded-lg shadow-xl flex flex-col overflow-hidden"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-border">
				<h2 class="text-lg font-semibold">Pending Question</h2>
				<button
					onclick={() => (askModalOpen = false)}
					class="text-muted-foreground hover:text-foreground"
					aria-label="Close"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6">
				{#if questions}
					<AskQuestionsBlock
						{questions}
						content={selectedAskEvent.content}
						askEvent={selectedAskEvent}
					/>
				{/if}
			</div>
		</div>
	</div>
{/if}
