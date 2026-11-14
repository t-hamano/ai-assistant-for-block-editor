import wpPlugin from '@wordpress/eslint-plugin';

export default [
	{
		ignores: [ 'build/**', 'vendor/**', 'node_modules/**' ],
	},
	...wpPlugin.configs.recommended,
];
