import type { AvailabilityStatus, SeasonEventDTO } from "@/types/api";

export function isSessionPlayable(ev: Pick<SeasonEventDTO, "status" | "hasTelemetry" | "verified">): boolean {
  return ev.status === "available" && ev.hasTelemetry === true && ev.verified === true;
}

export function getStatusDisplay(
  ev: Pick<SeasonEventDTO, "status" | "hasTelemetry" | "verified">
): {
  label: string;
  status: AvailabilityStatus;
} {
  const s = ev.status ?? "unknown";
  if (s === "available") {
    return isSessionPlayable(ev)
      ? { label: "Replay Ready", status: "available" }
      : { label: "Not Verified", status: "unverified" };
  }
  switch (s) {
    case "upcoming":
      return { label: "Upcoming", status: "upcoming" };
    case "unverified":
      return { label: "Not Verified", status: "unverified" };
    case "restricted":
      return { label: "Restricted", status: "restricted" };
    case "unavailable":
      return { label: "Unavailable", status: "unavailable" };
    default:
      return { label: "Unknown", status: "unknown" };
  }
}

