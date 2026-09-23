import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TOOL_REGISTRY, listAvailableTools } from '../apps/backend/src/services/tools.service.ts'

test('tool registry contains the 14 seed tools', () => {
  assert.equal(TOOL_REGISTRY.length, 14)
})

test('tool names are unique', () => {
  const names = TOOL_REGISTRY.map((t) => t.name)
  assert.equal(new Set(names).size, names.length)
})

test('every tool has complete metadata', () => {
  for (const tool of TOOL_REGISTRY) {
    assert.ok(tool.name.length > 0)
    assert.ok(tool.label.length > 0)
    assert.ok(tool.description.length > 0)
    assert.ok(tool.category.length > 0)
    assert.ok(tool.icon.length > 0)
  }
})

test('gmail tools require gmail OAuth; others do not', () => {
  for (const tool of TOOL_REGISTRY) {
    if (tool.name.startsWith('email_')) {
      assert.equal(tool.requiresOAuth, 'gmail')
    } else {
      assert.equal(tool.requiresOAuth, null)
    }
  }
})

test('listAvailableTools returns the registry', () => {
  assert.equal(listAvailableTools(), TOOL_REGISTRY)
})