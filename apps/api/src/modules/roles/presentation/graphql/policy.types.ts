import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import {
  POLICY_EFFECTS,
  POLICY_LIMITS,
  type AttachedPolicyResponse,
  type FieldDefinition,
  type MyAccessResponse,
  type PolicyDocument,
  type PolicyEffect,
  type PolicyResponse,
  type PolicyStatement,
  type SavePolicyRequest,
  type SpaceRule,
  type SpaceScopedPermission,
} from '@taskflow/shared-types';
import { FormSchema } from '../../../../core/forms/form-schema.decorators.js';
import { PolicyEffectEnum } from '../../../../core/graphql/enums.js';
import { IsNotBlank, IsOmittable } from '../../../../core/graphql/validation.js';

@ObjectType('PolicyStatement')
export class PolicyStatementGql implements PolicyStatement {
  @Field(() => PolicyEffectEnum) effect: PolicyEffect;
  @Field(() => [String], { nullable: true, description: 'Permission keys or patterns such as task.*' }) permissions?: string[] | null;
  @Field(() => [String], { nullable: true, description: 'Field keys or patterns such as member.email' }) fields?: string[] | null;
  @Field(() => [ID], { nullable: true, description: 'Deny only: limit the statement to these spaces' }) spaces?: string[] | null;
  @Field(() => [ID], { nullable: true, description: 'Deny only: apply the statement in every space except these' }) notSpaces?: string[] | null;
}

@ObjectType('SpaceRule', { description: 'A space-limited deny in effect for a role or caller' })
export class SpaceRuleGql implements SpaceRule {
  @Field(() => [ID], { nullable: true }) spaces: string[] | null;
  @Field(() => [ID], { nullable: true }) notSpaces: string[] | null;
  @Field(() => [String]) permissions: SpaceScopedPermission[];
}

@ObjectType('PolicyDocument')
export class PolicyDocumentGql implements PolicyDocument {
  @Field(() => [PolicyStatementGql]) statements: PolicyStatementGql[];
}

@ObjectType('Policy')
export class PolicyGql implements PolicyResponse {
  @Field({ description: 'managed:<key> for ready-made policies, otherwise a UUID' }) id: string;
  @Field() name: string;
  @Field() description: string;
  @Field() managed: boolean;
  @Field(() => PolicyDocumentGql) document: PolicyDocumentGql;
  @Field(() => Int) attachedRoleCount: number;
}

@ObjectType('AttachedPolicy')
export class AttachedPolicyGql implements AttachedPolicyResponse {
  @Field() ref: string;
  @Field() name: string;
  @Field() managed: boolean;
}

@ObjectType('FieldDefinition', { description: 'A data field whose visibility policies control' })
export class FieldDefinitionGql implements FieldDefinition {
  @Field() key: string;
  @Field() label: string;
  @Field() description: string;
  @Field({ description: 'Visible unless denied (true), or hidden unless allowed (false)' }) visibleByDefault: boolean;
}

@ObjectType('MyAccess')
export class MyAccessGql implements MyAccessResponse {
  @Field(() => [String]) permissions: string[];
  @Field(() => [String]) readableFields: string[];
  @Field(() => [SpaceRuleGql]) spaceRules: SpaceRuleGql[];
}

@InputType('PolicyStatementInput')
export class PolicyStatementInput implements PolicyStatement {
  @Field(() => PolicyEffectEnum)
  @IsIn(POLICY_EFFECTS)
  effect: PolicyEffect;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(POLICY_LIMITS.maxEntriesPerStatement)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  permissions?: string[] | null;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(POLICY_LIMITS.maxEntriesPerStatement)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  fields?: string[] | null;

  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(POLICY_LIMITS.maxSpacesPerStatement)
  @IsUUID('4', { each: true })
  spaces?: string[] | null;

  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(POLICY_LIMITS.maxSpacesPerStatement)
  @IsUUID('4', { each: true })
  notSpaces?: string[] | null;
}

@InputType('PolicyDocumentInput')
export class PolicyDocumentInput implements PolicyDocument {
  @Field(() => [PolicyStatementInput])
  @IsArray()
  @ArrayMaxSize(POLICY_LIMITS.maxStatements)
  @ValidateNested({ each: true })
  @Type(() => PolicyStatementInput)
  statements: PolicyStatementInput[];
}

@FormSchema('policy.save')
@InputType('SavePolicyInput')
export class SavePolicyInput implements SavePolicyRequest {
  @Field()
  @IsString()
  @IsNotBlank()
  @MaxLength(POLICY_LIMITS.nameMax)
  name: string;

  @Field({ nullable: true })
  @IsOmittable()
  @IsString()
  @MaxLength(POLICY_LIMITS.descriptionMax)
  description?: string;

  @Field(() => PolicyDocumentInput)
  @ValidateNested()
  @Type(() => PolicyDocumentInput)
  document: PolicyDocumentInput;
}
