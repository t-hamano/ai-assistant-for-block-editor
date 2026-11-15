<?php
/**
 * @package AI_Content_Editing_Assistant
 */

use WordPress\AiClient\AiClient;
use WordPress\AiClient\Providers\Http\DTO\ApiKeyRequestAuthentication;

/**
 * Gives the AI Client an API key for the fake provider, and takes it away
 * after each test.
 */
trait AI_Content_Editing_Assistant_Fake_Api_Key {

	/**
	 * Sets the API key of the fake provider.
	 *
	 * @param string $key The key. An empty string means no key.
	 */
	protected function set_fake_api_key( string $key ) {
		$registry = AiClient::defaultRegistry();

		if ( ! $registry->hasProvider( AI_Content_Editing_Assistant_Fake_Provider::ID ) ) {
			$registry->registerProvider( AI_Content_Editing_Assistant_Fake_Provider::class );
		}

		$registry->setProviderRequestAuthentication( AI_Content_Editing_Assistant_Fake_Provider::ID, new ApiKeyRequestAuthentication( $key ) );
	}

	/**
	 * Removes the key.
	 */
	public function tear_down() {
		$this->set_fake_api_key( '' );

		parent::tear_down();
	}
}
