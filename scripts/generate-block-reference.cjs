#!/usr/bin/env node
/* eslint-disable no-console -- A command line script reports through the console. */

/**
 * Generates `skills/block-markup/references/core-blocks.md` from
 * `@wordpress/block-library`: each core block's attributes from its
 * `block.json`, and example markup from the block's own `save()`.
 *
 * Only the parts between `<!-- generated:start -->` and
 * `<!-- generated:end -->` are rewritten. Everything else in the file, such
 * as the "Common mistakes" written by hand under a block, is kept.
 *
 * Usage: npm run generate:block-reference [-- --check]
 *
 * With `--check`, nothing is written and the script fails when the file is
 * not up to date.
 */

/**
 * External dependencies
 */
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const { JSDOM } = require( 'jsdom' );

/**
 * Internal dependencies
 */
const { mergeReference, readFrontmatter } = require( './lib/block-reference.cjs' );

const ROOT = path.resolve( __dirname, '..' );
const SKILL = path.join( ROOT, 'skills/block-markup/SKILL.md' );
const OUTPUT = path.join( ROOT, 'skills/block-markup/references/core-blocks.md' );

/**
 * Blocks left out of the reference: blocks the skill forbids or that the
 * user cannot insert.
 */
const EXCLUDED = new Set( [ 'core/freeform', 'core/html', 'core/missing' ] );

/**
 * Gives Node the browser globals that the block library needs to load.
 */
function setUpBrowserGlobals() {
	const dom = new JSDOM( '<!doctype html><html><body></body></html>', {
		url: 'http://localhost/',
	} );
	globalThis.window = dom.window;
	for ( const key of Object.getOwnPropertyNames( dom.window ) ) {
		if ( ! ( key in globalThis ) ) {
			try {
				globalThis[ key ] = dom.window[ key ];
			} catch {
				// Some window properties cannot be copied, and none of them are needed.
			}
		}
	}
}

/**
 * Reads every `block.json` in the block library, by block name.
 *
 * @param {string} base The package directory.
 * @return {Map<string, Object>} The metadata.
 */
function readMetadata( base ) {
	const dir = path.join( base, 'build-module' );
	const metadata = new Map();
	for ( const entry of fs.readdirSync( dir ) ) {
		const file = path.join( dir, entry, 'block.json' );
		if ( fs.existsSync( file ) ) {
			const json = JSON.parse( fs.readFileSync( file, 'utf8' ) );
			metadata.set( json.name, json );
		}
	}
	return metadata;
}

/**
 * Describes one attribute in a line.
 *
 * @param {string} name   The attribute's name.
 * @param {Object} schema The attribute.
 * @return {string} The line.
 */
function describeAttribute( name, schema ) {
	const parts = [];
	if ( schema.type ) {
		parts.push( [].concat( schema.type ).join( ' | ' ) );
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
	return `- \`${ name }\`: ${ parts.join( '; ' ) }`;
}

/**
 * Lists block names in a sentence.
 *
 * @param {string[]} names The names.
 * @return {string} The list.
 */
function listNames( names ) {
	return names.map( ( name ) => `\`${ name }\`` ).join( ', ' );
}

/**
 * Builds the generated part of a block's section.
 *
 * @param {Object}              blockType The registered block type.
 * @param {Object}              metadata  The block's `block.json`.
 * @param {string|{in: string}} example   The example markup, or the block whose example shows it.
 * @return {string} The Markdown.
 */
function describeBlock( blockType, metadata, example ) {
	const lines = [ `${ blockType.title }. ${ metadata.description ?? '' }`.trim(), '' ];

	if ( metadata.parent ) {
		lines.push( `Only directly inside ${ listNames( metadata.parent ) }.`, '' );
	}
	if ( metadata.ancestor ) {
		lines.push( `Only somewhere inside ${ listNames( metadata.ancestor ) }.`, '' );
	}
	if ( metadata.allowedBlocks ) {
		lines.push( `Takes only ${ listNames( metadata.allowedBlocks ) } as inner blocks.`, '' );
	}

	// Local attributes, such as the `blob` of an upload, are only used by the editor and never saved.
	const attributes = Object.entries( metadata.attributes ?? {} ).filter(
		( [ , schema ] ) => schema.role !== 'local'
	);
	if ( attributes.length ) {
		lines.push( 'Attributes:', '' );
		for ( const [ name, schema ] of attributes ) {
			lines.push( describeAttribute( name, schema ) );
		}
		lines.push( '' );
	} else {
		lines.push( 'No attributes of its own.', '' );
	}

	if ( typeof example === 'string' ) {
		lines.push( 'Example:', '', '```html', example, '```' );
	} else {
		lines.push( `See the example of \`${ example.in }\`.` );
	}
	return lines.join( '\n' );
}

/**
 * Removes the inner blocks that the block cannot hold. Some examples have
 * them, such as a button straight in a group, which the editor would not
 * let the user insert and which the skill tells the model not to write.
 *
 * @param {Object}   blocks    The `@wordpress/blocks` package.
 * @param {Object}   block     The block.
 * @param {string[]} ancestors The names of the blocks around it, nearest first.
 * @return {Object} The block, with only the inner blocks that may be there.
 */
function removeMisplacedBlocks( blocks, block, ancestors ) {
	const { allowedBlocks } = blocks.getBlockType( block.name );
	const chain = [ block.name, ...ancestors ];
	const innerBlocks = block.innerBlocks
		.filter( ( inner ) => {
			const { parent, ancestor } = blocks.getBlockType( inner.name );
			return (
				( ! allowedBlocks || allowedBlocks.includes( inner.name ) ) &&
				( ! parent || parent.includes( block.name ) ) &&
				( ! ancestor || ancestor.some( ( name ) => chain.includes( name ) ) )
			);
		} )
		.map( ( inner ) => removeMisplacedBlocks( blocks, inner, chain ) );
	return { ...block, innerBlocks };
}

/**
 * Builds example markup for a block: its own `example` when it has one,
 * otherwise the block with its default attributes.
 *
 * @param {Object} blocks    The `@wordpress/blocks` package.
 * @param {Object} blockType The registered block type.
 * @return {string} The markup.
 */
function buildExample( blocks, blockType ) {
	const block = blockType.example
		? blocks.getBlockFromExample( blockType.name, blockType.example )
		: blocks.createBlock( blockType.name );
	// Parsing migrates a block that is saved in a deprecated form, such as a post date without its binding, so the example shows the form the editor saves.
	const parsed = blocks.parse( blocks.serialize( removeMisplacedBlocks( blocks, block, [] ) ) );
	const markup = blocks.serialize( parsed );

	const problems = parsed.flatMap( function collect( item ) {
		return [ ...( item.isValid ? [] : [ item.name ] ), ...item.innerBlocks.flatMap( collect ) ];
	} );
	if ( problems.length ) {
		throw new Error(
			`The example of ${ blockType.name } is not valid: ${ problems.join( ', ' ) }`
		);
	}
	return markup;
}

function main() {
	const check = process.argv.includes( '--check' );

	setUpBrowserGlobals();

	// Loading the library complains about editor components that need a browser, which the examples do not use.
	const { warn, error } = console;
	console.warn = () => {};
	console.error = () => {};
	const blocks = require( '@wordpress/blocks' );
	const library = require( '@wordpress/block-library' );
	library.registerCoreBlocks();
	console.warn = warn;
	console.error = error;

	const base = path.dirname( require.resolve( '@wordpress/block-library/package.json' ) );
	const { version } = require( path.join( base, 'package.json' ) );
	const metadata = readMetadata( base );

	const included = blocks
		.getBlockTypes()
		.filter(
			( blockType ) =>
				blockType.name.startsWith( 'core/' ) &&
				! EXCLUDED.has( blockType.name ) &&
				blockType.supports?.inserter !== false &&
				metadata.has( blockType.name )
		);
	const examples = new Map(
		included
			.filter( ( blockType ) => blockType.example )
			.map( ( blockType ) => [ blockType.name, buildExample( blocks, blockType ) ] )
	);

	const sections = new Map();
	for ( const blockType of included ) {
		const blockMetadata = metadata.get( blockType.name );
		// A child block without an example of its own is shown by its parent's example.
		const delimiter = `<!-- wp:${ blockType.name.replace( /^core\//, '' ) } `;
		const parent = [ ...( blockMetadata.parent ?? [] ), ...( blockMetadata.ancestor ?? [] ) ].find(
			( name ) => examples.get( name )?.includes( delimiter )
		);
		const example =
			examples.get( blockType.name ) ??
			( parent ? { in: parent } : buildExample( blocks, blockType ) );
		sections.set( blockType.name, describeBlock( blockType, blockMetadata, example ) );
	}

	const skill = readFrontmatter( fs.readFileSync( SKILL, 'utf8' ) );
	const previous = fs.existsSync( OUTPUT ) ? fs.readFileSync( OUTPUT, 'utf8' ) : '';
	const { content, removed } = mergeReference( previous, sections, {
		wordpress: skill.wordpress,
		gutenberg: skill.gutenberg,
		'block-library': version,
		generated: new Date().toISOString().slice( 0, 10 ),
	} );

	for ( const name of removed ) {
		console.warn(
			`${ name } is no longer in the block library. Its handwritten notes were dropped.`
		);
	}

	if ( check ) {
		if ( content !== previous ) {
			console.error(
				`${ path.relative( ROOT, OUTPUT ) } is out of date. Run npm run generate:block-reference.`
			);
			process.exit( 1 );
		}
		return;
	}

	fs.mkdirSync( path.dirname( OUTPUT ), { recursive: true } );
	fs.writeFileSync( OUTPUT, content );
	console.log( `Wrote ${ sections.size } blocks to ${ path.relative( ROOT, OUTPUT ) }.` );
}

main();
