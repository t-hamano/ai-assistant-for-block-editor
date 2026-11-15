/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { formatReport, summarize, type Evaluation } from '../report';
import type { CaseResult } from '../run-case';

function result( values: Partial< CaseResult > ): CaseResult {
	return {
		id: 'case',
		outcome: 'edited',
		firstTry: true,
		applied: 1,
		failed: 0,
		autoFixed: 0,
		failures: [],
		unmet: [],
		usage: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 10 },
		seconds: 1,
		requestSize: { system: 1, message: 1 },
		...values,
	};
}

const RESULTS = [
	result( { id: 'a' } ),
	result( { id: 'b', firstTry: false, failed: 2, autoFixed: 1 } ),
	result( {
		id: 'c',
		outcome: 'gave-up',
		firstTry: false,
		applied: 0,
		failed: 4,
		unmet: [ 'has no core/table' ],
	} ),
	result( { id: 'd', outcome: 'error', firstTry: false, applied: 0, error: 'Overloaded' } ),
];

describe( 'summarize', () => {
	it( 'leaves the runs whose request failed out of the rates', () => {
		expect( summarize( RESULTS ) ).toEqual( {
			runs: 3,
			firstTryRate: 1 / 3,
			retriesPerRun: 2,
			autoFixed: 1,
			gaveUp: 1,
			noEdit: 0,
			errors: 1,
			expectedRate: 2 / 3,
			inputTokens: 400,
			outputTokens: 40,
		} );
	} );
} );

describe( 'formatReport', () => {
	const evaluation: Evaluation = {
		provider: 'anthropic',
		model: 'model',
		skill: { wordpress: '7.1', 'block-library': '12.1.0' },
		date: '2026-11-15',
		results: RESULTS,
	};

	it( 'lists the figures and the runs to look at', () => {
		const report = formatReport( evaluation );
		expect( report ).toContain( '| First-try pass rate | 33.3% |' );
		expect( report ).toContain( '- `b`: edited; 2 failed' );
		expect( report ).toContain( '- `c`: gave-up; 4 failed; has no core/table' );
		expect( report ).toContain( '- `d`: error; Overloaded' );
		expect( report ).not.toContain( '`a`' );
	} );

	it( 'compares with an earlier evaluation', () => {
		const before = { ...evaluation, results: [ result( { firstTry: false, failed: 1 } ) ] };
		expect( formatReport( evaluation, before ) ).toContain(
			'| First-try pass rate | 0.0% | 33.3% |'
		);
	} );
} );
