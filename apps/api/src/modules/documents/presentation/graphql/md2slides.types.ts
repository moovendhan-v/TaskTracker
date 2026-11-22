import { Field, Int, ObjectType } from '@nestjs/graphql';
import type { Md2SlidesCatalogResponse, Md2SlidesContributor, Md2SlidesSnippet, Md2SlidesTemplate } from '@taskflow/shared-types';

@ObjectType('Md2SlidesTemplate', { description: 'A community template from md2slides, credited to its contributor' })
export class Md2SlidesTemplateGql implements Md2SlidesTemplate {
  @Field() id: string;
  @Field() name: string;
  @Field() description: string;
  @Field() category: string;
  @Field() author: string;
  @Field(() => String, { nullable: true }) authorGithub: string | null;
  @Field({ description: 'Markdown: render without raw HTML' }) md: string;
  @Field(() => String, { nullable: true }) accent: string | null;
}

@ObjectType('Md2SlidesContributor')
export class Md2SlidesContributorGql implements Md2SlidesContributor {
  @Field() github: string;
  @Field() name: string;
  @Field() role: string;
  @Field(() => Int, { description: 'Community templates they made' }) templates: number;
  @Field(() => String, { nullable: true }) website: string | null;
}

@ObjectType('Md2SlidesSnippet')
export class Md2SlidesSnippetGql implements Md2SlidesSnippet {
  @Field() label: string;
  @Field() category: string;
  @Field() md: string;
}

@ObjectType('Md2SlidesCatalog')
export class Md2SlidesCatalogGql implements Md2SlidesCatalogResponse {
  @Field(() => [Md2SlidesTemplateGql]) templates: Md2SlidesTemplateGql[];
  @Field(() => [Md2SlidesContributorGql], { description: 'Most templates first' }) contributors: Md2SlidesContributorGql[];
  @Field(() => [Md2SlidesSnippetGql]) snippets: Md2SlidesSnippetGql[];
  @Field(() => String, { description: 'live (read from md2slides today) or snapshot (the bundled copy)' }) source: 'live' | 'snapshot';
  @Field() updatedAt: string;
}
