import { describe, expect, it } from 'vitest';
import { validateForm, type FormSchema } from '@taskflow/shared-types';
import { TestUser } from './support/api-client.js';
import { createWorkspace } from './support/fixtures.js';

const FORMS = `query($names: [String!]) { formSchemas(names: $names) {
  name fields { name label type required nullable rules { kind value values field message } } } }`;

describe('form schemas: one set of validation rules for client and server', () => {
  it('publishes the rules without a session, so sign-up can use them', async () => {
    const anonymous = new TestUser('Anonymous');
    const { formSchemas } = await anonymous.data<{ formSchemas: FormSchema[] }>(FORMS, { names: ['auth.signUp', 'task.create', 'nope'] });
    expect(formSchemas.map((form) => form.name)).toEqual(['auth.signUp', 'task.create']);
    const password = formSchemas[0]!.fields.find((field) => field.name === 'password');
    expect(password?.rules).toContainEqual({ kind: 'minLength', value: '10', values: null, field: null, message: 'Use at least 10 characters' });
    const title = formSchemas[1]!.fields.find((field) => field.name === 'title');
    expect(title).toMatchObject({ required: true, type: 'string' });
  });

  it('lists every form when no names are given', async () => {
    const { formSchemas } = await new TestUser('Anonymous').data<{ formSchemas: FormSchema[] }>(FORMS);
    expect(formSchemas.map((form) => form.name)).toEqual(expect.arrayContaining(['auth.resetPassword', 'sprint.create', 'workspace.create', 'hr.leave.request']));
  });

  it('reports server-side failures per field, with the same messages the schema gives', async () => {
    const ws = await createWorkspace('Forms owner');
    const { formSchemas } = await ws.owner.data<{ formSchemas: FormSchema[] }>(FORMS, { names: ['sprint.create'] });
    const input = { name: 'Sprint 1', startDate: '2026-03-10', endDate: '2026-03-01' };

    const result = await ws.owner.gql(
      'mutation($w: ID!, $s: ID!, $input: CreateSprintInput!) { createSprint(workspaceId: $w, spaceId: $s, input: $input) { id } }',
      { w: ws.workspaceId, s: ws.spaceId, input },
    );
    const error = result.errors?.[0] as { message: string; extensions?: { code?: string; fields?: { field: string; message: string }[] } };
    expect(error.extensions?.code).toBe('BAD_USER_INPUT');
    expect(error.extensions?.fields).toEqual(validateForm(formSchemas[0]!, input));
    expect(error.extensions?.fields?.[0]).toEqual({ field: 'endDate', message: 'End date must be on or after the start date' });
  });

  it('applies the auth form rules inside Better Auth too', async () => {
    const user = new TestUser('Short password');
    const response = await user.auth('sign-up/email', { name: 'Short password', email: user.email, password: 'short' });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string; message: string; fields: { field: string }[] };
    expect(body).toMatchObject({ code: 'VALIDATION_FAILED', message: 'Use at least 10 characters' });
    expect(body.fields.map((field) => field.field)).toEqual(['password']);

    const blank = await new TestUser('Blank').auth('sign-up/email', { name: '  ', email: 'not-an-email', password: 'correct-horse-42' });
    expect(blank.status).toBe(400);
    expect(((await blank.json()) as { fields: { field: string }[] }).fields.map((field) => field.field).sort()).toEqual(['email', 'name']);
  });
});
