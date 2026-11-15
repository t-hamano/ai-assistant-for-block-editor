/**
 * Merges generated block descriptions into the block reference, keeping
 * what was written by hand.
 *
 * The file is a frontmatter, an introduction, and one `## core/name`
 * section per block. In each section, the text between
 * `<!-- generated:start -->` and `<!-- generated:end -->` is generated, and
 * the text after it is handwritten.
 */

const START = '<!-- generated:start -->';
const END = '<!-- generated:end -->';

const DEFAULT_INTRO = [
	'# Core blocks',
	'',
	'The attributes and example markup of each core block. Write the markup the way the examples show it. The attributes of a block are the ones listed under it, together with the attributes its supports add, such as `className`, `style`, `textColor`, and `align`, that the common rules and the site information describe.',
].join( '\n' );

const SECTION = /^## (core\/[a-z0-9-]+)[ \t]*$/m;

/**
 * Reads the frontmatter of a Markdown file. Only `key: value` lines are
 * supported.
 *
 * @param {string} markdown The file.
 * @return {Record<string, string>} The values.
 */
function readFrontmatter( markdown ) {
	const match = markdown.match( /^---\n([\s\S]*?)\n---\n/ );
	if ( ! match ) {
		return {};
	}
	return Object.fromEntries(
		match[ 1 ]
			.split( '\n' )
			.map( ( line ) => line.match( /^([\w-]+):\s*(.*)$/ ) )
			.filter( Boolean )
			.map( ( [ , key, value ] ) => [ key, value.trim() ] )
	);
}

/**
 * Splits the reference into its introduction and the handwritten part of
 * each block's section.
 *
 * @param {string} markdown The reference.
 * @return {{ intro: string, generated: Map<string, string>, handwritten: Map<string, string> }} The parts.
 */
function parseReference( markdown ) {
	const body = markdown.replace( /^---\n[\s\S]*?\n---\n/, '' );
	const parts = body.split( SECTION );
	const generated = new Map();
	const handwritten = new Map();

	for ( let index = 1; index < parts.length; index += 2 ) {
		const name = parts[ index ];
		const section = parts[ index + 1 ];
		const start = section.indexOf( START );
		const end = section.indexOf( END );
		if ( start === -1 || end === -1 || end < start ) {
			throw new Error( `The section of ${ name } has no generated part.` );
		}
		generated.set( name, section.slice( start + START.length, end ).trim() );
		handwritten.set( name, section.slice( end + END.length ).trim() );
	}

	return { intro: parts[ 0 ].trim(), generated, handwritten };
}

/**
 * Builds the reference from the generated sections, keeping the
 * introduction and the handwritten parts of the previous reference. The
 * generation date stays the same when nothing generated changed.
 *
 * @param {string}                 previous    The previous reference, or an empty string.
 * @param {Map<string, string>}    sections    The generated part of each block, by name.
 * @param {Record<string, string>} frontmatter The frontmatter, with today's date as `generated`.
 * @return {{ content: string, removed: string[] }} The reference, and the blocks with handwritten parts that are no longer generated.
 */
function mergeReference( previous, sections, frontmatter ) {
	const old = previous
		? parseReference( previous )
		: { intro: '', generated: new Map(), handwritten: new Map() };
	const names = [ ...sections.keys() ].sort();

	const oldFrontmatter = readFrontmatter( previous );
	const unchanged =
		names.length === old.generated.size &&
		names.every( ( name ) => old.generated.get( name ) === sections.get( name ).trim() ) &&
		Object.keys( frontmatter ).every(
			( key ) => key === 'generated' || oldFrontmatter[ key ] === frontmatter[ key ]
		);
	const values = {
		...frontmatter,
		generated:
			unchanged && oldFrontmatter.generated ? oldFrontmatter.generated : frontmatter.generated,
	};

	const blocks = names.map( ( name ) =>
		[
			`## ${ name }`,
			'',
			START,
			sections.get( name ).trim(),
			END,
			...( old.handwritten.get( name ) ? [ '', old.handwritten.get( name ) ] : [] ),
		].join( '\n' )
	);

	const content = [
		[
			'---',
			...Object.entries( values ).map( ( [ key, value ] ) => `${ key }: ${ value }` ),
			'---',
		].join( '\n' ),
		old.intro || DEFAULT_INTRO,
		...blocks,
	].join( '\n\n' );

	const removed = [ ...old.handwritten ]
		.filter( ( [ name, text ] ) => text && ! sections.has( name ) )
		.map( ( [ name ] ) => name );

	return { content: `${ content }\n`, removed };
}

module.exports = { mergeReference, parseReference, readFrontmatter };
