import type { PrismaClient } from '../generated/prisma/client'

const DEFAULT_TEMPLATES = [
  {
    slug: 'email-summarizer',
    name: 'Email Summarizer',
    description: 'Summarize your recent emails into actionable bullet points',
    category: 'productivity',
    icon: 'Mail',
    requiresOAuth: 'gmail',
    defaultRole: 'Email summarizer and triage assistant',
    defaultPrompt:
      'Read my recent emails and provide a concise summary of the most important messages. Highlight action items, deadlines, and key updates. Group by priority.',
    defaultOutput: 'message' as const,
    sortOrder: 1,
    defaultTools: ['email_read', 'summarize'],
    defaultSources: [],
  },
  {
    slug: 'job-tracker',
    name: 'Job Tracker',
    description: 'Search for relevant job listings and track opportunities',
    category: 'career',
    icon: 'Briefcase',
    requiresOAuth: null,
    defaultRole: 'Job search and career opportunity tracker',
    defaultPrompt:
      'Search for the latest job listings relevant to my profile and preferences. List the top opportunities with company name, role, and a direct link. Highlight the most promising matches.',
    defaultOutput: 'note' as const,
    sortOrder: 2,
    defaultTools: ['web_fetch', 'note_write'],
    defaultSources: [],
  },
  {
    slug: 'news-provider',
    name: 'News Digest',
    description: 'Get a daily digest of tech and industry news',
    category: 'information',
    icon: 'Newspaper',
    requiresOAuth: null,
    defaultRole: 'Daily news curator and digest creator',
    defaultPrompt:
      'Fetch the latest tech and industry news. Provide a brief summary of each story, noting why it matters. Include links where available.',
    defaultOutput: 'message' as const,
    sortOrder: 3,
    defaultTools: ['news_read', 'summarize'],
    defaultSources: ['hn'],
  },
]

export async function seedTemplates(db: PrismaClient) {
  for (const template of DEFAULT_TEMPLATES) {
    await db.agentTemplate.upsert({
      where: { slug: template.slug },
      create: {
        slug: template.slug,
        name: template.name,
        description: template.description,
        category: template.category,
        icon: template.icon,
        requiresOAuth: template.requiresOAuth,
        defaultRole: template.defaultRole,
        defaultPrompt: template.defaultPrompt,
        defaultOutput: template.defaultOutput,
        defaultTools: template.defaultTools,
        defaultSources: template.defaultSources,
        sortOrder: template.sortOrder,
      },
      update: {
        name: template.name,
        description: template.description,
        category: template.category,
        icon: template.icon,
        requiresOAuth: template.requiresOAuth,
        defaultRole: template.defaultRole,
        defaultPrompt: template.defaultPrompt,
        defaultOutput: template.defaultOutput,
        defaultTools: template.defaultTools,
        defaultSources: template.defaultSources,
        sortOrder: template.sortOrder,
      },
    })
  }
}

export async function listTemplates(db: PrismaClient) {
  return db.agentTemplate.findMany({
    orderBy: { sortOrder: 'asc' },
  })
}
