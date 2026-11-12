/** A GitHub App installation a workspace may use (E2). */
export interface GithubInstallation {
  id: string;
  workspaceId: string;
  /** GitHub's installation id. */
  installationId: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
  installedById: string | null;
  createdAt: Date;
}

/** A task linked to a GitHub issue, with what sync last agreed on with GitHub. */
export interface IssueLink {
  id: string;
  workspaceId: string;
  connectionId: string;
  taskId: string;
  number: number;
  url: string;
  syncedTitle: string;
  syncedClosed: boolean;
  /** TaskFlow's side changed and hasn't reached GitHub yet. */
  pushDue: boolean;
  pushVersion: number;
  pushAttempts: number;
  lastError: string | null;
  createdAt: Date;
}

/** A leased push: the issue link, its repository and installation, and the task as it is now. */
export interface IssuePush {
  link: IssueLink;
  repo: string;
  installationId: number;
  title: string;
  closed: boolean;
}

/** An app connection with its installation's GitHub id, for the poller. */
export interface AppConnectionRef {
  connectionId: string;
  installationId: number;
}
