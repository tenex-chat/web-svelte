<script lang="ts">
	import { type VariantProps, tv } from "tailwind-variants";
	import type { Button as ButtonPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	type $$Props = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;
	type $$Events = ButtonPrimitive.Events;

	let className: $$Props["class"] = undefined;
	export { className as class };
	export let variant: $$Props["variant"] = "default";
	export let size: $$Props["size"] = "default";
</script>

<ButtonPrimitive.Root
	class={cn(buttonVariants({ variant, size, class: className }))}
	{...$$restProps}
	on:click
	on:keydown
>
	<slot />
</ButtonPrimitive.Root>
