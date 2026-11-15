/**
 * Internal dependencies
 */
import { toUserText } from '../../src/ai/conversation';
import { buildMessageContext } from '../../src/ai/document-context';
import { readDocument } from '../../src/ai/document-outline';
import { buildSystemPrompt } from '../../src/ai/prompt';
import { getSiteInfo } from '../../src/editor/site-info';
import type { AiPlatform, AiUsage } from '../../src/platform';
import { getBlockNames, setUpCase, type EvaluationCase } from './editor';

/**
 * How an answer ended:
 *
 * - `edited`: the model edited the document and finished.
 * - `no-edit`: the model finished without editing.
 * - `gave-up`: the edits kept failing, and the assistant stopped after the
 *   failures it allows.
 * - `error`: the request failed, or the answer was cut off.
 * - `dry-run`: the request was built but not sent.
 */
export type Outcome = 'edited' | 'no-edit' | 'gave-up' | 'error' | 'dry-run';

/**
 * What became of one run of a case.
 */
export type CaseResult = {
	id: string;
	outcome: Outcome;
	/**
	 * Whether every edit applied on its first try, and there was one.
	 */
	firstTry: boolean;
	/**
	 * The edits the model made: applied, failed and tried again, and fixed
	 * automatically before they were applied.
	 */
	applied: number;
	failed: number;
	autoFixed: number;
	/**
	 * Why the failed edits failed, as the model was told.
	 */
	failures: string[];
	/**
	 * What the document does not have of the case's `expect`.
	 */
	unmet: string[];
	usage: AiUsage;
	seconds: number;
	error?: string;
	/**
	 * The size of the first request, in characters.
	 */
	requestSize: { system: number; message: number };
};

/**
 * The error the dry-run platform throws once it has the request.
 */
export class DryRun extends Error {}

/**
 * The message the platforms reject with when the model's edits fail more
 * often than they allow.
 */
const GAVE_UP = 'The edit could not be made.';

function checkExpectations( evaluationCase: EvaluationCase, document: string ): string[] {
	const { blocks = [], text = [], absent = [] } = evaluationCase.expect ?? {};
	const names = getBlockNames();
	return [
		...blocks.filter( ( name ) => ! names.has( name ) ).map( ( name ) => `has no ${ name }` ),
		...text
			.filter( ( item ) => ! document.includes( item ) )
			.map( ( item ) => `has no "${ item }"` ),
		...absent
			.filter( ( item ) => document.includes( item ) )
			.map( ( item ) => `still has "${ item }"` ),
	];
}

/**
 * Sends a case's request to the model in a fresh editor, as the AI
 * assistant sends the first message of a conversation, and records what
 * became of the edits.
 *
 * @param evaluationCase The case.
 * @param platform       The connection to the model.
 * @return The result.
 */
export async function runCase(
	evaluationCase: EvaluationCase,
	platform: AiPlatform
): Promise< CaseResult > {
	const target = setUpCase( evaluationCase );
	const context = target.getContext();
	const system = buildSystemPrompt( context.document, getSiteInfo() );
	const message = toUserText( evaluationCase.request, buildMessageContext( context, null ) );

	const result: CaseResult = {
		id: evaluationCase.id,
		outcome: 'edited',
		firstTry: false,
		applied: 0,
		failed: 0,
		autoFixed: 0,
		failures: [],
		unmet: [],
		usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
		seconds: 0,
		requestSize: { system: system.length, message: message.length },
	};

	const started = Date.now();
	try {
		await platform.chat( {
			system,
			messages: [ { role: 'user', text: message } ],
			signal: new AbortController().signal,
			read: ( read ) => readDocument( target.getDocument(), read ),
			onEvent( event ) {
				if ( event.type === 'usage' ) {
					result.usage.inputTokens += event.usage.inputTokens;
					result.usage.cachedInputTokens! += event.usage.cachedInputTokens ?? 0;
					result.usage.outputTokens += event.usage.outputTokens;
				}
				if ( event.type !== 'edit' ) {
					return;
				}
				const edited = target.apply( event.edit );
				if ( edited.status === 'failed' ) {
					result.failed++;
					result.failures.push( edited.reason );
				} else if ( edited.status === 'applied' ) {
					result.applied++;
					result.autoFixed += edited.autoFix ? 1 : 0;
				}
				return edited;
			},
		} );
		result.outcome = result.applied ? 'edited' : 'no-edit';
	} catch ( error ) {
		const text = error instanceof Error ? error.message : String( error );
		if ( error instanceof DryRun ) {
			result.outcome = 'dry-run';
		} else {
			result.outcome = text === GAVE_UP ? 'gave-up' : 'error';
			result.error = text;
		}
	}
	result.seconds = ( Date.now() - started ) / 1000;
	result.firstTry = result.outcome === 'edited' && result.failed === 0;
	if ( result.outcome !== 'dry-run' && result.outcome !== 'error' ) {
		result.unmet = checkExpectations( evaluationCase, target.getDocument() );
	}
	return result;
}
