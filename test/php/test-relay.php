<?php
/**
 * @package AI_Content_Editing_Assistant
 */

/**
 * Tests for the Relay class.
 */
class Test_Relay extends WP_UnitTestCase {

	use AI_Content_Editing_Assistant_Fake_Api_Key;

	/**
	 * The request that was sent to the provider, if any.
	 *
	 * @var array|null
	 */
	private $sent;

	/**
	 * An administrator and a post they can edit.
	 */
	public function set_up() {
		parent::set_up();

		$this->sent = null;
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$this->set_fake_api_key( 'test-key' );

		// Record the request to the provider and answer it, instead of sending it.
		add_filter(
			'pre_http_request',
			function ( $response, $args, $url ) {
				$this->sent = array(
					'url'  => $url,
					'args' => $args,
				);
				return array(
					'headers'  => array(),
					'body'     => wp_json_encode( array( 'content' => array( array( 'text' => 'Hi' ) ) ) ),
					'response' => array(
						'code'    => 200,
						'message' => 'OK',
					),
					'cookies'  => array(),
					'filename' => null,
				);
			},
			10,
			3
		);
	}

	/**
	 * Sends a chat request to the route.
	 *
	 * @param array $params The request parameters.
	 * @return WP_REST_Response
	 */
	private function chat( array $params = array() ) {
		$request = new WP_REST_Request( 'POST', '/' . AI_CONTENT_EDITING_ASSISTANT_NAMESPACE . '/v1/chat' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body(
			wp_json_encode(
				array_merge(
					array(
						'provider' => 'anthropic',
						'post_id'  => self::factory()->post->create(),
						'body'     => array(
							'model'    => 'test-model',
							'messages' => array(),
							'stream'   => true,
						),
					),
					$params
				)
			)
		);

		return rest_get_server()->dispatch( $request );
	}

	/**
	 * Tests that the request goes to the provider with the key, and the answer comes back.
	 */
	public function test_relays_the_request() {
		$response = $this->chat();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( 'Hi', $response->get_data()['content'][0]['text'] );
		$this->assertSame( 'https://api.anthropic.com/v1/messages', $this->sent['url'] );
		$this->assertSame( 'test-key', $this->sent['args']['headers']['x-api-key'] );
		$this->assertSame( '2023-06-01', $this->sent['args']['headers']['anthropic-version'] );

		$body = json_decode( $this->sent['args']['body'], true );
		$this->assertSame( 'test-model', $body['model'] );
		$this->assertFalse( $body['stream'] );
	}

	/**
	 * Tests that editors cannot use the route.
	 */
	public function test_editor_cannot_chat() {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'editor' ) ) );

		$this->assertSame( 403, $this->chat()->get_status() );
		$this->assertNull( $this->sent );
	}

	/**
	 * Tests that the user must be able to edit the post.
	 */
	public function test_cannot_chat_about_a_post_that_does_not_exist() {
		$this->assertSame( 403, $this->chat( array( 'post_id' => PHP_INT_MAX ) )->get_status() );
		$this->assertNull( $this->sent );
	}

	/**
	 * Tests that other providers are not accepted.
	 */
	public function test_unknown_provider_is_rejected() {
		$this->assertSame( 400, $this->chat( array( 'provider' => 'example' ) )->get_status() );
		$this->assertNull( $this->sent );
	}

	/**
	 * Tests that nothing is sent without a key.
	 */
	public function test_nothing_is_sent_without_api_key() {
		$this->set_fake_api_key( '' );

		$response = $this->chat();

		$this->assertSame( 'ai_content_editing_assistant_no_api_key', $response->as_error()->get_error_code() );
		$this->assertNull( $this->sent );
	}

	/**
	 * Tests that nothing is sent when a filter prevents prompts.
	 */
	public function test_nothing_is_sent_when_prompts_are_prevented() {
		add_filter( 'wp_ai_client_prevent_prompt', '__return_true' );

		$response = $this->chat();

		$this->assertSame( 503, $response->get_status() );
		$this->assertNull( $this->sent );
	}

	/**
	 * Tests that nothing is sent when the site does not support AI.
	 */
	public function test_nothing_is_sent_when_ai_is_not_supported() {
		add_filter( 'wp_supports_ai', '__return_false' );

		$response = $this->chat();

		$this->assertSame( 503, $response->get_status() );
		$this->assertNull( $this->sent );
	}
}
