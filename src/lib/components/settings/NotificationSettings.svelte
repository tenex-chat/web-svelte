<script lang="ts">
	import { uiSettingsStore } from '$lib/stores/uiSettings.svelte';
	import { cn } from '$lib/utils/cn';

	const settings = $derived(uiSettingsStore.settings);
	const notifications = $derived(settings.notifications);

	function testNotification() {
		if ('Notification' in window) {
			if (Notification.permission === 'granted') {
				new Notification('TENEX', {
					body: 'This is a test notification',
					icon: '/favicon.png'
				});
			} else if (Notification.permission !== 'denied') {
				Notification.requestPermission().then((permission) => {
					if (permission === 'granted') {
						new Notification('TENEX', {
							body: 'This is a test notification',
							icon: '/favicon.png'
						});
					}
				});
			}
		}
	}

	function playTestSound() {
		const audio = new Audio('/notification.mp3');
		audio.play().catch((error) => {
			console.error('Failed to play test sound:', error);
		});
	}
</script>

<div class="space-y-6">
	<!-- Notification Types Section -->
	<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Notification Types</h3>
		<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose which notifications you want to receive</p>

		<div class="space-y-4">
			<!-- Project Updates -->
			<div class="flex items-center justify-between">
				<div>
					<label for="project-updates" class="text-sm font-medium text-gray-900 dark:text-gray-100">
						Project Updates
					</label>
					<p class="text-xs text-gray-500 dark:text-gray-400">Notifications about project changes and status</p>
				</div>
				<button
					id="project-updates"
					onclick={() =>
						uiSettingsStore.updateNotifications({
							projectUpdates: !notifications.projectUpdates
						})}
					class={cn(
						'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
						notifications.projectUpdates ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
					)}
					role="switch"
					aria-checked={notifications.projectUpdates}
				>
					<span
						class={cn(
							'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
							notifications.projectUpdates ? 'translate-x-6' : 'translate-x-1'
						)}
					/>
				</button>
			</div>

			<!-- Task Assignments -->
			<div class="flex items-center justify-between">
				<div>
					<label for="task-assignments" class="text-sm font-medium text-gray-900 dark:text-gray-100">
						Task Assignments
					</label>
					<p class="text-xs text-gray-500 dark:text-gray-400">When you are assigned to a task</p>
				</div>
				<button
					id="task-assignments"
					onclick={() =>
						uiSettingsStore.updateNotifications({
							taskAssignments: !notifications.taskAssignments
						})}
					class={cn(
						'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
						notifications.taskAssignments ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
					)}
					role="switch"
					aria-checked={notifications.taskAssignments}
				>
					<span
						class={cn(
							'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
							notifications.taskAssignments ? 'translate-x-6' : 'translate-x-1'
						)}
					/>
				</button>
			</div>

			<!-- Agent Responses -->
			<div class="flex items-center justify-between">
				<div>
					<label for="agent-responses" class="text-sm font-medium text-gray-900 dark:text-gray-100">
						Agent Responses
					</label>
					<p class="text-xs text-gray-500 dark:text-gray-400">When an agent completes a task or responds</p>
				</div>
				<button
					id="agent-responses"
					onclick={() =>
						uiSettingsStore.updateNotifications({
							agentResponses: !notifications.agentResponses
						})}
					class={cn(
						'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
						notifications.agentResponses ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
					)}
					role="switch"
					aria-checked={notifications.agentResponses}
				>
					<span
						class={cn(
							'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
							notifications.agentResponses ? 'translate-x-6' : 'translate-x-1'
						)}
					/>
				</button>
			</div>

			<!-- Thread Replies -->
			<div class="flex items-center justify-between">
				<div>
					<label for="thread-replies" class="text-sm font-medium text-gray-900 dark:text-gray-100">
						Thread Replies
					</label>
					<p class="text-xs text-gray-500 dark:text-gray-400">When someone replies to a thread you're in</p>
				</div>
				<button
					id="thread-replies"
					onclick={() =>
						uiSettingsStore.updateNotifications({ threadReplies: !notifications.threadReplies })}
					class={cn(
						'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
						notifications.threadReplies ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
					)}
					role="switch"
					aria-checked={notifications.threadReplies}
				>
					<span
						class={cn(
							'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
							notifications.threadReplies ? 'translate-x-6' : 'translate-x-1'
						)}
					/>
				</button>
			</div>

			<!-- Mentions -->
			<div class="flex items-center justify-between">
				<div>
					<label for="mentions" class="text-sm font-medium text-gray-900 dark:text-gray-100"> Mentions </label>
					<p class="text-xs text-gray-500 dark:text-gray-400">When someone mentions you</p>
				</div>
				<button
					id="mentions"
					onclick={() =>
						uiSettingsStore.updateNotifications({ mentions: !notifications.mentions })}
					class={cn(
						'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
						notifications.mentions ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
					)}
					role="switch"
					aria-checked={notifications.mentions}
				>
					<span
						class={cn(
							'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
							notifications.mentions ? 'translate-x-6' : 'translate-x-1'
						)}
					/>
				</button>
			</div>
		</div>
	</div>

	<!-- Sound Settings Section -->
	<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Sound Settings</h3>

		<div class="space-y-4">
			<!-- Sound Enabled -->
			<div class="flex items-center justify-between">
				<div>
					<label for="sound-enabled" class="text-sm font-medium text-gray-900 dark:text-gray-100">
						Sound Enabled
					</label>
					<p class="text-xs text-gray-500 dark:text-gray-400">Play sounds for notifications</p>
				</div>
				<button
					id="sound-enabled"
					onclick={() =>
						uiSettingsStore.updateNotifications({ soundEnabled: !notifications.soundEnabled })}
					class={cn(
						'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
						notifications.soundEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
					)}
					role="switch"
					aria-checked={notifications.soundEnabled}
				>
					<span
						class={cn(
							'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
							notifications.soundEnabled ? 'translate-x-6' : 'translate-x-1'
						)}
					/>
				</button>
			</div>

			<!-- Test Sound Button -->
			{#if notifications.soundEnabled}
				<button
					onclick={playTestSound}
					class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors text-sm font-medium"
				>
					Test Sound
				</button>
			{/if}
		</div>
	</div>

	<!-- Browser Notifications Section -->
	<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Browser Notifications</h3>
		<p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
			Receive browser notifications even when TENEX is not in focus
		</p>

		<button
			onclick={testNotification}
			class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
		>
			Test Notification
		</button>

		{#if 'Notification' in window && Notification.permission === 'denied'}
			<p class="text-xs text-red-600 mt-2">
				Browser notifications are blocked. Please enable them in your browser settings.
			</p>
		{/if}
	</div>
</div>
