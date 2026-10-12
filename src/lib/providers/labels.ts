export const PROVIDER_LABELS: Record<string, string> = {
  FIGMA: "Figma",
  GITHUB_COPILOT: "GitHub Copilot",
  ANTHROPIC: "Anthropic Claude",
  GITHUB: "GitHub",
  SLACK: "Slack",
  ZOOM: "Zoom",
};

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

/** Providers whose audit is seat-based (vs. token/usage-based). */
export const SEAT_PROVIDERS = ["FIGMA", "GITHUB_COPILOT"] as const;
