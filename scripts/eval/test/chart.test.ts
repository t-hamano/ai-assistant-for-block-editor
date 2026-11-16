/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { findBreaks, listCases, renderChart } from '../chart.mjs';

const item = ( name: string, totalInputTokens: number, pass = true ) => ( {
	case: name,
	pass,
	totalInputTokens,
	outputTokens: 100,
	requests: 2,
} );

const run = ( commit: string, evalSet: string, cases: object[] ) => ( {
	date: '2026-11-16T12:00:00.000Z',
	commit,
	dirty: false,
	evalSet,
	model: 'claude-sonnet-5-5',
	passed: 1,
	total: cases.length,
	totals: { totalInputTokens: 1000, outputTokens: 100, requests: 2 },
	cases,
} );

const runs = [
	run( 'aaaaaaaaaaaa', 'v1', [ item( 'Rewrite', 1000 ) ] ),
	run( 'bbbbbbbbbbbb', 'v1', [ item( 'Rewrite', 900 ), item( '<Columns>', 500, false ) ] ),
	run( 'cccccccccccc', 'v2', [ item( 'Rewrite', 950 ), item( '<Columns>', 520 ) ] ),
];

describe( 'listCases', () => {
	it( 'lists the cases in the order they first appear', () => {
		expect( listCases( runs ) ).toEqual( [ 'Rewrite', '<Columns>' ] );
	} );
} );

describe( 'findBreaks', () => {
	it( 'finds the first run and the runs where the evaluation set or model changes', () => {
		expect( findBreaks( runs ) ).toEqual( [ 0, 2 ] );
		expect( findBreaks( [ runs[ 0 ], { ...runs[ 1 ], model: 'claude-opus-5-5' } ] ) ).toEqual( [
			0, 1,
		] );
	} );
} );

describe( 'renderChart', () => {
	const html = renderChart( runs );

	it( 'draws each metric of each case', () => {
		expect( html.match( /<figure>/g ) ).toHaveLength( 6 );
		expect( html ).toContain( '&lt;Columns&gt;' );
		expect( html ).not.toContain( '<Columns>' );
	} );

	it( 'marks failed runs and changes of the evaluation set', () => {
		expect( html ).toContain( 'class="point failed"' );
		expect( html.match( /class="break"/g ) ).toHaveLength( 6 );
	} );

	it( 'does not join runs of different evaluation sets with a line', () => {
		// Only "Rewrite" has two runs of v1 in a row, one line for each metric.
		expect( html.match( /<polyline/g ) ).toHaveLength( 3 );
	} );

	it( 'marks a case that ended in an error, which has no usage', () => {
		const page = renderChart( [
			run( 'aaaaaaaaaaaa', 'v1', [ { case: 'Outline', pass: false, error: 'Request timed out' } ] ),
		] );
		expect( page.match( /class="error"/g ) ).toHaveLength( 3 );
		expect( page ).toContain( 'Error: Request timed out' );
		expect( page ).not.toContain( 'NaN' );
		expect( html ).not.toContain( 'Infinity' );
	} );

	it( 'shows the change from the run before in the tooltip', () => {
		expect( html ).toContain( 'Total input tokens: 900 (-100)' );
		// The first run of v2 does not compare with the run before.
		expect( html ).toContain( 'Total input tokens: 950\n' );
	} );
} );
