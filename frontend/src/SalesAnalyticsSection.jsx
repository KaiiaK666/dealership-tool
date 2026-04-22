import React from "react";

function formatNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString("en-US") : "0";
}

function formatDateTime(value) {
  if (!value) return "Not available yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function shortRunLabel(value) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
  }).format(parsed);
}

function metricPercent(value, maxValue) {
  if (!maxValue) return 0;
  return Math.max(8, Math.round((Number(value || 0) / Number(maxValue || 1)) * 100));
}

function statusLabel(value) {
  const text = String(value || "idle").trim();
  if (!text) return "Idle";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function runStatusCopy(config, status) {
  if (status?.state === "running") {
    return "The scraper is running now. If this is the first local run, DealerSocket MFA or WhatsApp login may need attention in the saved Chrome profile.";
  }
  if (!config?.runner_ready) {
    return "Install the sales-activity runner dependencies before triggering a scrape from this tab.";
  }
  return `Schedule: ${config?.schedule_label || "Manual only"} | WhatsApp target: ${config?.chat_name || "Me"}.`;
}

function HistoryBars({ history }) {
  const runs = (history || []).slice(0, 8).reverse();
  const maxCalls = Math.max(...runs.map((run) => Number(run?.totals?.calls_cti || 0)), 1);

  if (!runs.length) {
    return <div className="sales-analytics-empty-inline">No history yet. Trigger the first scrape to start the graph.</div>;
  }

  return (
    <div className="sales-analytics-history-bars">
      {runs.map((run) => (
        <article key={run.run_id || run.generated_at} className="sales-analytics-history-bar">
          <div className="sales-analytics-history-bar__rail">
            <span
              className="sales-analytics-history-bar__fill"
              style={{ height: `${metricPercent(run?.totals?.calls_cti || 0, maxCalls)}%` }}
            />
          </div>
          <strong>{formatNumber(run?.totals?.calls_cti || 0)}</strong>
          <small>{shortRunLabel(run.generated_at)}</small>
        </article>
      ))}
    </div>
  );
}

export default function SalesAnalyticsSection({
  assetUrl,
  dashboard,
  feedback,
  loading,
  onSelectVariant,
  onRefresh,
  onRun,
  running,
  selectedVariant,
  variants,
}) {
  const config = dashboard?.config || {
    variant_key: "sales",
    variant_label: "Sales people",
    schedule_label: "",
    schedule_times: [],
    chat_name: "Kau 429-8898 (You)",
    runner_ready: false,
    can_trigger: false,
  };
  const status = dashboard?.status || {
    variant_key: "sales",
    variant_label: "Sales people",
    state: "idle",
    last_success_at: "",
    last_error: "",
  };
  const latest = dashboard?.latest || null;
  const history = dashboard?.history || [];
  const rows = latest?.rows || [];
  const activeVariant =
    (variants || []).find((variant) => variant.key === selectedVariant) || {
      key: config?.variant_key || "sales",
      label: config?.variant_label || "Sales people",
    };
  const maxCalls = Math.max(...rows.map((row) => Number(row?.calls_cti || 0)), 1);
  const maxEmails = Math.max(...rows.map((row) => Number(row?.emails_sent || 0)), 1);
  const maxTexts = Math.max(...rows.map((row) => Number(row?.texts_sent || 0)), 1);
  const buttonDisabled = running || loading || !config.runner_ready || !config.can_trigger;
  const screenshotUrl = latest?.screenshot_url ? assetUrl(latest.screenshot_url) : "";

  return (
    <section className="stack sales-analytics-shell">
      <div className="panel sales-analytics-hero">
        <div className="sales-analytics-hero__copy">
          <span className="eyebrow">Sales analytics</span>
          <div className="sales-analytics-variant-tabs" role="tablist" aria-label="Sales analytics report filters">
            {(variants || []).map((variant) => (
              <button
                key={variant.key}
                type="button"
                className={`sales-analytics-variant-tab ${selectedVariant === variant.key ? "is-active" : ""}`}
                onClick={() => onSelectVariant?.(variant.key)}
              >
                {variant.label}
              </button>
            ))}
          </div>
          <h2>{activeVariant.label}</h2>
          <p>
            Runs the DealerSocket BDC Activity Report for <strong>{latest?.role_name || config.report_name}</strong>,
            sends the condensed table only to your verified self chat <strong>{config.chat_name}</strong>, and keeps a
            local run history for this dashboard.
          </p>

          <div className="sales-analytics-schedule">
            {(config.schedule_times || []).map((time) => (
              <span key={`sales-analytics-schedule-${time}`} className="sales-analytics-chip">
                {time}
              </span>
            ))}
          </div>

          <div className="sales-analytics-hero__meta">
            <span className={`sales-analytics-state is-${String(status.state || "idle").toLowerCase()}`}>
              {statusLabel(status.state)}
            </span>
            <span>Last success: {formatDateTime(status.last_success_at)}</span>
            <span>{runStatusCopy(config, status)}</span>
          </div>
        </div>

        <div className="sales-analytics-hero__actions">
          <button type="button" onClick={onRun} disabled={buttonDisabled}>
            {running ? "Running Manual Pull..." : "Run Manual Pull"}
          </button>
          <button type="button" className="secondary" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh Dashboard"}
          </button>
          <small>
            First local run may pause for DealerSocket MFA or a WhatsApp Web login inside the dedicated Chrome profile.
          </small>
          {feedback ? <div className="sales-analytics-feedback">{feedback}</div> : null}
          {status?.last_error ? <div className="sales-analytics-error">Last error: {status.last_error}</div> : null}
        </div>
      </div>

      {latest ? (
        <>
          <div className="sales-analytics-kpis">
            <article className="sales-analytics-kpi">
              <span>Total Calls</span>
              <strong>{formatNumber(latest?.totals?.calls_cti || 0)}</strong>
              <small>All reps combined on the latest run.</small>
            </article>
            <article className="sales-analytics-kpi">
              <span>Appointments</span>
              <strong>{formatNumber(latest?.totals?.appointments_created || 0)}</strong>
              <small>Appointments created from the latest scrape.</small>
            </article>
            <article className="sales-analytics-kpi">
              <span>Emails Sent</span>
              <strong>{formatNumber(latest?.totals?.emails_sent || 0)}</strong>
              <small>Outbound email volume in the latest run.</small>
            </article>
            <article className="sales-analytics-kpi">
              <span>Texts Sent</span>
              <strong>{formatNumber(latest?.totals?.texts_sent || 0)}</strong>
              <small>Outbound text volume in the latest run.</small>
            </article>
            <article className="sales-analytics-kpi">
              <span>Zero-Call Reps</span>
              <strong>{formatNumber(latest?.totals?.zero_call_reps || 0)}</strong>
              <small>People sitting at zero CTI calls.</small>
            </article>
            <article className="sales-analytics-kpi sales-analytics-kpi--accent">
              <span>Top Calls Rep</span>
              <strong>{latest?.top_calls_rep?.rep || "No data"}</strong>
              <small>{formatNumber(latest?.top_calls_rep?.calls_cti || 0)} calls on the latest run.</small>
            </article>
          </div>

          <div className="sales-analytics-grid">
            <div className="panel sales-analytics-preview">
              <div className="sales-analytics-panel__header">
                <div>
                  <span className="eyebrow">Latest export</span>
                  <h3>WhatsApp-ready screenshot</h3>
                  <p>{formatDateTime(latest.generated_at)}</p>
                </div>
                <div className="sales-analytics-inline-metrics">
                  <span>{latest.dealership}</span>
                  <span>{latest.role_name}</span>
                </div>
              </div>
              {screenshotUrl ? (
                <img className="sales-analytics-preview__image" src={screenshotUrl} alt="Latest BDC activity screenshot" />
              ) : (
                <div className="sales-analytics-empty-inline">No screenshot saved yet.</div>
              )}
            </div>

            <div className="panel sales-analytics-watchlist">
              <div className="sales-analytics-panel__header">
                <div>
                  <span className="eyebrow">Watchlist</span>
                  <h3>Low-activity reps</h3>
                  <p>Bottom three reps plus anybody with zero calls.</p>
                </div>
                <div className={`sales-analytics-delivery is-${latest?.delivery?.whatsapp_status || "unknown"}`}>
                  WhatsApp {latest?.delivery?.whatsapp_status || "unknown"}
                </div>
              </div>

              <div className="sales-analytics-watchlist__list">
                {(latest?.low_performers || []).length ? (
                  latest.low_performers.map((row) => (
                    <article key={`sales-analytics-low-${row.rep}`} className="sales-analytics-watchlist__item">
                      <div>
                        <strong>{row.rep}</strong>
                        <small>
                          {formatNumber(row.calls_cti)} calls | {formatNumber(row.emails_sent)} emails |{" "}
                          {formatNumber(row.texts_sent)} texts
                        </small>
                      </div>
                      <span>{formatNumber(row.appt_created)} appts</span>
                    </article>
                  ))
                ) : (
                  <div className="sales-analytics-empty-inline">No low-activity list was flagged on the latest run.</div>
                )}
              </div>

              <div className="sales-analytics-watchlist__summary">
                <div>
                  <span>Lowest calls rep</span>
                  <strong>{latest?.lowest_calls_rep?.rep || "No data"}</strong>
                  <small>{formatNumber(latest?.lowest_calls_rep?.calls_cti || 0)} calls on the latest run.</small>
                </div>
                <div>
                  <span>Delivery target</span>
                    <strong>{latest?.delivery?.chat_name || config.chat_name || "Me"}</strong>
                  <small>
                    {latest?.delivery?.sent_at
                      ? `Sent ${formatDateTime(latest.delivery.sent_at)}`
                      : latest?.delivery?.error_message || "Pending or not sent yet."}
                  </small>
                </div>
              </div>
            </div>
          </div>

          <div className="panel sales-analytics-table-panel">
            <div className="sales-analytics-panel__header">
              <div>
                <span className="eyebrow">Latest rep board</span>
                <h3>Calls, emails, texts, and appointments by rep</h3>
                <p>The shaded rails make weak spots easy to spot without opening the CRM report.</p>
              </div>
            </div>

            <div className="sales-analytics-table">
              <div className="sales-analytics-table__row sales-analytics-table__row--head">
                <span>Rep</span>
                <span>Calls</span>
                <span>Emails</span>
                <span>Texts</span>
                <span>Appointments</span>
              </div>
              {rows.map((row) => (
                <div
                  key={`sales-analytics-row-${row.rep}`}
                  className={`sales-analytics-table__row ${row.low_activity ? "is-low" : ""}`}
                >
                  <div className="sales-analytics-table__rep">
                    <strong>{row.rep}</strong>
                    <small>Rank #{formatNumber(row.rank || 0)}</small>
                  </div>
                  <div className="sales-analytics-meter">
                    <span className="sales-analytics-meter__value">{formatNumber(row.calls_cti)}</span>
                    <div className="sales-analytics-meter__rail">
                      <span style={{ width: `${metricPercent(row.calls_cti, maxCalls)}%` }} />
                    </div>
                  </div>
                  <div className="sales-analytics-meter is-email">
                    <span className="sales-analytics-meter__value">{formatNumber(row.emails_sent)}</span>
                    <div className="sales-analytics-meter__rail">
                      <span style={{ width: `${metricPercent(row.emails_sent, maxEmails)}%` }} />
                    </div>
                  </div>
                  <div className="sales-analytics-meter is-text">
                    <span className="sales-analytics-meter__value">{formatNumber(row.texts_sent)}</span>
                    <div className="sales-analytics-meter__rail">
                      <span style={{ width: `${metricPercent(row.texts_sent, maxTexts)}%` }} />
                    </div>
                  </div>
                  <div className="sales-analytics-table__appointments">
                    <strong>{formatNumber(row.appt_created)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sales-analytics-grid">
            <div className="panel sales-analytics-history">
              <div className="sales-analytics-panel__header">
                <div>
                  <span className="eyebrow">History graph</span>
                  <h3>Total calls per run</h3>
                  <p>Latest eight snapshots from this local machine.</p>
                </div>
              </div>
              <HistoryBars history={history} />
            </div>

            <div className="panel sales-analytics-history-list">
              <div className="sales-analytics-panel__header">
                <div>
                  <span className="eyebrow">Recent snapshots</span>
                  <h3>Run-by-run totals</h3>
                  <p>Use this to spot whether the team is heating up or falling off across the day.</p>
                </div>
              </div>

              <div className="sales-analytics-history-list__items">
                {history.slice(0, 6).map((run) => (
                  <article key={run.run_id || run.generated_at} className="sales-analytics-history-list__item">
                    <div>
                      <strong>{shortRunLabel(run.generated_at)}</strong>
                      <small>{run.delivery?.whatsapp_status === "sent" ? "WhatsApp sent" : run.delivery?.whatsapp_status || "Unknown delivery"}</small>
                    </div>
                    <div className="sales-analytics-history-list__stats">
                      <span>{formatNumber(run?.totals?.calls_cti || 0)} calls</span>
                      <span>{formatNumber(run?.totals?.appointments_created || 0)} appts</span>
                      <span>{formatNumber(run?.totals?.emails_sent || 0)} emails</span>
                      <span>{formatNumber(run?.totals?.texts_sent || 0)} texts</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="panel sales-analytics-empty">
          <span className="eyebrow">No snapshot yet</span>
          <h3>Run the first BDC activity scrape</h3>
          <p>
            This tab will populate after the first successful run. The runner uses a saved Chrome profile so DealerSocket MFA
            and WhatsApp login only need attention on the first setup pass.
          </p>
        </div>
      )}
    </section>
  );
}
