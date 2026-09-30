/**
 * Catalogue of tools an agent can be granted, plus the OAuth gate that decides
 * whether a tool's Connect button is live.
 *
 * This lives outside `AgentEditor.tsx` so the registry can be imported by tests
 * without a DOM. A previous version declared `oauthProvider: 'Gmail'` while the
 * editor compared against `'gmail'`, which left the Connect Gmail button
 * permanently disabled and made the OAuth flow unreachable from the UI.
 */

/** Provider id for Google OAuth. Compared verbatim, so keep it lowercase. */
export const GMAIL_OAUTH_PROVIDER = 'gmail'

/** Human-readable provider name, for button labels. */
export const GMAIL_PROVIDER_LABEL = 'Gmail'

export type ToolCategory = 'data' | 'communication' | 'productivity' | 'ai'

export type ToolDef = {
  id: string
  name: string
  description: string
  category: ToolCategory
  requiresOAuth?: boolean
  /** Set to {@link GMAIL_OAUTH_PROVIDER} for tools needing Google consent. */
  oauthProvider?: string
}

export const AVAILABLE_TOOLS: ToolDef[] = [
  {
    id: 'email_read',
    name: 'Read Emails',
    description: 'Read emails from your inbox',
    category: 'data',
    requiresOAuth: true,
    oauthProvider: GMAIL_OAUTH_PROVIDER,
  },
  {
    id: 'email_send',
    name: 'Send Emails',
    description: 'Send emails on your behalf',
    category: 'communication',
    requiresOAuth: true,
    oauthProvider: GMAIL_OAUTH_PROVIDER,
  },
  { id: 'web_fetch', name: 'Web Fetch', description: 'Fetch and read web page content', category: 'data' },
  { id: 'news_read', name: 'Read News', description: 'Read latest news articles', category: 'data' },
  { id: 'job_search', name: 'Job Search', description: 'Search for job listings', category: 'data' },
  { id: 'notes_read', name: 'Read Notes', description: 'Read your notes', category: 'data' },
  { id: 'calendar_read', name: 'Read Calendar', description: 'Read calendar events', category: 'productivity' },
  { id: 'diary_read', name: 'Read Diary', description: 'Read diary entries', category: 'data' },
  { id: 'note_write', name: 'Write Note', description: 'Create or update notes', category: 'productivity' },
  { id: 'calendar_write', name: 'Write Calendar', description: 'Create or update calendar events', category: 'productivity' },
  { id: 'task_move', name: 'Move Task', description: 'Move tasks between columns', category: 'productivity' },
  { id: 'message_inbox', name: 'Message Inbox', description: 'Check agent message inbox', category: 'communication' },
  { id: 'summarize', name: 'Summarize', description: 'Summarize content using AI', category: 'ai' },
  { id: 'classify', name: 'Classify', description: 'Classify content using AI', category: 'ai' },
]

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  data: 'Data',
  communication: 'Communication',
  productivity: 'Productivity',
  ai: 'AI & Generation',
}

export const CATEGORY_ORDER: ToolCategory[] = ['data', 'communication', 'productivity', 'ai']

/**
 * Whether a tool is gated behind Google OAuth.
 *
 * @param tool - Tool definition from {@link AVAILABLE_TOOLS}
 * @returns True only for tools whose `oauthProvider` matches exactly
 */
export function isGmailOAuthTool(tool: ToolDef): boolean {
  return tool.oauthProvider === GMAIL_OAUTH_PROVIDER
}

/**
 * Label for an OAuth tool's connect button.
 *
 * @param tool - Tool definition from {@link AVAILABLE_TOOLS}
 * @param isConnected - Whether a live OAuth connection exists
 * @param connectedEmail - Address on the live connection, if known
 * @param isConnecting - Whether an OAuth redirect is in flight
 * @returns Button text reflecting current connection state
 */
export function getGmailButtonLabel(
  tool: ToolDef,
  isConnected: boolean,
  connectedEmail: string | null,
  isConnecting: boolean
): string {
  if (!isGmailOAuthTool(tool)) return `Connect ${tool.oauthProvider ?? ''}`.trim()
  if (isConnected) return `Connected: ${connectedEmail ?? GMAIL_PROVIDER_LABEL}`
  if (isConnecting) return 'Connecting...'
  return `Connect ${GMAIL_PROVIDER_LABEL}`
}
