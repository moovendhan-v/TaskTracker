import type { IconKey } from './hierarchy.js';

/**
 * Doc templates (B5): a page to start from. The built-in starters ship with the
 * app; a workspace saves its own from any page. A new page from a template is an
 * ordinary page: its text is copied, then `{{date}}` becomes the day it was made.
 */
export const DOC_TEMPLATE_LIMITS = { nameMax: 60, descriptionMax: 200, perWorkspace: 100 } as const;

export interface DocTemplateResponse {
  id: string;
  name: string;
  description: string;
  icon: IconKey | null;
  content: string;
  /** Ships with the app (not deletable); otherwise saved in this workspace. */
  builtIn: boolean;
  createdById: string | null;
  createdAt: string | null;
}

export interface SaveDocTemplateRequest {
  name: string;
  description?: string;
  icon?: IconKey | null;
  content: string;
}

/** Fills a template's placeholders for a new page: {{date}} is the day it's made (YYYY-MM-DD). */
export function fillDocTemplate(content: string, today: string): string {
  return content.replaceAll('{{date}}', today);
}

export const BUILT_IN_DOC_TEMPLATES: readonly DocTemplateResponse[] = [
  {
    id: 'builtin:meeting-notes',
    name: 'Meeting notes',
    description: 'Agenda, notes, decisions and action items for one meeting.',
    icon: null,
    content: '# Meeting notes, {{date}}\n\n**Attendees:** \n\n## Agenda\n\n- \n\n## Notes\n\n\n\n## Decisions\n\n- \n\n## Action items\n\n- [ ] Who: what, by when\n',
    builtIn: true,
    createdById: null,
    createdAt: null,
  },
  {
    id: 'builtin:project-brief',
    name: 'Project brief',
    description: 'The problem, the goal, scope and who is involved, on one page.',
    icon: null,
    content: '# Project brief\n\n## Problem\n\nWhat is wrong today, and for whom?\n\n## Goal\n\nWhat does done look like? How will we measure it?\n\n## Scope\n\n**In:** \n\n**Out:** \n\n## People\n\n- Owner: \n- Team: \n\n## Milestones\n\n| Milestone | Date |\n| --- | --- |\n|  |  |\n',
    builtIn: true,
    createdById: null,
    createdAt: null,
  },
  {
    id: 'builtin:retrospective',
    name: 'Retrospective',
    description: 'What went well, what didn’t, and what to try next.',
    icon: null,
    content: '# Retrospective, {{date}}\n\n## What went well\n\n- \n\n## What didn’t\n\n- \n\n## What we’ll try next\n\n- [ ] \n',
    builtIn: true,
    createdById: null,
    createdAt: null,
  },
  {
    id: 'builtin:decision-record',
    name: 'Decision record',
    description: 'One decision: the context, the options and why this one.',
    icon: null,
    content: '# Decision: \n\n**Date:** {{date}}  \n**Status:** proposed\n\n## Context\n\n\n\n## Options\n\n1. \n2. \n\n## Decision\n\n\n\n## Consequences\n\n\n',
    builtIn: true,
    createdById: null,
    createdAt: null,
  },
];
