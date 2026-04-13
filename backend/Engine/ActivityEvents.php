<?php

declare(strict_types=1);

final class ActivityEvents
{
    private function __construct()
    {
    }

    public const USER_LOGGED_IN = 'user_logged_in';
    public const USER_REGISTERED = 'user_registered';
    public const USER_LOGGED_OUT = 'user_logged_out';
    public const USER_PASSWORD_RESET = 'user_password_reset';

    public const BOOKING_SUBMITTED = 'booking_submitted';
    public const BOOKING_STATUS_CHANGED = 'status_changed';
    public const BOOKING_BEFORE_PHOTOS_UPDATED = 'before_photos_updated';
    public const BOOKING_AFTER_PHOTOS_UPDATED = 'after_photos_updated';
    public const BOOKING_PARTS_UPDATED = 'parts_updated';
    public const BOOKING_INTERNAL_NOTES_UPDATED = 'internal_notes_updated';
    public const BOOKING_TECHNICIAN_ASSIGNED = 'technician_assigned';
    public const BOOKING_TECHNICIAN_UNASSIGNED = 'technician_unassigned';
    public const BOOKING_CALIBRATION_UPDATED = 'calibration_updated';
    public const BOOKING_APPOINTMENT_RESCHEDULED = 'appointment_rescheduled';
    public const BOOKING_BUILD_UPDATE_POSTED = 'build_update_posted';

    public const BUILD_UPDATE_CREATED = 'build_update_created';

    public const ORDER_CREATED = 'order_created';
    public const ORDER_STATUS_CHANGED = 'order_status_changed';
    public const ORDER_TRACKING_UPDATED = 'order_tracking_updated';
    public const ORDER_PAYMENT_STATUS_UPDATED = 'order_payment_status_updated';

    public const INVENTORY_ITEM_CREATED = 'inventory_item_created';
    public const INVENTORY_ITEM_UPDATED = 'inventory_item_updated';
    public const INVENTORY_STOCK_ADJUSTED = 'inventory_stock_adjusted';
    public const INVENTORY_SUPPLIER_CREATED = 'supplier_created';
    public const INVENTORY_PURCHASE_ORDER_CREATED = 'purchase_order_created';
    public const INVENTORY_PURCHASE_ORDER_STATUS_UPDATED = 'purchase_order_status_updated';
    public const INVENTORY_BOOKING_PART_REQUIREMENT_CREATED = 'booking_part_requirement_created';
    public const INVENTORY_BOOKING_PART_REQUIREMENT_UPDATED = 'booking_part_requirement_updated';

    public const TEAM_MEMBER_CREATED = 'team_member_created';
    public const TEAM_MEMBER_UPDATED = 'team_member_updated';
    public const TEAM_MEMBER_DELETED = 'team_member_deleted';

    public const WAITLIST_JOINED = 'waitlist_joined';
    public const WAITLIST_CLAIM_BOOKED = 'waitlist_claim_booked';
    public const WAITLIST_REMOVED = 'waitlist_removed';
    public const WAITLIST_NOTIFIED = 'waitlist_notified';
    public const WAITLIST_EXPIRED = 'waitlist_expired';

    public const FAQ_CREATED = 'faq_created';
    public const FAQ_UPDATED = 'faq_updated';
    public const FAQ_DELETED = 'faq_deleted';

    public const TESTIMONIAL_CREATED = 'testimonial_created';
    public const TESTIMONIAL_UPDATED = 'testimonial_updated';
    public const TESTIMONIAL_DELETED = 'testimonial_deleted';

    public const BLOG_POST_CREATED = 'blog_post_created';
    public const BLOG_POST_UPDATED = 'blog_post_updated';
    public const BLOG_POST_DELETED = 'blog_post_deleted';

    public const SHOP_HOURS_UPDATED = 'shop_hours_updated';
    public const SHOP_CLOSED_DATE_ADDED = 'shop_closed_date_added';
    public const SHOP_CLOSED_DATE_REMOVED = 'shop_closed_date_removed';

    public const SITE_SETTINGS_UPDATED = 'site_settings_updated';

    public const NOTIFICATION_QUEUE_REPLAY_FAILED = 'notification_queue_replay_failed';

    public const PRODUCT_VARIATION_CREATED = 'variation_created';
    public const PRODUCT_VARIATION_DELETED = 'variation_deleted';

    /**
     * @return array<string, string>
     */
    public static function conventionMap(): array
    {
        return [
            self::USER_LOGGED_IN => 'Authentication login success',
            self::USER_REGISTERED => 'Authentication registration success',
            self::USER_LOGGED_OUT => 'Authentication logout',
            self::USER_PASSWORD_RESET => 'Authentication password reset',
            self::BOOKING_SUBMITTED => 'Booking submitted by client',
            self::BOOKING_STATUS_CHANGED => 'Booking status transition',
            self::BOOKING_BEFORE_PHOTOS_UPDATED => 'Booking before-photos updated',
            self::BOOKING_AFTER_PHOTOS_UPDATED => 'Booking after-photos updated',
            self::BOOKING_PARTS_UPDATED => 'Booking parts flag or notes updated',
            self::BOOKING_INTERNAL_NOTES_UPDATED => 'Booking internal notes updated',
            self::BOOKING_TECHNICIAN_ASSIGNED => 'Booking technician assigned',
            self::BOOKING_TECHNICIAN_UNASSIGNED => 'Booking technician unassigned',
            self::BOOKING_CALIBRATION_UPDATED => 'Booking calibration data updated',
            self::BOOKING_APPOINTMENT_RESCHEDULED => 'Booking appointment rescheduled',
            self::BOOKING_BUILD_UPDATE_POSTED => 'Booking build update posted',
            self::BUILD_UPDATE_CREATED => 'Build update record created',
            self::ORDER_CREATED => 'Order created',
            self::ORDER_STATUS_CHANGED => 'Order status changed',
            self::ORDER_TRACKING_UPDATED => 'Order tracking updated',
            self::ORDER_PAYMENT_STATUS_UPDATED => 'Order payment status updated',
            self::INVENTORY_ITEM_CREATED => 'Inventory item created',
            self::INVENTORY_ITEM_UPDATED => 'Inventory item updated',
            self::INVENTORY_STOCK_ADJUSTED => 'Inventory stock adjusted',
            self::INVENTORY_SUPPLIER_CREATED => 'Inventory supplier created',
            self::INVENTORY_PURCHASE_ORDER_CREATED => 'Inventory purchase order created',
            self::INVENTORY_PURCHASE_ORDER_STATUS_UPDATED => 'Inventory purchase order status updated',
            self::INVENTORY_BOOKING_PART_REQUIREMENT_CREATED => 'Booking part requirement created',
            self::INVENTORY_BOOKING_PART_REQUIREMENT_UPDATED => 'Booking part requirement updated',
            self::TEAM_MEMBER_CREATED => 'Team member created',
            self::TEAM_MEMBER_UPDATED => 'Team member updated',
            self::TEAM_MEMBER_DELETED => 'Team member deleted',
            self::WAITLIST_JOINED => 'Waitlist entry created',
            self::WAITLIST_CLAIM_BOOKED => 'Waitlist claim converted to booking',
            self::WAITLIST_REMOVED => 'Waitlist entry removed',
            self::WAITLIST_NOTIFIED => 'Waitlist entry notified',
            self::WAITLIST_EXPIRED => 'Waitlist claim expired',
            self::FAQ_CREATED => 'FAQ created',
            self::FAQ_UPDATED => 'FAQ updated',
            self::FAQ_DELETED => 'FAQ deleted',
            self::TESTIMONIAL_CREATED => 'Testimonial created',
            self::TESTIMONIAL_UPDATED => 'Testimonial updated',
            self::TESTIMONIAL_DELETED => 'Testimonial deleted',
            self::BLOG_POST_CREATED => 'Blog post created',
            self::BLOG_POST_UPDATED => 'Blog post updated',
            self::BLOG_POST_DELETED => 'Blog post deleted',
            self::SHOP_HOURS_UPDATED => 'Shop hours updated',
            self::SHOP_CLOSED_DATE_ADDED => 'Shop closed date added',
            self::SHOP_CLOSED_DATE_REMOVED => 'Shop closed date removed',
            self::SITE_SETTINGS_UPDATED => 'Site settings updated',
            self::NOTIFICATION_QUEUE_REPLAY_FAILED => 'Notification queue failed jobs replayed',
            self::PRODUCT_VARIATION_CREATED => 'Product or service variation created',
            self::PRODUCT_VARIATION_DELETED => 'Product or service variation deleted',
        ];
    }
}
