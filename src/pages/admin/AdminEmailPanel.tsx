import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  Paperclip,
  RefreshCw,
  Reply,
  ReplyAll,
  Search,
  Send,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  deleteAdminEmailMessageApi,
  fetchAdminEmailFoldersApi,
  fetchAdminEmailInboxApi,
  fetchAdminEmailMessageApi,
  fetchAdminEmailThreadApi,
  moveAdminEmailMessageApi,
  sendAdminEmailApi,
  setAdminEmailSeenApi,
  uploadEmailImageApi,
  type AdminInboxDetail,
  type AdminInboxListResponse,
  type AdminInboxMessage,
} from '../../services/api';
import LexicalEmailEditor from '../../components/admin/LexicalEmailEditor';

function sanitizeEmailHtml(html: string): string {
  if (typeof window === 'undefined' || html.trim() === '') {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const blockedTags = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'form'];
  blockedTags.forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });

  doc.querySelectorAll('*').forEach(el => {
    const names = el.getAttributeNames();
    names.forEach(name => {
      const lower = name.toLowerCase();
      const value = el.getAttribute(name) ?? '';

      if (lower.startsWith('on')) {
        el.removeAttribute(name);
        return;
      }

      if ((lower === 'href' || lower === 'src') && /^\s*javascript:/i.test(value)) {
        el.removeAttribute(name);
      }
    });
  });

  return doc.body.innerHTML;
}

function extractEmails(text: string): string[] {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return Array.from(new Set(matches.map(item => item.trim().toLowerCase())));
}

type ComposeMode = 'new' | 'reply' | 'reply-all' | 'forward';

type ComposeAttachment = {
  name: string;
  type: string;
  data: string;
  size: number;
};

export default function AdminEmailPanel() {
  const { token, hasPermission } = useAuth();
  const canViewEmailInbox = hasPermission('email:inbox:view');
  const canComposeEmail = hasPermission('email:send') || hasPermission('email:test');
  const canDeleteEmail = hasPermission('email:delete');

  const [folders, setFolders] = useState<string[]>(['INBOX', 'Sent', 'Drafts', 'Trash']);
  const [currentFolder, setCurrentFolder] = useState('INBOX');

  const [inbox, setInbox] = useState<AdminInboxListResponse | null>(null);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [inboxError, setInboxError] = useState('');

  const [selectedMessageUid, setSelectedMessageUid] = useState<number | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<AdminInboxDetail | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [messageError, setMessageError] = useState('');

  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [hasAttachmentsOnly, setHasAttachmentsOnly] = useState(false);

  const [threadItems, setThreadItems] = useState<AdminInboxMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>('new');
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeIsHtml, setComposeIsHtml] = useState(false);
  const [composeAttachments, setComposeAttachments] = useState<ComposeAttachment[]>([]);
  const [composeError, setComposeError] = useState('');
  const [composeSuccess, setComposeSuccess] = useState('');
  const [sendingCompose, setSendingCompose] = useState(false);

  const [movingMessage, setMovingMessage] = useState(false);
  const [editorNonce, setEditorNonce] = useState(0);

  const loadFolders = async () => {
    if (!token || !canViewEmailInbox) return;

    try {
      const result = await fetchAdminEmailFoldersApi(token);
      if (result.folders.folders.length > 0) {
        setFolders(result.folders.folders);
      }
    } catch {
      // Keep fallback folders if folder fetch fails.
    }
  };

  const loadInbox = async () => {
    if (!token || !canViewEmailInbox) {
      setInbox(null);
      setInboxError('');
      return;
    }

    setLoadingInbox(true);
    setInboxError('');
    try {
      const { inbox: nextInbox } = await fetchAdminEmailInboxApi(token, {
        folder: currentFolder,
        limit: 30,
        q: query.trim() || undefined,
        unread: unreadOnly,
        hasAttachments: hasAttachmentsOnly,
      });
      setInbox(nextInbox);

      if (selectedMessageUid !== null && !nextInbox.messages.some(item => item.uid === selectedMessageUid)) {
        setSelectedMessageUid(null);
        setSelectedMessage(null);
        setThreadItems([]);
      }
    } catch (err: unknown) {
      setInboxError((err as Error)?.message ?? 'Failed to load inbox.');
    } finally {
      setLoadingInbox(false);
    }
  };

  useEffect(() => {
    void loadFolders();
  }, [token, canViewEmailInbox]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadInbox();
    }, 220);

    return () => window.clearTimeout(id);
  }, [token, canViewEmailInbox, currentFolder, query, unreadOnly, hasAttachmentsOnly]);

  const sanitizedHtmlBody = useMemo(() => {
    if (!selectedMessage?.htmlBody) {
      return '';
    }

    return sanitizeEmailHtml(selectedMessage.htmlBody);
  }, [selectedMessage]);

  useEffect(() => {
    if (!token || !canViewEmailInbox || selectedMessageUid === null) {
      setSelectedMessage(null);
      setMessageError('');
      setThreadItems([]);
      return;
    }

    setLoadingMessage(true);
    setLoadingThread(true);
    setMessageError('');

    Promise.all([
      fetchAdminEmailMessageApi(token, selectedMessageUid, currentFolder),
      fetchAdminEmailThreadApi(token, selectedMessageUid, currentFolder),
    ])
      .then(([messageResult, threadResult]) => {
        if (messageResult.message) {
          setSelectedMessage(messageResult.message);
        } else {
          setSelectedMessage(null);
          setMessageError(messageResult.reason ?? 'Message unavailable.');
        }

        setThreadItems(threadResult.thread ?? []);
      })
      .catch((err: unknown) => {
        setSelectedMessage(null);
        setThreadItems([]);
        setMessageError((err as Error)?.message ?? 'Failed to load email message.');
      })
      .finally(() => {
        setLoadingMessage(false);
        setLoadingThread(false);
      });
  }, [token, canViewEmailInbox, selectedMessageUid, currentFolder]);

  const handleEditorImageUpload = async (file: File): Promise<string> => {
    if (!token) {
      throw new Error('You are not authenticated.');
    }

    setComposeError('');
    try {
      const { url } = await uploadEmailImageApi(token, file);
      return url;
    } catch (err: unknown) {
      const message = (err as Error)?.message ?? 'Image upload failed.';
      setComposeError(message);
      throw err;
    }
  };

  const openCompose = (
    mode: ComposeMode = 'new',
    seed?: { to?: string; cc?: string; bcc?: string; subject?: string; body?: string; isHtml?: boolean }
  ) => {
    setComposeMode(mode);
    setComposeError('');
    setComposeSuccess('');
    setComposeTo(seed?.to ?? '');
    setComposeCc(seed?.cc ?? '');
    setComposeBcc(seed?.bcc ?? '');
    setComposeSubject(seed?.subject ?? '');
    setComposeBody(seed?.body ?? '');
    setComposeIsHtml(Boolean(seed?.isHtml));
    setComposeAttachments([]);
    setComposeOpen(true);
    setEditorNonce(prev => prev + 1);
  };

  const openReply = (replyAll: boolean) => {
    if (!selectedMessage) return;

    const sender = extractEmails(selectedMessage.from)[0] ?? '';
    const recipients = extractEmails(selectedMessage.to ?? '');

    const ccList = replyAll
      ? recipients.filter(item => item !== sender).join(', ')
      : '';

    const subject = /^re:/i.test(selectedMessage.subject)
      ? selectedMessage.subject
      : `Re: ${selectedMessage.subject || '(No subject)'}`;

    const quoted = selectedMessage.textBody || selectedMessage.snippet || '';
    const body = `\n\nOn ${selectedMessage.date ? new Date(selectedMessage.date).toLocaleString() : 'previous message'}, ${selectedMessage.from} wrote:\n> ${quoted.replace(/\n/g, '\n> ')}`;

    openCompose(replyAll ? 'reply-all' : 'reply', {
      to: sender,
      cc: ccList,
      subject,
      body,
      isHtml: false,
    });
  };

  const openForward = () => {
    if (!selectedMessage) return;

    const subject = /^fwd:/i.test(selectedMessage.subject)
      ? selectedMessage.subject
      : `Fwd: ${selectedMessage.subject || '(No subject)'}`;

    const original = selectedMessage.textBody || selectedMessage.snippet || '';

    openCompose('forward', {
      subject,
      body: `\n\n---------- Forwarded message ----------\nFrom: ${selectedMessage.from}\nDate: ${selectedMessage.date ? new Date(selectedMessage.date).toLocaleString() : ''}\nSubject: ${selectedMessage.subject}\nTo: ${selectedMessage.to}\n\n${original}`,
      isHtml: false,
    });
  };

  const handleComposeFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const list = Array.from(files).slice(0, 6);

    const nextItems: ComposeAttachment[] = [];
    for (const file of list) {
      if (file.size > 8 * 1024 * 1024) {
        setComposeError(`${file.name} is too large (max 8MB per file).`);
        continue;
      }

      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const raw = String(reader.result || '');
          const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
        reader.readAsDataURL(file);
      });

      nextItems.push({
        name: file.name,
        type: file.type || 'application/octet-stream',
        data,
        size: file.size,
      });
    }

    setComposeAttachments(prev => [...prev, ...nextItems].slice(0, 6));
  };

  const submitCompose = async () => {
    if (!token || !canComposeEmail) {
      setComposeError('You do not have permission to send email.');
      return;
    }

    const to = extractEmails(composeTo);
    const cc = extractEmails(composeCc);
    const bcc = extractEmails(composeBcc);

    if (to.length === 0 || !composeSubject.trim() || !composeBody.trim()) {
      setComposeError('Recipient, subject, and message are required.');
      return;
    }

    setSendingCompose(true);
    setComposeError('');
    setComposeSuccess('');

    const bodyToSend = composeBody;

    try {
      const result = await sendAdminEmailApi(token, {
        to: to[0],
        cc,
        bcc,
        subject: composeSubject.trim(),
        body: bodyToSend,
        isHtml: composeIsHtml,
        attachments: composeAttachments.map(item => ({
          name: item.name,
          type: item.type,
          data: item.data,
        })),
      });

      if (!result.result.sent) {
        setComposeError(result.result.reason || 'Email could not be sent.');
        return;
      }

      setComposeSuccess(`Email sent to ${result.result.recipient}.`);
      setComposeOpen(false);
      void loadInbox();
    } catch (err: unknown) {
      setComposeError((err as Error)?.message ?? 'Failed to send email.');
    } finally {
      setSendingCompose(false);
    }
  };

  const toggleSeen = async (nextSeen: boolean) => {
    if (!token || !selectedMessageUid) return;

    try {
      const result = await setAdminEmailSeenApi(token, selectedMessageUid, nextSeen, currentFolder);
      if (!result.ok) {
        setMessageError(result.reason ?? 'Failed to update read status.');
        return;
      }
      void loadInbox();
      if (selectedMessage) {
        setSelectedMessage({ ...selectedMessage, seen: nextSeen });
      }
    } catch (err: unknown) {
      setMessageError((err as Error)?.message ?? 'Failed to update read status.');
    }
  };

  const deleteCurrentMessage = async () => {
    if (!token || !selectedMessageUid || !canDeleteEmail) return;

    setMovingMessage(true);
    try {
      const result = await deleteAdminEmailMessageApi(token, selectedMessageUid, currentFolder);
      if (!result.ok) {
        setMessageError(result.reason ?? 'Failed to delete message.');
        return;
      }

      setSelectedMessageUid(null);
      setSelectedMessage(null);
      setThreadItems([]);
      void loadInbox();
    } catch (err: unknown) {
      setMessageError((err as Error)?.message ?? 'Failed to delete message.');
    } finally {
      setMovingMessage(false);
    }
  };

  const moveCurrentMessage = async (targetFolder: string) => {
    if (!token || !selectedMessageUid || !canDeleteEmail) return;

    setMovingMessage(true);
    try {
      const result = await moveAdminEmailMessageApi(token, selectedMessageUid, targetFolder, currentFolder);
      if (!result.ok) {
        setMessageError(result.reason ?? `Failed to move message to ${targetFolder}.`);
        return;
      }

      setSelectedMessageUid(null);
      setSelectedMessage(null);
      setThreadItems([]);
      void loadInbox();
    } catch (err: unknown) {
      setMessageError((err as Error)?.message ?? `Failed to move message to ${targetFolder}.`);
    } finally {
      setMovingMessage(false);
    }
  };

  const foldersQuick = ['INBOX', 'Sent', 'Drafts', 'Trash'];
  const folderButtons = foldersQuick.filter(name => folders.includes(name));

  if (!canViewEmailInbox) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Email</h2>
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-sm text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> You do not have permission to view the inbox.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-[1700px]">
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-[#111a26] via-[#111926] to-[#0d141d] px-6 py-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-orange-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Email Workspace</h2>
            <p className="mt-2 text-sm text-slate-300">Two-column inbox with folders, threads, actions, and full compose flow.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-[#0b1118]/70 px-3 py-1.5 text-xs text-slate-300">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Connected Inbox
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0e141c] shadow-[0_26px_70px_rgba(0,0,0,0.42)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#141d29] px-4 py-3">
          <div className="relative flex-1 min-w-[240px] max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search mail"
              className="w-full rounded-xl border border-slate-700 bg-[#0b1118] py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUnreadOnly(prev => !prev)}
              className={`rounded-lg border px-2.5 py-2 text-xs ${unreadOnly ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 bg-[#0b1118] text-slate-400'}`}
            >
              Unread
            </button>
            <button
              type="button"
              onClick={() => setHasAttachmentsOnly(prev => !prev)}
              className={`rounded-lg border px-2.5 py-2 text-xs ${hasAttachmentsOnly ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 bg-[#0b1118] text-slate-400'}`}
            >
              Attachments
            </button>
            {canComposeEmail && (
              <button
                type="button"
                onClick={() => openCompose('new')}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
              >
                <SquarePen className="h-3.5 w-3.5" />
                Compose
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void loadFolders();
                void loadInbox();
              }}
              disabled={loadingInbox}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-[#0b1118] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingInbox ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {(composeSuccess || composeError || inboxError) && (
          <div className="border-b border-slate-800 px-4 py-2 space-y-2">
            {composeSuccess && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                {composeSuccess}
              </div>
            )}
            {composeError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {composeError}
              </div>
            )}
            {inboxError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {inboxError}
              </div>
            )}
          </div>
        )}

        <div className="grid min-h-[720px] grid-cols-1 lg:grid-cols-12">
          <aside className="border-b border-slate-800 bg-[#0b1118] lg:col-span-4 lg:border-b-0 lg:border-r xl:col-span-3">
            <div className="sticky top-0 z-10 space-y-3 border-b border-slate-800 bg-[#0f1722]/95 px-4 py-3 backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                {folderButtons.map(folder => (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => setCurrentFolder(folder)}
                    className={`rounded-lg border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${currentFolder === folder ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 bg-[#0b1118] text-slate-400'}`}
                  >
                    {folder}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{currentFolder}</p>
                <div className="relative">
                  <select
                    value={currentFolder}
                    onChange={e => setCurrentFolder(e.target.value)}
                    className="appearance-none rounded-lg border border-slate-700 bg-[#0b1118] py-1.5 pl-2 pr-7 text-[11px] text-slate-300 focus:border-cyan-400/60 focus:outline-none"
                  >
                    {folders.map(folder => (
                      <option key={folder} value={folder}>{folder}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
            </div>

            <div className="max-h-[calc(100vh-275px)] overflow-y-auto">
              {loadingInbox && (
                <div className="px-4 py-6 text-sm text-slate-400 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading mailbox...
                </div>
              )}

              {!loadingInbox && (inbox?.messages?.length ?? 0) === 0 && (
                <div className="px-4 py-8 text-sm text-slate-500">No messages found.</div>
              )}

              {!loadingInbox && (inbox?.messages ?? []).map(item => (
                <button
                  key={item.uid}
                  type="button"
                  onClick={() => setSelectedMessageUid(item.uid)}
                  className={`block w-full border-b border-slate-800 px-4 py-3 text-left transition-all ${selectedMessageUid === item.uid ? 'bg-cyan-500/10 shadow-[inset_3px_0_0_0_rgba(34,211,238,0.9)]' : 'hover:bg-slate-800/40'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.seen ? 'bg-slate-700' : 'bg-cyan-400'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className={`line-clamp-1 text-sm ${item.seen ? 'font-medium text-slate-200' : 'font-semibold text-white'}`}>
                          {item.subject || '(No subject)'}
                        </p>
                        <span className="shrink-0 text-[10px] uppercase tracking-wider text-slate-500">
                          {item.date ? new Date(item.date).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-400">{item.from}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        {item.hasAttachments && (
                          <span className="inline-flex items-center gap-1 text-cyan-300/90">
                            <Paperclip className="h-3 w-3" /> Files
                          </span>
                        )}
                        <span className="line-clamp-1">{item.snippet || 'No preview available.'}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="bg-[#0f1722] lg:col-span-8 xl:col-span-9">
            <div className="sticky top-0 z-10 border-b border-slate-800 bg-[#101927]/95 px-5 py-4 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Message</p>
                {selectedMessage && (
                  <div className="flex flex-wrap items-center gap-2">
                    {canComposeEmail && (
                      <>
                        <button
                          type="button"
                          onClick={() => openReply(false)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#0b1118] px-2.5 py-1.5 text-[11px] text-slate-200 hover:border-slate-500"
                        >
                          <Reply className="h-3 w-3" /> Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => openReply(true)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#0b1118] px-2.5 py-1.5 text-[11px] text-slate-200 hover:border-slate-500"
                        >
                          <ReplyAll className="h-3 w-3" /> Reply All
                        </button>
                        <button
                          type="button"
                          onClick={openForward}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#0b1118] px-2.5 py-1.5 text-[11px] text-slate-200 hover:border-slate-500"
                        >
                          <Send className="h-3 w-3" /> Forward
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => { void toggleSeen(!selectedMessage.seen); }}
                      className="rounded-lg border border-slate-700 bg-[#0b1118] px-2.5 py-1.5 text-[11px] text-slate-200 hover:border-slate-500"
                    >
                      Mark as {selectedMessage.seen ? 'Unread' : 'Read'}
                    </button>

                    {canDeleteEmail && (
                      <>
                        {currentFolder !== 'Trash' && (
                          <button
                            type="button"
                            onClick={() => { void moveCurrentMessage('Trash'); }}
                            disabled={movingMessage}
                            className="rounded-lg border border-amber-600/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200 hover:bg-amber-500/20 disabled:opacity-60"
                          >
                            Move to Trash
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { void deleteCurrentMessage(); }}
                          disabled={movingMessage}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-600/40 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-200 hover:bg-red-500/20 disabled:opacity-60"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 space-y-4">
              {loadingMessage && (
                <div className="text-sm text-slate-400 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading message...
                </div>
              )}

              {messageError && !loadingMessage && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {messageError}
                </div>
              )}

              {!loadingMessage && !messageError && !selectedMessage && (
                <div className="flex min-h-[470px] items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-[#0b1118]/70 text-sm text-slate-500">
                  Select a message from the inbox
                </div>
              )}

              {selectedMessage && !loadingMessage && (
                <article className="space-y-4 rounded-2xl border border-slate-800 bg-[#111b28] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                  <header className="space-y-3 border-b border-slate-800 pb-5">
                    <h3 className="text-2xl font-semibold text-white">{selectedMessage.subject || '(No subject)'}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300">
                      <span>From: <span className="text-white">{selectedMessage.from}</span></span>
                      {selectedMessage.to && <span>To: <span className="text-slate-200">{selectedMessage.to}</span></span>}
                    </div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">
                      {selectedMessage.date ? new Date(selectedMessage.date).toLocaleString() : 'Unknown date'}
                    </div>

                    {(selectedMessage.attachments?.length ?? 0) > 0 && (
                      <div className="rounded-xl border border-slate-700 bg-[#0b121b] p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Attachments</p>
                        <div className="mt-2 space-y-1 text-xs text-slate-300">
                          {(selectedMessage.attachments ?? []).map(item => (
                            <div key={item.partNumber} className="flex items-center justify-between gap-2 rounded-md bg-slate-800/40 px-2 py-1.5">
                              <span className="inline-flex items-center gap-1 truncate">
                                <Paperclip className="h-3 w-3 text-cyan-300" />
                                {item.name || 'Attachment'}
                              </span>
                              <span className="shrink-0 text-slate-500">{Math.max(1, Math.round(item.size / 1024))} KB</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(threadItems.length > 1 || loadingThread) && (
                      <div className="rounded-xl border border-slate-700 bg-[#0b121b] px-3 py-2 text-xs text-slate-300">
                        {loadingThread ? 'Loading thread…' : `Thread has ${threadItems.length} messages.`}
                      </div>
                    )}
                  </header>

                  <div className="max-h-[620px] overflow-auto rounded-xl border border-slate-700 bg-[#0b121b] p-5">
                    {sanitizedHtmlBody ? (
                      <div
                        className="prose prose-invert max-w-none text-sm leading-7 text-slate-200 prose-a:text-cyan-300 prose-headings:text-white"
                        dangerouslySetInnerHTML={{ __html: sanitizedHtmlBody }}
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-200">
                        {selectedMessage.textBody || selectedMessage.snippet || 'No text body available for this message.'}
                      </pre>
                    )}
                  </div>
                </article>
              )}
            </div>
          </section>
        </div>
      </div>

      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-[#0f1722] shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="text-base font-semibold text-white">Compose Email ({composeMode})</h3>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="rounded-lg border border-slate-700 bg-[#111a28] p-2 text-slate-400 hover:text-white"
                aria-label="Close compose"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-5">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">To</label>
                <input
                  type="text"
                  value={composeTo}
                  onChange={e => setComposeTo(e.target.value)}
                  placeholder="name@example.com, second@example.com"
                  className="w-full rounded-xl border border-slate-700 bg-[#0b1118] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">CC</label>
                  <input
                    type="text"
                    value={composeCc}
                    onChange={e => setComposeCc(e.target.value)}
                    placeholder="cc@example.com"
                    className="w-full rounded-xl border border-slate-700 bg-[#0b1118] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">BCC</label>
                  <input
                    type="text"
                    value={composeBcc}
                    onChange={e => setComposeBcc(e.target.value)}
                    placeholder="bcc@example.com"
                    className="w-full rounded-xl border border-slate-700 bg-[#0b1118] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Subject</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={e => setComposeSubject(e.target.value)}
                  placeholder="Email subject"
                  className="w-full rounded-xl border border-slate-700 bg-[#0b1118] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-[#0b1118] px-3 py-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={composeIsHtml}
                    onChange={e => setComposeIsHtml(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  Rich HTML mode
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-[#101927] px-2.5 py-1.5 text-[11px] text-slate-200 hover:border-slate-500">
                  <Paperclip className="h-3.5 w-3.5" />
                  Add attachments
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={e => { void handleComposeFiles(e.target.files); }}
                  />
                </label>
              </div>

              {composeAttachments.length > 0 && (
                <div className="rounded-lg border border-slate-700 bg-[#0b1118] p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Compose Attachments</p>
                  <div className="mt-2 space-y-1 text-xs text-slate-300">
                    {composeAttachments.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-slate-800/40 px-2 py-1.5">
                        <span className="truncate">{item.name}</span>
                        <button
                          type="button"
                          onClick={() => setComposeAttachments(prev => prev.filter((_, i) => i !== index))}
                          className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-slate-400"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Message</label>
                {composeIsHtml ? (
                  <LexicalEmailEditor
                    key={editorNonce}
                    initialHtml={composeBody}
                    onChange={setComposeBody}
                    onUploadImage={handleEditorImageUpload}
                  />
                ) : (
                  <textarea
                    value={composeBody}
                    onChange={e => setComposeBody(e.target.value)}
                    placeholder="Write your message..."
                    rows={10}
                    className="w-full resize-y rounded-xl border border-slate-700 bg-[#0b1118] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-4">
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="rounded-xl border border-slate-700 bg-[#111a28] px-4 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void submitCompose(); }}
                disabled={sendingCompose}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
              >
                {sendingCompose ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
