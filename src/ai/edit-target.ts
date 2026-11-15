/**
 * Internal dependencies
 */
import type { AiEdit, AiEditResult } from '../platform';

/**
 * Wraps the selection in the context sent to the model with each message.
 */
export const SELECTION_START = '<selection>';
export const SELECTION_END = '</selection>';

/**
 * What the AI assistant sends to the model about the document.
 */
export type EditContext = {
	/**
	 * The whole document as block markup.
	 */
	document: string;
	/**
	 * The selection as block markup. Empty when nothing is selected.
	 */
	selection: string;
};

/**
 * The selection the AI assistant edits, captured when the user sends a
 * message. Each editor mode provides its own.
 */
export type EditTarget = {
	getContext: () => EditContext;
	/**
	 * The whole document as it is now, in the same form as the context's
	 * `document`.
	 */
	getDocument: () => string;
	/**
	 * Applies the model's edit, as one undo step: to the captured
	 * selection, or for `replace_text`, to the text it names. Changes
	 * nothing, and returns `dropped` when the selection no longer exists,
	 * or `failed` when the text to replace is not in the document, or is
	 * in more than one place.
	 */
	apply: ( edit: AiEdit ) => AiEditResult;
};
