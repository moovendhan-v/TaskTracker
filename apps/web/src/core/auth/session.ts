import { authClient } from './auth-client';

/** Used by route guards before rendering a signed-in page. */
export async function hasSession(): Promise<boolean> {
  try {
    const { data } = await authClient.getSession();
    return Boolean(data?.session);
  } catch {
    return false;
  }
}
