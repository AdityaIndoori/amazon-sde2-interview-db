"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  let campaigns;
  let research;
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  function safeLink(label, url) {
    let target;
    try {
      target = new URL(url);
      if (!["https:", "http:"].includes(target.protocol)) return element("span", label);
    } catch {
      return element("span", label);
    }
    const link = element("a", label);
    link.href = target.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = `${label} (opens in a new tab)`;
    return link;
  }

  function artifactLink(path) {
    if (typeof path !== "string" || !/^[a-zA-Z0-9_./-]+$/.test(path) || path.startsWith("/") || path.split("/").some(part => !part || part === "." || part === "..")) return element("span", "Evidence artifact unavailable: unsafe path");
    return safeLink(path, new URL(path, new URL("./", location.href)).href);
  }

  function dateLabel(date) {
    if (!date) return "Not stated";
    const parts = String(date).split("-");
    if (parts.length === 1) return parts[0];
    const parsed = new Date(`${parts[0]}-${parts[1]}-${parts[2] || "01"}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return String(date);
    return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", ...(parts.length === 3 ? { day: "numeric" } : {}), timeZone: "UTC" }).format(parsed);
  }

  function uniqueSorted(items) {
    return [...new Set(items)].sort(collator.compare);
  }

  function list(items, renderItem) {
    const ul = element("ul", null, "cell-list");
    for (const item of items) {
      const li = element("li");
      li.append(renderItem(item));
      ul.append(li);
    }
    return ul;
  }

  function coverageView(coverage) {
    const container = $("coverage-content");
    container.replaceChildren();
    let queryCount = 0;
    let excludedCount = 0;
    for (const slice of coverage) {
      queryCount += slice.queries.length;
      excludedCount += slice.excluded.length;
      const section = element("section", null, "coverage-slice");
      section.append(element("h3", slice.slice));
      if (slice.searchedAt) section.append(element("p", `Searched ${dateLabel(slice.searchedAt)}`));
      if (slice.limitations.length) section.append(list(slice.limitations, (text) => element("span", text)));
      const queries = element("details");
      queries.append(element("summary", `${slice.queries.length} documented search queries`), list(slice.queries, (text) => element("span", text)));
      const exclusions = element("details");
      exclusions.append(element("summary", `${slice.excluded.length} excluded or uncertain sources`), list(slice.excluded, (item) => {
        const wrapper = element("div");
        wrapper.append(safeLink(item.title || item.url || "Source", item.url), element("div", item.reason));
        return wrapper;
      }));
      section.append(queries, exclusions);
      container.append(section);
    }
    if (!coverage.length) container.append(element("p", "No search coverage entries are present in this database."));
    $("coverage-summary").textContent = `${queryCount} queries · ${excludedCount} exclusions`;
  }

  function renderLedger() {
    if (!campaigns) return;
    const country = $("ledger-country").value;
    const status = $("ledger-status").value;
    const matches = campaigns.filter(campaign => (!country || campaign.country === country) && (!status || campaign.status === status));
    const outcomes = {
      "admitted-evidence": "Admitted evidence",
      "no-candidates-returned": "No candidates returned · not evidence of absence",
      "inspected-no-admissions": "Inspected sources · no admissions",
      unresolved: "Unresolved leads",
      failed: "Search failed · no coverage conclusion",
    };
    const fragment = document.createDocumentFragment();
    for (const campaign of matches) {
      const row = element("tr");
      const scope = element("td");
      scope.append(element("strong", campaign.country), element("p", `${dateLabel(campaign.startDate)} – ${dateLabel(campaign.endDate)}`), element("span", campaign.id, "date-basis"));
      const execution = element("td");
      execution.append(element("strong", campaign.status === "failed" ? "Failed" : "Completed"), element("p", campaign.provider), element("p", `Searched at ${campaign.searchedAt}`));
      const outcome = element("td");
      outcome.append(element("p", outcomes[campaign.outcome] || campaign.outcome));
      if (campaign.error) outcome.append(element("p", `Error: ${campaign.error}`));
      const evidence = element("td");
      const details = element("details", null, "evidence");
      details.append(element("summary", `${campaign.queries.length} queries · ${campaign.sources.length} sources`));
      details.append(element("h4", "Search queries"), list(campaign.queries, query => element("span", query)));
      const artifact = element("p", "Evidence artifact: ");
      artifact.append(artifactLink(campaign.artifact));
      details.append(artifact, element("h4", "Source dispositions"));
      if (!campaign.sources.length) details.append(element("p", "No source dispositions recorded. This does not establish that no relevant interviews exist."));
      details.append(list(campaign.sources, source => {
        const item = element("div");
        item.append(safeLink(source.url, source.url), element("p", `Disposition: ${source.disposition}`), element("p", source.reason));
        if (source.reportId) item.append(element("p", `Report: ${source.reportId}`));
        return item;
      }));
      evidence.append(details);
      row.append(scope, execution, outcome, evidence);
      fragment.append(row);
    }
    $("ledger-rows").replaceChildren(fragment);
    $("ledger-results").hidden = !matches.length;
    $("ledger-summary").textContent = !campaigns.length
      ? "No structured campaigns have been recorded. Historical search notes below do not imply exhaustive coverage."
      : !matches.length ? "No documented campaigns match these ledger filters. This is not evidence that no interviews occurred."
        : `${matches.length} of ${campaigns.length} documented campaigns · scope is research activity, not interview coverage`;
  }

  function renderQueue() {
    if (!research) return;
    const status = $("queue-status").value;
    const matches = research.queue.filter(candidate => !status || candidate.status === status);
    $("queue-records").replaceChildren(...matches.map(candidate => {
      const article = element("article", null, "research-record");
      const heading = element("h4");
      heading.append(safeLink(candidate.title || candidate.url, candidate.url));
      article.append(heading, element("p", `${candidate.status} · Discovered ${candidate.discoveredAt}${candidate.publishedDate ? ` · Published ${candidate.publishedDate}` : ""}`), element("p", `Candidate: ${candidate.id}`, "record-reference"));
      if (candidate.reason) article.append(element("p", candidate.reason));
      if (candidate.reportId) article.append(element("p", `Admitted report reference: ${candidate.reportId}`, "record-reference"));
      article.append(element("p", `Discovery runs: ${candidate.runIds.join(", ")}`, "record-reference"));
      return article;
    }));
    $("queue-summary").textContent = `${matches.length} of ${research.queue.length} review candidates${matches.length ? "" : " · No candidates match this status"}. Queue entries are not question counts.`;
  }

  async function loadResearch() {
    try {
      const data = await fetchData("data/research-status.json");
      if (!data || typeof data.cutoff !== "string" || !Array.isArray(data.queue) || !Array.isArray(data.runs) || !Array.isArray(data.history)
        || !data.queue.every(item => item && typeof item.id === "string" && typeof item.url === "string" && ["pending", "rejected", "duplicate", "accepted"].includes(item.status) && Array.isArray(item.runIds))
        || !data.runs.every(item => item && typeof item.id === "string" && Array.isArray(item.queries))
        || !data.history.every(item => item && typeof item.id === "string" && Array.isArray(item.changes) && item.changes.every(change => change && typeof change.id === "string" && typeof change.collection === "string"))) throw new Error("The research status does not match the documented format.");
      research = data;
      $("research-watermark").textContent = `Last successful research: ${data.lastResearchedAt || "None recorded"} · Corpus cutoff: ${dateLabel(data.cutoff)}`;
      $("research-status").textContent = `Last research attempt: ${data.lastAttemptedAt || "None recorded"}. Failed attempts do not advance the successful research date. The corpus cutoff is separate from discovery activity.`;
      renderQueue();
      $("discovery-runs").replaceChildren(...data.runs.slice().reverse().map(run => {
        const article = element("article", null, "research-record");
        article.append(element("h4", `${run.status} · ${run.id}`), element("p", `Started ${run.startedAt}${run.completedAt ? ` · Completed ${run.completedAt}` : ""}`), element("p", `Search scope: ${run.country} · ${run.startDate} – ${run.endDate}`));
        if (run.error) article.append(element("p", `Failure: ${run.error}`));
        const queries = element("details", null, "evidence");
        queries.append(element("summary", `${run.queries.length} search queries`), list(run.queries, query => element("span", query)));
        article.append(queries);
        if (run.artifact) article.append(artifactLink(run.artifact));
        return article;
      }));
      if (!data.runs.length) $("discovery-runs").append(element("p", "No incremental discovery runs recorded."));
      $("record-history").replaceChildren(...data.history.slice().reverse().map(release => {
        const article = element("article", null, "research-record");
        article.append(element("h4", `${release.date} · ${release.summary}`), element("p", `Release: ${release.id}`, "record-reference"));
        if (!release.changes.length) article.append(element("p", "No record-level changes in this release."));
        else {
          const changes = element("details", null, "evidence");
          changes.append(element("summary", `${release.changes.length} record changes`));
          changes.addEventListener("toggle", () => {
            if (!changes.open || changes.dataset.loaded) return;
            changes.dataset.loaded = "true";
          for (const change of release.changes) {
            const record = element("div", null, "history-change");
            record.append(element("p", `${change.type} · ${change.collection} · ${change.id}`, "record-reference"));
            if (change.fields?.length) record.append(element("p", `Changed fields: ${change.fields.join(", ")}`));
            if (["strict", "unconfirmed"].includes(change.collection) && change.type !== "removed") {
              const url = new URL("./", location.href);
              url.searchParams.set("view", change.collection);
              url.searchParams.set("q", change.id);
              record.append(safeLink("Find current record", url.href));
            }
            for (const key of ["before", "after"]) {
              if (change[key] === undefined) continue;
              const snapshot = element("details", null, "evidence");
              snapshot.append(element("summary", key === "before" ? "Before" : "After"), element("pre", JSON.stringify(change[key], null, 2)));
              record.append(snapshot);
            }
            changes.append(record);
          }
          });
          article.append(changes);
        }
        return article;
      }));
      if (!data.history.length) $("record-history").append(element("p", "No record releases recorded."));
      $("research-content").hidden = false;
    } catch (error) {
      research = undefined;
      $("research-content").hidden = true;
      $("research-watermark").textContent = `Last successful research: unavailable · Corpus cutoff: ${dateLabel("2026-09-13")}`;
      $("research-status").textContent = `Optional research status unavailable: ${error.message} Questions remain independently available. Reload the page to retry.`;
    }
  }

  async function fetchData(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}.`);
    return response.json();
  }

  async function loadLedger() {
    try {
      const data = await fetchData("data/research-ledger.json");
      if (!Array.isArray(data?.campaigns) || !data.campaigns.every(campaign => campaign && Array.isArray(campaign.queries) && Array.isArray(campaign.sources) && campaign.sources.every(source => source && typeof source.url === "string"))) throw new Error("The ledger does not match the documented format.");
      campaigns = data.campaigns;
      $("ledger-country").replaceChildren(new Option("All countries", ""), ...uniqueSorted(campaigns.map(campaign => campaign.country)).map(country => new Option(country, country)));
      $("ledger-filters").disabled = false;
      renderLedger();
    } catch (error) {
      campaigns = undefined;
      $("ledger-filters").disabled = true;
      $("ledger-results").hidden = true;
      $("ledger-summary").textContent = `Research ledger unavailable: ${error.message} No coverage conclusion can be drawn. Reload the page to retry.`;
    }
  }

  async function loadCoverage() {
    try {
      const data = await fetchData("data/database.json");
      coverageView(data.coverage);
      $("disclaimer").textContent = data.metadata.disclaimer;
      $("date-window").textContent = `${dateLabel(data.metadata.startDate)} – ${dateLabel(data.metadata.endDate)}`;
    } catch (error) {
      $("coverage-content").textContent = `Search notes unavailable: ${error.message}`;
    }
  }
  $("ledger-country").addEventListener("change", renderLedger);
  $("ledger-status").addEventListener("change", renderLedger);
  $("queue-status").addEventListener("change", renderQueue);
  loadLedger();
  loadCoverage();
  loadResearch();
})();
