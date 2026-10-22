import { ParseUUIDPipe } from '@nestjs/common';

/** Rejects malformed ids with BAD_USER_INPUT before they reach a query. */
export const UUID_PIPE = new ParseUUIDPipe({ version: '4' });

/** Same check, but null and missing values pass through for arguments where null means "none". */
export const OPTIONAL_UUID_PIPE = new ParseUUIDPipe({ version: '4', optional: true });
