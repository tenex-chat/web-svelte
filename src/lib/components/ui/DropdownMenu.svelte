<script lang="ts" module>
	export interface DropdownMenuItem {
		label: string;
		icon?: string;
		onClick?: () => void;
		href?: string;
		separator?: boolean;
		submenu?: DropdownMenuItem[];
	}
</script>

<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		items: DropdownMenuItem[];
		align?: 'start' | 'end';
		side?: 'top' | 'right' | 'bottom' | 'left';
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		trigger?: any;
		children?: any;
	}

	let {
		items,
		align = 'end',
		side = 'bottom',
		open = $bindable(false),
		onOpenChange,
		trigger,
		children
	}: Props = $props();

	let triggerRef: HTMLButtonElement | null = $state(null);
	let menuRef: HTMLDivElement | null = $state(null);
	let openSubmenuIndex = $state<number | null>(null);

	function handleTriggerClick() {
		open = !open;
		onOpenChange?.(open);
	}

	function handleClickOutside(event: MouseEvent) {
		if (
			open &&
			triggerRef &&
			menuRef &&
			!triggerRef.contains(event.target as Node) &&
			!menuRef.contains(event.target as Node)
		) {
			open = false;
			onOpenChange?.(false);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			open = false;
			onOpenChange?.(false);
			triggerRef?.focus();
		}
	}

	function handleItemClick(item: DropdownMenuItem) {
		if (item.onClick) {
			item.onClick();
			open = false;
			onOpenChange?.(false);
		}
		if (item.href) {
			open = false;
			onOpenChange?.(false);
		}
	}

	$effect(() => {
		if (open) {
			document.addEventListener('mousedown', handleClickOutside);
			document.addEventListener('keydown', handleKeydown);
		}
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	const alignClasses = {
		start: 'left-0',
		end: 'right-0'
	};

	const sideClasses = {
		top: 'bottom-full mb-2',
		right: 'left-full ml-2 top-0',
		bottom: 'top-full mt-2',
		left: 'right-full mr-2 top-0'
	};
</script>

<div class="relative inline-block">
	<button
		bind:this={triggerRef}
		onclick={handleTriggerClick}
		type="button"
		class="inline-flex items-center"
	>
		{#if trigger}
			{@render trigger()}
		{:else}
			{@render children?.()}
		{/if}
	</button>

	{#if open}
		<div
			bind:this={menuRef}
			class={cn(
				'absolute z-50 min-w-[12rem] overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 shadow-lg',
				sideClasses[side],
				alignClasses[align]
			)}
		>
			{#each items as item, index (index)}
				{#if item.separator}
					<div class="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
				{:else if item.submenu}
					<div
						class="relative"
						onmouseenter={() => (openSubmenuIndex = index)}
						onmouseleave={() => (openSubmenuIndex = null)}
					>
						<button
							class="flex items-center w-full px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
							type="button"
						>
							{#if item.icon}
								<span class="mr-2">{item.icon}</span>
							{/if}
							<span class="flex-1 text-left">{item.label}</span>
							<svg
								class="w-4 h-4 ml-2"
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
						</button>

						{#if openSubmenuIndex === index}
							<div
								class="absolute left-full top-0 ml-1 min-w-[12rem] overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 shadow-lg"
							>
								{#each item.submenu as subitem, subindex (subindex)}
									{#if subitem.separator}
										<div class="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
									{:else if subitem.href}
										<a
											href={subitem.href}
											onclick={() => handleItemClick(subitem)}
											class="flex items-center w-full px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
										>
											{#if subitem.icon}
												<span class="mr-2">{subitem.icon}</span>
											{/if}
											<span>{subitem.label}</span>
										</a>
									{:else}
										<button
											onclick={() => handleItemClick(subitem)}
											class="flex items-center w-full px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
											type="button"
										>
											{#if subitem.icon}
												<span class="mr-2">{subitem.icon}</span>
											{/if}
											<span>{subitem.label}</span>
										</button>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				{:else if item.href}
					<a
						href={item.href}
						onclick={() => handleItemClick(item)}
						class="flex items-center w-full px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
					>
						{#if item.icon}
							<span class="mr-2">{item.icon}</span>
						{/if}
						<span>{item.label}</span>
					</a>
				{:else}
					<button
						onclick={() => handleItemClick(item)}
						class="flex items-center w-full px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						type="button"
					>
						{#if item.icon}
							<span class="mr-2">{item.icon}</span>
						{/if}
						<span>{item.label}</span>
					</button>
				{/if}
			{/each}
		</div>
	{/if}
</div>
