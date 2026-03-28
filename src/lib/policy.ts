import { RiskLevel } from "@prisma/client";

export function classifyRiskLevel(actionName: string, args: Record<string, unknown>) {
  switch (actionName) {
    case "calendar.read":
    case "email.draft":
      return RiskLevel.LOW;
    case "email.send": {
      const recipients = Array.isArray(args.recipients) ? args.recipients : [];
      return recipients.length > 1 ? RiskLevel.HIGH : RiskLevel.MEDIUM;
    }
    case "slack.post": {
      const channel = typeof args.channel === "string" ? args.channel : "";
      return channel.startsWith("#") ? RiskLevel.HIGH : RiskLevel.MEDIUM;
    }
    case "github.issue.create":
      return RiskLevel.MEDIUM;
    default:
      return RiskLevel.MEDIUM;
  }
}

export function requiresApproval(riskLevel: RiskLevel) {
  return riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL;
}
