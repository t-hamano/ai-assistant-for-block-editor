/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import type { Block } from '@wordpress/blocks';
import { dispatch, select } from '@wordpress/data';

/**
 * Internal dependencies
 */
import type { EditTarget } from '../ai/edit-target';
import type { AiEdit, AiEditResult } from '../platform';
import { getClientIdByRef, getRef, serializeWithRefs, stripRefs } from './block-refs';
import { collectHtml, validateMarkup } from './validate-markup';

function failed( reason: string ): AiEditResult {
	return { status: 'failed', reason };
}

/**
 * Creates the edit target for the blocks selected now. Blocks anywhere in
 * the document can also be edited by their reference IDs, which the
 * document and the selection carry before each block.
 *
 * Each edit is one undo step.
 *
 * @return The edit target.
 */
export function createBlockTarget(): EditTarget {
	const editor = () => select( blockEditorStore );
	// The blocks the edits are for. A replacement takes their place.
	let clientIds = editor().getSelectedBlockClientIds();
	// The block `insert_after` inserts after: the end of the selection, or
	// the blocks inserted before, so that they stay in order.
	let anchor: string | undefined = clientIds[ clientIds.length - 1 ];

	const getDocument = () => serializeWithRefs( editor().getBlocks() );

	/**
	 * Validates the markup, and returns its blocks or why they cannot be
	 * applied.
	 *
	 * @param markup The model's markup.
	 * @return The blocks, or the reason.
	 */
	function readBlocks( markup: string ): Block[] | string {
		// Markup that the editor would not read as written is never applied.
		const { blocks, problems } = validateMarkup(
			stripRefs( markup ),
			collectHtml( editor().getBlocks() )
		);
		if ( problems.length ) {
			return [
				'The edit was not applied, because the markup has these problems:',
				...problems.map( ( problem ) => `- ${ problem }` ),
				'Fix the markup, and call edit_blocks again.',
			].join( '\n' );
		}
		if ( ! blocks.length ) {
			return 'The markup has no blocks. Write the content as block markup, and try again.';
		}
		return blocks;
	}

	function canInsert( blocks: Block[], rootClientId: string | undefined ): string | null {
		const notAllowed = blocks.find(
			( block ) => ! editor().canInsertBlockType( block.name, rootClientId )
		);
		return notAllowed ? `The "${ notAllowed.name }" block is not allowed here.` : null;
	}

	function applied( blocks: Block[] ): AiEditResult {
		return { status: 'applied', refs: blocks.map( ( block ) => getRef( block.clientId ) ) };
	}

	/**
	 * Applies an edit of the block a reference ID points at.
	 *
	 * @param edit The edit.
	 * @param ref  The block's reference ID.
	 * @return What became of the edit.
	 */
	function applyToRef( edit: AiEdit, ref: string ): AiEditResult {
		const { canRemoveBlocks, getBlock, getBlockIndex, getBlockRootClientId } = editor();
		const clientId = getClientIdByRef( ref );
		if ( ! clientId || ! getBlock( clientId ) ) {
			return failed(
				`There is no block with the reference ID "${ ref }" in the document. Use a reference ID from the latest document.`
			);
		}
		const isRemoved = edit.action === 'replace_block' || edit.action === 'delete_block';
		if ( isRemoved && ! canRemoveBlocks( [ clientId ] ) ) {
			return failed( `The block "${ ref }" is locked, so it cannot be changed or removed.` );
		}

		const actions = dispatch( blockEditorStore );
		if ( edit.action === 'delete_block' ) {
			actions.removeBlocks( [ clientId ], false );
			clientIds = clientIds.filter( ( id ) => id !== clientId );
			return { status: 'applied', refs: [] };
		}

		const blocks = readBlocks( edit.markup );
		if ( typeof blocks === 'string' ) {
			return failed( blocks );
		}
		const rootClientId = getBlockRootClientId( clientId ) ?? undefined;
		const notAllowed = canInsert( blocks, rootClientId );
		if ( notAllowed ) {
			return failed( notAllowed );
		}

		if ( edit.action === 'replace_block' ) {
			// The new blocks are selected only when the block was, without
			// taking the focus from the chat.
			actions.replaceBlocks( [ clientId ], blocks, undefined, null );
			const newIds = blocks.map( ( block ) => block.clientId );
			clientIds = clientIds.flatMap( ( id ) => ( id === clientId ? newIds : [ id ] ) );
			if ( anchor === clientId ) {
				anchor = newIds[ newIds.length - 1 ];
			}
		} else {
			const index = getBlockIndex( clientId ) + ( edit.action === 'insert_before' ? 0 : 1 );
			actions.insertBlocks( blocks, index, rootClientId, false );
		}
		return applied( blocks );
	}

	return {
		getContext: () => ( {
			document: getDocument(),
			selection: serializeWithRefs(
				editor()
					.getBlocksByClientId( clientIds )
					.filter( ( block ) => block !== null )
			),
		} ),
		getDocument,
		apply( edit ) {
			if ( edit.action === 'replace_text' ) {
				return failed(
					'The "replace_text" action is not available. Edit the blocks by their reference IDs instead.'
				);
			}
			// `replace` and `append` do not point at a block, so a `ref` with them is ignored.
			if ( edit.action !== 'replace' && edit.action !== 'append' && edit.ref !== undefined ) {
				return applyToRef( edit, edit.ref );
			}
			if (
				edit.action !== 'replace' &&
				edit.action !== 'insert_after' &&
				edit.action !== 'append'
			) {
				return failed( `The "${ edit.action }" action needs the "ref" of a block.` );
			}

			const { canRemoveBlocks, getBlock, getBlockIndex, getBlockRootClientId } = editor();
			const isAppend = edit.action === 'append';
			if ( ! isAppend && clientIds.some( ( clientId ) => ! getBlock( clientId ) ) ) {
				return { status: 'dropped' };
			}
			if ( anchor && ! getBlock( anchor ) ) {
				anchor = clientIds[ clientIds.length - 1 ];
			}

			const blocks = readBlocks( edit.markup );
			if ( typeof blocks === 'string' ) {
				return failed( blocks );
			}

			const isReplace = edit.action === 'replace';
			if ( isReplace && ! clientIds.length ) {
				return failed(
					'Nothing is selected, so there is nothing to replace. Use "replace_block" with the reference ID of the block to replace, or "append" to add blocks to the end of the document.'
				);
			}
			if ( isReplace && ! canRemoveBlocks( clientIds ) ) {
				return failed( 'The selected blocks are locked, so they cannot be replaced.' );
			}
			const rootClientId =
				anchor && ! isAppend ? ( getBlockRootClientId( anchor ) ?? undefined ) : undefined;
			const notAllowed = canInsert( blocks, rootClientId );
			if ( notAllowed ) {
				return failed( notAllowed );
			}

			const actions = dispatch( blockEditorStore );
			const last = blocks[ blocks.length - 1 ].clientId;
			if ( isAppend ) {
				actions.insertBlocks( blocks, undefined, undefined, false );
			} else if ( isReplace ) {
				if ( ! anchor || clientIds.includes( anchor ) ) {
					anchor = last;
				}
				// The new blocks are selected, without taking the focus from the chat.
				actions.replaceBlocks( clientIds, blocks, undefined, null );
				clientIds = blocks.map( ( block ) => block.clientId );
			} else {
				// Without an anchor, the blocks go to the end of the document.
				const index = anchor ? getBlockIndex( anchor ) + 1 : undefined;
				// Keep the selection, and the focus in the chat.
				actions.insertBlocks( blocks, index, rootClientId, false );
				anchor = last;
			}
			return applied( blocks );
		},
	};
}
