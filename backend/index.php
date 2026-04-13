<?php

declare(strict_types=1);

require_once __DIR__ . '/config/init.php';

/**
 * Fallback auto worker runner for environments without system cron.
 * Uses a file lock + interval guard so requests do not run workers repeatedly.
 */
function runAutoCronWorkersOnRequest(): void
{
	if (PHP_SAPI === 'cli' || !AUTO_CRON_ON_REQUEST || DB_NAME === '') {
		return;
	}

	$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
	if (!is_string($requestPath) || !str_starts_with($requestPath, '/api/')) {
		return;
	}

	$runtimeDir = __DIR__ . '/storage/runtime';
	if (!is_dir($runtimeDir)) {
		@mkdir($runtimeDir, 0775, true);
	}

	$stateFile = $runtimeDir . '/auto_cron_state.json';
	$fp = @fopen($stateFile, 'c+');
	if ($fp === false) {
		return;
	}

	try {
		// Non-blocking lock to avoid request pileups running workers in parallel.
		if (!flock($fp, LOCK_EX | LOCK_NB)) {
			fclose($fp);
			return;
		}

		$raw = stream_get_contents($fp);
		$state = is_string($raw) ? json_decode($raw, true) : null;
		if (!is_array($state)) {
			$state = [];
		}

		$now = time();
		$lastRunAt = (int) ($state['lastRunAt'] ?? 0);
		if (($now - $lastRunAt) < AUTO_CRON_MIN_INTERVAL_SECONDS) {
			flock($fp, LOCK_UN);
			fclose($fp);
			return;
		}

		$state['lastRunAt'] = $now;
		ftruncate($fp, 0);
		rewind($fp);
		fwrite($fp, json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
		fflush($fp);

		// Run lightweight cron-equivalent workers.
		(new MarketingCampaignService())->runScheduledDue(AUTO_CRON_CAMPAIGN_LIMIT);
		(new NotificationJobQueueService())->processPending(AUTO_CRON_QUEUE_LIMIT);
		(new WaitlistService())->processAutoFill();

		flock($fp, LOCK_UN);
		fclose($fp);
	} catch (Throwable $e) {
		@error_log('auto-cron worker error: ' . $e->getMessage());
		if (is_resource($fp)) {
			@flock($fp, LOCK_UN);
			@fclose($fp);
		}
	}
}

runAutoCronWorkersOnRequest();

$router = new Router();
$router->dispatch();
