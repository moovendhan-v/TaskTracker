import { createTaskFlowClient } from '@taskflow/sdk';

/**
 * The only TaskFlow API client in the app. Calls go to the same origin
 * (`/api/...`): the Vite dev proxy or nginx forwards them to the API.
 */
export const api = createTaskFlowClient();
