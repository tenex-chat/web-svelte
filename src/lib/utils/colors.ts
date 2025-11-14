/**
 * Generate a deterministic HSL color based on a string
 * @param str The string to generate color from
 * @param saturation HSL saturation percentage (default: 65)
 * @param lightness HSL lightness percentage (default: 55)
 * @returns An HSL color string
 */
export function generateColorFromString(
	str: string,
	saturation: number = 65,
	lightness: number = 55
): string {
	if (!str) return `hsl(220, ${saturation}%, ${lightness}%)`;

	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}

	const hue = Math.abs(hash) % 360;

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Generate a deterministic HSL color based on a string (agent-specific alias)
 * @deprecated Use generateColorFromString instead
 * @param str The string to generate color from (agent name or ID)
 * @returns An HSL color string
 */
export function generateAgentColor(str: string): string {
	return generateColorFromString(str);
}

/**
 * Generate a linear gradient from an HSL color string
 * @param hsl The HSL color string (e.g., "hsl(220, 65%, 55%)")
 * @returns A CSS linear-gradient string with two stops + transparent
 */
export function generateLinearGradientFromHsl(hsl: string): string {
	if (!hsl) return '';

	// Extract hue from HSL string (format: "hsl(220, 65%, 55%)")
	const hueMatch = hsl.match(/hsl\((\d+)/);
	if (!hueMatch) return '';

	const hue = hueMatch[1];

	// Create gradient with two color stops
	const topColor = `hsl(${hue}, 75%, 65%, 0.15)`;
	const midColor = `hsl(${hue}, 65%, 55%, 0.03)`;

	return `linear-gradient(to bottom, ${topColor}, ${midColor} 50%, transparent 70%)`;
}

/**
 * Generate a deterministic gradient background based on a string
 * @param str The string to generate gradient from
 * @returns A CSS linear-gradient string
 */
export function generateGradientFromString(str: string): string {
	const hsl = generateColorFromString(str);
	return generateLinearGradientFromHsl(hsl);
}
