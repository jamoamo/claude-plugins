import type { Register } from 'claude-code'

import type { Ticket } from '../types'

const PANE = 'jira-tickets'
const TITLE = 'Jira tickets'
const KEY = /\b[A-Z][A-Z0-9]+-\d+\b/
// Jira tools that act on one issue; search tools are left out so a JQL
// result listing dozens of issues doesn't flood the pane.
const ISSUE_TOOL = /__(getJiraIssue|editJiraIssue|transitionJiraIssue|createJiraIssue|addCommentToJiraIssue|addWorklogToJiraIssue|getTransitionsForJiraIssue|getJiraIssueRemoteIssueLinks|createIssueLink)$/

const TICKETS = { plugin: 'jira-tickets', key: 'tickets' } as const

function parseResult(text: string | undefined): Partial<Ticket> {
  if (!text) return {}
  try {
    const json = JSON.parse(text)
    return {
      key: typeof json?.key === 'string' ? json.key : undefined,
      summary: json?.fields?.summary,
      status: json?.fields?.status?.name,
    }
  } catch {
    return { key: text.match(KEY)?.[0] }
  }
}

function touch(list: readonly Ticket[], key: string, parsed: Partial<Ticket>): Ticket[] {
  const old = list.find(t => t.key === key)
  const fresh = parsed.key === key
  const ticket: Ticket = {
    key,
    summary: (fresh && parsed.summary) || old?.summary,
    status: (fresh && parsed.status) || old?.status,
    touchedAt: Date.now(),
  }
  return [ticket, ...list.filter(t => t.key !== key)].slice(0, 50)
}

export const register: Register = (on, options) => {
  const base = String(options?.jiraBaseUrl ?? '').replace(/\/+$/, '')

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'jira-tickets',
      description: 'Show the Jira tickets of this session in a pane',
    })
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'jira-tickets' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Jira tickets pane opened.' }
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (!ISSUE_TOOL.test(e.tool) || 'deny' in ran && ran.deny || ran.isError) {
      return ran
    }

    const input = e as unknown as { issueIdOrKey?: unknown; inwardIssue?: unknown }
    const parsed = parseResult(ran.text)
    const fromInput = String(input.issueIdOrKey ?? input.inwardIssue ?? '').match(KEY)?.[0]
    const key = fromInput ?? parsed.key
    if (!key) return ran

    const { value = [] } = await $.state.get(TICKETS)
    await $.state.set(TICKETS, touch(value, key, parsed))

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Link } = $.ui.resolve(e)
    const { value: list = [] } = await $.state.get(TICKETS)

    return (
      <Box flexDirection="column">
        {!base && <Text dimColor>Set the Jira site URL in this plugin's settings to make keys clickable.</Text>}
        {list.length === 0 && <Text dimColor>No Jira tickets in this session yet.</Text>}
        {list.map(t => (
          <Box flexDirection="column">
            <Text>
              {base ? <Link href={`${base}/browse/${t.key}`}>{t.key}</Link> : t.key}
              {t.status ? ` · ${t.status}` : ''}
            </Text>
            {t.summary && <Text dimColor>{t.summary}</Text>}
          </Box>
        ))}
      </Box>
    )
  })
}
