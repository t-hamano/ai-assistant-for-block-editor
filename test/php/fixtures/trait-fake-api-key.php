<?php
/**
 * @package AI_Assistant_For_Block_Editor
 */

use WordPress\AiClient\AiClient;
use WordPress\AiClient\Providers\Http\DTO\ApiKeyRequestAuthentication;

/**
 * Gives the AI Client an API key for the fake provider, and takes it away
 * after each test.
 */
trait AABE_Fake_Api_Key {

	/**
	 * Sets the API key of the fake provider.
	 *
	 * @param string $key The key. An empty string means no key.
	 */
	protected function set_fake_api_key( string $key ) {
		$registry = AiClient::defaultRegistry();

		if ( ! $registry->hasProvider( AABE_Fake_Provider::ID ) ) {
			$registry->registerProvider( AABE_Fake_Provider::class );
		}

		$registry->setProviderRequestAuthentication( AABE_Fake_Provider::ID, new ApiKeyRequestAuthentication( $key ) );
	}

	/**
	 * Removes the key.
	 */
	public function tear_down() {
		$this->set_fake_api_key( '' );

		parent::tear_down();
	}
}
