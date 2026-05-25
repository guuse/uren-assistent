export type CopilotModel = {
  id: string              // e.g. "gpt-4o"
  name: string            // display name
  tokenMultiplier: number // relative token cost — defaults to 1.0 if not present in API response
}
