/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { getBlockTypes, store as blocksStore, type BlockType } from '@wordpress/blocks';
import { select } from '@wordpress/data';

type Supports = Record< string, unknown >;

type AttributeSchema = {
	type?: string | string[];
	enum?: unknown[];
	default?: unknown;
	source?: string;
	selector?: string;
	attribute?: string;
	role?: string;
};

/**
 * A registered block, as the model needs to know it.
 */
export type SiteBlock = {
	name: string;
	title: string;
	description?: string;
	parent?: string[];
	ancestor?: string[];
	allowedBlocks?: string[];
	attributes: Record< string, AttributeSchema >;
	supports: Supports;
	styles: string[];
};

/**
 * A preset of the theme, such as a color or a font size.
 */
export type Preset = {
	slug: string;
	name?: string;
	value?: string;
};

/**
 * The theme's presets, and what it allows beyond them.
 */
export type ThemeSettings = {
	colors: Preset[];
	gradients: Preset[];
	fontSizes: Preset[];
	fontFamilies: Preset[];
	spacingSizes: Preset[];
	shadows: Preset[];
	customColor: boolean;
	customGradient: boolean;
	customFontSize: boolean;
	customSpacingSize: boolean;
};

/**
 * What the site offers for writing blocks: its blocks, the theme's
 * presets, and what the theme allows beyond them, for all blocks and for
 * the blocks the theme sets on their own.
 */
export type SiteInfo = ThemeSettings & {
	blocks: SiteBlock[];
	/**
	 * The settings of blocks that differ from the settings for all blocks,
	 * with only the ones that differ.
	 */
	blockSettings: ( Partial< ThemeSettings > & { name: string } )[];
	contentSize?: string;
	wideSize?: string;
};

/**
 * The supports that change what a block can save, and so what the model
 * may write. Supports for the editor only, such as `html` or `inserter`,
 * are left out.
 */
const STYLE_SUPPORTS = [
	'align',
	'background',
	'border',
	'color',
	'dimensions',
	'filter',
	'layout',
	'position',
	'shadow',
	'spacing',
	'typography',
];

/**
 * Attributes that supports add to every block that has them. The supports
 * of the block describe them, so they are not listed again.
 */
const SUPPORT_ATTRIBUTES = new Set( [
	'align',
	'allowedBlocks',
	'anchor',
	'ariaLabel',
	'backgroundColor',
	'borderColor',
	'className',
	'fitText',
	'fontFamily',
	'fontSize',
	'gradient',
	'layout',
	'lock',
	'metadata',
	'shadow',
	'style',
	'textColor',
	'textShadow',
] );

/**
 * The name of a support or a feature without the `__experimental` prefix,
 * as the model knows it from `block.json` and `theme.json`.
 *
 * @param key The name.
 * @return The name without the prefix.
 */
function plainName( key: string ): string {
	const name = key.replace( /^__experimental/, '' );
	return name.charAt( 0 ).toLowerCase() + name.slice( 1 );
}

/**
 * Describes one support, such as `spacing: margin (top, bottom), padding`.
 *
 * @param key   The support.
 * @param value Its value in `supports`.
 * @return The description, or `null` when the block does not have it.
 */
function describeSupport( key: string, value: unknown ): string | null {
	if ( ! value ) {
		return null;
	}
	if ( Array.isArray( value ) ) {
		return value.length ? `${ key } (${ value.join( ', ' ) })` : null;
	}
	if ( typeof value !== 'object' ) {
		return key;
	}
	const features = { ...( value as Supports ) };
	// The text and background colors are on unless they are turned off.
	if ( key === 'color' ) {
		features.text ??= true;
		features.background ??= true;
	}
	const parts = Object.entries( features )
		.filter( ( [ feature ] ) => ! feature.startsWith( '__experimentalDefault' ) )
		.filter( ( [ feature ] ) => ! feature.startsWith( '__experimentalSkip' ) )
		.filter( ( [ feature ] ) => ! feature.startsWith( '__unstable' ) )
		.map( ( [ feature, enabled ] ) => {
			if ( ! enabled || typeof enabled === 'object' ) {
				return Array.isArray( enabled ) && enabled.length
					? `${ plainName( feature ) } (${ enabled.join( ', ' ) })`
					: null;
			}
			return plainName( feature );
		} )
		.filter( Boolean );
	if ( ! parts.length ) {
		// Colors with every kind turned off are no colors at all.
		return key === 'color' ? null : key;
	}
	return `${ key }: ${ parts.join( ', ' ) }`;
}

/**
 * Describes the supports of a block in one line.
 *
 * @param supports The block's supports.
 * @return The description, or an empty string when it has none of them.
 */
export function describeSupports( supports: Supports ): string {
	const entries = Object.entries( supports ).map(
		( [ key, value ] ) => [ plainName( key ), value ] as const
	);
	return STYLE_SUPPORTS.flatMap( ( key ) => {
		const entry = entries.find( ( [ name ] ) => name === key );
		const description = entry && describeSupport( key, entry[ 1 ] );
		return description ? [ description ] : [];
	} ).join( '; ' );
}

/**
 * Describes an attribute the way the block reference does.
 *
 * @param name   The attribute.
 * @param schema Its schema.
 * @return The line.
 */
function describeAttribute( name: string, schema: AttributeSchema ): string {
	const parts: string[] = [];
	if ( schema.type ) {
		parts.push( ( [] as string[] ).concat( schema.type ).join( ' | ' ) );
	}
	if ( schema.source ) {
		const where = schema.selector ? ` \`${ schema.selector }\`` : '';
		const what = schema.attribute ? ` \`${ schema.attribute }\`` : '';
		parts.push( `in the HTML${ where }${ what }, not in the JSON` );
	}
	if ( Array.isArray( schema.enum ) ) {
		parts.push(
			`one of ${ schema.enum.map( ( value ) => `\`${ JSON.stringify( value ) }\`` ).join( ', ' ) }`
		);
	}
	if ( schema.default !== undefined ) {
		parts.push( `default \`${ JSON.stringify( schema.default ) }\`` );
	}
	return `  - \`${ name }\`: ${ parts.join( '; ' ) }`;
}

/**
 * Lists block names in a sentence.
 *
 * @param names The names.
 * @return The list.
 */
function listNames( names: string[] ): string {
	return names.map( ( name ) => `\`${ name }\`` ).join( ', ' );
}

/**
 * Describes a block from a plugin: its supports, block styles, attributes,
 * and where it can go.
 *
 * @param block The block.
 * @return The lines.
 */
function describeBlock( block: SiteBlock ): string[] {
	const head = `- \`${ block.name }\` (${ block.title })`;
	const details = [
		describeSupports( block.supports ),
		block.styles.length ? `styles: ${ block.styles.join( ', ' ) }` : '',
	].filter( Boolean );
	const lines = [ details.length ? `${ head }: ${ details.join( '; ' ) }` : head ];
	if ( block.description ) {
		lines.push( `  ${ block.description }` );
	}
	if ( block.parent?.length ) {
		lines.push( `  Only directly inside ${ listNames( block.parent ) }.` );
	}
	if ( block.ancestor?.length ) {
		lines.push( `  Only somewhere inside ${ listNames( block.ancestor ) }.` );
	}
	if ( block.allowedBlocks?.length ) {
		lines.push( `  Takes only ${ listNames( block.allowedBlocks ) } as inner blocks.` );
	}
	const attributes = Object.entries( block.attributes ).filter(
		( [ name, schema ] ) => ! SUPPORT_ATTRIBUTES.has( name ) && schema.role !== 'local'
	);
	if ( attributes.length ) {
		lines.push( '  Attributes:' );
		for ( const [ name, schema ] of attributes ) {
			lines.push( describeAttribute( name, schema ) );
		}
	}
	return lines;
}

/**
 * Describes the blocks of the site. Core blocks are known to the model and
 * the same on every site, so they are listed by name, with the block
 * styles that the site gives them. Blocks from plugins get their details.
 *
 * @param blocks The blocks.
 * @return The lines.
 */
function describeBlocks( blocks: SiteBlock[] ): string[] {
	const core = blocks.filter( ( block ) => block.name.startsWith( 'core/' ) );
	const others = blocks.filter( ( block ) => ! block.name.startsWith( 'core/' ) );
	const styled = core.filter( ( block ) => block.styles.length );
	const lines: string[] = [];
	if ( core.length ) {
		lines.push( `Core blocks: ${ core.map( ( block ) => block.name.slice( 5 ) ).join( ', ' ) }.` );
	}
	if ( styled.length ) {
		lines.push(
			'',
			'Block styles of core blocks, for `className` as `is-style-<name>`:',
			...styled.map( ( block ) => `- \`${ block.name }\`: ${ block.styles.join( ', ' ) }` )
		);
	}
	if ( others.length ) {
		lines.push(
			'',
			'Blocks from plugins, with the supports and block styles each one has. A block can use only the supports listed for it: its color, typography, spacing, and other style attributes come from them.',
			...others.flatMap( describeBlock )
		);
	}
	return lines;
}

/**
 * Lists presets, one per line.
 *
 * @param title   What they are, and how blocks use them.
 * @param presets The presets.
 * @return The lines, or none when there are no presets.
 */
function describePresets( title: string, presets: Preset[] ): string[] {
	if ( ! presets.length ) {
		return [];
	}
	return [
		'',
		title,
		...presets.map( ( { slug, name, value } ) => {
			const label = [ name, value && `\`${ value }\`` ].filter( Boolean ).join( ', ' );
			return label ? `- \`${ slug }\`: ${ label }` : `- \`${ slug }\``;
		} ),
	];
}

/**
 * Describes the presets and the custom value settings. Settings that are
 * left out are not described.
 *
 * @param settings The settings.
 * @return The lines.
 */
function describeThemeSettings( settings: Partial< ThemeSettings > ): string[] {
	const allowed = ( value: boolean ) => ( value ? 'allowed' : 'not allowed' );
	const presets = (
		title: string,
		list: Preset[] | undefined,
		empty = list !== undefined
	): string[] => {
		if ( list?.length ) {
			return describePresets( title, list );
		}
		return empty ? [ '', `${ title } none` ] : [];
	};
	const flags = (
		[
			[ 'Custom colors', settings.customColor ],
			[ 'Custom gradients', settings.customGradient ],
			[ 'Custom font sizes', settings.customFontSize ],
			[ 'Custom spacing sizes', settings.customSpacingSize ],
		] as const
	 )
		.filter( ( [ , value ] ) => value !== undefined )
		.map( ( [ label, value ] ) => `- ${ label }: ${ allowed( value as boolean ) }` );
	return [
		...presets(
			`Colors, for \`textColor\`, \`backgroundColor\`, and \`borderColor\`, and \`var:preset|color|<slug>\` in \`style\`:`,
			settings.colors
		),
		...presets( `Gradients, for \`gradient\`:`, settings.gradients ),
		...presets( `Font sizes, for \`fontSize\`:`, settings.fontSizes ),
		...presets( `Font families, for \`fontFamily\`:`, settings.fontFamilies ),
		...presets(
			`Spacing sizes, for \`var:preset|spacing|<slug>\` in \`style.spacing\`:`,
			settings.spacingSizes
		),
		...presets(
			`Shadows, for \`var:preset|shadow|<slug>\` in \`style.shadow\`:`,
			settings.shadows
		),
		...( flags.length ? [ '', ...flags ] : [] ),
	];
}

/**
 * Writes the site information for the model.
 *
 * @param info The site information.
 * @return The text.
 */
export function formatSiteInfo( info: SiteInfo ): string {
	const { blocks, blockSettings, contentSize, wideSize, ...global } = info;
	const layout = [
		contentSize && `content width \`${ contentSize }\``,
		wideSize && `wide width \`${ wideSize }\``,
	].filter( Boolean );
	const lines = [
		'## Blocks',
		'',
		...describeBlocks( blocks ),
		'',
		'## Theme settings',
		...describeThemeSettings( global ),
		...( layout.length ? [ `- Layout: ${ layout.join( ', ' ) }` ] : [] ),
	];
	if ( blockSettings.length ) {
		lines.push(
			'',
			'## Block settings',
			'',
			'The theme sets these blocks on their own. For them, these settings replace the ones above.'
		);
		for ( const { name, ...settings } of blockSettings ) {
			lines.push( '', `### ${ name }`, ...describeThemeSettings( settings ) );
		}
	}
	return lines.join( '\n' );
}

/**
 * Writes the value of a preset. A number is a size in pixels, as the
 * editor reads font sizes.
 *
 * @param value The value.
 * @return The value as text, or `undefined` when it is not one.
 */
function describeValue( value: unknown ): string | undefined {
	if ( typeof value === 'number' && Number.isFinite( value ) ) {
		return `${ value }px`;
	}
	return typeof value === 'string' ? value : undefined;
}

/**
 * Reads the presets of one kind from the theme's settings. They are kept
 * by origin: the theme's own, the ones the user added, and WordPress's
 * defaults, which the theme can turn off.
 *
 * @param value       The presets, by origin or as one list.
 * @param withDefault Whether the default presets are offered.
 * @param read        Reads the value of a preset.
 * @return The presets.
 */
function readPresets(
	value: unknown,
	withDefault: boolean,
	read: ( preset: Record< string, unknown > ) => unknown
): Preset[] {
	if ( ! value || typeof value !== 'object' ) {
		return [];
	}
	const byOrigin = value as Record< string, unknown >;
	const lists = Array.isArray( value )
		? [ value ]
		: [ withDefault ? byOrigin.default : undefined, byOrigin.theme, byOrigin.custom ];
	const presets = new Map< string, Preset >();
	for ( const list of lists ) {
		if ( ! Array.isArray( list ) ) {
			continue;
		}
		for ( const preset of list as Record< string, unknown >[] ) {
			if ( typeof preset?.slug !== 'string' ) {
				continue;
			}
			const presetValue = read( preset );
			presets.set( preset.slug, {
				slug: preset.slug,
				name: typeof preset.name === 'string' ? preset.name : undefined,
				value: describeValue( presetValue ),
			} );
		}
	}
	return [ ...presets.values() ];
}

/**
 * Reads a value in nested settings.
 *
 * @param settings The settings.
 * @param path     The keys to the value.
 * @return The value.
 */
function get( settings: unknown, path: string ): unknown {
	return path
		.split( '.' )
		.reduce< unknown >(
			( value, key ) =>
				value && typeof value === 'object'
					? ( value as Record< string, unknown > )[ key ]
					: undefined,
			settings
		);
}

/**
 * Collects the site information from the editor: the registered blocks
 * that users can insert, and the theme's presets and settings from
 * `theme.json`.
 *
 * @return The site information.
 */
export function collectSiteInfo(): SiteInfo {
	const { getBlockStyles } = select( blocksStore );
	const blocks = ( getBlockTypes() as BlockType[] )
		.filter( ( blockType ) => blockType.supports?.inserter !== false )
		.map( ( blockType ) => {
			const { name, title, description, parent, ancestor, allowedBlocks } =
				blockType as BlockType & {
					description?: string;
					parent?: string[];
					ancestor?: string[];
					allowedBlocks?: string[];
				};
			const styles = ( getBlockStyles( name ) ?? [] ) as { name: string }[];
			return {
				name,
				title,
				description,
				parent,
				ancestor,
				allowedBlocks,
				attributes: ( blockType.attributes ?? {} ) as Record< string, AttributeSchema >,
				supports: ( blockType.supports ?? {} ) as Supports,
				styles: styles.map( ( style ) => style.name ),
			};
		} )
		.sort( ( a, b ) => a.name.localeCompare( b.name ) );

	const editorSettings = select( blockEditorStore ).getSettings() as Record< string, unknown >;
	const features = editorSettings.__experimentalFeatures;
	const global = readThemeSettings( ( path ) => get( features, path ), editorSettings );

	const allowedBlockTypes = editorSettings.allowedBlockTypes;
	const allowed = blocks.filter( ( block ) =>
		Array.isArray( allowedBlockTypes ) ? allowedBlockTypes.includes( block.name ) : true
	);

	const perBlock = get( features, 'blocks' );
	const blockSettings =
		perBlock && typeof perBlock === 'object'
			? Object.keys( perBlock )
					.filter( ( name ) => allowed.some( ( block ) => block.name === name ) )
					.sort()
					.map( ( name ) => {
						const settings = readThemeSettings(
							( path ) => get( perBlock, `${ name }.${ path }` ) ?? get( features, path ),
							editorSettings
						);
						const changed = ( Object.keys( settings ) as ( keyof ThemeSettings )[] ).filter(
							( key ) => JSON.stringify( settings[ key ] ) !== JSON.stringify( global[ key ] )
						);
						return {
							name,
							...Object.fromEntries( changed.map( ( key ) => [ key, settings[ key ] ] ) ),
						};
					} )
					.filter( ( settings ) => Object.keys( settings ).length > 1 )
			: [];

	return {
		blocks: allowedBlockTypes === false ? [] : allowed,
		...global,
		blockSettings,
		contentSize: ( get( features, 'layout.contentSize' ) as string | undefined ) ?? undefined,
		wideSize: ( get( features, 'layout.wideSize' ) as string | undefined ) ?? undefined,
	};
}

/**
 * Reads the presets and the custom value settings.
 *
 * @param setting        Reads a setting by its path in `theme.json`.
 * @param editorSettings The editor settings, for the older settings.
 * @return The settings.
 */
function readThemeSettings(
	setting: ( path: string ) => unknown,
	editorSettings: Record< string, unknown >
): ThemeSettings {
	const isOn = ( path: string ) => setting( path ) !== false;
	const value = ( key: string ) => ( preset: Record< string, unknown > ) => preset[ key ];
	return {
		colors: readPresets(
			setting( 'color.palette' ) ?? editorSettings.colors,
			isOn( 'color.defaultPalette' ),
			value( 'color' )
		),
		gradients: readPresets(
			setting( 'color.gradients' ) ?? editorSettings.gradients,
			isOn( 'color.defaultGradients' ),
			value( 'gradient' )
		),
		fontSizes: readPresets(
			setting( 'typography.fontSizes' ) ?? editorSettings.fontSizes,
			isOn( 'typography.defaultFontSizes' ),
			value( 'size' )
		),
		fontFamilies: readPresets( setting( 'typography.fontFamilies' ), true, value( 'fontFamily' ) ),
		spacingSizes: readPresets(
			setting( 'spacing.spacingSizes' ),
			isOn( 'spacing.defaultSpacingSizes' ),
			value( 'size' )
		),
		shadows: readPresets(
			setting( 'shadow.presets' ),
			isOn( 'shadow.defaultPresets' ),
			value( 'shadow' )
		),
		customColor: isOn( 'color.custom' ) && editorSettings.disableCustomColors !== true,
		customGradient:
			isOn( 'color.customGradient' ) && editorSettings.disableCustomGradients !== true,
		customFontSize:
			isOn( 'typography.customFontSize' ) && editorSettings.disableCustomFontSizes !== true,
		customSpacingSize: isOn( 'spacing.customSpacingSize' ),
	};
}

/**
 * Describes the site for the model: its blocks, and the theme's presets
 * and settings.
 *
 * @return The site information.
 */
export function getSiteInfo(): string {
	return formatSiteInfo( collectSiteInfo() );
}
