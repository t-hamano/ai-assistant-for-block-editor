#!/usr/bin/env node

/**
 * Draws the runs of `history.jsonl` as charts in one HTML file, which
 * opens in a browser without anything else: for each case, its total
 * input tokens, output tokens, and requests across the runs.
 *
 * Usage: npm run eval:chart
 */

/**
 * External dependencies
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Internal dependencies
 */
import { HISTORY, readHistory } from './record.mjs';

export const CHART = path.join( import.meta.dirname, 'history.html' );

const METRICS = [
	[ 'totalInputTokens', 'Total input tokens' ],
	[ 'outputTokens', 'Output tokens' ],
	[ 'requests', 'Requests' ],
];

const WIDTH = 320;
const HEIGHT = 140;
const PAD = { top: 12, right: 12, bottom: 24, left: 52 };

/**
 * Escapes text for HTML.
 *
 * @param {string|number} value The text.
 * @return {string} The escaped text.
 */
export function escape( value ) {
	return String( value )
		.replace( /&/g, '&amp;' )
		.replace( /</g, '&lt;' )
		.replace( />/g, '&gt;' )
		.replace( /"/g, '&quot;' );
}

/**
 * Formats a number with separators.
 *
 * @param {number} value The number.
 * @return {string} The text.
 */
const format = ( value ) => value.toLocaleString( 'en-US' );

/**
 * Lists the cases in the order they first appear in the history.
 *
 * @param {Object[]} runs The runs.
 * @return {string[]} The names of the cases.
 */
export function listCases( runs ) {
	return [ ...new Set( runs.flatMap( ( run ) => run.cases.map( ( item ) => item.case ) ) ) ];
}

/**
 * Finds the runs that start a new series of comparable runs: the first
 * run, and each run whose evaluation set or model differs from the run
 * before it.
 *
 * @param {Object[]} runs The runs.
 * @return {number[]} The indexes of those runs.
 */
export function findBreaks( runs ) {
	return runs
		.map( ( run, index ) => index )
		.filter(
			( index ) =>
				index === 0 ||
				runs[ index ].evalSet !== runs[ index - 1 ].evalSet ||
				runs[ index ].model !== runs[ index - 1 ].model
		);
}

/**
 * Draws one metric of one case across the runs.
 *
 * @param {Object[]} runs   The runs.
 * @param {string}   name   The case.
 * @param {string}   metric The metric's key.
 * @param {string}   label  The metric's name.
 * @param {number[]} breaks The runs that start a new evaluation set or model.
 * @return {string} The SVG.
 */
function drawMetric( runs, name, metric, label, breaks ) {
	const points = runs
		.map( ( run, index ) => ( { run, index, item: run.cases.find( ( c ) => c.case === name ) } ) )
		.filter( ( { item } ) => item && typeof item[ metric ] === 'number' );
	const plotWidth = WIDTH - PAD.left - PAD.right;
	const plotHeight = HEIGHT - PAD.top - PAD.bottom;
	const x = ( index ) =>
		PAD.left + ( runs.length > 1 ? ( index / ( runs.length - 1 ) ) * plotWidth : plotWidth / 2 );
	const values = points.map( ( { item } ) => item[ metric ] );
	let min = Math.min( ...values );
	let max = Math.max( ...values );
	// The scale fits the values rather than starting at zero, so that small changes show,
	// but spans at least a tenth of them, so that noise does not look large.
	const margin = Math.max( ( max - min ) * 0.15, max * 0.05, 1 );
	min = Math.max( 0, min - margin );
	max = max + margin;
	const y = ( value ) => PAD.top + ( 1 - ( value - min ) / ( max - min ) ) * plotHeight;

	const grid = [ min, ( min + max ) / 2, max ]
		.map(
			( value ) =>
				`<line class="grid" x1="${ PAD.left }" x2="${ WIDTH - PAD.right }" y1="${ y( value ) }" y2="${ y( value ) }"/>` +
				`<text class="tick" x="${ PAD.left - 6 }" y="${ y( value ) + 4 }" text-anchor="end">${ format( Math.round( value ) ) }</text>`
		)
		.join( '' );
	const divisions = breaks
		.filter( ( index ) => index > 0 )
		.map(
			( index ) =>
				`<line class="break" x1="${ x( index - 0.5 ) }" x2="${ x( index - 0.5 ) }" y1="${ PAD.top }" y2="${ HEIGHT - PAD.bottom }"/>`
		)
		.join( '' );
	// The line breaks where the evaluation set or the model changes, since those runs do not compare.
	const segments = [];
	for ( const point of points ) {
		const last = segments.at( -1 );
		if ( last && ! breaks.includes( point.index ) && last.at( -1 ).index === point.index - 1 ) {
			last.push( point );
		} else {
			segments.push( [ point ] );
		}
	}
	const lines = segments
		.filter( ( segment ) => segment.length > 1 )
		.map(
			( segment ) =>
				`<polyline class="line" points="${ segment
					.map( ( { index, item } ) => `${ x( index ) },${ y( item[ metric ] ) }` )
					.join( ' ' ) }"/>`
		)
		.join( '' );
	const marks = points
		.map( ( { run, index, item } ) => {
			const before = points.find(
				( point ) => point.index === index - 1 && ! breaks.includes( index )
			);
			const change = before
				? ` (${ item[ metric ] - before.item[ metric ] >= 0 ? '+' : '' }${ format(
						item[ metric ] - before.item[ metric ]
					) })`
				: '';
			const tip = [
				`${ run.commit }${ run.dirty ? ' (not committed)' : '' }`,
				run.date.slice( 0, 16 ).replace( 'T', ' ' ),
				`${ label }: ${ format( item[ metric ] ) }${ change }`,
				item.pass ? 'Passed' : 'Failed',
			].join( '\n' );
			return (
				`<circle class="point${ item.pass ? '' : ' failed' }" cx="${ x( index ) }" cy="${ y( item[ metric ] ) }" r="4"/>` +
				`<circle class="hit" cx="${ x( index ) }" cy="${ y( item[ metric ] ) }" r="12" data-tip="${ escape( tip ) }"/>`
			);
		} )
		.join( '' );
	const axis = runs
		.map( ( run, index ) =>
			runs.length <= 8 || index === 0 || index === runs.length - 1
				? `<text class="tick" x="${ x( index ) }" y="${ HEIGHT - 6 }" text-anchor="middle">${ escape(
						run.commit.slice( 0, 7 )
					) }</text>`
				: ''
		)
		.join( '' );

	return `<figure><figcaption>${ escape( label ) }</figcaption><svg viewBox="0 0 ${ WIDTH } ${ HEIGHT }" role="img" aria-label="${ escape(
		`${ label } of ${ name }`
	) }">${ grid }${ divisions }${ lines }${ marks }${ axis }</svg></figure>`;
}

/**
 * Builds the HTML page with the charts and a table of the runs.
 *
 * @param {Object[]} runs The runs, oldest first.
 * @return {string} The page.
 */
export function renderChart( runs ) {
	const breaks = findBreaks( runs );
	const cases = listCases( runs )
		.map(
			( name ) =>
				`<section><h2>${ escape( name ) }</h2><div class="row">${ METRICS.map(
					( [ metric, label ] ) => drawMetric( runs, name, metric, label, breaks )
				).join( '' ) }</div></section>`
		)
		.join( '' );
	const rows = runs
		.map(
			( run ) =>
				`<tr><td>${ escape( run.date.slice( 0, 16 ).replace( 'T', ' ' ) ) }</td><td><code>${ escape(
					run.commit
				) }</code>${ run.dirty ? ' (not committed)' : '' }</td><td>${ escape( run.evalSet ) }</td><td>${ escape(
					run.model
				) }</td><td>${ run.passed }/${ run.total }</td><td>${ format(
					run.totals.totalInputTokens
				) }</td><td>${ format( run.totals.outputTokens ) }</td><td>${ format( run.totals.requests ) }</td></tr>`
		)
		.reverse()
		.join( '' );

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Evaluation history</title>
<style>
:root {
	color-scheme: light;
	--surface: #fcfcfb;
	--text-primary: #0b0b0b;
	--text-secondary: #52514e;
	--grid: #e4e3df;
	--series: #2a78d6;
	--failed: #e34948;
}
@media (prefers-color-scheme: dark) {
	:root {
		color-scheme: dark;
		--surface: #1a1a19;
		--text-primary: #f0efec;
		--text-secondary: #c3c2b7;
		--grid: #3a3a37;
		--series: #3987e5;
		--failed: #e66767;
	}
}
body { margin: 0; padding: 24px 16px; background: var(--surface); color: var(--text-primary); font: 14px/1.5 system-ui, sans-serif; }
main { max-width: 1040px; margin: 0 auto; }
h1 { font-size: 20px; margin: 0 0 4px; }
h2 { font-size: 15px; margin: 32px 0 8px; }
p { color: var(--text-secondary); margin: 0 0 8px; }
.row { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
figure { margin: 0; }
figcaption { color: var(--text-secondary); font-size: 13px; }
svg { width: 100%; height: auto; overflow: visible; }
.grid { stroke: var(--grid); stroke-width: 1; }
.break { stroke: var(--text-secondary); stroke-width: 1; stroke-dasharray: 3 3; }
.tick { fill: var(--text-secondary); font-size: 11px; }
.line { fill: none; stroke: var(--series); stroke-width: 2; stroke-linejoin: round; }
.point { fill: var(--series); stroke: var(--surface); stroke-width: 2; }
.point.failed { fill: var(--surface); stroke: var(--failed); stroke-width: 2; }
.hit { fill: transparent; cursor: default; }
.table { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--grid); white-space: nowrap; }
th { color: var(--text-secondary); font-weight: 600; }
#tip { position: fixed; pointer-events: none; background: var(--text-primary); color: var(--surface); padding: 6px 8px; border-radius: 6px; font-size: 12px; white-space: pre; display: none; }
</style>
</head>
<body>
<main>
<h1>Evaluation history</h1>
<p>Each point is a run recorded in <code>history.jsonl</code>, oldest on the left. A hollow red point is a run where the case failed. A dashed line marks a change of the evaluation set or the model: runs on either side do not compare.</p>
${ cases }
<h2>Runs</h2>
<p>Newest first. The totals add up every case of the run, so they compare only between runs with the same cases.</p>
<div class="table"><table>
<thead><tr><th>Date (UTC)</th><th>Commit</th><th>Set</th><th>Model</th><th>Passed</th><th>Total input</th><th>Output</th><th>Requests</th></tr></thead>
<tbody>${ rows }</tbody>
</table></div>
</main>
<div id="tip"></div>
<script>
const tip = document.getElementById( 'tip' );
document.addEventListener( 'pointerover', ( event ) => {
	const text = event.target.dataset?.tip;
	tip.style.display = text ? 'block' : 'none';
	if ( text ) {
		tip.textContent = text;
		const box = event.target.getBoundingClientRect();
		tip.style.left = Math.min( box.right + 4, innerWidth - tip.offsetWidth - 8 ) + 'px';
		tip.style.top = Math.max( box.top - tip.offsetHeight - 4, 8 ) + 'px';
	}
} );
</script>
</body>
</html>
`;
}

/* eslint-disable no-console -- A command line script reports through the console. */
if ( import.meta.main ) {
	const runs = fs.existsSync( HISTORY ) ? readHistory( fs.readFileSync( HISTORY, 'utf8' ) ) : [];
	if ( ! runs.length ) {
		console.error( 'history.jsonl has no runs yet. Record one with `npm run eval:record`.' );
		process.exit( 1 );
	}
	fs.writeFileSync( CHART, renderChart( runs ) );
	console.log( `Open ${ CHART } in a browser.` );
}
