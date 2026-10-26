import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PREFERENCE_LIMITS, type PreferenceSettings, type SavedView, type TableLayout, type UserPreferences, type WorkspaceTab } from '@taskflow/shared-types';
import { Cached } from '../../../core/cache/cached.decorator.js';
import { EvictsUserCache } from '../../../core/cache/evicts-user-cache.decorator.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import { findQueryResource } from '../../../core/query/query-resource.decorators.js';
import { isAppPath, readPreferences, upsertBy } from '../domain/preferences.js';
import { PreferencesRepository } from '../domain/preferences.repository.js';

const byUser = (userId: string) => userId;

/** A user's own settings. Every method takes the signed-in user's id, never one from input. */
@Injectable()
export class PreferencesService {
  constructor(private readonly repository: PreferencesRepository) {}

  @Cached({ entities: [], user: byUser, ttlSeconds: 600 })
  async get(userId: string): Promise<UserPreferences> {
    return readPreferences(await this.repository.find(userId));
  }

  @EvictsUserCache(byUser)
  async updateSettings(userId: string, patch: Partial<PreferenceSettings>): Promise<UserPreferences> {
    return this.change(userId, (current) => ({ ...current, ...stripUndefined(patch) }));
  }

  @EvictsUserCache(byUser)
  async saveTable(userId: string, layout: TableLayout): Promise<UserPreferences> {
    return this.change(userId, (current) => ({
      ...current,
      tables: upsertBy(current.tables, layout, (existing) => existing.key === layout.key, PREFERENCE_LIMITS.tables),
    }));
  }

  @EvictsUserCache(byUser)
  async removeTable(userId: string, key: string): Promise<UserPreferences> {
    return this.change(userId, (current) => ({ ...current, tables: current.tables.filter((table) => table.key !== key) }));
  }

  /** Creates a view (no id) or replaces one of the user's own views (with id). */
  @EvictsUserCache(byUser)
  async saveView(userId: string, view: Omit<SavedView, 'id'> & { id?: string | null }): Promise<UserPreferences> {
    if (!findQueryResource(view.resource)) throw DomainError.invalid(`Unknown resource ${view.resource.slice(0, 64)}`);
    return this.change(userId, (current) => {
      if (view.id && !current.savedViews.some((existing) => existing.id === view.id)) throw DomainError.notFound('View');
      if (!view.id && current.savedViews.length >= PREFERENCE_LIMITS.savedViews) throw DomainError.invalid(`You can save at most ${PREFERENCE_LIMITS.savedViews} views`);
      const saved: SavedView = { ...view, id: view.id ?? randomUUID() };
      return { ...current, savedViews: upsertBy(current.savedViews, saved, (existing) => existing.id === saved.id, PREFERENCE_LIMITS.savedViews) };
    });
  }

  @EvictsUserCache(byUser)
  async removeView(userId: string, viewId: string): Promise<UserPreferences> {
    return this.change(userId, (current) => ({ ...current, savedViews: current.savedViews.filter((view) => view.id !== viewId) }));
  }

  @EvictsUserCache(byUser)
  async setTabs(userId: string, tabs: WorkspaceTab[]): Promise<UserPreferences> {
    if (tabs.some((tab) => !isAppPath(tab.path))) throw DomainError.invalid('Tabs can only open pages in TaskFlow');
    if (new Set(tabs.map((tab) => tab.id)).size !== tabs.length) throw DomainError.invalid('Tab ids must be unique');
    return this.change(userId, (current) => ({ ...current, tabs: tabs.slice(0, PREFERENCE_LIMITS.tabs) }));
  }

  @EvictsUserCache(byUser)
  async reset(userId: string): Promise<UserPreferences> {
    return this.change(userId, () => readPreferences({}));
  }

  private async change(userId: string, update: (current: UserPreferences) => UserPreferences): Promise<UserPreferences> {
    const next = readPreferences(update(readPreferences(await this.repository.find(userId))));
    await this.repository.save(userId, next);
    return next;
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}
