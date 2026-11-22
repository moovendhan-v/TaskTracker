import { Inject, Injectable, Logger } from '@nestjs/common';
import { AI_LIMITS, type AiSummaryResponse, type AiSummaryTarget } from '@taskflow/shared-types';
import { ENV } from '../../../config/config.module.js';
import type { Env } from '../../../config/env.schema.js';
import { AiModelRegistry } from '../../../core/ai/ai-model.registry.js';
import { LanguageModelError } from '../../../core/ai/language-model.port.js';
import { DomainError } from '../../../core/domain/domain-error.js';
import type { Actor, WorkspaceAccess } from '../../../core/http/types/authenticated-request.js';
import { ChatService } from '../../chat/application/chat.service.js';
import { CommentsService } from '../../comments/application/comments.service.js';
import { DocumentsService } from '../../documents/application/documents.service.js';
import { TasksService } from '../../tasks/application/tasks.service.js';
import { AiRepository } from '../domain/ai.repository.js';
import { cleanAnswer, summaryPrompt, type SummarySource } from '../domain/ai-prompts.js';
import { AiSettingsService } from './ai-settings.service.js';

/**
 * AI features over workspace content. Every source is read through its own service as the
 * caller, so a summary only ever sees what the caller can already open; the model's answer
 * is plain text and is never stored, rendered as HTML or acted on.
 */
@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    private readonly ai: AiRepository,
    private readonly settings: AiSettingsService,
    private readonly registry: AiModelRegistry,
    private readonly tasksService: TasksService,
    private readonly commentsService: CommentsService,
    private readonly documentsService: DocumentsService,
    private readonly chatService: ChatService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async summarize(actor: Actor, access: WorkspaceAccess, target: AiSummaryTarget, id: string, threadRootId?: string | null): Promise<AiSummaryResponse> {
    // What's summarised is read first: someone who can't open it learns nothing about AI here.
    const source = await this.source(actor, access, target, id, threadRootId ?? null);
    if (source.parts.every((part) => !part.text.trim())) throw DomainError.invalid('There is nothing to summarise yet');

    const settings = await this.settings.effective(access.workspaceId);
    if (!settings.enabled) throw DomainError.forbidden('AI is turned off for this workspace');
    if (!settings.providerId || !settings.model) throw DomainError.invalid('Pick an AI provider and model in workspace settings');
    const model = this.registry.modelFor(settings.providerId);
    if (!model) throw DomainError.invalid('Pick an AI provider and model in workspace settings');

    const day = this.settings.today();
    const budget = this.env.AI_DAILY_TOKENS_PER_USER;
    if ((await this.ai.tokensUsed(access.workspaceId, actor.userId, day)) >= budget) throw DomainError.invalid('You have used today’s AI allowance in this workspace; it resets at midnight UTC');

    let result;
    try {
      result = await model.generate({ model: settings.model, messages: summaryPrompt(source), maxOutputTokens: AI_LIMITS.outputTokens, temperature: 0.2 });
    } catch (error) {
      if (error instanceof LanguageModelError) throw DomainError.invalid(error.message);
      this.logger.error('AI request failed', error instanceof Error ? error.stack : undefined);
      throw DomainError.invalid('The AI request failed');
    }
    const tokens = result.inputTokens + result.outputTokens;
    const usedToday = await this.ai.addUsage(access.workspaceId, actor.userId, day, tokens);
    const providerLabel = this.registry.list().find((provider) => provider.id === settings.providerId)?.label ?? settings.providerId;
    return { text: cleanAnswer(result.text), providerLabel, model: settings.model, tokens, usedToday, dailyTokens: budget };
  }

  private async source(actor: Actor, access: WorkspaceAccess, target: AiSummaryTarget, id: string, threadRootId: string | null): Promise<SummarySource> {
    const { workspaceId } = access;
    switch (target) {
      case 'task': {
        const task = await this.tasksService.get(workspaceId, id);
        const comments = await this.commentsService.list(workspaceId, task.id);
        return {
          kind: 'task',
          title: `#${task.number} ${task.title} (status: ${task.status.name}, priority: ${task.priority}${task.dueDate ? `, due ${task.dueDate.slice(0, 10)}` : ''})`,
          parts: [{ author: 'Description', text: task.description }, ...comments.map((comment) => ({ author: comment.authorName, at: comment.createdAt, text: comment.body }))],
        };
      }
      case 'document': {
        const document = await this.documentsService.get(workspaceId, id);
        return { kind: 'document', title: document.title, parts: document.content.split(/\n{2,}/).map((text) => ({ text })) };
      }
      case 'chat': {
        const channel = await this.chatService.channel(access, actor, id);
        const page = threadRootId
          ? await this.chatService.thread(access, actor, threadRootId, null, AI_LIMITS.chatMessages)
          : await this.chatService.messages(access, actor, id, null, AI_LIMITS.chatMessages);
        const root = threadRootId ? await this.chatService.message(access, actor, threadRootId) : null;
        if (root && root.channelId !== channel.id) throw DomainError.notFound('Message');
        const items = [...(root ? [root] : []), ...page.items].filter((message) => message.kind === 'user').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return { kind: 'chat', title: `${channel.name ? `#${channel.name}` : 'Direct message'}${root ? ' (a thread)' : ''}`, parts: items.map((message) => ({ author: message.authorName, at: message.createdAt, text: message.body })) };
      }
    }
  }
}
