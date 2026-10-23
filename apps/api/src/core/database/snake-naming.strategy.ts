import { DefaultNamingStrategy, type NamingStrategyInterface } from 'typeorm';

const toSnakeCase = (value: string): string =>
  value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toLowerCase();

/** Maps camelCase entity properties to snake_case columns unless a column sets its own name. */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  override tableName(className: string, customName?: string): string {
    return customName ?? toSnakeCase(className);
  }

  override columnName(propertyName: string, customName: string | undefined, prefixes: string[]): string {
    return customName ?? toSnakeCase([...prefixes, propertyName].join('_'));
  }

  override relationName(propertyName: string): string {
    return toSnakeCase(propertyName);
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return toSnakeCase(`${relationName}_${referencedColumnName}`);
  }
}
