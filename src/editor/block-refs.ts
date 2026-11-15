/**
 * WordPress dependencies
 */
import { getFreeformContentHandlerName, serialize, type Block } from '@wordpress/blocks';

/**
 * Matches a reference ID comment, such as `<!-- ref:b12 -->`.
 */
const REF_COMMENT = /<!--\s*ref:[a-z0-9]+\s*-->/gi;

/**
 * Matches the opening delimiter of a block, and its name without the
 * `core/` prefix. Closing delimiters start with `/wp:` and do not match.
 */
const OPENER = /<!--\s+wp:([a-z][a-z0-9_-]*(?:\/[a-z][a-z0-9_-]*)?)[\s\S]*?-->/g;

// The reference IDs of the blocks, kept for the editor session so that a
// block keeps its ID through the conversation, and after undo.
const refs = new Map< string, string >();
const clientIds = new Map< string, string >();

/**
 * Returns the reference ID of a block, and gives it one when it has none.
 *
 * @param clientId The block's client ID.
 * @return The reference ID, such as `b12`.
 */
export function getRef( clientId: string ): string {
	let ref = refs.get( clientId );
	if ( ! ref ) {
		ref = `b${ refs.size + 1 }`;
		refs.set( clientId, ref );
		clientIds.set( ref, clientId );
	}
	return ref;
}

/**
 * Finds the block a reference ID points at.
 *
 * @param ref The reference ID.
 * @return The block's client ID, or `undefined` when no block has the ID.
 */
export function getClientIdByRef( ref: string ): string | undefined {
	return clientIds.get( ref.trim().toLowerCase() );
}

/**
 * Removes the reference IDs from markup the model wrote. They only point
 * at blocks, and are not part of the content.
 *
 * @param markup The markup.
 * @return The markup without reference IDs.
 */
export function stripRefs( markup: string ): string {
	return markup.replace( REF_COMMENT, '' );
}

function flatten( blocks: Block[] ): Block[] {
	return blocks.flatMap( ( block ) => [ block, ...flatten( block.innerBlocks ) ] );
}

/**
 * Serializes the blocks with a reference ID before the opening delimiter
 * of each block, including nested ones.
 *
 * @param blocks The blocks.
 * @return The block markup with reference IDs.
 */
export function serializeWithRefs( blocks: Block[] ): string {
	const markup = serialize( blocks );
	const openers = [ ...markup.matchAll( OPENER ) ].map( ( match ) => ( {
		index: match.index,
		name: match[ 1 ].includes( '/' ) ? match[ 1 ] : `core/${ match[ 1 ] }`,
	} ) );
	const insertions: { index: number; ref: string }[] = [];
	let next = 0;
	// The delimiters are in the same order as the blocks, depth first. A
	// classic block is saved without delimiters, so it gets no ID.
	flatten( blocks ).forEach( ( block ) => {
		if ( block.name === getFreeformContentHandlerName() ) {
			return;
		}
		const found = openers.findIndex(
			( opener, index ) => index >= next && opener.name === block.name
		);
		if ( found === -1 ) {
			return;
		}
		insertions.push( { index: openers[ found ].index, ref: getRef( block.clientId ) } );
		next = found + 1;
	} );
	return insertions.reduceRight(
		( result, { index, ref } ) =>
			`${ result.slice( 0, index ) }<!-- ref:${ ref } -->${ result.slice( index ) }`,
		markup
	);
}
