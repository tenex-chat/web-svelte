<script lang="ts">
	import type { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
	import type { Message } from '$lib/utils/messageUtils';
	import { ndk } from '$lib/ndk.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import * as d3 from 'd3';
	import { GitFork, ZoomIn, ZoomOut, Maximize2, Loader2, ArrowLeft } from 'lucide-svelte';

	// Layout constants
	const NODE_WIDTH = 200;
	const NODE_HEIGHT = 80;
	const COLUMN_GAP = 60;
	const ROW_GAP = 20;
	const INITIAL_TRANSLATE_X = 50;
	const INITIAL_TRANSLATE_Y = 50;
	const ZOOM_MIN = 0.1;
	const ZOOM_MAX = 4;
	const CONTENT_MAX_LENGTH = 80;

	interface TreeNode {
		id: string;
		event: NDKEvent;
		children: TreeNode[];
		profile?: NDKUserProfile;
		isRoot: boolean;
		isCurrentUser: boolean;
	}

	interface LayoutNode {
		node: TreeNode;
		x: number;
		y: number;
	}

	interface LayoutLink {
		source: LayoutNode;
		target: LayoutNode;
	}

	interface Props {
		rootEvent: NDKEvent;
		messages: Message[];
		isLoading?: boolean;
		currentUserPubkey?: string;
		parentEvent?: NDKEvent | null;
		onNodeClick?: (event: NDKEvent) => void;
		onNavigateBack?: () => void;
	}

	let {
		rootEvent,
		messages,
		isLoading = false,
		currentUserPubkey = ndk.$currentUser?.pubkey,
		parentEvent = null,
		onNodeClick,
		onNavigateBack
	}: Props = $props();

	// DOM references
	let svgElement: SVGSVGElement | undefined = $state();
	let containerElement: HTMLDivElement | undefined = $state();

	// Layout state
	let layoutNodes = $state<LayoutNode[]>([]);
	let layoutLinks = $state<LayoutLink[]>([]);
	let transform = $state(`translate(${INITIAL_TRANSLATE_X}, ${INITIAL_TRANSLATE_Y})`);
	let zoomBehavior = $state<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

	// Profile cache - using SvelteMap for reactivity
	let profileCache = new SvelteMap<string, NDKUserProfile>();

	// Build tree from messages using conversation flow logic
	function buildTree(messages: Message[], rootId: string): TreeNode | null {
		if (messages.length === 0) return null;

		const sortedMessages = [...messages].sort(
			(a, b) => (a.event.created_at ?? 0) - (b.event.created_at ?? 0)
		);

		const nodeMap = new Map<string, TreeNode>();

		for (const message of sortedMessages) {
			nodeMap.set(message.id, {
				id: message.id,
				event: message.event,
				children: [],
				profile: profileCache.get(message.event.pubkey),
				isRoot: message.id === rootId,
				isCurrentUser: message.event.pubkey === currentUserPubkey
			});
		}

		const lastMessageByAuthor = new Map<string, string>();

		for (const message of sortedMessages) {
			if (message.id === rootId) {
				lastMessageByAuthor.set(message.event.pubkey, message.id);
				continue;
			}

			const parentId = findParentId(message, rootId, lastMessageByAuthor, nodeMap);
			if (parentId) {
				const parentNode = nodeMap.get(parentId);
				const childNode = nodeMap.get(message.id);
				if (parentNode && childNode) {
					parentNode.children.push(childNode);
				}
			}

			lastMessageByAuthor.set(message.event.pubkey, message.id);
		}

		return nodeMap.get(rootId) || null;
	}

	function findParentId(
		message: Message,
		rootId: string,
		lastMessageByAuthor: Map<string, string>,
		nodeMap: Map<string, TreeNode>
	): string | null {
		const event = message.event;
		const eTags = event.tags.filter((t) => t[0] === 'e');
		const pTags = event.tags.filter((t) => t[0] === 'p');

		const replyTag = eTags.find((t) => t[3] === 'reply');
		if (replyTag && nodeMap.has(replyTag[1])) {
			return replyTag[1];
		}

		if (pTags.length > 0) {
			const pTaggedPubkeys = pTags.map((t) => t[1]);
			for (const pubkey of pTaggedPubkeys) {
				const lastMsgId = lastMessageByAuthor.get(pubkey);
				if (lastMsgId && nodeMap.has(lastMsgId)) {
					return lastMsgId;
				}
			}
		}

		const messageTime = event.created_at ?? 0;
		let bestParent: string | null = null;
		let bestParentTime = -1;

		for (const [, lastMsgId] of lastMessageByAuthor) {
			const node = nodeMap.get(lastMsgId);
			if (node) {
				const nodeTime = node.event.created_at ?? 0;
				if (nodeTime < messageTime && nodeTime > bestParentTime) {
					bestParent = lastMsgId;
					bestParentTime = nodeTime;
				}
			}
		}

		if (bestParent) {
			return bestParent;
		}

		return rootId;
	}

	// Custom horizontal layout with vertical stacking for same-author chains
	function calculateLayout(root: TreeNode): { nodes: LayoutNode[]; links: LayoutLink[] } {
		const nodes: LayoutNode[] = [];
		const links: LayoutLink[] = [];
		const nodePositions = new Map<string, LayoutNode>();

		function layoutColumn(
			children: TreeNode[],
			parentLayoutNode: LayoutNode | null,
			columnX: number
		): number {
			if (children.length === 0) return 0;

			// Group consecutive children by author for vertical stacking
			const groups: TreeNode[][] = [];
			let currentGroup: TreeNode[] = [];
			let currentAuthor: string | null = null;

			for (const child of children) {
				if (child.event.pubkey === currentAuthor) {
					currentGroup.push(child);
				} else {
					if (currentGroup.length > 0) {
						groups.push(currentGroup);
					}
					currentGroup = [child];
					currentAuthor = child.event.pubkey;
				}
			}
			if (currentGroup.length > 0) {
				groups.push(currentGroup);
			}

			let currentY = parentLayoutNode ? parentLayoutNode.y : 0;
			let maxDescendantHeight = 0;

			for (const group of groups) {
				const groupStartY = currentY;

				for (let i = 0; i < group.length; i++) {
					const child = group[i];
					const layoutNode: LayoutNode = {
						node: child,
						x: columnX,
						y: currentY
					};
					nodes.push(layoutNode);
					nodePositions.set(child.id, layoutNode);

					// Link to parent or previous in chain
					if (i === 0 && parentLayoutNode) {
						links.push({ source: parentLayoutNode, target: layoutNode });
					} else if (i > 0) {
						const prevNode = nodePositions.get(group[i - 1].id);
						if (prevNode) {
							links.push({ source: prevNode, target: layoutNode });
						}
					}

					// Process this node's children recursively
					const descendantHeight = layoutColumn(
						child.children,
						layoutNode,
						columnX + NODE_WIDTH + COLUMN_GAP
					);

					// Move to next row position
					const nodeHeight = Math.max(NODE_HEIGHT + ROW_GAP, descendantHeight);
					currentY += nodeHeight;
				}

				maxDescendantHeight = Math.max(maxDescendantHeight, currentY - groupStartY);
			}

			return currentY - (parentLayoutNode ? parentLayoutNode.y : 0);
		}

		// Layout root
		const rootLayoutNode: LayoutNode = {
			node: root,
			x: 0,
			y: 0
		};
		nodes.push(rootLayoutNode);
		nodePositions.set(root.id, rootLayoutNode);

		// Layout children
		layoutColumn(root.children, rootLayoutNode, NODE_WIDTH + COLUMN_GAP);

		return { nodes, links };
	}

	async function fetchProfiles(pubkeys: string[]): Promise<void> {
		const uniquePubkeys = [...new Set(pubkeys)].filter((pk) => !profileCache.has(pk));
		if (uniquePubkeys.length === 0) return;

		try {
			const users = await Promise.all(
				uniquePubkeys.map((pk) => ndk.getUser({ pubkey: pk }).fetchProfile())
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

	$effect(() => {
		if (messages.length > 0) {
			const pubkeys = messages.map((m) => m.event.pubkey);
			fetchProfiles(pubkeys);
		}
	});

	const tree = $derived.by(() => {
		if (messages.length === 0) return null;
		return buildTree(messages, rootEvent.id);
	});

	$effect(() => {
		if (!tree) {
			layoutNodes = [];
			layoutLinks = [];
			return;
		}

		const layout = calculateLayout(tree);
		layoutNodes = layout.nodes;
		layoutLinks = layout.links;
	});

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

	function linkPath(link: LayoutLink): string {
		const sx = link.source.x + NODE_WIDTH;
		const sy = link.source.y + NODE_HEIGHT / 2;
		const tx = link.target.x;
		const ty = link.target.y + NODE_HEIGHT / 2;

		// If same column (vertical chain), draw straight line
		if (link.source.x === link.target.x) {
			return `M ${link.source.x + NODE_WIDTH / 2} ${link.source.y + NODE_HEIGHT}
			        L ${link.target.x + NODE_WIDTH / 2} ${link.target.y}`;
		}

		// Horizontal link with curve
		const midX = (sx + tx) / 2;
		return `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`;
	}

	function getDisplayName(node: TreeNode): string {
		if (node.profile?.name) return node.profile.name;
		if (node.profile?.displayName) return node.profile.displayName;
		return node.event.pubkey.substring(0, 12) + '...';
	}

	function truncateContent(content: string): string {
		const cleaned = content.replace(/\n/g, ' ').trim();
		if (cleaned.length <= CONTENT_MAX_LENGTH) return cleaned;
		return cleaned.substring(0, CONTENT_MAX_LENGTH) + '...';
	}

	function getNodeClass(node: TreeNode): string {
		if (node.isRoot) return 'fill-primary/10 stroke-primary';
		if (node.isCurrentUser) return 'fill-accent/20 stroke-accent';
		return 'fill-card stroke-border';
	}

	function handleNodeClick(node: TreeNode) {
		onNodeClick?.(node.event);
	}
</script>

<div class="flex flex-col h-full bg-background overflow-hidden">
	<!-- Controls -->
	<div class="absolute top-14 right-4 z-10 flex flex-col gap-1">
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

	<!-- Main Content Area -->
	<div class="flex-1 overflow-hidden relative" bind:this={containerElement}>
		{#if isLoading}
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="text-center text-muted-foreground">
					<Loader2 class="h-8 w-8 mx-auto mb-2 animate-spin" />
					<p class="text-sm">Loading conversation tree...</p>
				</div>
			</div>
		{:else if !tree || layoutNodes.length === 0}
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="text-center text-muted-foreground">
					<GitFork class="h-12 w-12 mx-auto mb-3 opacity-50" />
					<p class="text-sm font-medium">No conversation tree to display</p>
					<p class="text-xs mt-1">Start a conversation to see the delegation structure</p>
				</div>
			</div>
		{:else}
			<svg
				bind:this={svgElement}
				class="w-full h-full"
				style="cursor: grab;"
				role="tree"
				aria-label="Conversation delegation tree"
			>
				<g {transform}>
					<!-- Links -->
					{#each layoutLinks as link (link.source.node.id + '-' + link.target.node.id)}
						<path
							class="fill-none stroke-muted-foreground/40"
							stroke-width="2"
							d={linkPath(link)}
						/>
					{/each}

					<!-- Nodes -->
					{#each layoutNodes as layoutNode (layoutNode.node.id)}
						<g
							transform="translate({layoutNode.x}, {layoutNode.y})"
							class="cursor-pointer"
							onclick={() => handleNodeClick(layoutNode.node)}
							onkeydown={(e) => e.key === 'Enter' && handleNodeClick(layoutNode.node)}
							role="treeitem"
							tabindex="0"
							aria-selected="false"
							aria-label="{getDisplayName(layoutNode.node)}: {truncateContent(layoutNode.node.event.content)}"
						>
							<rect
								width={NODE_WIDTH}
								height={NODE_HEIGHT}
								rx="8"
								class="{getNodeClass(layoutNode.node)} transition-colors hover:brightness-95"
								stroke-width={layoutNode.node.isRoot ? 2 : 1}
							/>

							{#if layoutNode.node.isRoot}
								<rect x="0" y="0" width={NODE_WIDTH} height="18" rx="8" class="fill-primary" />
								<rect x="0" y="10" width={NODE_WIDTH} height="8" class="fill-primary" />
								<text
									x={NODE_WIDTH / 2}
									y="13"
									text-anchor="middle"
									class="text-[10px] fill-primary-foreground font-semibold"
								>
									ROOT
								</text>
							{/if}

							<text
								x="10"
								y={layoutNode.node.isRoot ? 34 : 18}
								class="text-xs fill-foreground font-medium"
							>
								{getDisplayName(layoutNode.node)}
							</text>

							<foreignObject
								x="10"
								y={layoutNode.node.isRoot ? 38 : 22}
								width={NODE_WIDTH - 20}
								height="44"
							>
								<div class="text-[11px] text-muted-foreground line-clamp-2 overflow-hidden leading-tight">
									{truncateContent(layoutNode.node.event.content)}
								</div>
							</foreignObject>

							{#if layoutNode.node.isCurrentUser && !layoutNode.node.isRoot}
								<circle
									cx={NODE_WIDTH - 10}
									cy="10"
									r="5"
									class="fill-accent stroke-background"
									stroke-width="2"
								/>
							{/if}
						</g>
					{/each}
				</g>
			</svg>

			<div class="absolute bottom-4 left-4 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded">
				Scroll to zoom &bull; Drag to pan &bull; Click node to view
			</div>
		{/if}
	</div>
</div>
