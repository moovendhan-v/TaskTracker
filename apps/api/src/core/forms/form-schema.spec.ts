import { plainToInstance } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { validateForm } from '@taskflow/shared-types';
import { fieldErrors } from './describe-rules.js';
import { IsCalendarDate, IsClearable, IsNotBlank, IsOmittable, Label, OnOrAfter, SameAs, WithinDaysOf } from './form-field.decorators.js';
import { buildFormSchema } from './form-schema.decorators.js';

class TripInput {
  @Label('Trip name')
  @IsString()
  @IsNotBlank()
  @MaxLength(20)
  name: string;

  @IsOmittable()
  @IsIn(['car', 'train'])
  mode?: string;

  @IsClearable()
  @IsEmail()
  contact?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  people?: number;

  @IsCalendarDate()
  startDate: string;

  @IsCalendarDate()
  @OnOrAfter('startDate')
  @WithinDaysOf('startDate', 14)
  endDate: string;

  @IsOmittable()
  @SameAs('name', { message: 'Names differ' })
  confirmName?: string;
}

const schema = buildFormSchema('trip', TripInput);
const field = (name: string) => schema.fields.find((f) => f.name === name)!;

describe('form schemas', () => {
  it('publishes required, optional and nullable fields with their types', () => {
    expect(field('name')).toMatchObject({ label: 'Trip name', type: 'string', required: true, nullable: false });
    expect(field('mode')).toMatchObject({ type: 'enum', required: false, nullable: false });
    expect(field('contact')).toMatchObject({ required: false, nullable: true });
    expect(field('people')).toMatchObject({ type: 'number', required: false });
    expect(field('startDate')).toMatchObject({ type: 'date', required: true });
  });

  it('turns validators into rules with readable messages', () => {
    expect(field('name').rules).toEqual([
      { kind: 'required', message: 'Trip name is required' },
      { kind: 'maxLength', value: '20', message: 'Use at most 20 characters' },
    ]);
    expect(field('mode').rules).toEqual([{ kind: 'oneOf', values: ['car', 'train'], message: 'Choose one of: car, train' }]);
    const endRules = field('endDate').rules.map((rule) => [rule.kind, rule.field ?? null, rule.value ?? null]);
    expect(endRules[0]).toEqual(['required', null, null]);
    expect(endRules.slice(1)).toEqual(
      expect.arrayContaining([
        ['date', null, null],
        ['onOrAfter', 'startDate', null],
        ['withinDays', 'startDate', '14'],
      ]),
    );
    expect(field('confirmName').rules).toEqual([{ kind: 'sameAs', field: 'name', message: 'Names differ' }]);
  });

  it('gives the client the same answers as the server', async () => {
    const cases: Record<string, unknown>[] = [
      { name: '', startDate: '2026-01-01', endDate: '2026-01-02' },
      { name: 'x'.repeat(21), startDate: '2026-01-01', endDate: '2026-01-02' },
      { name: 'Alps', mode: 'plane', startDate: '2026-01-01', endDate: '2026-01-02' },
      { name: 'Alps', contact: 'nope', startDate: '2026-01-01', endDate: '2026-01-02' },
      { name: 'Alps', startDate: '2026-02-30', endDate: '2026-03-02' },
      { name: 'Alps', startDate: '2026-01-10', endDate: '2026-01-02' },
      { name: 'Alps', startDate: '2026-01-01', endDate: '2026-02-01' },
      { name: 'Alps', startDate: '2026-01-01', endDate: '2026-01-05', confirmName: 'Andes' },
      { name: 'Alps', contact: null, people: 2, startDate: '2026-01-01', endDate: '2026-01-05' },
    ];
    for (const values of cases) {
      const server = fieldErrors(await validate(plainToInstance(TripInput, values), { validationError: { target: true } }));
      const client = validateForm(schema, values);
      expect(client.map((e) => e.field).sort(), JSON.stringify(values)).toEqual(server.map((e) => e.field).sort());
      for (const error of client) expect(server.find((s) => s.field === error.field)?.message).toBe(error.message);
    }
  });
});
