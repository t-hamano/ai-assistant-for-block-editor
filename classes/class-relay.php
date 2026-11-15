<?php
/**
 * @package AI_Assistant_For_Block_Editor
 * @author Aki Hamano
 * @license GPL-2.0+
 */

namespace AI_Assistant_For_Block_Editor;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Passes chat requests from the editor on to the AI provider, adding the
 * site's API key on the server.
 *
 * The request body is built by the editor and is not read here. Requests
 * only go to the fixed address of each provider, so the key cannot be sent
 * anywhere else.
 */
class Relay {

	/**
	 * Where each provider's requests go, and the headers that carry the key
	 */
	const PROVIDERS = array(
		'anthropic' => array(
			'url'     => 'https://api.anthropic.com/v1/messages',
			'headers' => array(
				'anthropic-version' => '2023-06-01',
			),
			'key'     => 'x-api-key',
		),
	);

	/**
	 * How long to wait for the provider, in seconds
	 */
	const TIMEOUT = 120;

	/**
	 * Constructor
	 */
	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Registers the chat route
	 */
	public function register_routes() {
		register_rest_route(
			AABE_NAMESPACE . '/v1',
			'/chat',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'chat' ),
				'permission_callback' => array( $this, 'can_chat' ),
				'args'                => array(
					'provider' => array(
						'type'     => 'string',
						'enum'     => array_keys( self::PROVIDERS ),
						'required' => true,
					),
					'post_id'  => array(
						'type'     => 'integer',
						'required' => true,
					),
					'body'     => array(
						'type'     => 'object',
						'required' => true,
					),
				),
			)
		);
	}

	/**
	 * Whether the current user can chat about the post
	 *
	 * @param WP_REST_Request $request The request.
	 * @return bool
	 */
	public function can_chat( WP_REST_Request $request ) {
		return Enqueue::can_use() && current_user_can( 'edit_post', $request->get_param( 'post_id' ) );
	}

	/**
	 * Sends the request to the provider and returns its answer
	 *
	 * @param WP_REST_Request $request The request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function chat( WP_REST_Request $request ) {
		$provider_id = $request->get_param( 'provider' );

		$api_key = Api_Key::get( $provider_id );

		if ( '' === $api_key ) {
			return new WP_Error(
				'aabe_no_api_key',
				__( 'No API key is set for this provider.', 'ai-assistant-for-block-editor' ),
				array( 'status' => 400 )
			);
		}

		// Sites can turn AI off, or stop prompts, as they do for the AI Client.
		if ( ! wp_supports_ai() || apply_filters( 'wp_ai_client_prevent_prompt', false, wp_ai_client_prompt()->using_provider( $provider_id ) ) ) {
			return new WP_Error(
				'aabe_prompt_prevented',
				__( 'The site does not allow AI requests.', 'ai-assistant-for-block-editor' ),
				array( 'status' => 503 )
			);
		}

		$provider = self::PROVIDERS[ $provider_id ];
		$body     = $request->get_param( 'body' );

		// The answer comes back whole until the relay streams it.
		$body['stream'] = false;

		$response = wp_remote_post(
			$provider['url'],
			array(
				'headers' => array_merge(
					$provider['headers'],
					array(
						'content-type'   => 'application/json',
						$provider['key'] => $api_key,
					)
				),
				'body'    => wp_json_encode( $body ),
				'timeout' => self::TIMEOUT,
			)
		);

		if ( is_wp_error( $response ) ) {
			return new WP_Error(
				'aabe_provider_unreachable',
				$response->get_error_message(),
				array( 'status' => 502 )
			);
		}

		return new WP_REST_Response(
			json_decode( wp_remote_retrieve_body( $response ), true ),
			wp_remote_retrieve_response_code( $response )
		);
	}
}
