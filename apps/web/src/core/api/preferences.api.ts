import {
  DeleteViewDocument,
  MyPreferencesDocument,
  ResetPreferencesDocument,
  ResetTableLayoutDocument,
  SaveTableLayoutDocument,
  SaveViewDocument,
  SetTabsDocument,
  UpdatePreferencesDocument,
  type PreferencesFieldsFragment,
  type SaveViewInput,
  type TableLayoutInput,
  type UpdatePreferencesInput,
  type WorkspaceTabInput,
} from '@taskflow/sdk';
import { readPreferences, type FilterNode, type UserPreferences } from '@taskflow/shared-types';
import { graphql } from './graphql-client';

/** The server's answer in the shared shape; the saved filter tree travels as JSON so no depth is lost. */
function toPreferences(fields: PreferencesFieldsFragment): UserPreferences {
  return readPreferences({
    ...fields,
    savedViews: fields.savedViews.map(({ filterJson, ...view }) => ({ ...view, filter: filterJson ? (JSON.parse(filterJson) as FilterNode) : null })),
  });
}

export const preferencesApi = {
  get: async () => toPreferences((await graphql(MyPreferencesDocument, {})).myPreferences),
  update: async (input: UpdatePreferencesInput) => toPreferences((await graphql(UpdatePreferencesDocument, { input })).updatePreferences),
  saveTable: async (input: TableLayoutInput) => toPreferences((await graphql(SaveTableLayoutDocument, { input })).saveTableLayout),
  resetTable: async (key: string) => toPreferences((await graphql(ResetTableLayoutDocument, { key })).resetTableLayout),
  saveView: async (input: SaveViewInput) => toPreferences((await graphql(SaveViewDocument, { input })).saveView),
  deleteView: async (viewId: string) => toPreferences((await graphql(DeleteViewDocument, { viewId })).deleteView),
  setTabs: async (tabs: WorkspaceTabInput[]) => toPreferences((await graphql(SetTabsDocument, { input: { tabs } })).setTabs),
  reset: async () => toPreferences((await graphql(ResetPreferencesDocument, {})).resetPreferences),
};
