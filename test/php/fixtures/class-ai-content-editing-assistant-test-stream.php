<?php
/**
 * @package AI_Content_Editing_Assistant
 */

use AI_Content_Editing_Assistant\Stream;

/**
 * A stream that records the status and content type it would send, instead
 * of sending headers and closing the test's output buffers.
 */
class AI_Content_Editing_Assistant_Test_Stream extends Stream {

	/**
	 * The status and content type cURL reports for the answer.
	 *
	 * @var array
	 */
	public $info = array( 200, 'text/event-stream' );

	/**
	 * The status and content type at the time the output started, if it did.
	 *
	 * @var array|null
	 */
	public $started_with;

	/**
	 * Returns the status and content type set for the test.
	 *
	 * @param mixed $handle The cURL handle.
	 * @return array
	 */
	protected function read_info( $handle ): array {
		return $this->info;
	}

	/**
	 * Records the status and content type.
	 */
	protected function start_output() {
		$this->started_with = array( $this->status, $this->content_type );
	}
}
