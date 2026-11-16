/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { combineRuns, compare, readEvalSet, readHistory, summarize } from '../record.mjs';

const usage = ( inputTokens: number, outputTokens: number, requests: number ) => ( {
	inputTokens,
	cacheReadTokens: 1000,
	cacheWriteTokens: 200,
	outputTokens,
	requests,
} );

const item = ( description: string, success: boolean, result?: object ) => ( {
	testCase: { description },
	success,
	provider: { id: 'file://provider.mjs', label: 'claude-sonnet-5-5' },
	response: result ? { metadata: { result } } : { error: 'Anthropic answered with an error' },
	gradingResult: {
		componentResults: [
			{ pass: true, assertion: { metric: 'validMarkup' } },
			{ pass: success, assertion: { metric: 'firstTry' } },
			// The usage check has no metric.
			{ pass: true, assertion: {} },
		],
	},
} );

const output = {
	evalId: 'eval-abc',
	config: { description: 'AI assistant evaluation, eval set v1' },
	results: {
		timestamp: '2026-11-16T12:00:00.000Z',
		results: [
			item( 'Rewrite', true, {
				model: 'claude-sonnet-5-5',
				retries: 0,
				usage: usage( 10, 100, 2 ),
			} ),
			item( 'Columns', false, {
				model: 'claude-sonnet-5-5',
				retries: 1,
				usage: usage( 20, 300, 4 ),
			} ),
			item( 'Outline', false ),
		],
	},
};

describe( 'readEvalSet', () => {
	it( 'reads the version from the description', () => {
		expect( readEvalSet( 'AI assistant evaluation, eval set v2' ) ).toBe( 'v2' );
		expect( readEvalSet( 'Something else' ) ).toBe( 'Something else' );
	} );
} );

describe( 'summarize', () => {
	const run = summarize( output, { commit: 'abc123', dirty: false } );

	it( 'records the run', () => {
		expect( run ).toMatchObject( {
			date: '2026-11-16T12:00:00.000Z',
			evalId: 'eval-abc',
			commit: 'abc123',
			dirty: false,
			evalSet: 'v1',
			model: 'claude-sonnet-5-5',
			runs: 1,
			passed: 1,
			total: 3,
		} );
	} );

	it( 'records each case with its checks and usage', () => {
		expect( run.cases[ 1 ] ).toEqual( {
			case: 'Columns',
			pass: false,
			checks: { validMarkup: true, firstTry: false },
			inputTokens: 20,
			cacheReadTokens: 1000,
			cacheWriteTokens: 200,
			totalInputTokens: 1220,
			outputTokens: 300,
			requests: 4,
			retries: 1,
		} );
		expect( run.cases[ 2 ] ).toEqual( {
			case: 'Outline',
			pass: false,
			error: 'Anthropic answered with an error',
		} );
	} );

	it( 'adds up the usage of the cases', () => {
		expect( run.totals ).toEqual( {
			inputTokens: 30,
			cacheReadTokens: 2000,
			cacheWriteTokens: 400,
			totalInputTokens: 2430,
			outputTokens: 400,
			requests: 6,
			retries: 1,
		} );
	} );

	it( 'is read back from the history', () => {
		expect( readHistory( `${ JSON.stringify( run ) }\n\n` ) ).toEqual( [ run ] );
	} );
} );

describe( 'summarize with repeated runs', () => {
	const result = ( input: number, outputTokens: number, requests: number ) => ( {
		model: 'claude-sonnet-5-5',
		retries: 0,
		usage: usage( input, outputTokens, requests ),
	} );
	const run = summarize(
		{
			...output,
			results: {
				...output.results,
				results: [
					item( 'Rewrite', true, result( 10, 100, 1 ) ),
					item( 'Rewrite', true, result( 20, 200, 2 ) ),
					item( 'Rewrite', true, result( 30, 300, 2 ) ),
					item( 'Outline', true, result( 10, 100, 1 ) ),
					item( 'Outline', false, result( 20, 200, 3 ) ),
					item( 'Outline', false ),
				],
			},
		},
		{ commit: 'abc123', dirty: false }
	);

	it( 'records each case once, with the average of its runs', () => {
		expect( run ).toMatchObject( { runs: 3, passed: 1, total: 2 } );
		expect( run.cases[ 0 ] ).toEqual( {
			case: 'Rewrite',
			pass: true,
			runs: 3,
			passes: 3,
			checks: { validMarkup: true, firstTry: true },
			inputTokens: 20,
			cacheReadTokens: 1000,
			cacheWriteTokens: 200,
			totalInputTokens: 1220,
			outputTokens: 200,
			requests: 1.7,
			retries: 0,
		} );
	} );

	it( 'leaves the runs that ended in an error out of the average', () => {
		expect( run.cases[ 1 ] ).toEqual( {
			case: 'Outline',
			pass: false,
			runs: 3,
			passes: 1,
			errors: 1,
			checks: { validMarkup: true, firstTry: false },
			inputTokens: 15,
			cacheReadTokens: 1000,
			cacheWriteTokens: 200,
			totalInputTokens: 1215,
			outputTokens: 150,
			requests: 2,
			retries: 0,
		} );
	} );

	it( 'adds up the averages', () => {
		expect( run.totals ).toMatchObject( { totalInputTokens: 2435, requests: 3.7 } );
	} );

	it( 'keeps the error when every run ended in one', () => {
		expect(
			combineRuns( [
				{ case: 'Outline', pass: false, error: 'Overloaded' },
				{ case: 'Outline', pass: false, error: 'Overloaded' },
			] )
		).toEqual( { case: 'Outline', pass: false, runs: 2, passes: 0, error: 'Overloaded' } );
	} );
} );

describe( 'compare', () => {
	it( 'compares only the cases both runs have', () => {
		const earlier = summarize(
			{
				...output,
				results: {
					...output.results,
					results: [
						item( 'Rewrite', true, {
							model: 'claude-sonnet-5-5',
							retries: 0,
							usage: usage( 10, 200, 2 ),
						} ),
					],
				},
			},
			{ commit: 'old', dirty: false }
		);
		const run = summarize( output, { commit: 'new', dirty: false } );
		expect( compare( run, earlier ) ).toEqual( [
			'Compared with old (2026-11-16T12:00:00.000Z), on the 1 cases both runs have:',
			'  passed:             1 -> 1',
			'  total input tokens: 1210 -> 1210 (0.0%)',
			'  output tokens:      200 -> 100 (-50.0%)',
			'  requests:           2 -> 2 (0.0%)',
		] );
	} );

	it( 'says when one run averages repeated runs', () => {
		const run = summarize( output, { commit: 'new', dirty: false } );
		const lines = compare( { ...run, runs: 3 }, { ...run, runs: undefined } );
		expect( lines[ 1 ] ).toBe(
			'  The earlier run ran each case once, and this run 3 times, so one of them compares single runs with averages.'
		);
	} );
} );
