/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { select } from '@wordpress/data';
import { createElement, useEffect, useSyncExternalStore } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';

/**
 * Internal dependencies
 */
import './style.scss';

/**
 * How long a changed block stays highlighted, in milliseconds. The
 * stylesheet's animation fades out over the same time.
 */
export const HIGHLIGHT_DURATION = 4000;

export const HIGHLIGHT_CLASS_NAME = 'ai-content-editing-assistant-is-changed';

/**
 * Each block's attributes, by client ID. The block editor replaces a
 * block's attributes object only when they change, so comparing them tells
 * which blocks an edit changed.
 */
export type BlockSnapshot = ReadonlyMap< string, unknown >;

let highlighted: ReadonlySet< string > = new Set();
// The block to scroll to once it renders, if it is off-screen.
let scrollTarget: string | null = null;
const listeners = new Set< () => void >();
const timers = new Map< string, ReturnType< typeof setTimeout > >();

function setHighlighted( next: ReadonlySet< string > ) {
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
	const { getClientIdsWithDescendants, getBlockAttributes } = select( blockEditorStore );
	return new Map(
		getClientIdsWithDescendants().map( ( clientId ) => [
			clientId,
			getBlockAttributes( clientId ),
		] )
	);
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
			( clientId ) => ! before.has( clientId ) || before.get( clientId ) !== after.get( clientId )
		)
	);
	return [ ...changed ].filter(
		( clientId ) => ! getBlockParents( clientId ).some( ( parent ) => changed.has( parent ) )
	);
}

/**
 * Highlights the blocks for a few seconds, and scrolls to the first one
 * when it is off-screen. A block highlighted again stays highlighted for
 * the full time from now.
 *
 * @param clientIds The blocks to highlight, in document order.
 */
export function highlightBlocks( clientIds: string[] ) {
	if ( ! clientIds.length ) {
		return;
	}
	const next = new Set( highlighted );
	for ( const clientId of clientIds ) {
		next.add( clientId );
		clearTimeout( timers.get( clientId ) );
		timers.set(
			clientId,
			setTimeout( () => {
				timers.delete( clientId );
				const rest = new Set( highlighted );
				rest.delete( clientId );
				setHighlighted( rest );
			}, HIGHLIGHT_DURATION )
		);
	}
	scrollTarget = clientIds[ 0 ];
	setHighlighted( next );
}

/**
 * Highlights the blocks that changed since the snapshot.
 *
 * @param before The snapshot taken before the edit.
 */
export function highlightChanges( before: BlockSnapshot ) {
	highlightBlocks( findChangedBlocks( before ) );
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
 * Adds the highlight class to the changed blocks.
 *
 * @param BlockListBlock The block's component in the editor.
 * @return The component with the highlight.
 */
export function withChangeHighlight< P extends BlockListBlockProps >(
	BlockListBlock: ( props: P ) => unknown
) {
	return function ChangeHighlight( props: P ) {
		const { clientId, className } = props;
		const isChanged = useSyncExternalStore( subscribe, () => highlighted.has( clientId ) );

		useEffect( () => {
			if ( ! isChanged || scrollTarget !== clientId ) {
				return;
			}
			// Wait for the canvas to lay out the new block.
			const frame = window.requestAnimationFrame( () => {
				if ( scrollTarget === clientId ) {
					scrollTarget = null;
					scrollIntoViewIfNeeded( clientId );
				}
			} );
			return () => window.cancelAnimationFrame( frame );
		}, [ isChanged, clientId ] );

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
