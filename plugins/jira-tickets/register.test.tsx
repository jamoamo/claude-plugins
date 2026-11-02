import { expect, test } from 'claude-code/testing'

const JIRA = 'mcp__atlassian__getJiraIssue'
const PANE = {
  plugin: 'jira-tickets',
  component: 'Pane',
  requestId: 'jira-tickets',
  props: {
    title: 'Jira tickets',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test(
  'a fetched issue is listed with its summary and status',
  { options: { jiraBaseUrl: 'https://example.atlassian.net/' } },
  async ($, on) => {
    on('tool.call', () => ({
      result: {},
      text: JSON.stringify({
        key: 'PROJ-7',
        fields: { summary: 'Fix login', status: { name: 'In Progress' } },
      }),
    }))
    await $.tool.call({ tool: JIRA, issueIdOrKey: 'PROJ-7' })

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...PANE, surface })
      expect((await ui.find({ type: 'Text', text: /PROJ-7/ }))?.text).toContain('In Progress')
      expect((await ui.find({ type: 'Text', text: /Fix login/ }))?.text).toBe('Fix login')
      await ui.unmount()
    }
  },
)

test('non-Jira tools and failed calls are ignored', async ($, on) => {
  on('tool.call', (_, e) =>
    e.tool === 'Bash'
      ? { result: {}, text: 'PROJ-1' }
      : { result: {}, text: 'boom', isError: true },
  )
  await $.tool.call({ tool: 'Bash', command: 'echo PROJ-1' })
  await $.tool.call({ tool: JIRA, issueIdOrKey: 'PROJ-2' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /No Jira tickets/ })).toBeTruthy()
  await ui.unmount()
})
