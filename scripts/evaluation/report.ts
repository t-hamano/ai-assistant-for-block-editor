/**
 * Internal dependencies
 */
import type { CaseResult } from './run-case';

/**
 * The results of one evaluation, as saved.
 */
export type Evaluation = {
	provider: string;
	model: string;
	/**
	 * The skill's frontmatter, which records the versions it was made for.
	 */
	skill: Record< string, string >;
	date: string;
	results: CaseResult[];
};

/**
 * The figures of an evaluation.
 */
export type Summary = {
	runs: number;
	/**
	 * The share of runs whose edits all applied on their first try.
	 */
	firstTryRate: number;
	/**
	 * The failed edits the model tried again, per run.
	 */
	retriesPerRun: number;
	autoFixed: number;
	gaveUp: number;
	noEdit: number;
	errors: number;
	/**
	 * The share of runs that edited the document, and whose document has
	 * what the case expects.
	 */
	expectedRate: number;
	inputTokens: number;
	outputTokens: number;
};

/**
 * Sums up the results. Runs whose request failed are left out of the
 * rates, since they say nothing about the skill.
 *
 * @param results The results.
 * @return The figures.
 */
export function summarize( results: CaseResult[] ): Summary {
	const answered = results.filter( ( result ) => result.outcome !== 'error' );
	const runs = answered.length;
	const count = ( test: ( result: CaseResult ) => boolean ) => answered.filter( test ).length;
	const sum = ( pick: ( result: CaseResult ) => number ) =>
		results.reduce( ( total, result ) => total + pick( result ), 0 );
	return {
		runs,
		firstTryRate: runs ? count( ( result ) => result.firstTry ) / runs : 0,
		retriesPerRun: runs
			? sum( ( result ) => ( result.outcome === 'error' ? 0 : result.failed ) ) / runs
			: 0,
		autoFixed: sum( ( result ) => result.autoFixed ),
		gaveUp: count( ( result ) => result.outcome === 'gave-up' ),
		noEdit: count( ( result ) => result.outcome === 'no-edit' ),
		errors: results.length - runs,
		expectedRate: runs
			? count( ( result ) => result.outcome === 'edited' && ! result.unmet.length ) / runs
			: 0,
		inputTokens: sum( ( result ) => result.usage.inputTokens ),
		outputTokens: sum( ( result ) => result.usage.outputTokens ),
	};
}

const percent = ( value: number ) => `${ ( value * 100 ).toFixed( 1 ) }%`;
const decimal = ( value: number ) => value.toFixed( 2 );
const integer = ( value: number ) => String( value );

const ROWS: [ string, keyof Summary, ( value: number ) => string ][] = [
	[ 'Runs', 'runs', integer ],
	[ 'First-try pass rate', 'firstTryRate', percent ],
	[ 'Retries per run', 'retriesPerRun', decimal ],
	[ 'Auto-fixed edits', 'autoFixed', integer ],
	[ 'Gave up', 'gaveUp', integer ],
	[ 'No edit', 'noEdit', integer ],
	[ 'Did what was asked', 'expectedRate', percent ],
	[ 'Request errors', 'errors', integer ],
	[ 'Input tokens', 'inputTokens', integer ],
	[ 'Output tokens', 'outputTokens', integer ],
];

/**
 * Lists the runs whose edits did not all apply on their first try, with
 * why, for the report.
 *
 * @param results The results.
 * @return The Markdown lines.
 */
function describeProblems( results: CaseResult[] ): string[] {
	const lines = results
		.filter( ( result ) => ! result.firstTry || result.unmet.length )
		.map( ( result ) => {
			const notes = [
				result.outcome,
				...( result.failed ? [ `${ result.failed } failed` ] : [] ),
				...result.unmet,
				...( result.error ? [ result.error ] : [] ),
			];
			return `- \`${ result.id }\`: ${ notes.join( '; ' ) }`;
		} );
	return lines.length ? [ '', '### Runs to look at', '', ...lines ] : [];
}

/**
 * Formats an evaluation as Markdown, for the terminal and a pull request.
 * With an earlier evaluation, the figures are compared.
 *
 * @param evaluation The evaluation.
 * @param before     The earlier evaluation, if any.
 * @return The Markdown.
 */
export function formatReport( evaluation: Evaluation, before?: Evaluation ): string {
	const now = summarize( evaluation.results );
	const then = before && summarize( before.results );
	const header = then
		? [ '| | Before | After |', '| --- | --- | --- |' ]
		: [ '| | Result |', '| --- | --- |' ];
	const rows = ROWS.map( ( [ label, key, format ] ) =>
		then
			? `| ${ label } | ${ format( then[ key ] ) } | ${ format( now[ key ] ) } |`
			: `| ${ label } | ${ format( now[ key ] ) } |`
	);
	return [
		`## Skill evaluation: ${ evaluation.provider } ${ evaluation.model }`,
		'',
		`Skill for WordPress ${ evaluation.skill.wordpress ?? '?' }, block library ${
			evaluation.skill[ 'block-library' ] ?? '?'
		}. Run on ${ evaluation.date }.`,
		'',
		...header,
		...rows,
		...describeProblems( evaluation.results ),
	].join( '\n' );
}
