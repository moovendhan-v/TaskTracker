/** D2: calls (huddles) in chat channels. See docs/plan/D2_CALLS.md. */

export interface CallParticipantResponse {
  userId: string;
  name: string;
}

export interface ActiveCallResponse {
  id: string;
  channelId: string;
  startedById: string;
  startedAt: string;
  participants: CallParticipantResponse[];
}

export interface CallsOverviewResponse {
  /** Whether this server has a media server configured. */
  enabled: boolean;
  /** Calls going on now in channels you can read. */
  calls: ActiveCallResponse[];
}

/** What a browser needs to connect: the media server, and a short-lived token for one room. */
export interface CallJoinResponse {
  callId: string;
  channelId: string;
  url: string;
  token: string;
}

/** "Huddle ended · 12 min · 3 people" */
export function describeEndedCall(minutes: number, people: number): string {
  const length = minutes < 1 ? 'under a minute' : minutes === 1 ? '1 min' : `${minutes} min`;
  return `Huddle ended · ${length} · ${people} ${people === 1 ? 'person' : 'people'}`;
}

export const CALL_STARTED_LINE = 'started a huddle';
