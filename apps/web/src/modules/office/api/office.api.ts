import { LeaveOfficeDocument, MoveInOfficeDocument, OfficeDocument, OfficeHeartbeatDocument, OfficeMeetingRoomDocument, SetOfficeStatusDocument } from '@taskflow/sdk';
import { isOfficeChosenStatus, type OfficeChosenStatus, type OfficeStatus } from '@taskflow/shared-types';
import { graphql } from '@/core/api/graphql-client';

const STATUSES: readonly OfficeStatus[] = ['available', 'focused', 'in_meeting', 'away', 'offline'];
/** Unknown states from a newer API show as offline; unknown choices as available. */
const toPerson = <T extends { status: string; chosenStatus: string }>(person: T) => ({
  ...person,
  status: ((STATUSES as readonly string[]).includes(person.status) ? person.status : 'offline') as OfficeStatus,
  chosenStatus: (isOfficeChosenStatus(person.chosenStatus) ? person.chosenStatus : 'available') as OfficeChosenStatus,
});

/** The virtual office (D3). */
export const officeApi = {
  get: async (workspaceId: string) => (await graphql(OfficeDocument, { workspaceId })).office.people.map(toPerson),
  move: async (workspaceId: string, x: number, y: number) => toPerson((await graphql(MoveInOfficeDocument, { workspaceId, x, y })).moveInOffice),
  setStatus: async (workspaceId: string, status: OfficeChosenStatus) => toPerson((await graphql(SetOfficeStatusDocument, { workspaceId, status })).setOfficeStatus),
  heartbeat: async (workspaceId: string) => toPerson((await graphql(OfficeHeartbeatDocument, { workspaceId })).officeHeartbeat),
  leave: async (workspaceId: string) => (await graphql(LeaveOfficeDocument, { workspaceId })).leaveOffice,
  meetingRoom: async (workspaceId: string, zoneId: string) => (await graphql(OfficeMeetingRoomDocument, { workspaceId, zoneId })).officeMeetingRoom,
};
