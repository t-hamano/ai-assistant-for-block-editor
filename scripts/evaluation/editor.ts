/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { registerCoreBlocks } from '@wordpress/block-library';
import { getBlockTypes, parse, type Block } from '@wordpress/blocks';
import { dispatch, select } from '@wordpress/data';
import { create } from '@wordpress/rich-text';

/**
 * Internal dependencies
 */
import type { EditTarget } from '../../src/ai/edit-target';
import { createSelectionTarget } from '../../src/editor/text-target';
import site from './site.json';

/**
 * Where a block is: its index at the top level, then in its parent's inner
 * blocks, and so on.
 */
export type BlockPath = number[];

/**
 * One request of the evaluation, made in a fresh editor.
 */
export type EvaluationCase = {
	id: string;
	/**
	 * What the user writes in the chat.
	 */
	request: string;
	/**
	 * The document, as block markup.
	 */
	document: string;
	/**
	 * What is selected when the request is sent. Without it, nothing is.
	 * With `to`, the blocks from `block` to `to`, which share a parent.
	 * With `text`, the first place of that text in the block's `attribute`,
	 * `content` by default.
	 */
	select?: { block: BlockPath; to?: BlockPath; text?: string; attribute?: string };
	/**
	 * What the document has after the answer, to tell whether the model did
	 * what was asked: the names of blocks it has, or text in its markup.
	 * `absent` lists text it no longer has.
	 */
	expect?: { blocks?: string[]; text?: string[]; absent?: string[] };
};

/**
 * Registers the core blocks and the theme settings, once.
 */
export function setUpSite() {
	if ( getBlockTypes().length ) {
		return;
	}
	// Loading the library complains about editor components that need a browser, which the evaluation does not use.
	/* eslint-disable no-console */
	const { warn, error } = console;
	console.warn = () => {};
	console.error = () => {};
	registerCoreBlocks();
	console.warn = warn;
	console.error = error;
	/* eslint-enable no-console */
	dispatch( blockEditorStore ).updateSettings( { __experimentalFeatures: site } );
}

function findBlock( blocks: Block[], path: BlockPath, id: string ): Block {
	const block = path.reduce< Block | undefined >(
		( parent, index, depth ) => ( depth ? parent?.innerBlocks : blocks )?.[ index ],
		undefined
	);
	if ( ! block ) {
		throw new Error( `${ id }: there is no block at [${ path.join( ', ' ) }].` );
	}
	return block;
}

/**
 * Lists what is wrong with the document of a case, which the editor would
 * not load as written.
 *
 * @param blocks The parsed blocks.
 * @return The problems.
 */
function findInvalidBlocks( blocks: Block[] ): string[] {
	return blocks.flatMap( ( block ) => [
		...( block.isValid ? [] : [ `${ block.name } is not valid` ] ),
		...( block.name === 'core/freeform' ? [ 'HTML outside of blocks' ] : [] ),
		...findInvalidBlocks( block.innerBlocks ),
	] );
}

/**
 * Loads a case's document and selection in the editor, and creates the
 * edit target the AI assistant would, as when the user sends the request.
 *
 * @param evaluationCase The case.
 * @return The edit target.
 */
export function setUpCase( evaluationCase: EvaluationCase ): EditTarget {
	const { id, document, select: selection } = evaluationCase;
	const blocks = parse( document );
	const problems = findInvalidBlocks( blocks );
	if ( problems.length ) {
		throw new Error( `${ id }: the document is not valid: ${ problems.join( ', ' ) }.` );
	}

	const actions = dispatch( blockEditorStore );
	actions.resetBlocks( blocks );
	actions.clearSelectedBlock();

	if ( selection?.text !== undefined ) {
		const block = findBlock( blocks, selection.block, id );
		const attribute = selection.attribute ?? 'content';
		const { text } = create( { html: String( block.attributes[ attribute ] ?? '' ) } );
		const start = text.indexOf( selection.text );
		if ( start < 0 ) {
			throw new Error(
				`${ id }: "${ selection.text }" is not in the ${ attribute } of the block.`
			);
		}
		actions.selectionChange( block.clientId, attribute, start, start + selection.text.length );
	} else if ( selection?.to ) {
		actions.multiSelect(
			findBlock( blocks, selection.block, id ).clientId,
			findBlock( blocks, selection.to, id ).clientId
		);
	} else if ( selection ) {
		actions.selectBlock( findBlock( blocks, selection.block, id ).clientId );
	}

	return createSelectionTarget();
}

/**
 * The names of every block in the document now, nested blocks included.
 *
 * @return The names.
 */
export function getBlockNames(): Set< string > {
	const collect = ( blocks: Block[] ): string[] =>
		blocks.flatMap( ( block ) => [ block.name, ...collect( block.innerBlocks ) ] );
	return new Set( collect( select( blockEditorStore ).getBlocks() ) );
}
