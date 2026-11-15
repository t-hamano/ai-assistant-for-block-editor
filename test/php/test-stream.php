<?php
/**
 * @package AI_Assistant_For_Block_Editor
 */

/**
 * Tests for the Stream class.
 */
class Test_Stream extends WP_UnitTestCase {

	/**
	 * Tests that the answer is passed on as it arrives, with the provider's status and content type.
	 */
	public function test_passes_the_answer_on() {
		$stream = new AABE_Test_Stream();

		$stream->read_header( null, "HTTP/1.1 100 Continue\r\n" );
		$stream->read_header( null, "HTTP/2 200\r\n" );
		$stream->read_header( null, "content-type: text/event-stream; charset=utf-8\r\n" );
		$stream->read_header( null, "\r\n" );

		$this->expectOutputString( "event: ping\ndata: {}\n\nevent: message_stop\n" );

		$this->assertSame( 22, $stream->write( null, "event: ping\ndata: {}\n\n" ) );
		$this->assertSame( 20, $stream->write( null, "event: message_stop\n" ) );
		$this->assertSame( array( 200, 'text/event-stream; charset=utf-8' ), $stream->started_with );
	}

	/**
	 * Tests that an error from the provider keeps its status and content type.
	 */
	public function test_passes_an_error_on() {
		$stream = new AABE_Test_Stream();

		$stream->read_header( null, "HTTP/2 401\r\n" );
		$stream->read_header( null, "Content-Type: application/json\r\n" );

		$this->expectOutputString( '{"type":"error"}' );

		$stream->write( null, '{"type":"error"}' );

		$this->assertSame( array( 401, 'application/json' ), $stream->started_with );
	}

	/**
	 * Tests that nothing is sent before the answer arrives.
	 */
	public function test_output_starts_with_the_answer() {
		$stream = new AABE_Test_Stream();

		$stream->read_header( null, "HTTP/2 200\r\n" );

		$this->assertNull( $stream->started_with );
	}

	/**
	 * Tests that an error is returned when the provider cannot be reached.
	 */
	public function test_unreachable_provider_is_an_error() {
		$error = ( new AABE_Test_Stream() )->send( 'http://127.0.0.1:9/', array(), '{}' );

		$this->assertWPError( $error );
		$this->assertSame( 502, $error->get_error_data()['status'] );
	}
}
