# A3: Organizations above workspaces (phase 1)

An organization groups workspaces that belong to one company, so its admins can see them
together and set security rules once for all of them.

## Model

- `organization` (name, `two_step_required`, created by) and `organization_member`
  (user, role: `owner` / `admin` / `member`).
- `workspace.organization_id`: a workspace belongs to at most one organization.
  Workspace membership stays per workspace: being in the organization doesn't let you in.
- `audit_log.organization_id`: organization actions (and workspaces joining or leaving)
  are recorded there, readable by the organization's owners and admins.

## Who can do what

| Action | Who |
| --- | --- |
| Create an organization | Anyone signed in (becomes its owner) |
| See it, its members and its workspaces (names only) | Its members |
| Rename, add or remove members, set the two-step rule, read its activity | Owners and admins |
| Make or remove owners, delete it | Owners; an organization always keeps one owner |
| Put a workspace in it | Someone with `workspace.manage` there who is also an owner or admin of the organization |
| Take a workspace out | Someone with `workspace.manage` in that workspace |

## Security rules shared with workspaces

`two_step_required` on the organization applies to every workspace in it; a workspace
gets the stricter of its own setting and its organization's (A4).

## Row-level security

A new `organization` scope (`app.org_id`) like the workspace scope: the API sets it only
after checking the caller's membership, and policies limit rows to that organization.
Outside it you can read your own `organization_member` rows (that's how the API checks
membership), and the organizations of workspaces you're in (so the two-step rule applies).
A trigger refuses moving a workspace into an organization unless the current user is an
owner or admin of it.

## Later

Billing, shared HR and IAM (org-wide roles and policies), ARN-like resource names.
SSO per verified email domain is done (A4, OIDC): see the status page.
