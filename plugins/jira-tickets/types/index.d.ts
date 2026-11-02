export type Ticket = {
  key: string
  summary?: string
  status?: string
  touchedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'jira-tickets': { tickets: Ticket[] }
  }
}
