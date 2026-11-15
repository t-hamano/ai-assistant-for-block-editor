<?php
/**
 * @package AI_Content_Editing_Assistant
 * @author Aki Hamano
 * @license GPL-2.0+
 */

namespace AI_Content_Editing_Assistant;

use WP_Error;

/**
 * Sends a request to the provider and passes its streamed answer (Server-Sent
 * Events) on to the browser as each piece arrives.
 *
 * cURL is used directly, because `wp_remote_post()` waits for the whole
 * answer before returning it.
 */
class Stream {

	/**
	 * The provider's HTTP status
	 *
	 * @var int
	 */
	protected $status = 0;

	/**
	 * The provider's content type
	 *
	 * @var string
	 */
	protected $content_type = '';

	/**
	 * Whether any of the answer has been sent to the browser
	 *
	 * @var bool
	 */
	private $started = false;

	/**
	 * Sends the request and passes the answer on
	 *
	 * @param string $url     The provider's address.
	 * @param array  $headers The request headers, by name.
	 * @param string $body    The request body.
	 * @return WP_Error|null An error when nothing could be sent to the browser.
	 */
	public function send( string $url, array $headers, string $body ) {
		// Keep running when the user stops the answer, so the connection to
		// the provider is closed here instead of being cut off.
		ignore_user_abort( true );
		set_time_limit( Relay::TIMEOUT + 10 );

		$handle = curl_init( $url ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_init

		// phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_setopt_array
		curl_setopt_array(
			$handle,
			array(
				CURLOPT_POST           => true,
				CURLOPT_POSTFIELDS     => $body,
				CURLOPT_HTTPHEADER     => array_map(
					static fn( $name, $value ) => "$name: $value",
					array_keys( $headers ),
					$headers
				),
				CURLOPT_HEADERFUNCTION => array( $this, 'read_header' ),
				CURLOPT_WRITEFUNCTION  => array( $this, 'write' ),
				CURLOPT_CONNECTTIMEOUT => 10,
				CURLOPT_TIMEOUT        => Relay::TIMEOUT,
				CURLOPT_CAINFO         => ABSPATH . WPINC . '/certificates/ca-bundle.crt',
			)
		);

		curl_exec( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_exec
		$error = curl_error( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_error

		if ( $this->started ) {
			return null;
		}

		return new WP_Error(
			'acea_provider_unreachable',
			$error ? $error : __( 'The provider did not answer.', 'ai-content-editing-assistant' ),
			array( 'status' => 502 )
		);
	}

	/**
	 * Reads a header line of the provider's answer
	 *
	 * @param mixed  $handle The cURL handle.
	 * @param string $line   The header line.
	 * @return int The length of the line, so that cURL goes on.
	 */
	public function read_header( $handle, string $line ): int {
		if ( preg_match( '#^HTTP/\S+\s+(\d{3})#', $line, $matches ) ) {
			// A new status line, such as after `100 Continue`, starts the headers again.
			$this->status       = (int) $matches[1];
			$this->content_type = '';
		} elseif ( preg_match( '#^content-type:\s*(.+)$#i', trim( $line ), $matches ) ) {
			$this->content_type = $matches[1];
		}

		return strlen( $line );
	}

	/**
	 * Passes a piece of the provider's answer on to the browser
	 *
	 * @param mixed  $handle The cURL handle.
	 * @param string $data   The piece.
	 * @return int The length of the piece, or 0 to stop when the browser has gone.
	 */
	public function write( $handle, string $data ): int {
		if ( ! $this->started ) {
			$this->started = true;
			$this->start_output();
		}

		echo $data; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		flush();

		// The user stopped the answer, so stop the provider's answer too.
		if ( connection_aborted() ) {
			return 0;
		}

		return strlen( $data );
	}

	/**
	 * Sends the headers, and turns off everything that would hold the answer back
	 */
	protected function start_output() {
		while ( ob_get_level() > 0 ) {
			ob_end_clean();
		}

		// Apache's gzip compression (mod_deflate) collects output before
		// sending it, so turn it off for this request. The function only
		// exists when PHP runs as an Apache module.
		if ( function_exists( 'apache_setenv' ) ) {
			apache_setenv( 'no-gzip', '1' );
		}
		// PHP's own compression holds output back in the same way.
		ini_set( 'zlib.output_compression', '0' ); // phpcs:ignore WordPress.PHP.IniSet.Risky

		status_header( $this->status ? $this->status : 200 );
		header( 'Content-Type: ' . ( $this->content_type ? $this->content_type : 'text/event-stream' ) );
		header( 'Cache-Control: no-cache' );
		// Asks nginx not to buffer the answer.
		header( 'X-Accel-Buffering: no' );
	}
}
