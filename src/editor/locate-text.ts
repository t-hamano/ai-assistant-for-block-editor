/**
 * WordPress dependencies
 */
import { serialize, type Block } from '@wordpress/blocks';

/**
 * The blocks that hold a range of the document's markup, and where the
 * range is in their markup.
 */
export type LocatedText = {
	/**
	 * Sibling blocks, in order: the smallest block that holds the whole
	 * range, or the run of siblings it spans.
	 */
	blocks: Block[];
	/**
	 * The markup of the blocks, as `serialize()` writes them together.
	 */
	markup: string;
	/**
	 * Where the range is in `markup`, as character offsets.
	 */
	start: number;
	end: number;
};

/**
 * Finds the smallest blocks that hold a range of the markup of sibling
 * blocks. Inner blocks are searched when the whole range is in one block,
 * so that changing a word in a group changes that one paragraph, not the
 * group.
 *
 * @param blocks The sibling blocks.
 * @param markup Their markup, which holds each block's own markup in order.
 * @param start  Where the range starts in `markup`.
 * @param end    Where it ends.
 * @return The blocks, or `null` when the range is not inside them.
 */
export function locateText(
	blocks: Block[],
	markup: string,
	start: number,
	end: number
): LocatedText | null {
	const hits: { block: Block; from: number; to: number }[] = [];
	let cursor = 0;
	for ( const block of blocks ) {
		const own = serialize( [ block ] );
		const from = markup.indexOf( own, cursor );
		if ( from === -1 ) {
			// The parent writes its inner blocks in a way of its own.
			return null;
		}
		cursor = from + own.length;
		if ( from < end && cursor > start ) {
			hits.push( { block, from, to: cursor } );
		}
	}
	if ( ! hits.length ) {
		return null;
	}
	// A range may take in the space between blocks, but not the parent's
	// own markup around them: then the parent holds it.
	const from = Math.min( hits[ 0 ].from, start );
	const to = Math.max( hits[ hits.length - 1 ].to, end );
	if (
		markup.slice( from, hits[ 0 ].from ).trim() ||
		markup.slice( hits[ hits.length - 1 ].to, to ).trim()
	) {
		return null;
	}
	const located = {
		blocks: hits.map( ( hit ) => hit.block ),
		markup: markup.slice( from, to ),
		start: start - from,
		end: end - from,
	};
	if ( hits.length > 1 || start < hits[ 0 ].from || end > hits[ 0 ].to ) {
		return located;
	}
	const [ { block } ] = hits;
	return locateText( block.innerBlocks, located.markup, located.start, located.end ) ?? located;
}
