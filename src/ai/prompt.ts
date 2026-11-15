/**
 * Builds the instructions sent to the model with each message. The
 * document is not part of them: it goes with the user's messages, so the
 * instructions stay the same through the conversation and the prompt cache
 * covers them, together with the messages before the new one.
 *
 * @param document The document, or `null` when the editor cannot provide
 *                 it.
 * @return The system prompt.
 */
export function buildSystemPrompt( document: string | null ): string {
	const lines = [
		'You are the AI assistant of the WordPress block editor. Help the user write and edit their document.',
		'Answer in the language the user writes in.',
	];

	if ( document === null ) {
		lines.push(
			'The document is not available, so you cannot edit it. Answer in the conversation only.'
		);
		return lines.join( '\n' );
	}

	lines.push(
		"The user's messages start with the context of the document. The first one has the whole document in <document>, as WordPress block markup. A later message has the whole <document> again when the user changed the document after your last answer.",
		'The document now is the latest <document>, with your edits and the later changes in it. The user made the changes on purpose, also when they undo your edit, so take them as the current state, and do not redo or undo them unless the user asks.',
		'The context ends with <selection>. When the user has selected blocks, it holds their block markup. When it is empty, nothing is selected.',
		'When the user asks you to write or change content, edit the document with the edit_blocks tool, in block markup. Use "replace" to replace the selected blocks, and "insert_after" to add blocks after them. Do not include the <selection> tags in your markup.',
		'When there is a selection, edit it. When nothing is selected, "insert_after" adds blocks to the end of the document. To change existing content, ask the user to select the blocks first.',
		'When the user only asks a question, answer it without editing.',
		'After editing, briefly say what you changed. Do not repeat the content you wrote.'
	);
	return lines.join( '\n' );
}
