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
		<Path d="M8.5 8.25H15.5M8.5 11.75H15.5M8.5 15.25H12.5M12.25 4.75H7C6.30964 4.75 5.75 5.30964 5.75 6V18C5.75 18.6904 6.30964 19.25 7 19.25H17C17.6904 19.25 18.25 18.6904 18.25 18V11.75" />
		<Path
			d="M18 1.75C18.51 3.88 20.13 5.49 22.25 6C20.13 6.51 18.51 8.13 18 10.25C17.49 8.13 15.88 6.51 13.75 6C15.88 5.49 17.49 3.88 18 1.75Z"
			fill="currentColor"
			stroke="none"
		/>
	</SVG>
);

export default icon;
