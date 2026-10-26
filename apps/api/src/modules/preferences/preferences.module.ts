import { Module } from '@nestjs/common';
import { PreferencesService } from './application/preferences.service.js';
import { PreferencesRepository } from './domain/preferences.repository.js';
import { TypeOrmPreferencesRepository } from './infrastructure/typeorm-preferences.repository.js';
import { PreferencesResolver, SavedViewFieldsResolver } from './presentation/graphql/preferences.resolver.js';

/** Personal settings: theme, palette, density, layout, table layouts, saved views and open tabs. */
@Module({
  providers: [PreferencesService, PreferencesResolver, SavedViewFieldsResolver, { provide: PreferencesRepository, useClass: TypeOrmPreferencesRepository }],
})
export class PreferencesModule {}
