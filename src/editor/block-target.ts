/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { serialize } from '@wordpress/blocks';
import { dispatch, select } from '@wordpress/data';

/**
 * Internal dependencies
 */
import type { EditTarget } from '../ai/edit-target';
import type { AiEditResult } from '../platform';
import { collectHtml, validateMarkup } from './validate-markup';

function failed( reason: string ): AiEditResult {
	return { status: 'failed', reason };
}

/**
 * Creates the edit target for the blocks selected now. With no selection,
 * the model can only add blocks, at the end of the document.
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

	const getDocument = () => serialize( editor().getBlocks() );

	return {
		getContext: () => ( {
			document: getDocument(),
			selection: serialize(
				editor()
					.getBlocksByClientId( clientIds )
					.filter( ( block ) => block !== null )
			),
		} ),
		getDocument,
		apply( edit ) {
			if ( edit.action === 'replace_text' ) {
				return failed(
					'The "replace_text" action is not available. Use "replace" or "insert_after".'
				);
			}
			const { canInsertBlockType, canRemoveBlocks, getBlock, getBlockIndex, getBlockRootClientId } =
				editor();
			if ( clientIds.some( ( clientId ) => ! getBlock( clientId ) ) ) {
				return { status: 'dropped' };
			}
			if ( anchor && ! getBlock( anchor ) ) {
				anchor = clientIds[ clientIds.length - 1 ];
			}

			// Markup that the editor would not read as written is never applied.
			const { blocks, problems } = validateMarkup(
				edit.markup,
				collectHtml( editor().getBlocks() )
			);
			if ( problems.length ) {
				return failed(
					[
						'The edit was not applied, because the markup has these problems:',
						...problems.map( ( problem ) => `- ${ problem }` ),
						'Fix the markup, and call edit_blocks again.',
					].join( '\n' )
				);
			}
			if ( ! blocks.length ) {
				return failed(
					'The markup has no blocks. Write the content as block markup, and try again.'
				);
			}

			const isReplace = edit.action === 'replace';
			if ( isReplace && ! clientIds.length ) {
				return failed(
					'Nothing is selected, so there is nothing to replace. Use "insert_after" to add blocks to the end of the document.'
				);
			}
			if ( isReplace && ! canRemoveBlocks( clientIds ) ) {
				return failed( 'The selected blocks are locked, so they cannot be replaced.' );
			}
			const rootClientId = anchor ? ( getBlockRootClientId( anchor ) ?? undefined ) : undefined;
			const notAllowed = blocks.find(
				( block ) => ! canInsertBlockType( block.name, rootClientId )
			);
			if ( notAllowed ) {
				return failed( `The "${ notAllowed.name }" block is not allowed here.` );
			}

			const actions = dispatch( blockEditorStore );
			const last = blocks[ blocks.length - 1 ].clientId;
			if ( isReplace ) {
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
			return { status: 'applied' };
		},
	};
}
