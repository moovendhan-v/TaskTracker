import { toast, type ExternalToast } from 'sonner';
import { getErrorMessage } from '@/lib/errors';

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
  /** Shows the API's (already user-safe) message for an error. */
  error: (error: unknown, options?: Options) => toast.error(getErrorMessage(error), withDuration({ duration: 'long', ...options })),
  /** A change that can be taken back from the toast. */
  undoable: (message: string, onUndo: () => void, options?: Options) =>
    toast(message, withDuration({ duration: 'long', ...options, action: { label: 'Undo', onClick: onUndo } })),
  /** Tracks a promise: loading, then success or the error. */
  promise: <T>(promise: Promise<T>, messages: { loading: string; success: string }) =>
    toast.promise(promise, { loading: messages.loading, success: messages.success, error: (error: unknown) => getErrorMessage(error) }),
};
