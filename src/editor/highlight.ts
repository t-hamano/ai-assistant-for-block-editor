/**
 * WordPress dependencies
 */
import { speak } from '@wordpress/a11y';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { select } from '@wordpress/data';
import { createElement, useEffect, useSyncExternalStore } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import './canvas.scss';

/**
 * How long a changed block stays highlighted, in milliseconds. The
 * stylesheet's animation fades out over the same time.
 */
export const HIGHLIGHT_DURATION = 1000;

export const HIGHLIGHT_CLASS_NAME = 'ai-content-editing-assistant-is-changed';

/**
 * The name of the CSS custom highlight that colors the changed text.
 */
export const TEXT_HIGHLIGHT_NAME = 'ai-content-editing-assistant-changed-text';

type BlockState = {
	// The block editor replaces a block's attributes object only when they
	// change, so comparing them tells which blocks an edit changed.
	attributes: unknown;
	// The block's parent and place in it, to find the block that took its
	// place when it is replaced.
	parent: string;
	index: number;
	// The block's text in the canvas, if it is rendered.
	text: string | null;
};

/**
 * Each block's state, by client ID, in document order.
 */
export type BlockSnapshot = ReadonlyMap< string, BlockState >;

// Each highlighted block, with a number that changes each time it is
// highlighted again.
let highlighted: ReadonlyMap< string, number > = new Map();
let generation = 0;
// The block to scroll to once it renders, if it is off-screen.
let scrollTarget: string | null = null;
const listeners = new Set< () => void >();
const timers = new Map< string, ReturnType< typeof setTimeout > >();
// The text of each highlighted block before the edit.
const previousTexts = new Map< string, string >();
// The changed text of each highlighted block, and the windows whose
// highlight registry holds some of it.
const textRanges = new Map< string, Range >();
let paintedViews = new Set< Window >();

function setHighlighted( next: ReadonlyMap< string, number > ) {
	highlighted = next;
	listeners.forEach( ( listener ) => listener() );
}

function subscribe( listener: () => void ) {
	listeners.add( listener );
	return () => {
		listeners.delete( listener );
	};
}

/**
 * Takes a snapshot of the blocks in the editor, to compare with after an
 * edit.
 *
 * @return The snapshot.
 */
export function takeBlockSnapshot(): BlockSnapshot {
	const { getBlockOrder, getBlockAttributes } = select( blockEditorStore );
	const snapshot = new Map< string, BlockState >();
	const walk = ( parent: string ) => {
		getBlockOrder( parent ).forEach( ( clientId, index ) => {
			snapshot.set( clientId, {
				attributes: getBlockAttributes( clientId ),
				parent,
				index,
				text: getBlockElement( clientId )?.textContent ?? null,
			} );
			walk( clientId );
		} );
	};
	walk( '' );
	return snapshot;
}

/**
 * Finds the blocks that are new, or whose attributes changed, since the
 * snapshot. A changed block's inner blocks are left out, since its
 * highlight covers them.
 *
 * @param before The snapshot taken before the edit.
 * @return The client IDs of the changed blocks, in document order.
 */
export function findChangedBlocks( before: BlockSnapshot ): string[] {
	const { getBlockParents } = select( blockEditorStore );
	const after = takeBlockSnapshot();
	const changed = new Set(
		[ ...after.keys() ].filter(
			( clientId ) =>
				! before.has( clientId ) ||
				before.get( clientId )?.attributes !== after.get( clientId )?.attributes
		)
	);
	return [ ...changed ].filter(
		( clientId ) => ! getBlockParents( clientId ).some( ( parent ) => changed.has( parent ) )
	);
}

/**
 * Finds the text of a changed block before the edit. A block that took
 * the place of another one is compared with the one it replaced.
 *
 * @param before   The snapshot taken before the edit.
 * @param clientId The changed block's client ID.
 * @return The text, if the block or the one it replaced was rendered.
 */
function findPreviousText( before: BlockSnapshot, clientId: string ): string | null {
	const state = before.get( clientId );
	if ( state ) {
		return state.text;
	}
	const { getBlock, getBlockIndex, getBlockRootClientId } = select( blockEditorStore );
	const parent = getBlockRootClientId( clientId ) ?? '';
	const index = getBlockIndex( clientId );
	for ( const [ id, old ] of before ) {
		if ( old.parent === parent && old.index === index && ! getBlock( id ) ) {
			return old.text;
		}
	}
	return null;
}

/**
 * Finds the part of the text that changed, from the first character that
 * differs to the last one.
 *
 * @param before The text before the change.
 * @param after  The text after the change.
 * @return The start and end of the changed part in the new text, or null
 *         when no text was added or changed.
 */
export function diffText( before: string, after: string ): { start: number; end: number } | null {
	const length = Math.min( before.length, after.length );
	let start = 0;
	while ( start < length && before[ start ] === after[ start ] ) {
		start++;
	}
	let suffix = 0;
	while (
		suffix < length - start &&
		before[ before.length - 1 - suffix ] === after[ after.length - 1 - suffix ]
	) {
		suffix++;
	}
	let end = after.length - suffix;
	// Keep characters made of two code units whole.
	if ( start > 0 && isHighSurrogate( after.charCodeAt( start - 1 ) ) ) {
		start--;
	}
	if ( end < after.length && isHighSurrogate( after.charCodeAt( end - 1 ) ) ) {
		end++;
	}
	return start < end ? { start, end } : null;
}

function isHighSurrogate( code: number ): boolean {
	return code >= 0xd800 && code <= 0xdbff;
}

/**
 * Creates a range over the element's text, between two character offsets.
 *
 * @param element The element.
 * @param start   The offset of the first character.
 * @param end     The offset after the last character.
 * @return The range, or null when the offsets are past the text.
 */
export function createTextRange( element: Element, start: number, end: number ): Range | null {
	const document = element.ownerDocument;
	const walker = document.createTreeWalker( element, NodeFilter.SHOW_TEXT );
	const range = document.createRange();
	let offset = 0;
	let hasStart = false;
	for ( let node = walker.nextNode(); node; node = walker.nextNode() ) {
		const length = node.nodeValue?.length ?? 0;
		if ( ! hasStart && start < offset + length ) {
			range.setStart( node, start - offset );
			hasStart = true;
		}
		if ( hasStart && end <= offset + length ) {
			range.setEnd( node, end - offset );
			return range;
		}
		offset += length;
	}
	return null;
}

/**
 * Colors the text that changed in each highlighted block, in each window
 * that shows some of it.
 */
function paintTextHighlight() {
	const rangesByView = new Map< Window, Range[] >();
	for ( const range of textRanges.values() ) {
		const view = range.startContainer.ownerDocument?.defaultView;
		if ( view ) {
			rangesByView.set( view, [ ...( rangesByView.get( view ) ?? [] ), range ] );
		}
	}
	for ( const view of new Set( [ ...paintedViews, ...rangesByView.keys() ] ) ) {
		const { CSS: css, Highlight: CustomHighlight } = view as Window & typeof globalThis;
		// Browsers without the CSS Custom Highlight API show only the
		// block highlight.
		if ( ! css?.highlights || ! CustomHighlight ) {
			continue;
		}
		const ranges = rangesByView.get( view );
		if ( ranges ) {
			css.highlights.set( TEXT_HIGHLIGHT_NAME, new CustomHighlight( ...ranges ) );
		} else {
			css.highlights.delete( TEXT_HIGHLIGHT_NAME );
		}
	}
	paintedViews = new Set( rangesByView.keys() );
}

function highlightText( clientId: string ) {
	const previous = previousTexts.get( clientId );
	const element = getBlockElement( clientId );
	if ( previous === undefined || ! element ) {
		return;
	}
	const changed = diffText( previous, element.textContent ?? '' );
	const range = changed && createTextRange( element, changed.start, changed.end );
	if ( range ) {
		textRanges.set( clientId, range );
		paintTextHighlight();
	}
}

function clearTextHighlight( clientId: string ) {
	if ( textRanges.delete( clientId ) ) {
		paintTextHighlight();
	}
}

/**
 * Highlights the blocks for a few seconds, and scrolls to the first one
 * when it is off-screen. A block highlighted again stays highlighted for
 * the full time from now.
 *
 * @param clientIds The blocks to highlight, in document order.
 * @param texts     The text of the blocks before the edit, by client ID,
 *                  to color the text that changed.
 */
export function highlightBlocks(
	clientIds: string[],
	texts: ReadonlyMap< string, string > = new Map()
) {
	if ( ! clientIds.length ) {
		return;
	}
	generation++;
	const next = new Map( highlighted );
	for ( const clientId of clientIds ) {
		next.set( clientId, generation );
		const text = texts.get( clientId );
		if ( text === undefined ) {
			previousTexts.delete( clientId );
		} else {
			previousTexts.set( clientId, text );
		}
		clearTimeout( timers.get( clientId ) );
		timers.set(
			clientId,
			setTimeout( () => {
				timers.delete( clientId );
				previousTexts.delete( clientId );
				const rest = new Map( highlighted );
				rest.delete( clientId );
				setHighlighted( rest );
			}, HIGHLIGHT_DURATION )
		);
	}
	scrollTarget = clientIds[ 0 ];
	setHighlighted( next );
}

/**
 * Highlights the blocks and the text that changed since the snapshot, and
 * announces the change to screen readers.
 *
 * @param before The snapshot taken before the edit.
 */
export function highlightChanges( before: BlockSnapshot ) {
	const clientIds = findChangedBlocks( before );
	if ( ! clientIds.length ) {
		return;
	}
	const texts = new Map< string, string >();
	for ( const clientId of clientIds ) {
		const text = findPreviousText( before, clientId );
		if ( text !== null ) {
			texts.set( clientId, text );
		}
	}
	highlightBlocks( clientIds, texts );
	speak(
		sprintf(
			/* translators: %d: The number of blocks. */
			_n(
				'The AI changed %d block.',
				'The AI changed %d blocks.',
				clientIds.length,
				'ai-content-editing-assistant'
			),
			clientIds.length
		)
	);
}

/**
 * Whether the block is highlighted now.
 *
 * @param clientId The block's client ID.
 * @return Whether it is highlighted.
 */
export function isHighlighted( clientId: string ): boolean {
	return highlighted.has( clientId );
}

/**
 * Finds the block's element, in the editor canvas iframe or, when the
 * canvas is not an iframe, in the page.
 *
 * @param clientId The block's client ID.
 * @return The element, if the block is rendered.
 */
function getBlockElement( clientId: string ): HTMLElement | null {
	const id = `block-${ clientId }`;
	const canvas = document.querySelector< HTMLIFrameElement >( 'iframe[name="editor-canvas"]' );
	return canvas?.contentDocument?.getElementById( id ) ?? document.getElementById( id );
}

function scrollIntoViewIfNeeded( clientId: string ) {
	const element = getBlockElement( clientId );
	const view = element?.ownerDocument.defaultView;
	if ( ! element || ! view ) {
		return;
	}
	const { top, bottom } = element.getBoundingClientRect();
	if ( bottom <= 0 || top >= view.innerHeight ) {
		element.scrollIntoView( { block: 'center', behavior: 'smooth' } );
	}
}

type BlockListBlockProps = {
	clientId: string;
	className?: string;
};

/**
 * Adds the highlight class to the changed blocks, and colors their changed
 * text.
 *
 * @param BlockListBlock The block's component in the editor.
 * @return The component with the highlight.
 */
export function withChangeHighlight< P extends BlockListBlockProps >(
	BlockListBlock: ( props: P ) => unknown
) {
	return function ChangeHighlight( props: P ) {
		const { clientId, className } = props;
		const changedAt = useSyncExternalStore( subscribe, () => highlighted.get( clientId ) ?? 0 );
		const isChanged = changedAt !== 0;

		useEffect( () => {
			if ( ! changedAt ) {
				return;
			}
			// Wait for the canvas to lay out the new block.
			const frame = window.requestAnimationFrame( () => {
				if ( scrollTarget === clientId ) {
					scrollTarget = null;
					scrollIntoViewIfNeeded( clientId );
				}
				highlightText( clientId );
			} );
			return () => {
				window.cancelAnimationFrame( frame );
				clearTextHighlight( clientId );
			};
		}, [ changedAt, clientId ] );

		return createElement( BlockListBlock as ( props: P ) => null, {
			...props,
			className: isChanged
				? [ className, HIGHLIGHT_CLASS_NAME ].filter( Boolean ).join( ' ' )
				: className,
		} );
	};
}

/**
 * Registers the highlight of changed blocks in the editor.
 */
export function registerChangeHighlight() {
	addFilter(
		'editor.BlockListBlock',
		'ai-content-editing-assistant/change-highlight',
		withChangeHighlight
	);
}
