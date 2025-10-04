import { writeFile } from "node:fs/promises";
import { marked } from "marked";
export async function generateHTMLReport(
	results,
	rules,
	ruleSummaries,
	outputPath,
	options,
) {
	// Group results by file
	const fileMap = new Map();
	for (const result of results) {
		if (!fileMap.has(result.file)) {
			fileMap.set(result.file, []);
		}
		fileMap.get(result.file).push(result);
	}
	const groupedFiles = Array.from(fileMap.entries()).map(([file, results]) => ({
		file,
		results,
		hasFailed: results.some((r) => !r.passed),
	}));
	const uniqueFiles = groupedFiles.length;
	const totalFailures = results.filter((r) => !r.passed).length;
	const totalPassed = results.filter((r) => r.passed).length;
	const totalTokens = results.reduce((sum, r) => sum + (r.tokens || 0), 0);
	const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0);
	// Convert markdown summaries to HTML
	const summariesHtml = await Promise.all(
		ruleSummaries.map(async (summary) => ({
			...summary,
			summaryHtml: await marked(summary.summary),
		})),
	);
	const reportData = {
		timestamp: new Date().toISOString(),
		totalFiles: uniqueFiles,
		totalFailures,
		totalPassed,
		rules,
		results,
		model: options.model,
		workers: options.workers,
		duration: options.duration,
	};
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AutoRules Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }

    .container {
      width: 100%;
      padding: 20px;
    }

    h1, h2, h3 {
      margin-bottom: 15px;
    }

    .dashboard {
      background: white;
      border-radius: 8px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .stat {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 6px;
      text-align: center;
    }

    .stat-value {
      font-size: 2em;
      font-weight: bold;
      color: #2c3e50;
    }

    .stat-label {
      color: #7f8c8d;
      margin-top: 5px;
    }

    .stat.passed .stat-value { color: #27ae60; }
    .stat.failed .stat-value { color: #e74c3c; }

    .results-table {
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      background: #34495e;
      color: white;
      padding: 15px;
      text-align: left;
      font-weight: 600;
    }

    td {
      padding: 15px;
      border-bottom: 1px solid #ecf0f1;
    }

    tbody tr {
      cursor: pointer;
      transition: background 0.2s;
    }

    tbody tr:hover {
      background: #f8f9fa;
    }

    .expand-cell {
      width: 40px;
      text-align: center;
      color: #7f8c8d;
    }

    .expand-arrow {
      display: inline-block;
      transition: transform 0.2s;
    }

    tr.file-row.expanded .expand-arrow {
      transform: rotate(90deg);
    }

    .details-row {
      display: none;
    }

    .details-row.visible {
      display: table-row;
    }

    .details-cell {
      padding: 0 !important;
      background: #f8f9fa;
    }

    .details-content {
      padding: 20px;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 600;
    }

    .badge.passed {
      background: #d4edda;
      color: #155724;
    }

    .badge.failed {
      background: #f8d7da;
      color: #721c24;
    }

    .meta {
      color: #7f8c8d;
      font-size: 0.9em;
      margin-bottom: 20px;
    }

    .rule-check {
      padding: 20px;
      border-bottom: 1px solid #e1e8ed;
    }

    .rule-check:last-child {
      border-bottom: none;
    }

    .rule-header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 15px;
    }

    .rule-name {
      font-weight: 600;
      font-size: 1.05em;
      color: #2c3e50;
    }

    .rule-response {
      background: white;
      padding: 15px;
      border-radius: 6px;
      font-size: 0.95em;
      color: #333;
      line-height: 1.7;
      border: 1px solid #e1e8ed;
    }

    .rule-response p {
      margin: 0 0 10px 0;
    }

    .rule-response p:last-child {
      margin-bottom: 0;
    }

    .rule-response ul, .rule-response ol {
      margin: 10px 0;
      padding-left: 25px;
    }

    .rule-response li {
      margin: 5px 0;
    }

    .rule-response code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }

    .rule-response strong {
      font-weight: 600;
      color: #2c3e50;
    }

    .rule-meta {
      font-size: 0.85em;
      color: #7f8c8d;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="dashboard">
      <h1>AutoRules Report</h1>
      <div class="meta">
        Generated: ${new Date(reportData.timestamp).toLocaleString()} |
        Model: ${reportData.model} |
        Workers: ${reportData.workers} |
        Duration: ${reportData.duration}s |
        Tokens: ${totalTokens.toLocaleString()} |
        Cost: $${totalCost.toFixed(4)}
      </div>

      <div class="stats">
        <div class="stat">
          <div class="stat-value">${reportData.totalFiles}</div>
          <div class="stat-label">Total Files</div>
        </div>
        <div class="stat passed">
          <div class="stat-value">${reportData.totalPassed}</div>
          <div class="stat-label">Passed</div>
        </div>
        <div class="stat failed">
          <div class="stat-value">${reportData.totalFailures}</div>
          <div class="stat-label">Failed</div>
        </div>
        <div class="stat">
          <div class="stat-value">${reportData.rules.length}</div>
          <div class="stat-label">Rules</div>
        </div>
      </div>
    </div>

    <h2 style="margin: 30px 0 20px 0;">Rule Summaries</h2>
    <div class="results-table" style="margin-bottom: 30px;">
      <table>
        <thead>
          <tr>
            <th style="width: 40px;"></th>
            <th>Rule</th>
            <th style="width: 120px;">Status</th>
            <th style="width: 150px;">Files Checked</th>
          </tr>
        </thead>
        <tbody>
          ${summariesHtml
						.map(
							(summary, index) => `
            <tr class="file-row" id="summary-row-${index}" onclick="toggleSummary(${index})">
              <td class="expand-cell"><span class="expand-arrow">▶</span></td>
              <td><strong>${escapeHtml(summary.rule.title)}</strong></td>
              <td>
                <span class="badge ${summary.failed > 0 ? "failed" : "passed"}">
                  ${summary.failed > 0 ? "FAILED" : "PASSED"}
                </span>
              </td>
              <td>${summary.passed}/${summary.totalChecked} passed</td>
            </tr>
            <tr class="details-row" id="summary-details-${index}">
              <td colspan="4" class="details-cell">
                <div class="details-content">
                  <div class="rule-response">${summary.summaryHtml}</div>
                </div>
              </td>
            </tr>
          `,
						)
						.join("")}
        </tbody>
      </table>
    </div>

    <h2 style="margin: 30px 0 20px 0;">File Details</h2>
    <div class="results-table">
      <table>
        <thead>
          <tr>
            <th style="width: 40px;"></th>
            <th>File</th>
            <th style="width: 120px;">Status</th>
            <th style="width: 150px;">Rules Checked</th>
          </tr>
        </thead>
        <tbody>
          ${groupedFiles
						.map(
							(grouped, index) => `
            <tr class="file-row" id="row-${index}" onclick="toggleRow(${index})">
              <td class="expand-cell"><span class="expand-arrow">▶</span></td>
              <td><code>${escapeHtml(grouped.file)}</code></td>
              <td>
                <span class="badge ${grouped.hasFailed ? "failed" : "passed"}">
                  ${grouped.hasFailed ? "FAILED" : "PASSED"}
                </span>
              </td>
              <td>${grouped.results.length} rule${grouped.results.length > 1 ? "s" : ""}</td>
            </tr>
            <tr class="details-row" id="details-${index}">
              <td colspan="4" class="details-cell">
                <div class="details-content">
                  ${grouped.results
										.map(
											(result) => `
                    <div class="rule-check">
                      <div class="rule-header">
                        <span class="badge ${result.passed ? "passed" : "failed"}">
                          ${result.passed ? "PASSED" : "FAILED"}
                        </span>
                        <span class="rule-name">${escapeHtml(result.ruleTitle)}</span>
                      </div>
                      <div class="rule-response">${escapeHtml(result.response || result.error || "No response")}</div>
                      ${
												result.tokens || result.cost
													? `
                        <div class="rule-meta">
                          ${result.tokens ? `Tokens: ${result.tokens.toLocaleString()}` : ""}
                          ${result.tokens && result.cost ? " | " : ""}
                          ${result.cost ? `Cost: $${result.cost.toFixed(6)}` : ""}
                        </div>
                      `
													: ""
											}
                    </div>
                  `,
										)
										.join("")}
                </div>
              </td>
            </tr>
          `,
						)
						.join("")}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    function toggleRow(index) {
      const row = document.getElementById('row-' + index);
      const details = document.getElementById('details-' + index);

      row.classList.toggle('expanded');
      details.classList.toggle('visible');
    }

    function toggleSummary(index) {
      const row = document.getElementById('summary-row-' + index);
      const details = document.getElementById('summary-details-' + index);

      row.classList.toggle('expanded');
      details.classList.toggle('visible');
    }
  </script>
</body>
</html>`;
	await writeFile(outputPath, html, "utf-8");
}
function escapeHtml(text) {
	const map = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#039;",
	};
	return text.replace(/[&<>"']/g, (m) => map[m]);
}
//# sourceMappingURL=report.js.map
