import { ValidateIf } from 'class-validator';

/**
 * For input fields that may be left out but never set to null. GraphQL lets a
 * client send null for any nullable field, and class-validator's @IsOptional()
 * would skip validation for it; this runs every validator unless the field is
 * missing. Fields where null means "clear it" use
 * `@IsOptional() @ValidateIf((_, value) => value !== null)` instead.
 */
export const IsOmittable = (): PropertyDecorator => ValidateIf((_, value) => value !== undefined);
