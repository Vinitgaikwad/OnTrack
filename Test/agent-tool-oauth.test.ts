import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  AVAILABLE_TOOLS,
  CATEGORY_ORDER,
  GMAIL_OAUTH_PROVIDER,
  getGmailButtonLabel,
  isGmailOAuthTool,
  type ToolDef,
} from '../apps/web/src/features/agents/available-tools.ts'

const editorSource = await readFile('apps/web/src/features/agents/AgentEditor.tsx', 'utf8')
const toolRegistrySource = await readFile(
  'apps/web/src/features/agents/available-tools.ts',
  'utf8'
)

const byId = (id: string): ToolDef => {
  const tool = AVAILABLE_TOOLS.find((t) => t.id === id)
  assert.ok(tool, `tool ${id} must exist in the registry`)
  return tool
}

test('the Gmail provider id is lowercase, matching the backend registry', () => {
  assert.equal(GMAIL_OAUTH_PROVIDER, 'gmail')
  assert.equal(GMAIL_OAUTH_PROVIDER, GMAIL_OAUTH_PROVIDER.toLowerCase())
})

test('every OAuth-gated tool names the provider the gate compares against', () => {
  const gated = AVAILABLE_TOOLS.filter((tool) => tool.requiresOAuth)
  assert.ok(gated.length > 0, 'expected at least one OAuth-gated tool')
  for (const tool of gated) {
    assert.equal(
      tool.oauthProvider,
      GMAIL_OAUTH_PROVIDER,
      `${tool.id} declares oauthProvider ${JSON.stringify(tool.oauthProvider)}; ` +
        `isGmailOAuthTool compares against ${JSON.stringify(GMAIL_OAUTH_PROVIDER)}, ` +
        'so the connect button would stay disabled'
    )
  }
})

test('the email tools pass the OAuth gate, so Connect Gmail is reachable', () => {
  assert.equal(isGmailOAuthTool(byId('email_read')), true)
  assert.equal(isGmailOAuthTool(byId('email_send')), true)
})

test('a tool with no OAuth provider fails the gate', () => {
  assert.equal(isGmailOAuthTool(byId('web_fetch')), false)
  assert.equal(isGmailOAuthTool(byId('summarize')), false)
})

test('a wrong-case provider id fails the gate, which is the bug that shipped', () => {
  const miscased: ToolDef = {
    id: 'email_read',
    name: 'Read Emails',
    description: 'Read emails from your inbox',
    category: 'data',
    requiresOAuth: true,
    oauthProvider: 'Gmail',
  }
  assert.equal(isGmailOAuthTool(miscased), false)
})

test('the connect button offers Google while disconnected and names the account once connected', () => {
  const tool = byId('email_read')
  assert.equal(getGmailButtonLabel(tool, false, null, false), 'Connect Gmail')
  assert.equal(getGmailButtonLabel(tool, false, null, true), 'Connecting...')
  assert.equal(
    getGmailButtonLabel(tool, true, 'vinit@example.com', false),
    'Connected: vinit@example.com'
  )
  assert.equal(getGmailButtonLabel(tool, true, null, false), 'Connected: Gmail')
})

test('the editor gates the button through the shared helper, not an inline literal', () => {
  assert.match(editorSource, /from '\.\/available-tools'/)
  assert.match(editorSource, /!isGmailOAuthTool\(tool\)/)
  assert.match(editorSource, /getGmailButtonLabel\(/)
  assert.ok(
    !/oauthProvider\s*[!=]==?\s*['"]/.test(editorSource),
    'the editor must not compare oauthProvider against a string literal; use isGmailOAuthTool'
  )
  assert.ok(
    !/oauthProvider\s*[!=]==?\s*['"]/.test(toolRegistrySource),
    'the gate must compare against the exported constant, not a literal'
  )
})

test('every registry tool sits in a category the editor renders', () => {
  for (const tool of AVAILABLE_TOOLS) {
    assert.ok(
      CATEGORY_ORDER.includes(tool.category),
      `${tool.id} has category ${tool.category}, which is not in CATEGORY_ORDER`
    )
  }
})
