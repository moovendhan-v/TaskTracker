import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type { SavedView } from '@taskflow/shared-types';
import { PREFERENCE_LIMITS } from '@taskflow/shared-types';
import { CurrentUser } from '../../../../core/http/decorators/current-user.decorator.js';
import type { SessionUser } from '../../../../core/http/types/authenticated-request.js';
import { PreferencesService } from '../../application/preferences.service.js';
import { PreferencesGql, SavedViewGql, SaveViewInput, SetTabsInput, TableLayoutInput, UpdatePreferencesInput } from './preferences.types.js';

/** The signed-in user's own settings. The user always comes from the session. */
@Resolver(() => PreferencesGql)
export class PreferencesResolver {
  constructor(private readonly preferences: PreferencesService) {}

  @Query(() => PreferencesGql, { description: "The signed-in user's settings, with defaults for anything never changed" })
  myPreferences(@CurrentUser() user: SessionUser): Promise<PreferencesGql> {
    return this.preferences.get(user.id);
  }

  @Mutation(() => PreferencesGql)
  updatePreferences(@CurrentUser() user: SessionUser, @Args('input') input: UpdatePreferencesInput): Promise<PreferencesGql> {
    return this.preferences.updateSettings(user.id, input);
  }

  @Mutation(() => PreferencesGql, { description: 'Saves how a table is arranged (columns, widths, paging)' })
  saveTableLayout(@CurrentUser() user: SessionUser, @Args('input') input: TableLayoutInput): Promise<PreferencesGql> {
    return this.preferences.saveTable(user.id, input);
  }

  @Mutation(() => PreferencesGql)
  resetTableLayout(@CurrentUser() user: SessionUser, @Args('key') key: string): Promise<PreferencesGql> {
    return this.preferences.removeTable(user.id, key.slice(0, PREFERENCE_LIMITS.keyMax));
  }

  @Mutation(() => PreferencesGql, { description: 'Creates or updates a saved view (a named set of filters)' })
  saveView(@CurrentUser() user: SessionUser, @Args('input') input: SaveViewInput): Promise<PreferencesGql> {
    return this.preferences.saveView(user.id, input);
  }

  @Mutation(() => PreferencesGql)
  deleteView(@CurrentUser() user: SessionUser, @Args('viewId', { type: () => ID }) viewId: string): Promise<PreferencesGql> {
    return this.preferences.removeView(user.id, viewId.slice(0, 64));
  }

  @Mutation(() => PreferencesGql, { description: 'Replaces the open tabs of the multi-tab workspace' })
  setTabs(@CurrentUser() user: SessionUser, @Args('input') input: SetTabsInput): Promise<PreferencesGql> {
    return this.preferences.setTabs(user.id, input.tabs);
  }

  @Mutation(() => PreferencesGql, { description: 'Back to the default settings' })
  resetPreferences(@CurrentUser() user: SessionUser): Promise<PreferencesGql> {
    return this.preferences.reset(user.id);
  }
}

@Resolver(() => SavedViewGql)
export class SavedViewFieldsResolver {
  @ResolveField(() => String, { nullable: true, description: 'The filter tree as JSON, whatever its depth' })
  filterJson(@Parent() view: SavedView): string | null {
    return view.filter ? JSON.stringify(view.filter) : null;
  }
}
