/**
 * WordPress dependencies
 */
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

/**
 * Imports a file as a string when its path ends with `?raw`, as Vite does in
 * the tests. The skills are bundled this way.
 *
 * @param {import('webpack').Configuration} config The default config.
 * @return {import('webpack').Configuration} The config with the rule.
 */
const withRawImports = ( config ) => ( {
	...config,
	module: {
		...config.module,
		rules: [ { resourceQuery: /raw/, type: 'asset/source' }, ...config.module.rules ],
	},
} );

module.exports = Array.isArray( defaultConfig )
	? defaultConfig.map( withRawImports )
	: withRawImports( defaultConfig );
