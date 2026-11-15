<?php
/**
 * @package AI_Content_Editing_Assistant
 * @author Aki Hamano
 * @license GPL-2.0+
 */

namespace AI_Content_Editing_Assistant;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

/**
 * Lists the models a provider offers, from the provider's Models API.
 *
 * The list is kept for a while, so that opening the editor does not ask the
 * provider every time. It is fetched with the site's API key, which never
 * leaves the server.
 */
class Models {

	/**
	 * How long the list is kept, in seconds
	 */
	const CACHE_TIME = 12 * HOUR_IN_SECONDS;

	/**
	 * How long to wait for the provider, in seconds
	 */
	const TIMEOUT = 15;

	/**
	 * Constructor
	 */
	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Registers the models route
	 */
	public function register_routes() {
		register_rest_route(
			AI_CONTENT_EDITING_ASSISTANT_NAMESPACE . '/v1',
			'/models',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'list_models' ),
				'permission_callback' => array( Enqueue::class, 'can_use' ),
				'args'                => array(
					'provider' => array(
						'type'     => 'string',
						'enum'     => array_keys( Relay::PROVIDERS ),
						'required' => true,
					),
				),
			)
		);
	}

	/**
	 * Returns the models of the provider
	 *
	 * @param WP_REST_Request $request The request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function list_models( WP_REST_Request $request ) {
		$models = self::get( $request->get_param( 'provider' ) );

		if ( is_wp_error( $models ) ) {
			return $models;
		}

		return new WP_REST_Response( $models );
	}

	/**
	 * Gets the models of a provider, from the cache when it has them
	 *
	 * @param string $provider_id The provider ID, such as `anthropic`.
	 * @return array|WP_Error The models, each with an `id` and a `name`.
	 */
	public static function get( string $provider_id ) {
		$api_key = Api_Key::get( $provider_id );

		if ( '' === $api_key ) {
			return new WP_Error(
				'ai_content_editing_assistant_no_api_key',
				__( 'No API key is set for this provider.', 'ai-content-editing-assistant' ),
				array( 'status' => 400 )
			);
		}

		// The key is part of the name, so a new key gets its own list.
		$cache_key = AI_CONTENT_EDITING_ASSISTANT_NAMESPACE . '_models_' . md5( $provider_id . $api_key );
		$models    = get_transient( $cache_key );

		if ( is_array( $models ) ) {
			return $models;
		}

		$models = self::fetch( $provider_id, $api_key );

		// Errors are not kept, so the next request tries again.
		if ( ! is_wp_error( $models ) ) {
			set_transient( $cache_key, $models, self::CACHE_TIME );
		}

		return $models;
	}

	/**
	 * Asks the provider for its models
	 *
	 * @param string $provider_id The provider ID.
	 * @param string $api_key     The provider's API key.
	 * @return array|WP_Error The models, each with an `id` and a `name`.
	 */
	private static function fetch( string $provider_id, string $api_key ) {
		$provider = Relay::PROVIDERS[ $provider_id ];

		$response = wp_remote_get(
			$provider['models'],
			array(
				'headers' => array_merge( $provider['headers'], array( $provider['key'] => ( $provider['key_prefix'] ?? '' ) . $api_key ) ),
				'timeout' => self::TIMEOUT,
			)
		);

		if ( is_wp_error( $response ) ) {
			return new WP_Error(
				'ai_content_editing_assistant_provider_unreachable',
				$response->get_error_message(),
				array( 'status' => 502 )
			);
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( 200 !== wp_remote_retrieve_response_code( $response ) || ! isset( $body['data'] ) || ! is_array( $body['data'] ) ) {
			return new WP_Error(
				'ai_content_editing_assistant_models_unavailable',
				__( 'The provider did not return its models.', 'ai-content-editing-assistant' ),
				array( 'status' => 502 )
			);
		}

		$models = array();

		foreach ( $body['data'] as $model ) {
			if ( empty( $model['id'] ) || ! is_string( $model['id'] ) ) {
				continue;
			}

			$models[] = array(
				'id'   => $model['id'],
				'name' => isset( $model['display_name'] ) && is_string( $model['display_name'] ) ? $model['display_name'] : $model['id'],
			);
		}

		return $models;
	}
}
