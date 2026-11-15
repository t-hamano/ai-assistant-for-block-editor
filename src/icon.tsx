/**
 * WordPress dependencies
 */
import { SVG, Path } from '@wordpress/primitives';

const icon = (
	<SVG
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		style={ { fill: 'none' } }
		stroke="currentColor"
		strokeWidth="1.5"
	>
		<Path d="M8.5 8.25H14.5M8.5 11.75H15.5M8.5 15.25H12.5M11.5 4.75H7C6.30964 4.75 5.75 5.30964 5.75 6V18C5.75 18.6904 6.30964 19.25 7 19.25H17C17.6904 19.25 18.25 18.6904 18.25 18V12.5" />
		<Path
			d="M18 1C19 4 20 5 23 6C20 7 19 8 18 11C17 8 16 7 13 6C16 5 17 4 18 1Z"
			fill="currentColor"
			stroke="none"
		/>
	</SVG>
);

export default icon;
