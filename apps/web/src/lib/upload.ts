/** PUTs a file to a signed same-origin upload URL, reporting progress (fetch can't report upload progress). */
export function putFile(url: string, file: File, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', 'application/octet-stream');
    request.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(request.status === 413 ? 'File is too large' : "The upload didn't complete")));
    request.onerror = () => reject(new Error("The upload didn't complete"));
    request.onabort = () => reject(new DOMException('Cancelled', 'AbortError'));
    signal?.addEventListener('abort', () => request.abort());
    request.send(file);
  });
}

/** One upload: ask for a link, send the bytes, then let the server check them. Discards the pending upload if sending fails. */
export async function uploadWith<T>(
  steps: {
    request: () => Promise<{ attachmentId: string; uploadUrl: string }>;
    complete: (attachmentId: string) => Promise<{ attachment?: T | null; error?: string | null }>;
    discard: (attachmentId: string) => Promise<unknown>;
  },
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  const ticket = await steps.request();
  try {
    await putFile(ticket.uploadUrl, file, onProgress, signal);
  } catch (error) {
    void steps.discard(ticket.attachmentId).catch(() => undefined);
    throw error;
  }
  const result = await steps.complete(ticket.attachmentId);
  if (!result.attachment) throw new Error(result.error ?? "This file can't be shared");
  return result.attachment;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What the file pickers offer; the server checks the real type anyway. */
export const UPLOAD_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.zip,.docx,.xlsx,.pptx,.txt,.csv,.md,.log,.json';
