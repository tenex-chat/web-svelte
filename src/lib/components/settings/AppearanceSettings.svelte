<script lang="ts">
	import { uiSettingsStore } from '$lib/stores/uiSettings.svelte';
	import { cn } from '$lib/utils/cn';

	const settings = $derived(uiSettingsStore.settings);

	const colorSchemes = [
		{ value: 'default', label: 'Default', class: 'bg-blue-500' },
		{ value: 'purple', label: 'Purple', class: 'bg-purple-500' },
		{ value: 'green', label: 'Green', class: 'bg-green-500' },
		{ value: 'orange', label: 'Orange', class: 'bg-orange-500' },
		{ value: 'pink', label: 'Pink', class: 'bg-pink-500' }
	];
</script>

<div class="space-y-6">
	<!-- Theme Section -->
	<div class="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Theme</h3>
		<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose your preferred color theme</p>

		<div class="grid grid-cols-3 gap-3">
			<button
				onclick={() => uiSettingsStore.setTheme('light')}
				class={cn(
					'p-4 border-2 rounded-lg transition-all text-gray-900 dark:text-gray-100',
					settings.theme === 'light'
						? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
						: 'border-gray-200 dark:border-zinc-600 hover:border-gray-300 dark:hover:border-gray-500'
				)}
			>
				<div class="flex flex-col items-center gap-2">
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
						/>
					</svg>
					<span class="text-sm font-medium">Light</span>
				</div>
			</button>

			<button
				onclick={() => uiSettingsStore.setTheme('dark')}
				class={cn(
					'p-4 border-2 rounded-lg transition-all text-gray-900 dark:text-gray-100',
					settings.theme === 'dark'
						? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
						: 'border-gray-200 dark:border-zinc-600 hover:border-gray-300 dark:hover:border-gray-500'
				)}
			>
				<div class="flex flex-col items-center gap-2">
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
						/>
					</svg>
					<span class="text-sm font-medium">Dark</span>
				</div>
			</button>

			<button
				onclick={() => uiSettingsStore.setTheme('system')}
				class={cn(
					'p-4 border-2 rounded-lg transition-all text-gray-900 dark:text-gray-100',
					settings.theme === 'system'
						? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
						: 'border-gray-200 dark:border-zinc-600 hover:border-gray-300 dark:hover:border-gray-500'
				)}
			>
				<div class="flex flex-col items-center gap-2">
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
						/>
					</svg>
					<span class="text-sm font-medium">System</span>
				</div>
			</button>
		</div>
	</div>

	<!-- Font Size Section -->
	<div class="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Font Size</h3>
		<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Adjust the base font size for better readability</p>

		<div class="grid grid-cols-3 gap-3">
			<button
				onclick={() => uiSettingsStore.setFontSize('small')}
				class={cn(
					'p-4 border-2 rounded-lg transition-all text-gray-900 dark:text-gray-100',
					settings.fontSize === 'small'
						? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
						: 'border-gray-200 dark:border-zinc-600 hover:border-gray-300 dark:hover:border-gray-500'
				)}
			>
				<div class="flex flex-col items-center gap-2">
					<span class="text-xs font-medium">Aa</span>
					<span class="text-sm">Small</span>
				</div>
			</button>

			<button
				onclick={() => uiSettingsStore.setFontSize('medium')}
				class={cn(
					'p-4 border-2 rounded-lg transition-all text-gray-900 dark:text-gray-100',
					settings.fontSize === 'medium'
						? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
						: 'border-gray-200 dark:border-zinc-600 hover:border-gray-300 dark:hover:border-gray-500'
				)}
			>
				<div class="flex flex-col items-center gap-2">
					<span class="text-sm font-medium">Aa</span>
					<span class="text-sm">Medium</span>
				</div>
			</button>

			<button
				onclick={() => uiSettingsStore.setFontSize('large')}
				class={cn(
					'p-4 border-2 rounded-lg transition-all text-gray-900 dark:text-gray-100',
					settings.fontSize === 'large'
						? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
						: 'border-gray-200 dark:border-zinc-600 hover:border-gray-300 dark:hover:border-gray-500'
				)}
			>
				<div class="flex flex-col items-center gap-2">
					<span class="text-base font-medium">Aa</span>
					<span class="text-sm">Large</span>
				</div>
			</button>
		</div>
	</div>

	<!-- Display Options Section -->
	<div class="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Display Options</h3>
		<div class="space-y-4">
			<!-- Compact Mode -->
			<div class="flex items-center justify-between">
				<div>
					<label for="compact-mode" class="text-sm font-medium text-gray-900 dark:text-gray-100">
						Compact Mode
					</label>
					<p class="text-xs text-gray-500 dark:text-gray-400">Reduce spacing for a denser layout</p>
				</div>
				<button
					id="compact-mode"
					onclick={() => uiSettingsStore.setCompactMode(!settings.compactMode)}
					class={cn(
						'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
						settings.compactMode ? 'bg-blue-600' : 'bg-gray-200 dark:bg-zinc-800'
					)}
					role="switch"
					aria-checked={settings.compactMode}
				>
					<span
						class={cn(
							'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
							settings.compactMode ? 'translate-x-6' : 'translate-x-1'
						)}
					/>
				</button>
			</div>

			<!-- Animations -->
			<div class="flex items-center justify-between">
				<div>
					<label for="animations" class="text-sm font-medium text-gray-900 dark:text-gray-100">
						Enable Animations
					</label>
					<p class="text-xs text-gray-500 dark:text-gray-400">Show smooth transitions and effects</p>
				</div>
				<button
					id="animations"
					onclick={() => uiSettingsStore.setAnimationsEnabled(!settings.animationsEnabled)}
					class={cn(
						'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
						settings.animationsEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-zinc-800'
					)}
					role="switch"
					aria-checked={settings.animationsEnabled}
				>
					<span
						class={cn(
							'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
							settings.animationsEnabled ? 'translate-x-6' : 'translate-x-1'
						)}
					/>
				</button>
			</div>
		</div>
	</div>

	<!-- Color Scheme Section -->
	<div class="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Color Scheme</h3>
		<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose an accent color for the interface</p>

		<div class="grid grid-cols-5 gap-3">
			{#each colorSchemes as scheme (scheme.value)}
				<button
					onclick={() => uiSettingsStore.setColorScheme(scheme.value)}
					class={cn(
						'p-4 border-2 rounded-lg transition-all text-gray-900 dark:text-gray-100',
						settings.colorScheme === scheme.value
							? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
							: 'border-gray-200 dark:border-zinc-600 hover:border-gray-300 dark:hover:border-gray-500'
					)}
				>
					<div class="flex flex-col items-center gap-2">
						<div class={cn('w-8 h-8 rounded-full', scheme.class)}></div>
						<span class="text-xs font-medium">{scheme.label}</span>
					</div>
				</button>
			{/each}
		</div>
	</div>
</div>
