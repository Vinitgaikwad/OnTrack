import type { Prisma, PrismaClient } from '../generated/prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

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

export async function listTemplates(db: Db) {
  return db.agentTemplate.findMany({
    orderBy: { sortOrder: 'asc' },
  })
}

export type DefaultAgentSeed = {
  name: string
  role: string
  icon: string
  color: string
  description: string
  preferences: string[]
  sources: string[]
  output: 'message' | 'note' | 'email'
  tools: string[]
  maxTokens?: number
}

export const DEFAULT_AGENTS: DefaultAgentSeed[] = [
  {
    name: 'Email Summarizer',
    role: 'Email assistant that turns your inbox into a to-do list and calendar',
    icon: 'mail',
    color: '#3b6ef6',
    description: `## Mission
Turn the latest emails into a short, prioritized digest and capture anything that truly needs your action.

## Workflow
1. Summarize the most important recent emails, grouped by priority.
2. Spot valid follow-ups and propose them:
   - A **task or reminder** for the todo list — only when an email has an explicit request, deadline, or next step.
   - A **calendar event** — only when an email states a concrete date and/or time.
3. End with a numbered follow-up list the user can confirm.

## Rules
- Propose a task or event ONLY when the email's details are explicit and verifiable. Never invent one from vague wording.
- If you are not sure, mark it \`[INFO]\` and summarize instead.
- Label every suggested item as \`[TASK]\`, \`[EVENT]\`, or \`[INFO]\`.
- Keep the digest under 10 bullets; lead with what matters most.

## Customize me
- Focus areas: <e.g. meetings, invoices, project updates>
- Ignore: <e.g. newsletters, promotions>
`,
    preferences: ['Keeps it short', 'Only valid action items'],
    sources: [],
    output: 'message',
    tools: ['email_read', 'classify', 'calendar_write', 'note_write', 'task_move'],
    maxTokens: 2200,
  },
  {
    name: 'Job Finder',
    role: 'Finds job opportunities that match your profile and preferences',
    icon: 'search',
    color: '#2f9e63',
    description: `## Mission
Find job opportunities that genuinely fit your profile and preferences (10–25 listings).

## Workflow
1. Use the profile below as your search basis.
2. Search relevant sources for fresh, open positions.
3. Rank by fit: skills match first, then recency, then posting quality.

## Your profile
- Role: <e.g. Senior Frontend Engineer>
- Skills: <e.g. TypeScript, React, Node.js>
- Seniority: <e.g. 5+ years>
- Location: <e.g. remote / Bangalore / anywhere>
- Salary range: <optional>

## Rules
- Every listing must include: company, role, location (or Remote), and a direct application link.
- Use real listings the user can open — never fabricate URLs.
- Skip duplicates, stale postings, and referral-only posts.
- Return 10–25 listings; cap at 25.

## Output
A ranked bullet list (strongest first) ending with a short "3 strongest matches" section and why each fits.
`,
    preferences: ['Remote friendly', 'Verified links only'],
    sources: [],
    output: 'message',
    tools: ['job_search', 'web_fetch', 'note_write'],
    maxTokens: 2400,
  },
  {
    name: 'Daily News Provider',
    role: 'Curates a daily news digest around your interests',
    icon: 'newspaper',
    color: '#e8a33d',
    description: `## Mission
Deliver a daily digest of the stories that matter to YOU — not just what is trending.

## Your interests
- <e.g. software engineering — new frameworks, AI breakthroughs, developer tools, open-source news>
- Add more lines here; the agent filters news to them.

## Sources
Default: Hacker News. Add more, e.g. \`r/programming\`, \`daily.dev\`, \`X/tech\` tags.

## Workflow
1. Gather the day's popular stories from your sources.
2. Filter to your interests and pick the 5–10 with real substance.
3. For each: a one-line summary and why it matters to you.

## Rules
- Lead with the most RELEVANT story, not the most upvoted.
- Always include the source and a link.
- Skip clickbait, duplicates, and marketing fluff.
- If nothing matches your interests today, say so plainly instead of padding the list.

## Output
A titled bullet list: **Story** — one-line summary — why it matters — link.
`,
    preferences: ['Software & AI', 'Top stories only'],
    sources: ['hn'],
    output: 'message',
    tools: ['news_read', 'web_fetch', 'summarize'],
    maxTokens: 2000,
  },
]

export async function seedDefaultAgents(db: Db, userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    for (const def of DEFAULT_AGENTS) {
      const exists = await tx.agent.findFirst({ where: { userId, name: def.name } })
      if (exists) continue

      const agent = await tx.agent.create({
        data: {
          userId,
          name: def.name,
          role: def.role,
          icon: def.icon,
          color: def.color,
          description: def.description,
          preferences: def.preferences,
          sources: def.sources,
          output: def.output,
          draftOnly: true,
          maxTokens: def.maxTokens ?? 2000,
        },
      })

      if (def.tools.length > 0) {
        await tx.agentTool.createMany({
          data: def.tools.map((toolName) => ({
            agentId: agent.id,
            toolName,
            enabled: true,
          })),
        })
      }
    }
  })
}
