import { VIPSeverity, VIPUIActionType } from "./vip-policy-types";

export function applyAlertThrottling(severity: VIPSeverity, isRepetitive: boolean, coordinatorBurdenHigh: boolean): VIPUIActionType {
  // Critical issues: never suppress
  if (severity === "CRITICAL" || severity === "HARD_STOP") {
    return "RENDER_BANNER";
  }

  // Coordinator burden: must influence alert routing
  if (coordinatorBurdenHigh && (severity === "LOW" || severity === "INFO")) {
    return "THROTTLE_ALERT";
  }

  // Repetitive issues -> digest/throttle
  if (isRepetitive && severity !== "HIGH") {
    return "THROTTLE_ALERT";
  }

  return "RENDER_BANNER";
}
