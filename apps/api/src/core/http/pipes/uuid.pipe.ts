import { ParseUUIDPipe } from '@nestjs/common';

/** Rejects malformed ids with 400 before they reach a query. */
export const UUID_PIPE = new ParseUUIDPipe({ version: '4' });
