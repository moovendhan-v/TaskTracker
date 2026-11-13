import type { ChatMessageRecord } from './chat.repository.js';

export const CHAT_EXPORT_FORMATS = ['markdown', 'json'] as const;
export type ChatExportFormat = (typeof CHAT_EXPORT_FORMATS)[number];

/** A channel's messages, oldest first, each with its thread replies and the names of its files. */
export interface ChatExportMessage {
  record: ChatMessageRecord;
  files: string[];
  replies: { record: ChatMessageRecord; files: string[] }[];
}

export interface ChatExport {
  fileName: string;
  contentType: string;
  content: string;
}

const stamp = (date: Date) => `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
const who = (record: ChatMessageRecord) => (record.kind === 'system' ? 'TaskFlow' : (record.authorName ?? 'Someone who left'));

/** A file name made only of safe characters, from the channel's name. */
function slug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'chat'
  );
}

/**
 * The export file: Markdown to read, or JSON to process. Messages are plain text as written
 * (files appear by name only; links to them expire, so none are included). Deleted messages
 * are left out by the caller.
 */
export function formatChatExport(channel: { title: string }, messages: readonly ChatExportMessage[], format: ChatExportFormat, exportedAt: Date, truncated: boolean): ChatExport {
  const base = `${slug(channel.title)}-${exportedAt.toISOString().slice(0, 10)}`;
  if (format === 'json') {
    const item = (record: ChatMessageRecord, files: string[]) => ({
      id: record.id,
      author: who(record),
      authorId: record.authorId,
      sentAt: record.createdAt.toISOString(),
      editedAt: record.editedAt?.toISOString() ?? null,
      body: record.body,
      files,
    });
    const content = JSON.stringify(
      {
        channel: channel.title,
        exportedAt: exportedAt.toISOString(),
        truncated,
        messages: messages.map((message) => ({ ...item(message.record, message.files), replies: message.replies.map((reply) => item(reply.record, reply.files)) })),
      },
      null,
      2,
    );
    return { fileName: `${base}.json`, contentType: 'application/json', content };
  }
  const block = (record: ChatMessageRecord, files: string[], indent: string) => {
    const head = `${indent}**${who(record)}** · ${stamp(record.createdAt)}${record.editedAt ? ' (edited)' : ''}`;
    // Each line of the text is quoted, so nothing in a message can turn into headings or structure here.
    const body = record.body ? record.body.split('\n').map((line) => `${indent}> ${line}`) : [];
    const attached = files.map((name) => `${indent}> 📎 ${name}`);
    return [head, ...body, ...attached].join('\n');
  };
  const lines = [
    `# ${channel.title}`,
    '',
    `Exported ${stamp(exportedAt)} · ${messages.length} message${messages.length === 1 ? '' : 's'}${truncated ? ' (the most recent ones; older messages weren’t included)' : ''}`,
    '',
  ];
  for (const message of messages) {
    lines.push(block(message.record, message.files, ''), '');
    for (const reply of message.replies) lines.push(block(reply.record, reply.files, '    '), '');
  }
  return { fileName: `${base}.md`, contentType: 'text/markdown', content: lines.join('\n') };
}
