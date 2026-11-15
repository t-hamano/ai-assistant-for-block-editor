<?php
/**
 * Removes the data the plugin stored, when the plugin is deleted.
 *
 * @package AI_Content_Editing_Assistant
 * @author Aki Hamano
 * @license GPL-2.0+
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

/**
 * Removes the data the plugin stored on the current site.
 *
 * - The cached model lists, kept as transients named
 *   `ai-content-editing-assistant_models_{hash}`.
 * - Each user's model choice, kept in the `ai-content-editing-assistant`
 *   scope of the `persisted_preferences` user meta. That meta also holds the
 *   preferences of WordPress itself and of other plugins, so only this scope
 *   is removed.
 */
function ai_content_editing_assistant_uninstall_site() {
	global $wpdb;

	$scope = 'ai-content-editing-assistant';

	// Transients are named with a hash, so they are found by their prefix.
	// When a persistent object cache is used, they are not in the database
	// and expire on their own.
	foreach ( array( '_transient_', '_transient_timeout_' ) as $prefix ) {
		$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			$wpdb->prepare(
				"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
				$wpdb->esc_like( $prefix . $scope . '_models_' ) . '%'
			)
		);
	}

	$meta_key = $wpdb->get_blog_prefix() . 'persisted_preferences';
	$user_ids = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->prepare(
			"SELECT DISTINCT user_id FROM {$wpdb->usermeta} WHERE meta_key = %s",
			$meta_key
		)
	);

	foreach ( $user_ids as $user_id ) {
		$preferences = get_user_meta( (int) $user_id, $meta_key, true );

		if ( ! is_array( $preferences ) || ! array_key_exists( $scope, $preferences ) ) {
			continue;
		}

		unset( $preferences[ $scope ] );

		// `_modified` is only the time of the last change, not a preference.
		if ( array() === array_diff_key( $preferences, array( '_modified' => true ) ) ) {
			delete_user_meta( (int) $user_id, $meta_key );
		} else {
			update_user_meta( (int) $user_id, $meta_key, $preferences );
		}
	}
}

if ( is_multisite() ) {
	$ai_content_editing_assistant_site_ids = get_sites(
		array(
			'fields' => 'ids',
			'number' => 0,
		)
	);

	foreach ( $ai_content_editing_assistant_site_ids as $ai_content_editing_assistant_site_id ) {
		switch_to_blog( $ai_content_editing_assistant_site_id );
		ai_content_editing_assistant_uninstall_site();
		restore_current_blog();
	}
} else {
	ai_content_editing_assistant_uninstall_site();
}
