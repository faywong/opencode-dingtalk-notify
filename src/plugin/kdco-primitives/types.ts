// Type definitions for OpenCode SDK (extracted from opencode-notify)

export interface OpencodeClient {
  session: {
    get: (params: { path: { id: string } }) => Promise<{
      data?: {
        id?: string
        title?: string
        parentID?: string
        status?: string
      }
    }>
  }
}
