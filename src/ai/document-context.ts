/**
 * Internal dependencies
 */
import { SELECTION_END, SELECTION_START, type EditContext } from './edit-target';

/**
 * Matches a reference ID comment before a block, such as `<!-- ref:b12 -->`,
 * or a block delimiter: an opening one, a closing one starting with `/wp:`,
 * or a self-closing one ending with `/-->`.
 */
const TOKEN =
	/<!--\s*ref:([a-z0-9]+)\s*-->|<!--\s+(\/)?wp:(?:[a-z][a-z0-9_-]*\/)?[a-z][a-z0-9_-]*\s+(?:\{[\s\S]*?\}\s+)?(\/)?-->/gi;

/**
 * Above this many top-level blocks in both documents, comparing them takes
 * too long, so the whole document is sent instead.
 */
const MAX_COMPARED = 1000;

/**
 * A top-level block of the document, with its nested blocks.
 */
type TopLevelBlock = {
	ref: string;
	markup: string;
};

/**
 * Splits the document into its top-level blocks, each with the reference ID
 * before it.
 *
 * @param document The document, with reference IDs.
 * @return The blocks, or `null` when some content has no reference ID, such
 *         as a classic block, so the changes cannot be told by ID.
 */
export function splitTopLevelBlocks( document: string ): TopLevelBlock[] | null {
	const blocks: TopLevelBlock[] = [];
	const seen = new Set< string >();
	let depth = 0;
	let current: { ref: string; start: number } | null = null;
	let end = 0;
	for ( const match of document.matchAll( TOKEN ) ) {
		const [ token, ref, isCloser, isSelfClosing ] = match;
		if ( depth > 0 && ref ) {
			continue;
		}
		if ( depth === 0 ) {
			const between = document.slice( end, match.index );
			if ( between.trim() || ( current && ref ) ) {
				return null;
			}
		}
		if ( ref ) {
			const id = ref.toLowerCase();
			if ( seen.has( id ) ) {
				return null;
			}
			seen.add( id );
			current = { ref: id, start: match.index };
			end = match.index + token.length;
			continue;
		}
		if ( depth === 0 && ( ! current || isCloser ) ) {
			return null;
		}
		end = match.index + token.length;
		if ( isCloser ) {
			depth--;
		} else if ( ! isSelfClosing ) {
			depth++;
		}
		if ( depth === 0 && current ) {
			blocks.push( { ref: current.ref, markup: document.slice( current.start, end ) } );
			current = null;
		}
	}
	if ( depth !== 0 || current || document.slice( end ).trim() ) {
		return null;
	}
	return blocks;
}

/**
 * Finds which blocks of the document now are as the model knows them, in
 * the same order: the longest run they have in common with the blocks the
 * model was told about.
 *
 * @param previous The blocks the model knows.
 * @param current  The blocks now.
 * @return For each block now, whether the model knows it as it is there.
 */
function findUnchanged( previous: TopLevelBlock[], current: TopLevelBlock[] ): boolean[] {
	const same = ( a: TopLevelBlock, b: TopLevelBlock ) => a.ref === b.ref && a.markup === b.markup;
	const rows = previous.length + 1;
	const columns = current.length + 1;
	// lengths[ i * columns + j ]: the longest common run of previous[ i.. ] and current[ j.. ].
	const lengths = new Uint32Array( rows * columns );
	for ( let i = previous.length - 1; i >= 0; i-- ) {
		for ( let j = current.length - 1; j >= 0; j-- ) {
			lengths[ i * columns + j ] = same( previous[ i ], current[ j ] )
				? lengths[ ( i + 1 ) * columns + j + 1 ] + 1
				: Math.max( lengths[ ( i + 1 ) * columns + j ], lengths[ i * columns + j + 1 ] );
		}
	}
	const unchanged = current.map( () => false );
	let i = 0;
	let j = 0;
	while ( i < previous.length && j < current.length ) {
		if ( same( previous[ i ], current[ j ] ) ) {
			unchanged[ j ] = true;
			i++;
			j++;
		} else if ( lengths[ ( i + 1 ) * columns + j ] >= lengths[ i * columns + j + 1 ] ) {
			i++;
		} else {
			j++;
		}
	}
	return unchanged;
}

/**
 * Describes how the document changed since the model last saw it, by
 * reference ID: the blocks that were removed, and the blocks that are new
 * or changed, or moved, with the block they come after.
 *
 * @param document The document now.
 * @param previous The document the model knows.
 * @return The `<changes>` block, or `null` when the changes cannot be told
 *         by reference ID.
 */
export function formatChanges( document: string, previous: string ): string | null {
	const before = splitTopLevelBlocks( previous );
	const after = splitTopLevelBlocks( document );
	if ( ! before || ! after || before.length * after.length > MAX_COMPARED * MAX_COMPARED ) {
		return null;
	}
	const unchanged = findUnchanged( before, after );
	const refs = new Set( after.map( ( block ) => block.ref ) );
	const removed = before.map( ( block ) => block.ref ).filter( ( ref ) => ! refs.has( ref ) );

	const parts: string[] = [];
	if ( removed.length ) {
		parts.push( `<removed refs="${ removed.join( ' ' ) }" />` );
	}
	after.forEach( ( block, index ) => {
		if ( unchanged[ index ] ) {
			return;
		}
		// A run of changed blocks goes in one place.
		if ( index > 0 && ! unchanged[ index - 1 ] ) {
			parts[ parts.length - 1 ] += `\n${ block.markup }`;
			return;
		}
		const position = index === 0 ? 'at="start"' : `after="${ after[ index - 1 ].ref }"`;
		parts.push( `<blocks ${ position }>\n${ block.markup }` );
	} );
	return [
		'<changes>',
		...parts.map( ( part ) => ( part.startsWith( '<blocks' ) ? `${ part }\n</blocks>` : part ) ),
		'</changes>',
	].join( '\n' );
}

/**
 * Shows the document as the model reads it.
 *
 * @param document The document.
 * @return The `<document>` block.
 */
function formatDocument( document: string ): string {
	return [ '<document>', document.replace( /\n+$/, '' ), '</document>' ]
		.filter( ( part ) => part !== '' )
		.join( '\n' );
}

/**
 * Describes the selection. It is empty when nothing is selected.
 *
 * @param context The selection and the document.
 * @return The `<selection>` block.
 */
function formatSelection( context: EditContext ): string {
	const selection = context.selection.replace( /\n+$/, '' );
	if ( ! selection ) {
		return `${ SELECTION_START }${ SELECTION_END }`;
	}
	return [ SELECTION_START, selection, SELECTION_END ].join( '\n' );
}

/**
 * Builds what goes before the user's message to tell the model about the
 * document. The first message has the whole document. A later one has only
 * the blocks that changed since the last message, by the user or by the
 * model's edits, so the model also learns the reference IDs of the blocks
 * it added. The whole document is sent again when that is shorter, or when
 * the changes cannot be told by reference ID. The selection comes last.
 *
 * @param context  The selection and the document now.
 * @param previous The document as it was when the last message was sent,
 *                 or `null` when the model has not seen it.
 * @return The context for the message.
 */
export function buildMessageContext( context: EditContext, previous: string | null ): string {
	const parts: string[] = [];
	const { document } = context;
	if ( previous === null ) {
		parts.push( formatDocument( document ) );
	} else if ( previous !== document ) {
		const changes = formatChanges( document, previous );
		const whole = formatDocument( document );
		if ( changes !== null && changes.length < whole.length ) {
			parts.push(
				'The document changed after the last message, by the user or by your edits. These are the changes.',
				changes
			);
		} else {
			parts.push(
				'The document changed after the last message, by the user or by your edits. This is the whole document now.',
				whole
			);
		}
	}
	parts.push( formatSelection( context ) );
	return parts.join( '\n\n' );
}
