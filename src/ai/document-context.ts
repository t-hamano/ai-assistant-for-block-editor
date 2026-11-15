/**
 * Internal dependencies
 */
import { SELECTION_END, SELECTION_START, type EditContext } from './edit-target';

/**
 * Shows the document as the model reads it.
 *
 * @param document The document.
 * @return The `<document>` block.
 */
export function formatDocument( document: string ): string {
	return [ '<document>', document.replace( /\n+$/, '' ), '</document>' ]
		.filter( ( part ) => part !== '' )
		.join( '\n' );
}

/**
 * Applies to the document as the model knows it a change made to the
 * document in the editor, such as the model's edit. When the editor's
 * document holds changes the model has not been told about, the change is
 * not applied, so the next message sends the whole document.
 *
 * @param seen   The document as the model knows it.
 * @param before The editor's document before the change.
 * @param after  The editor's document after the change.
 * @return The document as the model knows it, with the change, or `null`
 *         when the model does not know the document before the change.
 */
export function applyChange( seen: string, before: string, after: string ): string | null {
	return seen === before ? after : null;
}

/**
 * Describes the selection. It is empty when nothing is selected.
 *
 * @param context The selection and the document.
 * @return The `<selection>` block.
 */
export function formatSelection( context: EditContext ): string {
	const selection = context.selection.replace( /\n+$/, '' );
	if ( ! selection ) {
		return `${ SELECTION_START }${ SELECTION_END }`;
	}
	return [ SELECTION_START, selection, SELECTION_END ].join( '\n' );
}

/**
 * Builds what goes before the user's message to tell the model about the
 * document: the whole document in the first message, and again when the
 * user changed it after the model's last answer. The selection comes last.
 *
 * @param context  The selection and the document now.
 * @param previous The document as it was when the model's last answer
 *                 ended, or `null` when the model has not seen it.
 * @return The context for the message.
 */
export function buildMessageContext( context: EditContext, previous: string | null ): string {
	const parts: string[] = [];
	const { document } = context;
	if ( previous === null ) {
		parts.push( formatDocument( document ) );
	} else if ( previous !== document ) {
		parts.push(
			'The user changed the document after your last answer. This is the whole document now.',
			formatDocument( document )
		);
	}
	parts.push( formatSelection( context ) );
	return parts.join( '\n\n' );
}
