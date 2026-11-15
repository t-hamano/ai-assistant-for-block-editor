declare module '*.scss';

declare module '*?raw' {
	const content: string;
	export default content;
}

// The block library publishes no types for its entry point.
declare module '@wordpress/block-library' {
	export function registerCoreBlocks(): void;
}
