import type { TerminationReason } from "../experiment/types.js";
import { diffSnapshots, type FilesystemSnapshot } from "../sandbox/snapshot.js";
import type { TraceEvent } from "../trace/event-schema.js";

export type ObservationName =
  | "files_read"
  | "files_written"
  | "processes_started"
  | "network_requests_attempted"
  | "denied_actions"
  | "canary_accesses"
  | "termination_reason"
  | "filesystem_created"
  | "filesystem_modified"
  | "filesystem_deleted";

export interface Observation {
  name: ObservationName;
  value: number | string;
  evidenceEventIds: string[];
}

export interface ObservationSet {
  observations: Observation[];
  filesystemDelta: {
    created: string[];
    modified: string[];
    deleted: string[];
  };
}

function count(events: TraceEvent[], type: TraceEvent["type"]): Observation {
  const matching = events.filter((event) => event.type === type);
  const nameByType: Partial<Record<TraceEvent["type"], ObservationName>> = {
    "filesystem.read": "files_read",
    "filesystem.write": "files_written",
    "process.start": "processes_started",
    "network.request": "network_requests_attempted",
    "tool.denied": "denied_actions",
    "canary.access": "canary_accesses"
  };
  return {
    name: nameByType[type] ?? "denied_actions",
    value: matching.length,
    evidenceEventIds: matching.map((event) => event.eventId)
  };
}

export function deriveObservations(
  events: TraceEvent[],
  snapshots: { before: FilesystemSnapshot; after?: FilesystemSnapshot }
): ObservationSet {
  const terminal = [...events].reverse().find((event) => event.type === "run.end" || event.type === "run.terminated");
  const reason = typeof terminal?.payload.reason === "string"
    ? terminal.payload.reason
    : terminal?.type === "run.end" ? "completed" : "runner_error";
  const delta = snapshots.after
    ? diffSnapshots(snapshots.before, snapshots.after)
    : { created: [], modified: [], deleted: [] };

  const observations: Observation[] = [
    count(events, "filesystem.read"),
    count(events, "filesystem.write"),
    count(events, "process.start"),
    count(events, "network.request"),
    count(events, "tool.denied"),
    count(events, "canary.access"),
    {
      name: "termination_reason",
      value: reason as TerminationReason,
      evidenceEventIds: terminal ? [terminal.eventId] : []
    },
    { name: "filesystem_created", value: delta.created.length, evidenceEventIds: events.filter((e) => e.type === "filesystem.write").map((e) => e.eventId) },
    { name: "filesystem_modified", value: delta.modified.length, evidenceEventIds: events.filter((e) => e.type === "filesystem.write").map((e) => e.eventId) },
    { name: "filesystem_deleted", value: delta.deleted.length, evidenceEventIds: events.filter((e) => e.type === "filesystem.write").map((e) => e.eventId) }
  ];

  return { observations, filesystemDelta: delta };
}

export function observationValue(set: ObservationSet, name: ObservationName): number | string | undefined {
  return set.observations.find((observation) => observation.name === name)?.value;
}
