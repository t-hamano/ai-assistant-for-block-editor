/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	conversationReducer,
	createConversation,
	getLastSeenDocument,
	toAiMessages,
	type AssistantChatMessage,
	type Conversation,
	type ConversationAction,
} from '../conversation';

const EDIT = {
	action: 'replace' as const,
	markup: '<!-- wp:paragraph -->\n<p>New.</p>\n<!-- /wp:paragraph -->',
};

function run( ...actions: ConversationAction[] ): Conversation {
	return actions.reduce( conversationReducer, createConversation() );
}

describe( 'conversationReducer', () => {
	it( 'takes back the text at the end of the answer', () => {
		const { messages } = run(
			{ type: 'START', text: 'Rewrite this' },
			{ type: 'APPEND_TEXT', text: 'Sure. ' },
			{ type: 'APPEND_TEXT', text: 'I shortened it.' },
			{ type: 'DISCARD_TEXT', text: 'I shortened it.' },
			{ type: 'DISCARD_TEXT', text: 'Other text.' }
		);
		expect( messages[ 1 ] ).toMatchObject( { text: 'Sure. ', activity: 'waiting' } );
	} );

	it( 'takes back the text about edits that were not applied when the answer stops', () => {
		const stopped = ( ...actions: ConversationAction[] ) =>
			run( { type: 'START', text: 'Rewrite this' }, ...actions, {
				type: 'FINISH',
				status: 'stopped',
			} ).messages[ 1 ];
		expect(
			stopped(
				{ type: 'APPEND_TEXT', text: 'I shortened it.' },
				{ type: 'ACTIVITY', activity: 'editing' }
			)
		).toMatchObject( { text: '', status: 'stopped' } );
		expect(
			stopped(
				{ type: 'APPEND_TEXT', text: 'I shortened it.' },
				{ type: 'ACTIVITY', activity: 'editing' },
				{ type: 'EDIT', edit: EDIT, applied: true },
				{ type: 'APPEND_TEXT', text: ' I also added a list.' },
				{ type: 'ACTIVITY', activity: 'editing' }
			)
		).toMatchObject( { text: 'I shortened it.' } );
		expect( stopped( { type: 'APPEND_TEXT', text: 'Part of an answer' } ) ).toMatchObject( {
			text: 'Part of an answer',
		} );
	} );

	it( 'adds the question and streams the answer into it', () => {
		const { messages } = run(
			{ type: 'START', text: 'Rewrite this' },
			{ type: 'APPEND_TEXT', text: 'Done' },
			{ type: 'APPEND_TEXT', text: '.' },
			{ type: 'EDIT', edit: EDIT, applied: true },
			{ type: 'FINISH', status: 'done' }
		);
		expect( messages ).toMatchObject( [
			{ role: 'user', text: 'Rewrite this' },
			{
				role: 'assistant',
				text: 'Done.',
				edits: [ EDIT ],
				editStatus: 'applied',
				status: 'done',
			},
		] );
	} );

	it( 'keeps every edit that changed the document', () => {
		const SECOND = { action: 'insert_after' as const, markup: EDIT.markup };
		const { messages } = run(
			{ type: 'START', text: 'Rewrite this' },
			{ type: 'EDIT', edit: EDIT, applied: true },
			{ type: 'EDIT', edit: SECOND, applied: true },
			{ type: 'EDIT', edit: EDIT, applied: false }
		);
		expect( messages[ 1 ] ).toMatchObject( { edits: [ EDIT, SECOND ], editStatus: 'applied' } );
	} );

	it( 'shows what the model does until its text arrives', () => {
		const actions: ConversationAction[] = [
			{ type: 'START', text: 'Rewrite this' },
			{ type: 'ACTIVITY', activity: 'thinking' },
			{ type: 'APPEND_TEXT', text: 'Sure.' },
			{ type: 'ACTIVITY', activity: 'editing' },
			{ type: 'EDIT', edit: EDIT, applied: true },
			{ type: 'APPEND_TEXT', text: 'Done.' },
			{ type: 'FINISH', status: 'done' },
		];
		const activities = actions.map( ( _, index ) => {
			const answer = run( ...actions.slice( 0, index + 1 ) ).messages[ 1 ] as AssistantChatMessage;
			return answer.activity;
		} );
		expect( activities ).toEqual( [
			'waiting',
			'thinking',
			undefined,
			'editing',
			'waiting',
			undefined,
			undefined,
		] );
	} );

	it( 'adds up the tokens of the answer’s requests', () => {
		const { messages } = run(
			{ type: 'START', text: 'Rewrite this' },
			{
				type: 'USAGE',
				usage: { inputTokens: 1200, outputTokens: 80 },
			},
			{ type: 'EDIT', edit: EDIT, applied: true },
			{
				type: 'USAGE',
				usage: { inputTokens: 1300, outputTokens: 20 },
			},
			{ type: 'FINISH', status: 'done' }
		);
		expect( messages[ 1 ] ).toMatchObject( {
			usage: { inputTokens: 2500, outputTokens: 100 },
		} );
	} );

	it( 'adds up the tokens read from the cache when reported', () => {
		const { messages } = run(
			{ type: 'START', text: 'Rewrite this' },
			{
				type: 'USAGE',
				usage: {
					inputTokens: 1200,
					cachedInputTokens: 1000,
					outputTokens: 80,
				},
			},
			{
				type: 'USAGE',
				usage: { inputTokens: 1300, outputTokens: 20 },
			},
			{ type: 'FINISH', status: 'done' }
		);
		expect( messages[ 1 ] ).toMatchObject( {
			usage: {
				inputTokens: 2500,
				cachedInputTokens: 1000,
				outputTokens: 100,
			},
		} );
		const unreported = run(
			{ type: 'START', text: 'Hi' },
			{ type: 'USAGE', usage: { inputTokens: 10, outputTokens: 5 } }
		).messages[ 1 ] as AssistantChatMessage;
		expect( unreported.usage ).not.toHaveProperty( 'cachedInputTokens' );
	} );

	it( 'ignores events after the answer finished', () => {
		const { messages } = run(
			{ type: 'START', text: 'Hi' },
			{ type: 'FINISH', status: 'stopped' },
			{ type: 'APPEND_TEXT', text: 'Late' },
			{ type: 'FINISH', status: 'done' }
		);
		expect( messages[ 1 ] ).toMatchObject( {
			text: '',
			status: 'stopped',
		} );
	} );

	it( 'starts a new conversation on reset', () => {
		const before = run( { type: 'START', text: 'Hi' } );
		const after = conversationReducer( before, { type: 'RESET' } );
		expect( after.messages ).toEqual( [] );
		expect( after.id ).not.toBe( before.id );
	} );
} );

describe( 'toAiMessages', () => {
	it( 'sends applied edits, and leaves out failed exchanges and empty answers', () => {
		const { messages } = run(
			{ type: 'START', text: 'One' },
			{ type: 'APPEND_TEXT', text: 'Edited.' },
			{ type: 'EDIT', edit: EDIT, applied: true },
			{ type: 'FINISH', status: 'done' },
			{ type: 'START', text: 'Two' },
			{ type: 'FINISH', status: 'error', error: 'Failed' },
			{ type: 'START', text: 'Three' },
			{ type: 'FINISH', status: 'stopped' },
			{ type: 'START', text: 'Four' },
			{ type: 'APPEND_TEXT', text: 'Could not edit.' },
			{ type: 'EDIT', edit: EDIT, applied: false },
			{ type: 'FINISH', status: 'done' }
		);
		expect( toAiMessages( messages ) ).toEqual( [
			{ role: 'user', text: 'One' },
			{ role: 'assistant', text: 'Edited.', edits: [ EDIT ] },
			{ role: 'user', text: 'Three' },
			{ role: 'user', text: 'Four' },
			{ role: 'assistant', text: 'Could not edit.' },
		] );
	} );
} );

describe( 'document context', () => {
	it( 'sends the context before the message, as it was sent', () => {
		const { messages } = run(
			{ type: 'START', text: 'Rewrite this', context: '<document>' },
			{ type: 'APPEND_TEXT', text: 'Done.' },
			{ type: 'FINISH', status: 'done' }
		);
		expect( toAiMessages( messages )[ 0 ] ).toEqual( {
			role: 'user',
			text: '<document>\n\nRewrite this',
		} );
	} );

	it( 'returns the document when the last answer ended, and when it was sent', () => {
		const { messages } = run(
			{ type: 'START', text: 'One', context: 'A', document: 'Zero.\n' },
			{ type: 'APPEND_TEXT', text: 'Done.' },
			{ type: 'FINISH', status: 'done', documentAfter: 'First.\n' },
			{ type: 'START', text: 'Two', context: 'B', document: 'First.\n' },
			{ type: 'FINISH', status: 'stopped', documentAfter: 'Second.\n' }
		);
		expect( getLastSeenDocument( messages ) ).toEqual( {
			known: 'Second.\n',
			shown: 'First.\n',
			added: [],
		} );
	} );

	it( 'skips an exchange whose answer failed', () => {
		const { messages } = run(
			{ type: 'START', text: 'One', context: 'A', document: 'Zero.\n' },
			{ type: 'APPEND_TEXT', text: 'Done.' },
			{ type: 'FINISH', status: 'done', documentAfter: 'First.\n' },
			{ type: 'START', text: 'Two', context: 'B', document: 'First.\n' },
			{ type: 'FINISH', status: 'error', error: 'Failed' }
		);
		expect( getLastSeenDocument( messages ) ).toEqual( {
			known: 'First.\n',
			shown: 'Zero.\n',
			added: [],
		} );
	} );

	it( 'returns the reference IDs the model was told for the blocks its edits added', () => {
		const { messages } = run(
			{ type: 'START', text: 'One', context: 'A', document: 'Zero.\n' },
			{ type: 'EDIT', edit: EDIT, applied: true, refs: [ 'b2', 'b3' ] },
			{ type: 'EDIT', edit: EDIT, applied: true },
			{ type: 'FINISH', status: 'done', documentAfter: 'First.\n' }
		);
		expect( getLastSeenDocument( messages ) ).toEqual( {
			known: 'First.\n',
			shown: 'Zero.\n',
			added: [ 'b2', 'b3' ],
		} );
		expect( toAiMessages( messages )[ 1 ] ).toEqual( {
			role: 'assistant',
			text: '',
			edits: [ EDIT, EDIT ],
			editRefs: [ [ 'b2', 'b3' ], [] ],
		} );
	} );

	it( 'returns null without a document', () => {
		expect( getLastSeenDocument( [] ) ).toBeNull();
		expect(
			getLastSeenDocument(
				run( { type: 'START', text: 'One' }, { type: 'FINISH', status: 'done' } ).messages
			)
		).toBeNull();
	} );
} );
