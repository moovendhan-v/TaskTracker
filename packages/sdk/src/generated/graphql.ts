export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A JSON object (read-only) */
  JSONObject: { input: Record<string, unknown>; output: Record<string, unknown>; }
};

export type AddMemberInput = {
  email: Scalars['String']['input'];
  roleId: Scalars['ID']['input'];
};

export type AddMemberResult = {
  __typename?: 'AddMemberResult';
  /** Same answer whether or not the email has an account */
  message: Scalars['String']['output'];
};

export type AdminUser = {
  __typename?: 'AdminUser';
  createdAt: Scalars['String']['output'];
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  platformRole: PlatformRole;
  suspended: Scalars['Boolean']['output'];
  workspaceCount: Scalars['Int']['output'];
};

export type AdminUserPage = {
  __typename?: 'AdminUserPage';
  items: Array<AdminUser>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type AdminWorkspace = {
  __typename?: 'AdminWorkspace';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  memberCount: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  ownerId: Scalars['ID']['output'];
  ownerName: Scalars['String']['output'];
};

export type AdminWorkspacePage = {
  __typename?: 'AdminWorkspacePage';
  items: Array<AdminWorkspace>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type AuditLogEntry = {
  __typename?: 'AuditLogEntry';
  action: Scalars['String']['output'];
  actorId: Scalars['ID']['output'];
  actorName: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  /** Only shown to platform admins */
  ip: Maybe<Scalars['String']['output']>;
  metadata: Scalars['JSONObject']['output'];
  targetId: Maybe<Scalars['String']['output']>;
  targetType: Scalars['String']['output'];
  workspaceId: Maybe<Scalars['ID']['output']>;
};

export type AuditLogPage = {
  __typename?: 'AuditLogPage';
  items: Array<AuditLogEntry>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type Comment = {
  __typename?: 'Comment';
  authorId: Scalars['ID']['output'];
  authorName: Scalars['String']['output'];
  /** Plain text; render as text, never HTML */
  body: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  taskId: Scalars['ID']['output'];
  updatedAt: Scalars['String']['output'];
};

export type CommentInput = {
  body: Scalars['String']['input'];
};

export type CreateDepartmentInput = {
  headUserId?: InputMaybe<Scalars['ID']['input']>;
  name: Scalars['String']['input'];
};

export type CreateDocumentInput = {
  content?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
  spaceId?: InputMaybe<Scalars['ID']['input']>;
  title: Scalars['String']['input'];
};

export type CreateLeaveTypeInput = {
  /** null means unlimited */
  annualAllowanceDays?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  /** Defaults to true */
  requiresApproval?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CreateRoleInput = {
  name: Scalars['String']['input'];
  /** Permission keys such as task.create */
  permissions: Array<Scalars['String']['input']>;
};

export type CreateSpaceInput = {
  color?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
};

export type CreateSprintInput = {
  /** yyyy-mm-dd */
  endDate: Scalars['String']['input'];
  goal?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  /** yyyy-mm-dd */
  startDate: Scalars['String']['input'];
};

export type CreateTaskInput = {
  assigneeId?: InputMaybe<Scalars['ID']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  /** ISO date-time; null clears it */
  dueDate?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<TaskPriority>;
  status?: InputMaybe<TaskStatus>;
  title: Scalars['String']['input'];
};

export type CreateWorkspaceInput = {
  color?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
};

export type CurrentUser = {
  __typename?: 'CurrentUser';
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  image: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  platformRole: PlatformRole;
};

export type DecideLeaveInput = {
  decision: LeaveDecision;
  note?: InputMaybe<Scalars['String']['input']>;
};

export type Department = {
  __typename?: 'Department';
  headUserId: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  memberCount: Scalars['Int']['output'];
  name: Scalars['String']['output'];
};

export type Document = {
  __typename?: 'Document';
  /** Markdown; render without raw HTML */
  content: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  createdById: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  parentId: Maybe<Scalars['ID']['output']>;
  position: Scalars['Float']['output'];
  spaceId: Maybe<Scalars['ID']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type DocumentSummary = {
  __typename?: 'DocumentSummary';
  createdById: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  parentId: Maybe<Scalars['ID']['output']>;
  position: Scalars['Float']['output'];
  spaceId: Maybe<Scalars['ID']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type Employee = {
  __typename?: 'Employee';
  departmentId: Maybe<Scalars['ID']['output']>;
  departmentName: Maybe<Scalars['String']['output']>;
  email: Scalars['String']['output'];
  employmentType: Maybe<EmploymentType>;
  jobTitle: Maybe<Scalars['String']['output']>;
  managerUserId: Maybe<Scalars['ID']['output']>;
  name: Scalars['String']['output'];
  /** yyyy-mm-dd */
  startDate: Maybe<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
};

export type EmployeeProfileInput = {
  departmentId?: InputMaybe<Scalars['ID']['input']>;
  employmentType?: InputMaybe<EmploymentType>;
  jobTitle?: InputMaybe<Scalars['String']['input']>;
  managerUserId?: InputMaybe<Scalars['ID']['input']>;
  startDate?: InputMaybe<Scalars['String']['input']>;
};

export type EmploymentType =
  | 'contractor'
  | 'full_time'
  | 'intern'
  | 'part_time';

export type LeaveBalance = {
  __typename?: 'LeaveBalance';
  /** null means unlimited */
  allowanceDays: Maybe<Scalars['Int']['output']>;
  color: Scalars['String']['output'];
  leaveTypeId: Scalars['ID']['output'];
  leaveTypeName: Scalars['String']['output'];
  pendingDays: Scalars['Int']['output'];
  remainingDays: Maybe<Scalars['Int']['output']>;
  usedDays: Scalars['Int']['output'];
  year: Scalars['Int']['output'];
};

export type LeaveDecision =
  | 'approved'
  | 'rejected';

export type LeaveRequest = {
  __typename?: 'LeaveRequest';
  createdAt: Scalars['String']['output'];
  /** Working days */
  days: Scalars['Int']['output'];
  decidedAt: Maybe<Scalars['String']['output']>;
  decidedById: Maybe<Scalars['ID']['output']>;
  decisionNote: Scalars['String']['output'];
  /** yyyy-mm-dd */
  endDate: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  leaveTypeId: Scalars['ID']['output'];
  leaveTypeName: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  /** yyyy-mm-dd */
  startDate: Scalars['String']['output'];
  status: LeaveStatus;
  userId: Scalars['ID']['output'];
  userName: Scalars['String']['output'];
};

export type LeaveRequestPage = {
  __typename?: 'LeaveRequestPage';
  items: Array<LeaveRequest>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type LeaveStatus =
  | 'approved'
  | 'cancelled'
  | 'pending'
  | 'rejected';

export type LeaveType = {
  __typename?: 'LeaveType';
  /** null means unlimited */
  annualAllowanceDays: Maybe<Scalars['Int']['output']>;
  color: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  requiresApproval: Scalars['Boolean']['output'];
};

export type Member = {
  __typename?: 'Member';
  email: Scalars['String']['output'];
  joinedAt: Scalars['String']['output'];
  name: Scalars['String']['output'];
  roleId: Scalars['ID']['output'];
  roleName: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  addMember: AddMemberResult;
  cancelLeaveRequest: LeaveRequest;
  /** Unfinished tasks move to another planned sprint in the space, or to the backlog when omitted */
  completeSprint: Sprint;
  createComment: Comment;
  createDepartment: Department;
  createDocument: Document;
  createLeaveType: LeaveType;
  createList: TaskList;
  createRole: Role;
  createSpace: Space;
  createSprint: Sprint;
  createTask: Task;
  createWorkspace: Workspace;
  /** Approvers cannot decide on their own requests */
  decideLeaveRequest: LeaveRequest;
  /** The author, or anyone with task.delete */
  deleteComment: Scalars['Boolean']['output'];
  deleteDepartment: Scalars['Boolean']['output'];
  /** Sub-pages are deleted too */
  deleteDocument: Scalars['Boolean']['output'];
  deleteLeaveType: Scalars['Boolean']['output'];
  deleteList: Scalars['Boolean']['output'];
  deleteRole: Scalars['Boolean']['output'];
  deleteSpace: Scalars['Boolean']['output'];
  deleteSprint: Scalars['Boolean']['output'];
  deleteTask: Scalars['Boolean']['output'];
  deleteWorkspace: Scalars['Boolean']['output'];
  /** Leave a workspace. The last owner cannot leave. */
  leaveWorkspace: Scalars['Boolean']['output'];
  /** parentId null moves the page to the top level */
  moveDocument: Document;
  removeMember: Scalars['Boolean']['output'];
  requestLeave: LeaveRequest;
  startSprint: Sprint;
  /** Suspending signs the user out everywhere. You cannot change your own account. */
  updateAdminUser: AdminUser;
  /** Only the author can edit */
  updateComment: Comment;
  updateDepartment: Department;
  updateDocument: Document;
  updateLeaveType: LeaveType;
  updateList: TaskList;
  updateMemberRole: Member;
  updateRole: Role;
  updateSpace: Space;
  updateSprint: Sprint;
  updateTask: Task;
  updateWorkspace: Workspace;
  upsertEmployeeProfile: Employee;
};


export type MutationAddMemberArgs = {
  input: AddMemberInput;
  workspaceId: Scalars['ID']['input'];
};


export type MutationCancelLeaveRequestArgs = {
  requestId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationCompleteSprintArgs = {
  moveOpenTasksToSprintId: InputMaybe<Scalars['ID']['input']>;
  sprintId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationCreateCommentArgs = {
  input: CommentInput;
  taskId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationCreateDepartmentArgs = {
  input: CreateDepartmentInput;
  workspaceId: Scalars['ID']['input'];
};


export type MutationCreateDocumentArgs = {
  input: CreateDocumentInput;
  workspaceId: Scalars['ID']['input'];
};


export type MutationCreateLeaveTypeArgs = {
  input: CreateLeaveTypeInput;
  workspaceId: Scalars['ID']['input'];
};


export type MutationCreateListArgs = {
  input: TaskListInput;
  spaceId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationCreateRoleArgs = {
  input: CreateRoleInput;
  workspaceId: Scalars['ID']['input'];
};


export type MutationCreateSpaceArgs = {
  input: CreateSpaceInput;
  workspaceId: Scalars['ID']['input'];
};


export type MutationCreateSprintArgs = {
  input: CreateSprintInput;
  spaceId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationCreateTaskArgs = {
  input: CreateTaskInput;
  listId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationCreateWorkspaceArgs = {
  input: CreateWorkspaceInput;
};


export type MutationDecideLeaveRequestArgs = {
  input: DecideLeaveInput;
  requestId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationDeleteCommentArgs = {
  commentId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationDeleteDepartmentArgs = {
  departmentId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationDeleteDocumentArgs = {
  documentId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationDeleteLeaveTypeArgs = {
  leaveTypeId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationDeleteListArgs = {
  listId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationDeleteRoleArgs = {
  roleId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationDeleteSpaceArgs = {
  spaceId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationDeleteSprintArgs = {
  sprintId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationDeleteTaskArgs = {
  taskId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationDeleteWorkspaceArgs = {
  workspaceId: Scalars['ID']['input'];
};


export type MutationLeaveWorkspaceArgs = {
  workspaceId: Scalars['ID']['input'];
};


export type MutationMoveDocumentArgs = {
  documentId: Scalars['ID']['input'];
  parentId: InputMaybe<Scalars['ID']['input']>;
  position: InputMaybe<Scalars['Float']['input']>;
  workspaceId: Scalars['ID']['input'];
};


export type MutationRemoveMemberArgs = {
  userId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationRequestLeaveArgs = {
  input: RequestLeaveInput;
  workspaceId: Scalars['ID']['input'];
};


export type MutationStartSprintArgs = {
  sprintId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationUpdateAdminUserArgs = {
  input: UpdateAdminUserInput;
  userId: Scalars['ID']['input'];
};


export type MutationUpdateCommentArgs = {
  commentId: Scalars['ID']['input'];
  input: CommentInput;
  workspaceId: Scalars['ID']['input'];
};


export type MutationUpdateDepartmentArgs = {
  departmentId: Scalars['ID']['input'];
  input: UpdateDepartmentInput;
  workspaceId: Scalars['ID']['input'];
};


export type MutationUpdateDocumentArgs = {
  documentId: Scalars['ID']['input'];
  input: UpdateDocumentInput;
  workspaceId: Scalars['ID']['input'];
};


export type MutationUpdateLeaveTypeArgs = {
  input: UpdateLeaveTypeInput;
  leaveTypeId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationUpdateListArgs = {
  input: TaskListInput;
  listId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationUpdateMemberRoleArgs = {
  roleId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationUpdateRoleArgs = {
  input: UpdateRoleInput;
  roleId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationUpdateSpaceArgs = {
  input: UpdateSpaceInput;
  spaceId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationUpdateSprintArgs = {
  input: UpdateSprintInput;
  sprintId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationUpdateTaskArgs = {
  input: UpdateTaskInput;
  taskId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationUpdateWorkspaceArgs = {
  input: UpdateWorkspaceInput;
  workspaceId: Scalars['ID']['input'];
};


export type MutationUpsertEmployeeProfileArgs = {
  input: EmployeeProfileInput;
  userId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};

export type PlatformRole =
  | 'SUPER_ADMIN'
  | 'USER';

export type Query = {
  __typename?: 'Query';
  /** Platform-wide audit log with IP addresses */
  adminAuditLog: AuditLogPage;
  adminUsers: AdminUserPage;
  adminWorkspaces: AdminWorkspacePage;
  /** Unfinished tasks in a space that aren't in a sprint */
  backlog: Array<Task>;
  comments: Array<Comment>;
  departments: Array<Department>;
  document: Document;
  /** Page tree without content */
  documents: Array<DocumentSummary>;
  employee: Employee;
  /** Current members with their HR profiles */
  employees: Array<Employee>;
  /** Approver queue, oldest first */
  leaveRequests: LeaveRequestPage;
  leaveTypes: Array<LeaveType>;
  /** Every list in the workspace */
  lists: Array<TaskList>;
  /** The signed-in user */
  me: CurrentUser;
  members: Array<Member>;
  myLeaveBalances: Array<LeaveBalance>;
  myLeaveRequests: Array<LeaveRequest>;
  roles: Array<Role>;
  spaces: Array<Space>;
  sprint: Sprint;
  sprintTasks: Array<Task>;
  sprints: Array<Sprint>;
  task: Task;
  tasks: TaskPage;
  workspace: Workspace;
  /** This workspace’s audit log, newest first, without IP addresses */
  workspaceAuditLog: AuditLogPage;
  /** Workspaces the caller belongs to */
  workspaces: Array<Workspace>;
};


export type QueryAdminAuditLogArgs = {
  action: InputMaybe<Scalars['String']['input']>;
  actorId: InputMaybe<Scalars['ID']['input']>;
  page: InputMaybe<Scalars['Int']['input']>;
  pageSize: InputMaybe<Scalars['Int']['input']>;
  workspaceId: InputMaybe<Scalars['ID']['input']>;
};


export type QueryAdminUsersArgs = {
  page: InputMaybe<Scalars['Int']['input']>;
  pageSize: InputMaybe<Scalars['Int']['input']>;
  search: InputMaybe<Scalars['String']['input']>;
};


export type QueryAdminWorkspacesArgs = {
  page: InputMaybe<Scalars['Int']['input']>;
  pageSize: InputMaybe<Scalars['Int']['input']>;
  search: InputMaybe<Scalars['String']['input']>;
};


export type QueryBacklogArgs = {
  spaceId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type QueryCommentsArgs = {
  taskId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type QueryDepartmentsArgs = {
  workspaceId: Scalars['ID']['input'];
};


export type QueryDocumentArgs = {
  documentId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type QueryDocumentsArgs = {
  search: InputMaybe<Scalars['String']['input']>;
  workspaceId: Scalars['ID']['input'];
};


export type QueryEmployeeArgs = {
  userId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type QueryEmployeesArgs = {
  workspaceId: Scalars['ID']['input'];
};


export type QueryLeaveRequestsArgs = {
  page: InputMaybe<Scalars['Int']['input']>;
  pageSize: InputMaybe<Scalars['Int']['input']>;
  status: InputMaybe<LeaveStatus>;
  workspaceId: Scalars['ID']['input'];
};


export type QueryLeaveTypesArgs = {
  workspaceId: Scalars['ID']['input'];
};


export type QueryListsArgs = {
  workspaceId: Scalars['ID']['input'];
};


export type QueryMembersArgs = {
  workspaceId: Scalars['ID']['input'];
};


export type QueryMyLeaveBalancesArgs = {
  workspaceId: Scalars['ID']['input'];
  year: InputMaybe<Scalars['Int']['input']>;
};


export type QueryMyLeaveRequestsArgs = {
  workspaceId: Scalars['ID']['input'];
};


export type QueryRolesArgs = {
  workspaceId: Scalars['ID']['input'];
};


export type QuerySpacesArgs = {
  workspaceId: Scalars['ID']['input'];
};


export type QuerySprintArgs = {
  sprintId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type QuerySprintTasksArgs = {
  sprintId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type QuerySprintsArgs = {
  spaceId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type QueryTaskArgs = {
  taskId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type QueryTasksArgs = {
  listId: Scalars['ID']['input'];
  page: InputMaybe<Scalars['Int']['input']>;
  pageSize: InputMaybe<Scalars['Int']['input']>;
  search: InputMaybe<Scalars['String']['input']>;
  status: InputMaybe<TaskStatus>;
  workspaceId: Scalars['ID']['input'];
};


export type QueryWorkspaceArgs = {
  workspaceId: Scalars['ID']['input'];
};


export type QueryWorkspaceAuditLogArgs = {
  action: InputMaybe<Scalars['String']['input']>;
  actorId: InputMaybe<Scalars['ID']['input']>;
  page: InputMaybe<Scalars['Int']['input']>;
  pageSize: InputMaybe<Scalars['Int']['input']>;
  workspaceId: Scalars['ID']['input'];
};

export type RequestLeaveInput = {
  /** yyyy-mm-dd */
  endDate: Scalars['String']['input'];
  leaveTypeId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  /** yyyy-mm-dd */
  startDate: Scalars['String']['input'];
};

export type Role = {
  __typename?: 'Role';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  permissions: Array<Scalars['String']['output']>;
  /** Set for built-in roles */
  systemKey: Maybe<Scalars['String']['output']>;
};

export type Space = {
  __typename?: 'Space';
  color: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  workspaceId: Scalars['ID']['output'];
};

export type Sprint = {
  __typename?: 'Sprint';
  completedAt: Maybe<Scalars['String']['output']>;
  doneTasks: Scalars['Int']['output'];
  /** yyyy-mm-dd */
  endDate: Scalars['String']['output'];
  goal: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  spaceId: Scalars['ID']['output'];
  /** yyyy-mm-dd */
  startDate: Scalars['String']['output'];
  status: SprintStatus;
  totalTasks: Scalars['Int']['output'];
};

export type SprintStatus =
  | 'active'
  | 'completed'
  | 'planned';

export type Task = {
  __typename?: 'Task';
  assigneeId: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['String']['output'];
  description: Scalars['String']['output'];
  dueDate: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  listId: Scalars['ID']['output'];
  position: Scalars['Float']['output'];
  priority: TaskPriority;
  sprintId: Maybe<Scalars['ID']['output']>;
  status: TaskStatus;
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type TaskList = {
  __typename?: 'TaskList';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  spaceId: Scalars['ID']['output'];
};

export type TaskListInput = {
  name: Scalars['String']['input'];
};

export type TaskPage = {
  __typename?: 'TaskPage';
  items: Array<Task>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type TaskPriority =
  | 'high'
  | 'low'
  | 'none'
  | 'normal'
  | 'urgent';

export type TaskStatus =
  | 'done'
  | 'in_progress'
  | 'in_review'
  | 'todo';

export type UpdateAdminUserInput = {
  platformRole?: InputMaybe<PlatformRole>;
  suspended?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateDepartmentInput = {
  headUserId?: InputMaybe<Scalars['ID']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateDocumentInput = {
  content?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateLeaveTypeInput = {
  annualAllowanceDays?: InputMaybe<Scalars['Int']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  requiresApproval?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateRoleInput = {
  name?: InputMaybe<Scalars['String']['input']>;
  permissions?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type UpdateSpaceInput = {
  color?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateSprintInput = {
  endDate?: InputMaybe<Scalars['String']['input']>;
  goal?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTaskInput = {
  assigneeId?: InputMaybe<Scalars['ID']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  dueDate?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Float']['input']>;
  priority?: InputMaybe<TaskPriority>;
  /** null moves the task to the backlog; needs sprint.manage */
  sprintId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<TaskStatus>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateWorkspaceInput = {
  color?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type Workspace = {
  __typename?: 'Workspace';
  color: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  /** The caller's permissions, e.g. task.create */
  permissions: Array<Scalars['String']['output']>;
  /** The caller's role in this workspace */
  roleName: Scalars['String']['output'];
};
