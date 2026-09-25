import type { JsonReport } from "./json-report.js";

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function json(value: unknown): string {
  return escapeHtml(JSON.stringify(value, null, 2));
}

export function renderHtmlReport(report: JsonReport): string {
  const status = report.runStatus.completed
    ? '<div class="status complete">Run completed normally.</div>'
    : `<div class="status partial">Partial/terminated run: ${escapeHtml(report.runStatus.reason)}</div>`;

  const observations = report.observedBehavior.observations.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.value)}</td>
      <td><code>${item.evidenceEventIds.map(escapeHtml).join(", ") || "—"}</code></td>
    </tr>`).join("");

  const comparison = report.declaredVsObserved.map((item) => `
    <tr>
      <td>${escapeHtml(item.behavior)}</td>
      <td>${escapeHtml(item.label)}</td>
      <td>${item.declaredEvidence.map(escapeHtml).join("<br>") || "—"}</td>
      <td><code>${item.observedEvidenceEventIds.map(escapeHtml).join(", ") || "—"}</code></td>
    </tr>`).join("");

  const modelOutputs = report.modelOutputs.map((output) => `
    <article><h3>Turn ${escapeHtml(output.turn ?? "—")} · <code>${escapeHtml(output.eventId)}</code></h3><pre>${escapeHtml(output.text)}</pre></article>`).join("") || "<p>—</p>";

  const timeline = report.evidenceTimeline.map((event) => `
    <tr><td><code>${escapeHtml(event.eventId)}</code></td><td>${escapeHtml(event.timestamp)}</td><td>${escapeHtml(event.type)}</td></tr>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ravel report — ${escapeHtml(report.identity.runId)}</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:2rem;background:#f7f7f8;color:#171717}
main{background:white;padding:2rem;border:1px solid #ddd;border-radius:12px}
h1,h2{line-height:1.2} section{margin:2rem 0} table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ddd;padding:.55rem;text-align:left;vertical-align:top} th{background:#f1f1f1}
pre{white-space:pre-wrap;background:#f6f6f6;padding:1rem;border-radius:8px;overflow-wrap:anywhere}
.status{padding:.8rem 1rem;border-radius:8px;font-weight:700}.complete{background:#e8f7ec}.partial{background:#fff1df}
code{font-family:ui-monospace,monospace}
</style>
</head>
<body><main>
<h1>Ravel experiment report</h1>
${status}
<section id="identity"><h2>1. Identity</h2><pre>${json(report.identity)}</pre></section>
<section id="conditions"><h2>2. Experimental Conditions</h2><pre>${json(report.experimentalConditions)}</pre></section>
<section id="declared"><h2>3. Declared Behavior</h2><pre>${json(report.declaredBehavior)}</pre></section>
<section id="observed"><h2>4. Observed Behavior</h2>
<table><thead><tr><th>Observation</th><th>Value</th><th>Evidence event IDs</th></tr></thead><tbody>${observations}</tbody></table>
</section>
<section id="comparison"><h2>5. Declared vs Observed</h2>
<table><thead><tr><th>Behavior</th><th>Label</th><th>Declared evidence</th><th>Observed event IDs</th></tr></thead><tbody>${comparison}</tbody></table>
</section>
<section id="model-outputs"><h2>6. Model Outputs</h2>
${modelOutputs}
</section>
<section id="timeline"><h2>7. Evidence Timeline</h2>
<table><thead><tr><th>Event ID</th><th>Timestamp</th><th>Type</th></tr></thead><tbody>${timeline}</tbody></table>
</section>
</main></body></html>`;
}
