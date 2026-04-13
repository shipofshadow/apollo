<?php

declare(strict_types=1);

if (!function_exists('activity')) {
    function activity(): ActivityLog
    {
        return new ActivityLog();
    }
}
