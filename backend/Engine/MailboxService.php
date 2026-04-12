<?php

declare(strict_types=1);

class MailboxService
{
    /** @return array<string, mixed> */
    public function configStatus(): array
    {
        $username = MAILBOX_USERNAME !== '' ? MAILBOX_USERNAME : (SMTP_USERNAME !== '' ? SMTP_USERNAME : MAIL_FROM);
        $configured = MAILBOX_IMAP_HOST !== '' && $username !== '' && MAILBOX_PASSWORD !== '';

        return [
            'supported'    => function_exists('imap_open'),
            'configured'   => $configured,
            'usernameHint' => $username !== '' ? $this->maskEmail($username) : '',
            'defaultFolder'=> MAILBOX_FOLDER !== '' ? MAILBOX_FOLDER : 'INBOX',
            'incoming' => [
                'imap' => [
                    'host'       => MAILBOX_IMAP_HOST,
                    'port'       => MAILBOX_IMAP_PORT,
                    'encryption' => MAILBOX_IMAP_ENCRYPTION,
                ],
                'pop' => [
                    'host'       => MAILBOX_POP_HOST,
                    'port'       => MAILBOX_POP_PORT,
                    'encryption' => MAILBOX_POP_ENCRYPTION,
                ],
            ],
            'outgoing' => [
                'smtp' => [
                    'host'       => MAILBOX_SMTP_HOST,
                    'port'       => MAILBOX_SMTP_PORT,
                    'encryption' => MAILBOX_SMTP_ENCRYPTION,
                ],
            ],
        ];
    }

    /** @return array<string, mixed> */
    public function listFolders(): array
    {
        $status = $this->configStatus();

        if (!$status['supported']) {
            return [
                'supported' => false,
                'configured' => (bool) $status['configured'],
                'folders' => [],
                'reason' => 'PHP IMAP extension is not enabled on the server.',
            ];
        }

        if (!$status['configured']) {
            return [
                'supported' => true,
                'configured' => false,
                'folders' => [],
                'reason' => 'Mailbox credentials are not configured. Set MAILBOX_USERNAME and MAILBOX_PASSWORD in backend/.env.',
            ];
        }

        $connection = $this->openConnection('INBOX');
        if (!$connection['ok']) {
            return [
                'supported' => true,
                'configured' => true,
                'folders' => [],
                'reason' => $connection['reason'],
            ];
        }

        $mailbox = $connection['mailbox'];
        $root = $this->buildMailboxRootPath();
        $rawFolders = @imap_list($mailbox, $root, '*');
        imap_close($mailbox);

        $folders = [];
        if (is_array($rawFolders)) {
            foreach ($rawFolders as $rawFolder) {
                $name = (string) preg_replace('/^.*}/', '', (string) $rawFolder);
                $name = trim($name);
                if ($name !== '') {
                    $folders[] = $name;
                }
            }
        }

        $defaults = ['INBOX', 'Sent', 'Drafts', 'Trash'];
        foreach ($defaults as $default) {
            if (!in_array($default, $folders, true)) {
                $folders[] = $default;
            }
        }

        natcasesort($folders);

        return [
            'supported' => true,
            'configured' => true,
            'folders' => array_values($folders),
            'reason' => null,
        ];
    }

    /** @return array<string, mixed> */
    public function listInbox(
        string $folder = 'INBOX',
        int $limit = 20,
        string $query = '',
        bool $unreadOnly = false,
        bool $hasAttachmentsOnly = false
    ): array
    {
        $status = $this->configStatus();
        $folder = $this->normalizeFolder($folder);
        $limit = max(1, min(50, $limit));
        $query = trim($query);

        $cacheKey = $this->inboxCacheKey($folder, $limit, $query, $unreadOnly, $hasAttachmentsOnly);
        if (MAILBOX_INBOX_CACHE_TTL > 0) {
            $cached = Cache::get($cacheKey);
            if ($cached !== null) {
                return $cached;
            }
        }

        if (!$status['supported']) {
            return [
                'supported' => false,
                'configured' => (bool) $status['configured'],
                'folder' => $folder,
                'messages' => [],
                'reason' => 'PHP IMAP extension is not enabled on the server.',
            ];
        }

        if (!$status['configured']) {
            return [
                'supported' => true,
                'configured' => false,
                'folder' => $folder,
                'messages' => [],
                'reason' => 'Mailbox credentials are not configured. Set MAILBOX_USERNAME and MAILBOX_PASSWORD in backend/.env.',
            ];
        }

        $connection = $this->openConnection($folder);
        if (!$connection['ok']) {
            return [
                'supported' => true,
                'configured' => true,
                'folder' => $folder,
                'messages' => [],
                'reason' => $connection['reason'],
            ];
        }

        $mailbox = $connection['mailbox'];
        $searchCriteria = $this->buildSearchCriteria($query, $unreadOnly);
        $uids = $searchCriteria !== ''
            ? @imap_search($mailbox, $searchCriteria, SE_UID)
            : imap_sort($mailbox, SORTDATE, true, SE_UID);

        if (!is_array($uids) && $searchCriteria === '') {
            $uids = imap_search($mailbox, 'ALL', SE_UID);
        }

        if (!is_array($uids)) {
            $uids = [];
        }

        $uids = array_map('intval', $uids);
        rsort($uids, SORT_NUMERIC);

        $messages = [];

        foreach ($uids as $uid) {
            if (count($messages) >= $limit) {
                break;
            }

            $overviewList = imap_fetch_overview($mailbox, (string) $uid, FT_UID);
            $overview = is_array($overviewList) && isset($overviewList[0]) ? $overviewList[0] : null;
            if ($overview === null) {
                continue;
            }

            if ($unreadOnly && ((int) ($overview->seen ?? 0)) === 1) {
                continue;
            }

            $structure = imap_fetchstructure($mailbox, $uid, FT_UID);
            $hasAttachments = $this->structureHasAttachments($structure);
            if ($hasAttachmentsOnly && !$hasAttachments) {
                continue;
            }

            $snippet = $this->buildSnippet($mailbox, $uid);
            $subject = $this->decodeHeaderValue((string) ($overview->subject ?? '(No subject)'));
            $messages[] = [
                'uid'     => $uid,
                'subject' => $subject,
                'from'    => $this->decodeHeaderValue((string) ($overview->from ?? 'Unknown sender')),
                'date'    => $this->normalizeDate((string) ($overview->date ?? '')),
                'seen'    => ((int) ($overview->seen ?? 0)) === 1,
                'snippet' => $snippet,
                'hasAttachments' => $hasAttachments,
                'threadKey' => $this->threadKeyFromSubject($subject),
            ];
        }

        imap_close($mailbox);

        $result = [
            'supported' => true,
            'configured' => true,
            'folder' => $folder,
            'query' => $query,
            'unreadOnly' => $unreadOnly,
            'hasAttachmentsOnly' => $hasAttachmentsOnly,
            'messages' => $messages,
            'reason' => null,
        ];

        if (MAILBOX_INBOX_CACHE_TTL > 0) {
            Cache::set($cacheKey, $result, MAILBOX_INBOX_CACHE_TTL);
        }

        return $result;
    }

    /** @return array<string, mixed> */
    public function getMessage(int $uid, string $folder = 'INBOX'): array
    {
        $status = $this->configStatus();
        $folder = $this->normalizeFolder($folder);

        $cacheKey = $this->messageCacheKey($folder, $uid);
        if (MAILBOX_MESSAGE_CACHE_TTL > 0 && $uid > 0) {
            $cached = Cache::get($cacheKey);
            if ($cached !== null) {
                return $cached;
            }
        }

        if ($uid <= 0) {
            return [
                'supported' => (bool) $status['supported'],
                'configured' => (bool) $status['configured'],
                'message' => null,
                'reason' => 'Invalid message id.',
            ];
        }

        if (!$status['supported']) {
            return [
                'supported' => false,
                'configured' => (bool) $status['configured'],
                'message' => null,
                'reason' => 'PHP IMAP extension is not enabled on the server.',
            ];
        }

        if (!$status['configured']) {
            return [
                'supported' => true,
                'configured' => false,
                'message' => null,
                'reason' => 'Mailbox credentials are not configured. Set MAILBOX_USERNAME and MAILBOX_PASSWORD in backend/.env.',
            ];
        }

        $connection = $this->openConnection($folder);
        if (!$connection['ok']) {
            return [
                'supported' => true,
                'configured' => true,
                'message' => null,
                'reason' => $connection['reason'],
            ];
        }

        $mailbox = $connection['mailbox'];
        $overviewList = imap_fetch_overview($mailbox, (string) $uid, FT_UID);
        $overview = is_array($overviewList) && isset($overviewList[0]) ? $overviewList[0] : null;

        if ($overview === null) {
            imap_close($mailbox);
            return [
                'supported' => true,
                'configured' => true,
                'message' => null,
                'reason' => 'Message not found.',
            ];
        }

        $structure = imap_fetchstructure($mailbox, $uid, FT_UID);
        $parts = $this->extractBodies($mailbox, $uid, $structure, '', 'UTF-8');
        $textBody = trim((string) ($parts['text'] ?? ''));
        $htmlBody = trim((string) ($parts['html'] ?? ''));
        $attachments = $this->extractAttachmentMetadata($structure, '');
        $subject = $this->decodeHeaderValue((string) ($overview->subject ?? '(No subject)'));
        $messageId = trim((string) ($overview->message_id ?? ''));
        $references = trim((string) ($overview->references ?? ''));
        $inReplyTo = trim((string) ($overview->in_reply_to ?? ''));

        if ($textBody === '' && $htmlBody !== '') {
            $textBody = $this->htmlToText($htmlBody);
        }

        $message = [
            'uid'      => $uid,
            'folder'   => $folder,
            'subject'  => $subject,
            'from'     => $this->decodeHeaderValue((string) ($overview->from ?? 'Unknown sender')),
            'to'       => $this->decodeHeaderValue((string) ($overview->to ?? '')),
            'date'     => $this->normalizeDate((string) ($overview->date ?? '')),
            'seen'     => ((int) ($overview->seen ?? 0)) === 1,
            'snippet'  => $this->truncate($textBody !== '' ? $textBody : $this->htmlToText($htmlBody), 220),
            'textBody' => $textBody,
            'htmlBody' => $htmlBody,
            'hasAttachments' => count($attachments) > 0,
            'attachments' => $attachments,
            'threadKey' => $this->threadKeyFromSubject($subject),
            'messageId' => $messageId,
            'references' => $references,
            'inReplyTo' => $inReplyTo,
        ];

        imap_close($mailbox);

        $result = [
            'supported' => true,
            'configured' => true,
            'message' => $message,
            'reason' => null,
        ];

        if (MAILBOX_MESSAGE_CACHE_TTL > 0) {
            Cache::set($cacheKey, $result, MAILBOX_MESSAGE_CACHE_TTL);
        }

        return $result;
    }

    /** @return array<string, mixed> */
    public function getThread(int $uid, string $folder = 'INBOX'): array
    {
        $current = $this->getMessage($uid, $folder);
        if (!isset($current['message']) || !is_array($current['message'])) {
            return [
                'supported' => (bool) ($current['supported'] ?? true),
                'configured' => (bool) ($current['configured'] ?? true),
                'thread' => [],
                'reason' => (string) ($current['reason'] ?? 'Thread unavailable.'),
            ];
        }

        $threadKey = (string) (($current['message']['threadKey'] ?? '') ?: '');
        if ($threadKey === '') {
            return [
                'supported' => true,
                'configured' => true,
                'thread' => [$current['message']],
                'reason' => null,
            ];
        }

        $inbox = $this->listInbox($folder, 50, '', false, false);
        $messages = is_array($inbox['messages'] ?? null) ? $inbox['messages'] : [];
        $thread = [];
        foreach ($messages as $message) {
            if (!is_array($message)) {
                continue;
            }
            if ((string) ($message['threadKey'] ?? '') === $threadKey) {
                $thread[] = $message;
            }
        }

        return [
            'supported' => true,
            'configured' => true,
            'thread' => $thread,
            'reason' => null,
        ];
    }

    /** @return array<string, mixed> */
    public function setSeen(int $uid, string $folder = 'INBOX', bool $seen = true): array
    {
        if ($uid <= 0) {
            return ['ok' => false, 'reason' => 'Invalid message id.'];
        }

        $connection = $this->openConnection($folder, false);
        if (!$connection['ok']) {
            return ['ok' => false, 'reason' => $connection['reason']];
        }

        $mailbox = $connection['mailbox'];
        $msgNo = (int) imap_msgno($mailbox, $uid);
        if ($msgNo <= 0) {
            imap_close($mailbox);
            return ['ok' => false, 'reason' => 'Message not found.'];
        }

        if ($seen) {
            @imap_setflag_full($mailbox, (string) $msgNo, '\\Seen');
        } else {
            @imap_clearflag_full($mailbox, (string) $msgNo, '\\Seen');
        }

        imap_close($mailbox);

        return ['ok' => true, 'reason' => null];
    }

    /** @return array<string, mixed> */
    public function deleteMessage(int $uid, string $folder = 'INBOX'): array
    {
        if ($uid <= 0) {
            return ['ok' => false, 'reason' => 'Invalid message id.'];
        }

        $folder = $this->normalizeFolder($folder);
        $trashCandidates = ['Trash', 'INBOX.Trash'];

        foreach ($trashCandidates as $trashFolder) {
            if (strcasecmp($folder, $trashFolder) === 0) {
                continue;
            }

            $moved = $this->moveMessage($uid, $folder, $trashFolder);
            if ((bool) ($moved['ok'] ?? false)) {
                return ['ok' => true, 'reason' => null];
            }
        }

        $connection = $this->openConnection($folder, false);
        if (!$connection['ok']) {
            return ['ok' => false, 'reason' => $connection['reason']];
        }

        $mailbox = $connection['mailbox'];
        @imap_delete($mailbox, (string) $uid, FT_UID);
        @imap_expunge($mailbox);
        imap_close($mailbox);

        return ['ok' => true, 'reason' => null];
    }

    /** @return array<string, mixed> */
    public function moveMessage(int $uid, string $fromFolder, string $toFolder): array
    {
        if ($uid <= 0) {
            return ['ok' => false, 'reason' => 'Invalid message id.'];
        }

        $from = $this->normalizeFolder($fromFolder);
        $to = $this->normalizeFolder($toFolder);

        $connection = $this->openConnection($from, false);
        if (!$connection['ok']) {
            return ['ok' => false, 'reason' => $connection['reason']];
        }

        $mailbox = $connection['mailbox'];
        $moved = @imap_mail_move($mailbox, (string) $uid, $to, CP_UID);
        if ($moved) {
            @imap_expunge($mailbox);
        }
        imap_close($mailbox);

        return [
            'ok' => (bool) $moved,
            'reason' => $moved ? null : 'Unable to move message.',
        ];
    }

    private function inboxCacheKey(string $folder, int $limit, string $query, bool $unreadOnly, bool $hasAttachmentsOnly): string
    {
        return 'mailbox_inbox_' . md5(strtolower(
            MAILBOX_IMAP_HOST . '|' . MAILBOX_USERNAME . '|' . $folder . '|' . (string) $limit . '|' . $query . '|'
            . ($unreadOnly ? '1' : '0') . '|' . ($hasAttachmentsOnly ? '1' : '0')
        ));
    }

    private function messageCacheKey(string $folder, int $uid): string
    {
        return 'mailbox_message_' . md5(strtolower(MAILBOX_IMAP_HOST . '|' . MAILBOX_USERNAME . '|' . $folder . '|' . (string) $uid));
    }

    /** @return array<string, mixed> */
    private function openConnection(string $folder, bool $readonly = true): array
    {
        $folder = $this->normalizeFolder($folder);
        $mailboxPath = $this->buildMailboxPath($folder, $readonly);
        $errorsBefore = function_exists('imap_errors') ? imap_errors() : null;
        if (is_array($errorsBefore)) {
            // Clear prior error state.
        }

        $mailbox = @imap_open(
            $mailboxPath,
            MAILBOX_USERNAME,
            MAILBOX_PASSWORD,
            $readonly ? OP_READONLY : 0,
            1,
            ['DISABLE_AUTHENTICATOR' => 'GSSAPI']
        );

        if ($mailbox === false) {
            $errors = function_exists('imap_errors') ? imap_errors() : null;
            $reason = is_array($errors) && !empty($errors)
                ? (string) end($errors)
                : 'Unable to connect to the mailbox.';

            return [
                'ok' => false,
                'reason' => $reason,
            ];
        }

        return [
            'ok' => true,
            'mailbox' => $mailbox,
            'reason' => null,
        ];
    }

    private function buildMailboxRootPath(bool $readonly = true): string
    {
        $flags = ['/imap'];
        if (MAILBOX_IMAP_ENCRYPTION === 'ssl') {
            $flags[] = '/ssl';
        } elseif (MAILBOX_IMAP_ENCRYPTION === 'tls') {
            $flags[] = '/tls';
        } else {
            $flags[] = '/notls';
        }

        if ($readonly) {
            $flags[] = '/readonly';
        }

        return '{' . MAILBOX_IMAP_HOST . ':' . MAILBOX_IMAP_PORT . implode('', $flags) . '}';
    }

    private function buildMailboxPath(string $folder, bool $readonly = true): string
    {
        return $this->buildMailboxRootPath($readonly) . $folder;
    }

    private function buildSearchCriteria(string $query, bool $unreadOnly): string
    {
        $criteria = [];
        $criteria[] = $unreadOnly ? 'UNSEEN' : 'ALL';

        if ($query !== '') {
            $escaped = addcslashes($query, '\\"');
            $criteria[] = 'TEXT "' . $escaped . '"';
        }

        return trim(implode(' ', $criteria));
    }

    private function structureHasAttachments($structure): bool
    {
        if (!is_object($structure)) {
            return false;
        }

        $isAttachment = $this->isAttachmentPart($structure);
        if ($isAttachment) {
            return true;
        }

        if (!isset($structure->parts) || !is_array($structure->parts)) {
            return false;
        }

        foreach ($structure->parts as $part) {
            if ($this->structureHasAttachments($part)) {
                return true;
            }
        }

        return false;
    }

    /** @return array<int, array{name:string,size:int,mime:string,partNumber:string}> */
    private function extractAttachmentMetadata($structure, string $partNumber): array
    {
        if (!is_object($structure)) {
            return [];
        }

        $result = [];
        $currentPart = $partNumber !== '' ? $partNumber : '1';

        if ($this->isAttachmentPart($structure)) {
            $result[] = [
                'name' => $this->partFileName($structure),
                'size' => (int) ($structure->bytes ?? 0),
                'mime' => $this->partMime($structure),
                'partNumber' => $currentPart,
            ];
        }

        if (!isset($structure->parts) || !is_array($structure->parts)) {
            return $result;
        }

        foreach ($structure->parts as $index => $part) {
            $nextPartNumber = $partNumber === '' ? (string) ($index + 1) : $partNumber . '.' . ($index + 1);
            foreach ($this->extractAttachmentMetadata($part, $nextPartNumber) as $meta) {
                $result[] = $meta;
            }
        }

        return $result;
    }

    private function isAttachmentPart($structure): bool
    {
        $disposition = strtoupper((string) ($structure->disposition ?? ''));
        if (in_array($disposition, ['ATTACHMENT', 'INLINE'], true)) {
            $name = $this->partFileName($structure);
            if ($name !== '') {
                return true;
            }
        }

        foreach ((array) ($structure->parameters ?? []) as $parameter) {
            $attribute = strtolower((string) ($parameter->attribute ?? ''));
            if ($attribute === 'name' && trim((string) ($parameter->value ?? '')) !== '') {
                return true;
            }
        }

        foreach ((array) ($structure->dparameters ?? []) as $parameter) {
            $attribute = strtolower((string) ($parameter->attribute ?? ''));
            if ($attribute === 'filename' && trim((string) ($parameter->value ?? '')) !== '') {
                return true;
            }
        }

        return false;
    }

    private function partFileName($structure): string
    {
        foreach ((array) ($structure->dparameters ?? []) as $parameter) {
            if (strtolower((string) ($parameter->attribute ?? '')) === 'filename') {
                return $this->decodeHeaderValue((string) ($parameter->value ?? ''));
            }
        }

        foreach ((array) ($structure->parameters ?? []) as $parameter) {
            if (strtolower((string) ($parameter->attribute ?? '')) === 'name') {
                return $this->decodeHeaderValue((string) ($parameter->value ?? ''));
            }
        }

        return '';
    }

    private function partMime($structure): string
    {
        $types = ['TEXT', 'MULTIPART', 'MESSAGE', 'APPLICATION', 'AUDIO', 'IMAGE', 'VIDEO', 'OTHER'];
        $typeIndex = (int) ($structure->type ?? 0);
        $major = $types[$typeIndex] ?? 'APPLICATION';
        $sub = strtoupper((string) ($structure->subtype ?? 'OCTET-STREAM'));
        return strtolower($major . '/' . $sub);
    }

    private function threadKeyFromSubject(string $subject): string
    {
        $normalized = trim(mb_strtolower($subject));
        $normalized = preg_replace('/^((re|fwd?|aw):\s*)+/iu', '', $normalized) ?? $normalized;
        $normalized = preg_replace('/\s+/u', ' ', $normalized) ?? $normalized;

        return $normalized;
    }

    private function normalizeFolder(string $folder): string
    {
        $folder = trim($folder);
        $folder = str_replace(["\r", "\n", '{', '}'], '', $folder);
        return $folder !== '' ? $folder : (MAILBOX_FOLDER !== '' ? MAILBOX_FOLDER : 'INBOX');
    }

    private function decodeHeaderValue(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        if (function_exists('iconv_mime_decode')) {
            $decoded = @iconv_mime_decode($value, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8');
            if (is_string($decoded) && $decoded !== '') {
                return $decoded;
            }
        }

        if (function_exists('imap_mime_header_decode')) {
            $parts = imap_mime_header_decode($value);
            if (is_array($parts) && !empty($parts)) {
                $out = '';
                foreach ($parts as $part) {
                    $charset = strtoupper((string) ($part->charset ?? 'UTF-8'));
                    $text = (string) ($part->text ?? '');
                    if ($charset !== 'DEFAULT' && $charset !== 'UTF-8' && function_exists('iconv')) {
                        $converted = @iconv($charset, 'UTF-8//IGNORE', $text);
                        $text = is_string($converted) ? $converted : $text;
                    }
                    $out .= $text;
                }
                if ($out !== '') {
                    return $out;
                }
            }
        }

        return $value;
    }

    private function normalizeDate(string $date): string
    {
        $timestamp = strtotime($date);
        return $timestamp !== false ? gmdate('c', $timestamp) : $date;
    }

    private function buildSnippet($mailbox, int $uid): string
    {
        $structure = imap_fetchstructure($mailbox, $uid, FT_UID);
        $parts = $this->extractBodies($mailbox, $uid, $structure, '', 'UTF-8');
        $text = trim((string) ($parts['text'] ?? ''));
        if ($text === '') {
            $text = $this->htmlToText((string) ($parts['html'] ?? ''));
        }
        return $this->truncate($text, 160);
    }

    /**
     * @param object|null $structure
     * @return array{text:string, html:string}
     */
    private function extractBodies($mailbox, int $uid, $structure, string $partNumber, string $charset): array
    {
        $result = ['text' => '', 'html' => ''];

        if ($structure === null) {
            $body = imap_body($mailbox, $uid, FT_UID | FT_PEEK);
            $result['text'] = is_string($body) ? $body : '';
            return $result;
        }

        $currentCharset = $this->partCharset($structure) ?: $charset;

        if (!isset($structure->parts) || !is_array($structure->parts) || $structure->parts === []) {
            $section = $partNumber !== '' ? $partNumber : '1';
            $body = imap_fetchbody($mailbox, $uid, $section, FT_UID | FT_PEEK);
            if (!is_string($body)) {
                return $result;
            }

            $decoded = $this->decodeBody($body, (int) ($structure->encoding ?? 0), $currentCharset);
            $subtype = strtoupper((string) ($structure->subtype ?? 'PLAIN'));

            if ((int) ($structure->type ?? 0) === 0 && $subtype === 'HTML') {
                $result['html'] = $decoded;
            } else {
                $result['text'] = $decoded;
            }

            return $result;
        }

        foreach ($structure->parts as $index => $part) {
            $nextPartNumber = $partNumber === '' ? (string) ($index + 1) : $partNumber . '.' . ($index + 1);
            $child = $this->extractBodies($mailbox, $uid, $part, $nextPartNumber, $currentCharset);
            if ($result['text'] === '' && $child['text'] !== '') {
                $result['text'] = $child['text'];
            }
            if ($result['html'] === '' && $child['html'] !== '') {
                $result['html'] = $child['html'];
            }
        }

        return $result;
    }

    private function partCharset($structure): string
    {
        if (!isset($structure->parameters) || !is_array($structure->parameters)) {
            return '';
        }

        foreach ($structure->parameters as $parameter) {
            if (strtolower((string) ($parameter->attribute ?? '')) === 'charset') {
                return strtoupper((string) ($parameter->value ?? 'UTF-8'));
            }
        }

        return '';
    }

    private function decodeBody(string $body, int $encoding, string $charset): string
    {
        if ($encoding === 3) {
            $body = base64_decode($body, true) ?: $body;
        } elseif ($encoding === 4) {
            $body = quoted_printable_decode($body);
        }

        if ($charset !== '' && strtoupper($charset) !== 'UTF-8' && strtoupper($charset) !== 'DEFAULT' && function_exists('iconv')) {
            $converted = @iconv($charset, 'UTF-8//IGNORE', $body);
            if (is_string($converted) && $converted !== '') {
                $body = $converted;
            }
        }

        return trim(str_replace(["\r\n", "\r"], "\n", $body));
    }

    private function htmlToText(string $html): string
    {
        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
        return trim($text);
    }

    private function truncate(string $text, int $length): string
    {
        $text = trim($text);
        if ($text === '') {
            return '';
        }

        if (mb_strlen($text) <= $length) {
            return $text;
        }

        return rtrim(mb_substr($text, 0, $length - 1)) . '…';
    }

    private function maskEmail(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        if ($local === '' || $domain === '') {
            return $email;
        }

        $prefix = mb_substr($local, 0, min(2, mb_strlen($local)));
        return $prefix . str_repeat('*', max(1, mb_strlen($local) - mb_strlen($prefix))) . '@' . $domain;
    }
}