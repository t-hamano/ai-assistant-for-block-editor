#!/usr/bin/env node

/**
 * Adds the results of an evaluation run to `history.jsonl`, one line per
 * run, and prints how the run compares with the last one recorded for
 * the same evaluation set and model. Committing the line keeps the
 * history of the results in Git.
 *
 * Usage: npm run eval -- -o results.json && npm run eval:record [-- results.json]
 */

/**
 * External dependencies
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const HISTORY = path.join( import.meta.dirname, 'history.jsonl' );

const USAGE_KEYS = [
	'inputTokens',
	'cacheReadTokens',
	'cacheWriteTokens',
	'totalInputTokens',
	'outputTokens',
	'requests',
	'retries',
];

/**
 * Reads the version of the evaluation set from the description in
 * `promptfooconfig.yaml`, such as `v1` from "eval set v1".
 *
 * @param {string} description The description.
 * @return {string} The version, or the whole description when it names none.
 */
export function readEvalSet( description = '' ) {
	return description.match( /eval set (\S+)/i )?.[ 1 ] ?? description;
}

/**
 * Summarizes one case of promptfoo's results.
 *
 * @param {Object} item One of `results.results` of promptfoo's output file.
 * @return {Object} The case's line in the history.
 */
export function summarizeCase( item ) {
	const name = item.testCase?.description ?? item.vars?.request ?? '';
	const result = item.response?.metadata?.result;
	if ( ! result ) {
		return {
			case: name,
			pass: false,
			error: item.error || item.response?.error || 'No result.',
		};
	}
	const checks = {};
	for ( const component of item.gradingResult?.componentResults ?? [] ) {
		const metric = component.assertion?.metric;
		if ( metric ) {
			checks[ metric ] = component.pass;
		}
	}
	const { inputTokens, cacheReadTokens, cacheWriteTokens, outputTokens, requests } = result.usage;
	return {
		case: name,
		pass: Boolean( item.success ),
		checks,
		inputTokens,
		cacheReadTokens,
		cacheWriteTokens,
		totalInputTokens: inputTokens + cacheReadTokens + cacheWriteTokens,
		outputTokens,
		requests,
		retries: result.retries,
	};
}

/**
 * Adds up the usage of cases.
 *
 * @param {Object[]} cases The cases, as `summarizeCase()` returns them.
 * @return {Object} The totals.
 */
export function addUp( cases ) {
	const totals = Object.fromEntries( USAGE_KEYS.map( ( key ) => [ key, 0 ] ) );
	for ( const item of cases ) {
		for ( const key of USAGE_KEYS ) {
			totals[ key ] += item[ key ] ?? 0;
		}
	}
	return totals;
}

/**
 * Builds the history's line for a run.
 *
 * @param {Object}  output     promptfoo's output file, as JSON.
 * @param {Object}  git        Where the code was.
 * @param {string}  git.commit The commit.
 * @param {boolean} git.dirty  Whether there were changes not committed.
 * @param {string}  [now]      The time to record when the output has none.
 * @return {Object} The line.
 */
export function summarize( output, { commit, dirty }, now = new Date().toISOString() ) {
	const items = output.results?.results ?? [];
	const cases = items.map( summarizeCase );
	const model =
		items.map( ( item ) => item.response?.metadata?.result?.model ).find( Boolean ) ??
		items.map( ( item ) => item.provider?.label ).find( Boolean ) ??
		'';
	const timestamp = output.results?.timestamp;
	return {
		date: timestamp ? new Date( timestamp ).toISOString() : now,
		evalId: output.evalId ?? null,
		commit,
		dirty,
		evalSet: readEvalSet( output.config?.description ),
		model,
		passed: cases.filter( ( item ) => item.pass ).length,
		total: cases.length,
		totals: addUp( cases ),
		cases,
	};
}

/**
 * Reads the history.
 *
 * @param {string} text The content of `history.jsonl`.
 * @return {Object[]} The runs, oldest first.
 */
export function readHistory( text ) {
	return text
		.split( '\n' )
		.filter( ( line ) => line.trim() )
		.map( ( line ) => JSON.parse( line ) );
}

/**
 * Compares a run with an earlier one, counting only the cases both have,
 * by the tokens and requests that do not depend on the prompt cache.
 *
 * @param {Object} run     The run.
 * @param {Object} earlier The earlier run.
 * @return {string[]} The lines to print.
 */
export function compare( run, earlier ) {
	const before = new Map( earlier.cases.map( ( item ) => [ item.case, item ] ) );
	const shared = run.cases.filter( ( item ) => before.has( item.case ) );
	const now = addUp( shared );
	const then = addUp( shared.map( ( item ) => before.get( item.case ) ) );
	const change = ( key ) => {
		const difference = now[ key ] - then[ key ];
		const percent = then[ key ]
			? ` (${ ( ( difference / then[ key ] ) * 100 ).toFixed( 1 ) }%)`
			: '';
		return `${ then[ key ] } -> ${ now[ key ] }${ percent }`;
	};
	const passed = ( cases ) => cases.filter( ( item ) => item.pass ).length;
	return [
		`Compared with ${ earlier.commit } (${ earlier.date }), on the ${ shared.length } cases both runs have:`,
		`  passed:             ${ passed( shared.map( ( item ) => before.get( item.case ) ) ) } -> ${ passed( shared ) }`,
		`  total input tokens: ${ change( 'totalInputTokens' ) }`,
		`  output tokens:      ${ change( 'outputTokens' ) }`,
		`  requests:           ${ change( 'requests' ) }`,
	];
}

/* eslint-disable no-console -- A command line script reports through the console. */
if ( import.meta.main ) {
	const file = path.resolve( process.argv[ 2 ] ?? 'results.json' );
	if ( ! fs.existsSync( file ) ) {
		console.error(
			`${ file } does not exist. Run the evaluation with \`npm run eval -- -o results.json\` first.`
		);
		process.exit( 1 );
	}
	const git = ( ...args ) => execFileSync( 'git', args, { encoding: 'utf8' } ).trim();
	const run = summarize( JSON.parse( fs.readFileSync( file, 'utf8' ) ), {
		commit: git( 'rev-parse', '--short=12', 'HEAD' ),
		// The history itself changes with every run, so it does not count.
		dirty: Boolean( git( 'status', '--porcelain', '--', '.', `:!${ HISTORY }` ) ),
	} );
	const history = fs.existsSync( HISTORY ) ? readHistory( fs.readFileSync( HISTORY, 'utf8' ) ) : [];
	if ( run.evalId && history.some( ( earlier ) => earlier.evalId === run.evalId ) ) {
		console.error( `This run (${ run.evalId }) is already in the history.` );
		process.exit( 1 );
	}
	fs.appendFileSync( HISTORY, JSON.stringify( run ) + '\n' );

	console.log(
		`Recorded ${ run.passed }/${ run.total } passed, eval set ${ run.evalSet }, ${ run.model }, at ${ run.commit }.`
	);
	if ( run.dirty ) {
		console.log(
			'The code had changes that are not committed, so the commit does not show all of it.'
		);
	}
	const earlier = history.findLast(
		( item ) => item.evalSet === run.evalSet && item.model === run.model
	);
	console.log(
		earlier
			? compare( run, earlier ).join( '\n' )
			: 'No earlier run of this evaluation set to compare with.'
	);
}
