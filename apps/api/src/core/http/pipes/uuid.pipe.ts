import { BadRequestException, ParseUUIDPipe, type PipeTransform } from '@nestjs/common';

/** Rejects malformed ids with BAD_USER_INPUT before they reach a query. */
export const UUID_PIPE = new ParseUUIDPipe({ version: '4' });

/** Same check, but null and missing values pass through for arguments where null means "none". */
export const OPTIONAL_UUID_PIPE = new ParseUUIDPipe({ version: '4', optional: true });

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A list of UUIDs (at most 100), rejected with BAD_USER_INPUT when any is malformed. */
export const UUID_LIST_PIPE: PipeTransform<unknown, string[]> = {
  transform(value: unknown): string[] {
    if (!Array.isArray(value) || value.length > 100 || !value.every((item) => typeof item === 'string' && UUID_V4.test(item))) {
      throw new BadRequestException('Use a list of valid ids');
    }
    return value as string[];
  },
};
