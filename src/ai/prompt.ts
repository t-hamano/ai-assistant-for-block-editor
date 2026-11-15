/**
 * Internal dependencies
 */
import blockMarkupSkill from '../../skills/block-markup/SKILL.md?raw';

/**
 * Removes the frontmatter from a skill. It records which versions the skill
 * was written for, which the model does not need.
 *
 * @param skill The skill file.
 * @return The skill without its frontmatter.
 */
export function stripFrontmatter( skill: string ): string {
	return skill.replace( /^---\n[\s\S]*?\n---\n+/, '' ).trim();
}

/**
 * Builds the instructions sent to the model with each message. The
 * document is not part of them: it goes with the user's messages, so the
 * instructions stay the same through the conversation and the prompt cache
 * covers them, together with the messages before the new one. When the
 * document can be edited, the rules for writing block markup follow.
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
		'Each block in <document> and <selection>, also nested blocks, has a reference ID in a comment before it, such as <!-- ref:b12 -->. The IDs are not part of the content, and stay with the block through the conversation.',
		'When the user asks you to write or change content, edit the document with the edit_blocks tool, in block markup. Call it once for each change.',
		'When there is a selection, edit it: use "replace" to replace the selected blocks, and "insert_after" to add blocks after them. Do not include the <selection> tags in your markup.',
		'To change other places, point at a block by its reference ID in "ref": "replace_block" replaces the block, "insert_before" and "insert_after" add blocks before or after it, and "delete_block" removes it. "append" adds blocks to the end of the document. When nothing is selected, decide from the request and the document which blocks to change.',
		'For a small change inside a block, such as a word or a sentence, "replace_text" replaces the "find" text with the markup, without writing the whole block again. "find" must appear only once in the latest <document>.',
		'Use only reference IDs from the latest <document> or <selection>, or from the results of your edits. Do not write reference IDs in your markup.',
		'When the user only asks a question, answer it without editing.',
		'After editing, briefly say what you changed. Do not repeat the content you wrote.',
		'Follow the rules in <skill name="block-markup"> whenever you write block markup.'
	);
	return [
		lines.join( '\n' ),
		`<skill name="block-markup">\n${ stripFrontmatter( blockMarkupSkill ) }\n</skill>`,
	].join( '\n\n' );
}
