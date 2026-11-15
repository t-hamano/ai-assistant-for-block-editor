/**
 * Internal dependencies
 */
import type { SeenDocument } from './conversation';
import { formatOutline, isLongDocument } from './document-outline';
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
 * Matches a reference ID comment, and takes the ID.
 */
const REF = /<!--\s*ref:([a-z0-9]+)\s*-->/gi;

/**
 * Lists the reference IDs in the markup, also those of nested blocks.
 *
 * @param markup The markup.
 * @return The reference IDs.
 */
function collectRefs( markup: string ): Set< string > {
	return new Set( [ ...markup.matchAll( REF ) ].map( ( match ) => match[ 1 ].toLowerCase() ) );
}

/**
 * Finds the blocks of the document now that the model knows as they are,
 * in the same order: the longest run they have in common with the blocks
 * the model knows.
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
 * Describes how the document differs from what the model knows, by
 * reference ID: the blocks that were removed, and the blocks that are new
 * or changed, or moved, with the block they come after. Blocks the model's
 * own edits added are sent too, because the model has not seen their
 * reference IDs.
 *
 * @param document The document now.
 * @param seen     What the model knows about the document.
 * @return The `<changes>` block, an empty string when nothing changed, or
 *         `null` when the changes cannot be told by reference ID.
 */
export function formatChanges( document: string, seen: SeenDocument ): string | null {
	const before = splitTopLevelBlocks( seen.known );
	const after = splitTopLevelBlocks( document );
	if ( ! before || ! after || before.length * after.length > MAX_COMPARED * MAX_COMPARED ) {
		return null;
	}
	const shownRefs = collectRefs( seen.shown );
	const matched = findUnchanged( before, after );
	const unchanged = after.map(
		( block, index ) =>
			matched[ index ] &&
			[ ...collectRefs( block.markup ) ].every( ( ref ) => shownRefs.has( ref ) )
	);
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
	if ( ! parts.length ) {
		return '';
	}
	return [
		'<changes>',
		...parts.map( ( part ) => ( part.startsWith( '<blocks' ) ? `${ part }\n</blocks>` : part ) ),
		'</changes>',
	].join( '\n' );
}

/**
 * Shows the document as the model reads it: the whole of it, or for a long
 * document, its outline with the blocks around the selection.
 *
 * @param context The selection and the document.
 * @return The `<document>` block, or the `<outline>` block.
 */
function formatDocument( context: EditContext ): string {
	const { document, selection } = context;
	if ( isLongDocument( document ) ) {
		return formatOutline( document, selection );
	}
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
 * the blocks that differ from what the model knows, by the user's changes
 * after the last answer, and the blocks the model's edits added, so the
 * model learns their reference IDs. The whole document is sent again when
 * that is shorter, or when the changes cannot be told by reference ID. A
 * long document is sent as an outline instead of the whole of it, and the
 * model reads the blocks it needs with its read tools. The selection comes
 * last.
 *
 * @param context The selection and the document now.
 * @param seen    What the model knows about the document, or `null` when
 *                it has not seen it.
 * @return The context for the message.
 */
export function buildMessageContext( context: EditContext, seen: SeenDocument | null ): string {
	const parts: string[] = [];
	const { document } = context;
	const changes = seen === null ? null : formatChanges( document, seen );
	const whole = formatDocument( context );
	const isOutline = isLongDocument( document );
	if ( seen === null ) {
		parts.push( whole );
	} else if ( changes !== null && changes.length < whole.length ) {
		if ( changes ) {
			parts.push(
				'The document changed after your last answer, or has blocks you added. These are the changes.',
				changes
			);
		}
	} else if (
		changes !== null ||
		seen.known !== document ||
		[ ...collectRefs( document ) ].some( ( ref ) => ! collectRefs( seen.shown ).has( ref ) )
	) {
		parts.push(
			isOutline
				? 'The document changed after your last answer, or has blocks you added. This is the outline of the document now.'
				: 'The document changed after your last answer, or has blocks you added. This is the whole document now.',
			whole
		);
	}
	parts.push( formatSelection( context ) );
	return parts.join( '\n\n' );
}
