import { execFileSync } from 'node:child_process'
import process from 'node:process'

const PORTS = [3456, 7891]
const KILL_NAMES = new Set(['node.exe', 'electron.exe'])

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', windowsHide: true })
  } catch {
    return ''
  }
}

function listenerPids() {
  const out = run('netstat.exe', ['-ano', '-p', 'tcp'])
  const pids = new Set()
  for (const line of out.split(/\r?\n/)) {
    const match = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+:0\s+LISTENING\s+(\d+)\s*$/i)
    if (match && PORTS.includes(Number(match[1]))) pids.add(Number(match[2]))
  }
  return [...pids]
}

function processTable() {
  const out = run('powershell.exe', [
    '-NoProfile',
    '-Command',
    "Get-CimInstance Win32_Process | ForEach-Object { \"$($_.ProcessId)|$($_.ParentProcessId)|$($_.Name)\" }",
  ])
  const table = new Map()
  for (const line of out.split(/\r?\n/)) {
    const [pid, ppid, name] = line.trim().split('|')
    if (!pid) continue
    table.set(Number(pid), { ppid: Number(ppid) || 0, name: String(name).toLowerCase() })
  }
  return table
}

const table = processTable()

function protectedSet() {
  const protectedIds = new Set()
  let pid = process.pid
  while (pid) {
    protectedIds.add(pid)
    const entry = table.get(pid)
    if (!entry || entry.ppid === pid) break
    pid = entry.ppid
  }
  return protectedIds
}

const protectedIds = protectedSet()
const killed = new Set()

for (const listenerPid of listenerPids()) {
  if (protectedIds.has(listenerPid)) continue

  const lineage = []
  let pid = listenerPid
  while (pid && !lineage.includes(pid)) {
    lineage.push(pid)
    const entry = table.get(pid)
    if (!entry || entry.ppid === pid) break
    pid = entry.ppid
  }

  const runner = [...lineage]
    .map((id) => ({ id, name: table.get(id)?.name ?? '' }))
    .filter(({ name }) => KILL_NAMES.has(name))
    .sort((a, b) => lineage.indexOf(b.id) - lineage.indexOf(a.id))[0]

  if (!runner || protectedIds.has(runner.id)) {
    const holder = lineage.map((id) => `${id}(${table.get(id)?.name ?? '?'})`).join(' -> ')
    console.warn(`[dev-cleanup] port ${PORTS.join('/')} is held by ${holder} — not auto-killed.`)
    continue
  }

  if (killed.has(runner.id)) continue
  killed.add(runner.id)
  run('taskkill.exe', ['/F', '/T', '/PID', String(runner.id)])
  console.log(`[dev-cleanup] killed stale dev process ${runner.id} (${runner.name}) on port ${PORTS.join('/')}.`)
}

if (killed.size === 0) console.log('[dev-cleanup] ports clean.')