import { Mail, Search, Newspaper } from 'lucide-react'
import type { AgentTemplate } from '../../global/stores/useAgentsStore'
import { Card } from '../../global/ui/Card'
import { Button } from '../../global/ui/Button'

const TEMPLATES: AgentTemplate[] = [
  {
    id: 'email-summarizer',
    slug: 'email-summarizer',
    name: 'Email Summarizer',
    description: 'Digests your inbox and surfaces what matters — with a one-line summary per email.',
    icon: 'bell',
    category: 'productivity',
    defaultRole: 'Summarizer',
    requiresOAuth: 'gmail',
    configSchema: { gmail: true },
    defaultTools: ['gmail'],
    defaultSources: ['Gmail'],
    defaultOutput: 'message',
    defaultPrompt: 'Summarize unread emails from the last 24 hours.',
    sortOrder: 0,
  },
  {
    id: 'job-tracker',
    slug: 'job-tracker',
    name: 'Job Tracker',
    description: 'Tracks job applications, follows up on pending responses, and keeps your pipeline clean.',
    icon: 'calendar',
    category: 'productivity',
    defaultRole: 'Tracker',
    requiresOAuth: null,
    configSchema: { spreadsheet: true },
    defaultTools: ['spreadsheet'],
    defaultSources: [],
    defaultOutput: 'note',
    defaultPrompt: 'Track my job applications and follow up on pending ones.',
    sortOrder: 1,
  },
  {
    id: 'news-provider',
    slug: 'news-provider',
    name: 'News Provider',
    description: 'Scans the web for topics you care about and delivers a clean morning briefing.',
    icon: 'sparkles',
    category: 'content',
    defaultRole: 'Curator',
    requiresOAuth: null,
    configSchema: { search: true },
    defaultTools: ['search'],
    defaultSources: ['Web Search'],
    defaultOutput: 'message',
    defaultPrompt: 'Find the latest news on my interests and summarize top stories.',
    sortOrder: 2,
  },
]

const TEMPLATE_ICONS: Record<string, typeof Mail> = {
  bell: Mail,
  calendar: Newspaper,
  sparkles: Search,
}

type TemplateGalleryProps = {
  onSelect: (template: AgentTemplate) => void
}

export function TemplateGallery({ onSelect }: TemplateGalleryProps) {
  const getChips = (template: AgentTemplate): string[] => {
    const chips: string[] = []
    if (template.requiresOAuth) chips.push('OAuth Required')
    if (template.configSchema && typeof template.configSchema === 'object') {
      if ('gmail' in template.configSchema) chips.push('Gmail')
      if ('spreadsheet' in template.configSchema) chips.push('Spreadsheet')
      if ('search' in template.configSchema) chips.push('Web Search')
    }
    if (template.defaultTools.length > 0) chips.push(`${template.defaultTools.length} tool${template.defaultTools.length === 1 ? '' : 's'}`)
    return chips
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {TEMPLATES.map((template) => {
        const Icon = TEMPLATE_ICONS[template.icon] ?? Mail
        const chips = getChips(template)

        return (
          <Card key={template.id} className="flex flex-col p-5">
            <div className="flex items-start gap-3">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-(--surface-2) text-(--text-muted)"
              >
                <Icon size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{template.name}</h3>
                <p className="mt-0.5 text-xs font-medium text-(--text-muted)">
                  {template.defaultRole}
                </p>
              </div>
            </div>

            <p className="mt-3 flex-1 text-sm text-(--text-muted)">{template.description}</p>

            {chips.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-(--surface-2) px-2 py-0.5 text-[11px] font-medium text-(--text-muted)"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}

            <Button
              variant="soft"
              size="sm"
              className="mt-4"
              onClick={() => onSelect(template)}
            >
              Use template
            </Button>
          </Card>
        )
      })}
    </div>
  )
}
