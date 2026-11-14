import { toast, type ExternalToast } from 'sonner';
import { getErrorMessage, missingPermissionOf, whyHref, workspaceInPath } from '@/lib/errors';
import { navigateTo } from '@/lib/navigate';

/** How long toasts stay, in ms. One place to tune them. */
export const TOAST_DURATION = { short: 2500, normal: 4000, long: 8000 } as const;

type Options = Omit<ExternalToast, 'duration'> & { duration?: keyof typeof TOAST_DURATION | number };

const withDuration = ({ duration = 'normal', ...rest }: Options = {}): ExternalToast => ({
  ...rest,
  duration: typeof duration === 'number' ? duration : TOAST_DURATION[duration],
});

/** Toast presets, so every part of the app announces things the same way. */
export const notify = {
  success: (message: string, options?: Options) => toast.success(message, withDuration({ duration: 'short', ...options })),
  info: (message: string, options?: Options) => toast(message, withDuration(options)),
  /**
   * Shows the API's (already user-safe) message for an error. A refusal that names the
   * missing permission gets a "Why?" button to the access checker (with Request access).
   */
  error: (error: unknown, options?: Options) => {
    const missing = missingPermissionOf(error);
    const workspaceId = typeof window === 'undefined' ? null : workspaceInPath(window.location.pathname);
    const why = missing && workspaceId ? { action: { label: 'Why?', onClick: () => navigateTo(whyHref(workspaceId, missing)) } } : {};
    return toast.error(getErrorMessage(error), withDuration({ duration: 'long', ...why, ...options }));
  },
  /** A change that can be taken back from the toast. */
  undoable: (message: string, onUndo: () => void, options?: Options) =>
    toast(message, withDuration({ duration: 'long', ...options, action: { label: 'Undo', onClick: onUndo } })),
  /** Tracks a promise: loading, then success or the error. */
  promise: <T>(promise: Promise<T>, messages: { loading: string; success: string }) =>
    toast.promise(promise, { loading: messages.loading, success: messages.success, error: (error: unknown) => getErrorMessage(error) }),
};
