"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  const controls = { q: $("search"), round: $("round"), topic: $("topic"), location: $("location"), year: $("year"), basis: $("basis"), min: $("minimum") };
  const sortKeys = ["round", "question", "topic", "frequency", "dates", "sources", "locations"];
  let database;
  let reports = new Map();
  let visibleRows = [];
  let sort = { key: "frequency", direction: "desc" };
  let searchTimer;

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

  function dateLabel(date) {
    if (!date) return "Not stated";
    const parts = String(date).split("-");
    if (parts.length === 1) return parts[0];
    const parsed = new Date(`${parts[0]}-${parts[1]}-${parts[2] || "01"}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return String(date);
    return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", ...(parts.length === 3 ? { day: "numeric" } : {}), timeZone: "UTC" }).format(parsed);
  }

  function basisLabel(basis) {
    return basis === "interview" ? "Interview date" : "Publication date";
  }

  function uniqueSorted(items) {
    return [...new Set(items)].sort(collator.compare);
  }

  function sourceFor(question, reportId) {
    return reports.get(reportId) || question.sources.find((source) => source.id === reportId) || { id: reportId, title: reportId };
  }

  function populateSelect(id, values, label = (value) => value) {
    const select = $(id);
    select.replaceChildren(select.options[0]);
    for (const value of uniqueSorted(values)) {
      const option = element("option", label(value));
      option.value = value;
      select.append(option);
    }
  }

  function stateFromControls() {
    const state = Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value]));
    state.min = Math.max(1, Math.floor(Number(state.min) || 1));
    return state;
  }

  function restoreURL() {
    const params = new URLSearchParams(location.search);
    for (const [key, control] of Object.entries(controls)) {
      const value = params.get(key) || (key === "min" ? "1" : "");
      if (control.tagName === "SELECT") {
        control.value = [...control.options].some((option) => option.value === value) ? value : "";
      } else {
        control.value = key === "min" ? String(Math.max(1, Math.floor(Number(value) || 1))) : value;
      }
    }
    const key = params.get("sort");
    sort = { key: sortKeys.includes(key) ? key : "frequency", direction: params.get("dir") === "asc" ? "asc" : "desc" };
  }

  function saveURL(state) {
    const url = new URL(location.href);
    for (const key of [...Object.keys(controls), "sort", "dir"]) url.searchParams.delete(key);
    for (const [key, value] of Object.entries(state)) {
      if (value && !(key === "min" && value === 1)) url.searchParams.set(key, value);
    }
    if (sort.key !== "frequency" || sort.direction !== "desc") {
      url.searchParams.set("sort", sort.key);
      url.searchParams.set("dir", sort.direction);
    }
    try { history.replaceState(null, "", url); } catch { /* Filtering still works when URL updates are unavailable. */ }
  }

  function aggregate(question, occurrences) {
    const reportIds = new Set(occurrences.map((item) => item.reportId));
    const dateMap = new Map();
    for (const item of occurrences) dateMap.set(`${item.date}|${item.dateBasis}`, { date: item.date, basis: item.dateBasis });
    return {
      ...question,
      occurrences,
      frequency: reportIds.size,
      dates: [...dateMap.values()].sort((a, b) => collator.compare(a.date, b.date) || collator.compare(a.basis, b.basis)),
      sources: [...reportIds].map((id) => ({ ...sourceFor(question, id), id })).sort((a, b) => collator.compare(a.title, b.title)),
      locations: uniqueSorted(occurrences.map((item) => item.location || "Not stated")),
    };
  }

  function matchingRows(state) {
    const terms = state.q.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const rows = [];
    for (const question of database.questions) {
      if (state.round && String(question.round) !== state.round) continue;
      if (state.topic && question.topic !== state.topic) continue;
      const questionText = `${question.question} ${question.topic} R${question.round}`.toLocaleLowerCase();
      const occurrences = question.occurrences.filter((item) => {
        if (state.year && !item.date.startsWith(state.year)) return false;
        if (state.location && (item.location || "Not stated") !== state.location) return false;
        if (state.basis && item.dateBasis !== state.basis) return false;
        if (!terms.length) return true;
        const source = sourceFor(question, item.reportId);
        const text = `${questionText} ${item.evidence} ${item.location} ${item.date} ${source.title} ${source.url}`.toLocaleLowerCase();
        return terms.every((term) => text.includes(term));
      });
      if (!occurrences.length) continue;
      const row = aggregate(question, occurrences);
      if (row.frequency >= state.min) rows.push(row);
    }
    return rows;
  }

  function sortValue(row, key) {
    if (key === "dates") return row.dates.at(-1)?.date || "";
    if (key === "sources") return row.sources.map((source) => source.title).join("; ");
    if (key === "locations") return row.locations.join("; ");
    return row[key];
  }

  function sortRows(rows) {
    const direction = sort.direction === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const left = sortValue(a, sort.key);
      const right = sortValue(b, sort.key);
      const result = typeof left === "number" && typeof right === "number" ? left - right : collator.compare(left, right);
      return result * direction || a.round - b.round || collator.compare(a.question, b.question) || collator.compare(a.id, b.id);
    });
    for (const header of document.querySelectorAll("th[data-sort]")) {
      const active = header.dataset.sort === sort.key;
      header.setAttribute("aria-sort", active ? (sort.direction === "asc" ? "ascending" : "descending") : "none");
      header.querySelector("span").textContent = active ? (sort.direction === "asc" ? "↑" : "↓") : "↕";
    }
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

  function evidenceView(row) {
    const details = element("details", null, "evidence");
    details.append(element("summary", `View evidence · ${row.occurrences.length} occurrence${row.occurrences.length === 1 ? "" : "s"}`));
    details.addEventListener("toggle", () => {
      if (!details.open || details.dataset.loaded) return;
      details.dataset.loaded = "true";
      for (const occurrence of row.occurrences) {
        const source = sourceFor(row, occurrence.reportId);
        const article = element("article", null, "evidence-item");
        const heading = element("h3");
        heading.append(safeLink(source.title || occurrence.reportId, source.url));
        article.append(heading, element("p", `Round ${row.round} · ${dateLabel(occurrence.date)} · ${basisLabel(occurrence.dateBasis)} · ${occurrence.location || "Not stated"}`), element("blockquote", occurrence.evidence));
        if (occurrence.reportedQuestion && occurrence.reportedQuestion !== row.question) article.append(element("p", `Reported prompt: ${occurrence.reportedQuestion}`));
        if (occurrence.sourceRound) article.append(element("p", `Original label: ${occurrence.sourceRound}`, "date-basis"));
        if (occurrence.roundMappingNote) article.append(element("p", occurrence.roundMappingNote, "date-basis"));
        if (source.stageEvidence) {
          const context = element("details", null, "source-context");
          context.append(element("summary", "Role, stage & source context"), element("blockquote", source.stageEvidence));
          context.append(element("p", `Reported role: ${source.role || "Not stated"}. Interview: ${dateLabel(source.interviewDate)}. Published: ${dateLabel(source.publishedDate)}.`));
          if (source.verification) context.append(element("p", source.verification));
          if (source.dateEvidence) context.append(element("p", `Date evidence: ${source.dateEvidence}`));
          if (source.locationEvidence) context.append(element("p", `Country evidence: ${source.locationEvidence}`));
          if (source.archiveRetrievalUrl && source.archiveRetrievalUrl !== source.retrievedVia) context.append(safeLink("Archive verification", source.archiveRetrievalUrl));
          if (source.retrievedVia && source.retrievedVia !== source.url) context.append(safeLink("Retrieval copy", source.retrievedVia));
          article.append(context);
        }
        details.append(article);
      }
    });
    return details;
  }

  function renderRows(rows) {
    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const tr = element("tr");
      const round = element("td");
      round.append(element("span", `R${row.round}`, "round-badge"));
      const question = element("td");
      question.append(element("p", row.question, "question-text"), evidenceView(row));
      const topic = element("td");
      topic.append(element("span", row.topic, "topic-label"));
      const frequency = element("td");
      frequency.append(element("span", row.frequency, "frequency-value"), element("span", row.frequency === 1 ? "report" : "reports", "frequency-unit"));
      const dates = element("td");
      dates.append(list(row.dates, (item) => {
        const wrapper = element("div");
        const time = element("time", dateLabel(item.date), "date-value");
        time.dateTime = item.date;
        wrapper.append(time, element("span", basisLabel(item.basis), "date-basis"));
        return wrapper;
      }));
      const sources = element("td");
      sources.append(list(row.sources, (source) => safeLink(source.title || source.id, source.url)));
      const locations = element("td");
      locations.append(list(row.locations, (location) => element("span", location)));
      tr.append(round, question, topic, frequency, dates, sources, locations);
      fragment.append(tr);
    }
    $("question-rows").replaceChildren(fragment);
  }

  function render(updateURL = true) {
    if (!database) return;
    const state = stateFromControls();
    visibleRows = matchingRows(state);
    sortRows(visibleRows);
    renderRows(visibleRows);
    const reportIds = new Set();
    const locations = new Set();
    let occurrenceCount = 0;
    for (const row of visibleRows) {
      for (const item of row.occurrences) {
        reportIds.add(item.reportId);
        if (item.location && item.location !== "Not stated") locations.add(item.location);
        occurrenceCount += 1;
      }
    }
    $("stat-questions").textContent = visibleRows.length.toLocaleString();
    $("stat-reports").textContent = reportIds.size.toLocaleString();
    $("stat-occurrences").textContent = occurrenceCount.toLocaleString();
    $("stat-locations").textContent = locations.size.toLocaleString();
    $("result-summary").textContent = `${visibleRows.length.toLocaleString()} of ${database.questions.length.toLocaleString()} question–round pairs · ${reportIds.size.toLocaleString()} distinct reports`;
    $("question-table").hidden = !visibleRows.length;
    $("empty-state").hidden = !!visibleRows.length;
    $("table-hint").hidden = !visibleRows.length;
    $("export-csv").disabled = !visibleRows.length;
    $("reset").disabled = false;
    if (updateURL) saveURL(state);
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

  function downloadCSV() {
    if (!visibleRows.length) return;
    const escape = (value) => {
      let text = String(value ?? "");
      // Prevent spreadsheet formula execution when opening untrusted source text.
      if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const records = [["Round", "Question", "Topic", "Frequency", "Dates", "Sources", "Locations"]];
    for (const row of visibleRows) records.push([
      `R${row.round}`, row.question, row.topic, row.frequency,
      row.dates.map((item) => `${item.date} (${item.basis})`).join("; "),
      row.sources.map((source) => `${source.title} — ${source.url}`).join("; "),
      row.locations.join("; "),
    ]);
    const csv = "\uFEFF" + records.map((record) => record.map(escape).join(",")).join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = element("a");
    link.href = url;
    link.download = "amazon-sde2-filtered-questions.csv";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function reset() {
    clearTimeout(searchTimer);
    for (const [key, control] of Object.entries(controls)) control.value = key === "min" ? "1" : "";
    sort = { key: "frequency", direction: "desc" };
    render();
  }

  async function load() {
    $("load-error").hidden = true;
    $("results").setAttribute("aria-busy", "true");
    $("result-summary").textContent = "Loading the research database…";
    $("retry").disabled = true;
    try {
      const response = await fetch("data/database.json");
      if (!response.ok) throw new Error(`Database request returned HTTP ${response.status}.`);
      const data = await response.json();
      if (!data.metadata || !Array.isArray(data.questions) || !Array.isArray(data.reports) || !Array.isArray(data.coverage)) throw new Error("The database does not match the documented viewer format.");
      database = data;
      reports = new Map(database.reports.map((report) => [report.id, report]));
      const occurrences = database.questions.flatMap((question) => question.occurrences);
      populateSelect("round", database.questions.map((question) => String(question.round)), (value) => `Round ${value}`);
      populateSelect("topic", database.questions.map((question) => question.topic));
      populateSelect("location", occurrences.map((item) => item.location || "Not stated"));
      populateSelect("year", occurrences.map((item) => item.date.slice(0, 4)));
      $("date-window").textContent = `${dateLabel(data.metadata.startDate)} – ${dateLabel(data.metadata.endDate)} · Rounds 1–4`;
      if (data.metadata.disclaimer) $("disclaimer").textContent = data.metadata.disclaimer;
      if (data.metadata.frequencyDefinition) $("frequency-definition").textContent = data.metadata.frequencyDefinition;
      if (data.metadata.generatedAt) $("generated-at").textContent = `Database generated ${dateLabel(data.metadata.generatedAt.slice(0, 10))}`;
      coverageView(data.coverage);
      restoreURL();
      render(false);
      $("filter-fields").disabled = false;
    } catch (error) {
      database = undefined;
      visibleRows = [];
      $("filter-fields").disabled = true;
      $("reset").disabled = true;
      $("export-csv").disabled = true;
      $("question-table").hidden = true;
      $("empty-state").hidden = true;
      $("table-hint").hidden = true;
      $("load-error").hidden = false;
      $("error-message").textContent = `${error.message} Serve this repository over HTTP rather than opening index.html as a local file, and ensure the generated data/database.json is present.`;
      $("result-summary").textContent = "Database unavailable";
    } finally {
      $("results").setAttribute("aria-busy", "false");
      $("retry").disabled = false;
    }
  }

  $("filters").addEventListener("submit", (event) => event.preventDefault());
  controls.q.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => render(), 120); });
  for (const [key, control] of Object.entries(controls)) {
    if (key !== "q") control.addEventListener(key === "min" ? "input" : "change", () => render());
  }
  controls.min.addEventListener("change", () => { controls.min.value = stateFromControls().min; render(); });
  for (const header of document.querySelectorAll("th[data-sort]")) {
    header.querySelector("button").addEventListener("click", () => {
      const key = header.dataset.sort;
      sort = { key, direction: sort.key === key && sort.direction === "asc" ? "desc" : sort.key === key ? "asc" : key === "frequency" || key === "dates" ? "desc" : "asc" };
      render();
    });
  }
  $("reset").addEventListener("click", reset);
  $("empty-reset").addEventListener("click", reset);
  $("export-csv").addEventListener("click", downloadCSV);
  $("retry").addEventListener("click", load);
  window.addEventListener("popstate", () => { if (database) { restoreURL(); render(false); } });
  load();
})();
