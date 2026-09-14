"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
  const controls = { q: $("search"), round: $("round"), topic: $("topic"), category: $("category"), quality: $("quality"), location: $("location"), year: $("year"), basis: $("basis"), min: $("minimum"), personal: $("personal") };
  const sortKeys = ["round", "question", "topic", "frequency", "dates", "sources", "locations"];
  let database;
  const collections = {};
  let view = "all";
  let reports = new Map();
  let visibleRows = [];
  let sort = { key: "frequency", direction: "desc" };
  let searchTimer;
  const qualityLabels = { "exact-named": "Exact named", described: "Described", partial: "Partial" };
  const studyKey = "interview-fieldnotes.study.v1";
  let study = { version: 1, marks: Object.create(null), views: [] };
  let storageAvailable = true;

  function storageNotice(message) {
    storageAvailable = false;
    $("storage-notice").hidden = false;
    $("storage-notice").textContent = `${message} Changes are session-only and will be lost on reload. No study data is uploaded.`;
  }

  function publicQuery(query) {
    const input = new URLSearchParams(query);
    const output = new URLSearchParams();
    for (const key of [...Object.keys(controls).filter(key => key !== "personal"), "view", "sort", "dir"]) {
      for (const value of input.getAll(key)) output.append(key, value);
    }
    return output.size ? `?${output}` : "";
  }

  function readStudy() {
    try {
      const stored = localStorage.getItem(studyKey);
      if (!stored) return;
      const data = JSON.parse(stored);
      if (data?.version !== 1 || !data.marks || typeof data.marks !== "object" || Array.isArray(data.marks) || !Array.isArray(data.views)) throw new Error("Unrecognized study data");
      const marks = Object.create(null);
      for (const [key, value] of Object.entries(data.marks)) {
        const identity = JSON.parse(key);
        if (!Array.isArray(identity) || identity.length !== 2 || !["strict", "unconfirmed"].includes(identity[0]) || typeof identity[1] !== "string" || !value || typeof value !== "object" || typeof value.bookmarked !== "boolean" || typeof value.practiced !== "boolean") throw new Error("Invalid study mark");
        marks[key] = { bookmarked: value.bookmarked, practiced: value.practiced };
      }
      const views = [];
      for (const item of data.views) {
        if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.length > 80 || typeof item.query !== "string" || (item.query && !item.query.startsWith("?"))) throw new Error("Invalid saved filter set");
        if (!views.some(saved => saved.name === item.name)) views.push({ name: item.name, query: publicQuery(item.query) });
      }
      study = { version: 1, marks, views };
    } catch {
      storageNotice("Local study storage could not be read safely. Existing stored data has not been changed.");
    }
  }

  function persistStudy() {
    if (!storageAvailable) return;
    try { localStorage.setItem(studyKey, JSON.stringify(study)); }
    catch { storageNotice("This browser could not save local study data."); }
  }

  function markKey(row) { return JSON.stringify([row.round === null ? "unconfirmed" : "strict", row.id]); }

  function renderSavedViews(selected = $("saved-view").value) {
    $("saved-view").replaceChildren(new Option(study.views.length ? "Choose a saved filter set" : "No saved filter sets", ""), ...study.views.map((item, index) => new Option(item.name, String(index))));
    $("saved-view").value = selected;
    updateSavedActions();
  }

  function updateSavedActions() {
    const selected = $("saved-view").value;
    const available = selected !== "" && !!study.views[Number(selected)];
    $("load-view").disabled = !database || !available;
    $("delete-view").disabled = !available;
  }

  function studyActions(row) {
    const group = element("div", null, "study-actions");
    const identity = markKey(row);
    for (const [key, label] of [["bookmarked", "Bookmark"], ["practiced", "Practiced"]]) {
      const button = element("button", label, "study-toggle");
      button.type = "button";
      button.dataset.mark = key;
      button.dataset.identity = identity;
      button.setAttribute("aria-label", `${label}: ${row.question}`);
      button.setAttribute("aria-pressed", String(!!study.marks[identity]?.[key]));
      button.addEventListener("click", () => {
        const previous = study.marks[identity] || { bookmarked: false, practiced: false };
        study.marks[identity] = { ...previous, [key]: !previous[key] };
        if (!study.marks[identity].bookmarked && !study.marks[identity].practiced) delete study.marks[identity];
        persistStudy();
        const personal = controls.personal.value;
        if ((key === "bookmarked" && personal === "bookmarked") || (key === "practiced" && ["practiced", "not-practiced"].includes(personal))) render();
        else button.setAttribute("aria-pressed", String(!!study.marks[identity]?.[key]));
      });
      group.append(button);
    }
    return group;
  }

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


  function roundLabel(round) {
    return round === null ? "Unconfirmed" : `R${round}`;
  }

  function selectCollection(nextView) {
    view = nextView === "strict" || !collections.unconfirmed ? "strict" : nextView === "unconfirmed" ? "unconfirmed" : "all";
    database = collections[view];
    if (!database) return;
    reports = new Map(database.reports.map(report => [report.id, report]));
    $("collection-switch").value = view;
    $("collection-note").textContent = "";
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
    const source = view === "all" ? collections.all.sourceReports[question.round === null ? "unconfirmed" : "strict"].get(reportId) : reports.get(reportId);
    return source || question.sources.find((item) => item.id === reportId) || { id: reportId, title: reportId };
  }

  function populateChoices(id, values, label = (value) => value) {
    const control = $(id);
    const options = control.querySelector(".filter-options");
    options.replaceChildren(options.querySelector("legend"));
    const clear = element("button", "Clear selection", "filter-clear");
    clear.type = "button";
    clear.addEventListener("click", () => {
      for (const input of options.querySelectorAll("input")) input.checked = false;
      render();
    });
    options.append(clear);
    for (const value of uniqueSorted(values)) {
      const row = element("label");
      const input = element("input");
      input.type = "checkbox";
      input.name = id;
      input.value = value;
      row.append(input, element("span", label(value)));
      options.append(row);
    }
  }

  function stateFromControls() {
    const state = Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.hasAttribute("data-multiple") ? [...control.querySelectorAll("input:checked")].map(input => input.value) : control.value]));
    state.min = Math.max(1, Math.floor(Number(state.min) || 1));
    return state;
  }

  function restoreURL(search = location.search) {
    const params = new URLSearchParams(search);
    selectCollection(params.get("view"));
    for (const [key, control] of Object.entries(controls)) {
      if (key === "personal") { control.value = ""; continue; }
      const value = params.get(key) || (key === "min" ? "1" : "");
      if (control.hasAttribute("data-multiple")) {
        const selected = new Set(params.getAll(key));
        for (const input of control.querySelectorAll("input")) input.checked = selected.has(input.value);
      } else {
        control.value = key === "min" ? String(Math.max(1, Math.floor(Number(value) || 1))) : value;
      }
    }
    const key = params.get("sort");
    sort = { key: sortKeys.includes(key) ? key : "frequency", direction: params.get("dir") === "asc" ? "asc" : "desc" };
  }

  function publicURL(state = stateFromControls()) {
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set("view", view);
    for (const [key, value] of Object.entries(state)) {
      if (key === "personal") continue;
      if (Array.isArray(value)) {
        for (const selected of value) url.searchParams.append(key, selected);
      } else if (value && !(key === "min" && value === 1)) url.searchParams.set(key, value);
    }
    if (sort.key !== "frequency" || sort.direction !== "desc") {
      url.searchParams.set("sort", sort.key);
      url.searchParams.set("dir", sort.direction);
    }
    return url;
  }

  function saveURL(state) {
    const url = publicURL(state);
    url.hash = location.hash;
    try { history.replaceState(null, "", url); } catch { /* Filtering still works when URL updates are unavailable. */ }
  }

  function aggregate(question, occurrences) {
    const reportIds = new Set(occurrences.map((item) => item.reportId));
    const dateMap = new Map();
    for (const item of occurrences) dateMap.set(`${item.date}|${item.dateBasis}`, { date: item.date, basis: item.dateBasis });
    return {
      ...question,
      occurrences,
      evidenceQualities: uniqueSorted(occurrences.map(item => item.evidenceQuality)),
      practiceLinks: uniqueSorted(occurrences.filter(item => item.evidenceQuality === "exact-named" && item.problemUrl && item.problemEvidence).map(item => item.problemUrl)),
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
      if (state.round.length && !state.round.includes(question.round === null ? "unconfirmed" : String(question.round))) continue;
      if (state.topic.length && !state.topic.includes(question.topic)) continue;
      if (state.category.length && !state.category.includes(question.category)) continue;
      const mark = study.marks[markKey(question)];
      if (state.personal === "bookmarked" && !mark?.bookmarked) continue;
      if (state.personal === "practiced" && !mark?.practiced) continue;
      if (state.personal === "not-practiced" && mark?.practiced) continue;
      const questionText = `${question.id} ${question.question} ${question.topic} ${question.category} ${roundLabel(question.round)}`.toLocaleLowerCase();
      const occurrences = question.occurrences.filter((item) => {
        if (state.year.length && !state.year.includes(item.date.slice(0, 4))) return false;
        if (state.location.length && !state.location.includes(item.location || "Not stated")) return false;
        if (state.basis.length && !state.basis.includes(item.dateBasis)) return false;
        if (state.quality.length && !state.quality.includes(item.evidenceQuality)) return false;
        if (!terms.length) return true;
        const source = sourceFor(question, item.reportId);
        const text = `${questionText} ${item.reportId} ${item.evidence} ${item.roundUncertainty || ""} ${item.roundMappingNote || ""} ${item.location} ${item.date} ${source.title} ${source.url}`.toLocaleLowerCase();
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
    details.append(element("summary", "Evidence & context"));
    details.addEventListener("toggle", () => {
      if (!details.open || details.dataset.loaded) return;
      details.dataset.loaded = "true";
      for (const occurrence of row.occurrences) {
        const source = sourceFor(row, occurrence.reportId);
        const article = element("article", null, "evidence-item");
        const heading = element("h3");
        heading.append(safeLink(source.title || occurrence.reportId, source.url));
        article.append(heading, element("p", `${row.round === null ? "Round unconfirmed" : `Round ${row.round}`} · ${dateLabel(occurrence.date)} · ${basisLabel(occurrence.dateBasis)} · ${occurrence.location || "Not stated"}`), element("blockquote", occurrence.evidence));
        article.append(element("span", qualityLabels[occurrence.evidenceQuality] || "Quality unavailable", `quality-badge quality-${occurrence.evidenceQuality}`), element("p", occurrence.qualityReason || "No evidence assessment is available."));
        if (occurrence.evidenceQuality === "exact-named" && occurrence.problemUrl && occurrence.problemEvidence) {
          const practice = element("p");
          practice.append(safeLink("Practice this exact named problem", occurrence.problemUrl));
          article.append(practice, element("p", `Practice-link evidence: ${occurrence.problemEvidence}`));
        }
        if (occurrence.reportedQuestion && occurrence.reportedQuestion !== row.question) article.append(element("p", `Reported prompt: ${occurrence.reportedQuestion}`));
        if (occurrence.sourceRound) article.append(element("p", `Original label: ${occurrence.sourceRound}`, "date-basis"));
        if (row.round === null) article.append(element("p", `Why the round is unconfirmed: ${occurrence.roundUncertainty || occurrence.roundMappingNote}`, "round-uncertainty"));
        else if (occurrence.roundMappingNote) article.append(element("p", occurrence.roundMappingNote, "date-basis"));
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
    const active = document.activeElement;
    const focusedMark = active?.dataset.mark;
    const focusedIdentity = active?.dataset.identity;
    const oldButtons = [...$("question-rows").querySelectorAll("button[data-mark]")];
    const focusedIndex = oldButtons.indexOf(active);
    const openEvidence = new Set([...$("question-rows").querySelectorAll("tr[data-identity]")].filter(tr => tr.querySelector(".evidence")?.open).map(tr => tr.dataset.identity));
    for (const row of rows) {
      const tr = element("tr");
      tr.dataset.identity = markKey(row);
      const round = element("td");
      round.append(element("span", roundLabel(row.round), "round-badge"));
      const question = element("td");
      const badges = element("div", null, "quality-badges");
      for (const quality of row.evidenceQualities) badges.append(element("span", qualityLabels[quality] || "Quality unavailable", `quality-badge quality-${quality}`));
      const evidence = evidenceView(row);
      evidence.open = openEvidence.has(markKey(row));
      question.append(element("p", row.question, "question-text"), badges, studyActions(row));
      if (row.practiceLinks.length) question.append(list(row.practiceLinks, url => safeLink("Practice exact named problem", url)));
      const topic = element("td");
      topic.append(element("span", row.category, "category-label"), element("span", row.topic, "topic-label"));
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
      sources.append(list(row.sources, (source) => safeLink(source.title || source.id, source.url)), evidence);
      const locations = element("td");
      locations.append(list(row.locations, (location) => element("span", location)));
      tr.append(round, question, topic, frequency, dates, sources, locations);
      fragment.append(tr);
    }
    $("question-rows").replaceChildren(fragment);
    if (focusedMark) {
      const buttons = [...$("question-rows").querySelectorAll("button[data-mark]")];
      const same = buttons.find(button => button.dataset.identity === focusedIdentity && button.dataset.mark === focusedMark);
      (same || buttons[Math.min(focusedIndex, buttons.length - 1)] || controls.personal).focus({ preventScroll: true });
    }
  }

  function render(updateURL = true) {
    if (!database) return;
    const state = stateFromControls();
    for (const control of Object.values(controls)) {
      if (!control.hasAttribute("data-multiple")) continue;
      const selected = [...control.querySelectorAll("input:checked")].map(input => input.nextElementSibling.textContent);
      control.querySelector(".selection-label").textContent = selected.length === 0 ? control.dataset.all : selected.length <= 2 ? selected.join(", ") : `${selected.length} selected`;
      control.querySelector(".filter-clear").disabled = selected.length === 0;
    }
    const advancedCount = ["topic", "quality", "location", "year", "basis"].filter(key => state[key].length).length + Number(state.min > 1);
    document.querySelector(".advanced-filters > summary").textContent = advancedCount ? `More filters · ${advancedCount} active` : "More filters";
    visibleRows = matchingRows(state);
    sortRows(visibleRows);
    renderRows(visibleRows);
    const reportIds = new Set();
    for (const row of visibleRows) {
      for (const item of row.occurrences) {
        reportIds.add(item.reportId);
      }
    }
    $("result-summary").textContent = `${view === "all" ? "All collections" : view === "unconfirmed" ? "Round unconfirmed" : "Round verified"} · ${visibleRows.length.toLocaleString()} of ${database.questions.length.toLocaleString()} ${view === "all" ? "question entries" : view === "unconfirmed" ? "questions" : "question–round pairs"} · ${reportIds.size.toLocaleString()} distinct reports`;
    $("question-table").hidden = !visibleRows.length;
    $("empty-state").hidden = !!visibleRows.length;
    $("table-hint").hidden = !visibleRows.length;
    $("export-csv").disabled = !visibleRows.length;
    $("reset").disabled = false;
    if (updateURL) saveURL(state);
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
      roundLabel(row.round), row.question, row.topic, row.frequency,
      row.dates.map((item) => `${item.date} (${item.basis})`).join("; "),
      row.sources.map((source) => `${source.title} — ${source.url}`).join("; "),
      row.locations.join("; "),
    ]);
    const csv = "\uFEFF" + records.map((record) => record.map(escape).join(",")).join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = element("a");
    link.href = url;
    link.download = `amazon-sde2-${view === "all" ? "all" : view === "unconfirmed" ? "unconfirmed" : "round-verified"}-filtered-questions.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function reset() {
    clearTimeout(searchTimer);
    for (const [key, control] of Object.entries(controls)) {
      if (control.hasAttribute("data-multiple")) {
        for (const input of control.querySelectorAll("input")) input.checked = false;
      } else control.value = key === "min" ? "1" : "";
    }
    sort = { key: "frequency", direction: "desc" };
    render();
  }


  async function fetchData(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}.`);
    return response.json();
  }

  function validateCollection(data, unconfirmed = false) {
    if (!data?.metadata || !Array.isArray(data.questions) || !Array.isArray(data.reports) || !Array.isArray(data.coverage)
      || !data.questions.every(question => question && typeof question.question === "string" && Array.isArray(question.sources) && Array.isArray(question.occurrences)
        && (!unconfirmed || question.round === null)
        && question.occurrences.every(item => item && typeof item.date === "string" && (!unconfirmed || (typeof item.roundUncertainty === "string" && item.roundUncertainty.trim()))))) {
      throw new Error("The collection does not match the documented viewer format.");
    }
    return data;
  }

  async function load() {
    $("load-error").hidden = true;
    $("results").setAttribute("aria-busy", "true");
    $("result-summary").textContent = "Loading the research database…";
    $("retry").disabled = true;
    const [strictResult, unconfirmedResult] = await Promise.allSettled([
      fetchData("data/database.json").then(data => validateCollection(data)),
      fetchData("data/unconfirmed.json").then(data => validateCollection(data, true)),
    ]);
    if (unconfirmedResult.status === "fulfilled") {
      collections.unconfirmed = unconfirmedResult.value;
      $("auxiliary-status").textContent = "";
    } else {
      delete collections.unconfirmed;
      $("auxiliary-status").textContent = `Round unconfirmed unavailable: ${unconfirmedResult.reason.message} Round verified remains available. Reload the page to retry.`;
    }
    try {
      if (strictResult.status === "rejected") throw strictResult.reason;
      collections.strict = strictResult.value;
      if (collections.unconfirmed) {
        const combinedReports = [...new Map([...collections.strict.reports, ...collections.unconfirmed.reports].map(report => [report.id, report])).values()];
        collections.all = { metadata: { ...collections.strict.metadata, reportCount: combinedReports.length }, questions: [...collections.strict.questions, ...collections.unconfirmed.questions], reports: combinedReports };
        collections.all.sourceReports = { strict: new Map(collections.strict.reports.map(report => [report.id, report])), unconfirmed: new Map(collections.unconfirmed.reports.map(report => [report.id, report])) };
      } else delete collections.all;
      const data = collections.strict;
      const questions = [...collections.strict.questions, ...(collections.unconfirmed?.questions ?? [])];
      const occurrences = questions.flatMap(question => question.occurrences);
      populateChoices("round", [...data.questions.map(question => String(question.round)), "unconfirmed"], value => value === "unconfirmed" ? "Round unconfirmed" : `Round ${value}`);
      populateChoices("topic", questions.map(question => question.topic));
      populateChoices("category", questions.map(question => question.category).filter(Boolean));
      populateChoices("quality", Object.keys(qualityLabels), value => qualityLabels[value]);
      populateChoices("location", occurrences.map(item => item.location || "Not stated"));
      populateChoices("year", occurrences.map(item => item.date.slice(0, 4)));
      populateChoices("basis", ["interview", "publication"], basisLabel);
      restoreURL();
      render(false);
      $("view-strict").disabled = false;
      $("view-unconfirmed").disabled = !collections.unconfirmed;
      $("view-all").disabled = !collections.unconfirmed;
      $("filter-fields").disabled = false;
      $("save-view").disabled = false;
      $("share-view").disabled = false;
      updateSavedActions();
    } catch (error) {
      database = undefined;
      visibleRows = [];
      $("view-strict").disabled = true;
      $("view-unconfirmed").disabled = true;
      $("view-all").disabled = true;
      $("filter-fields").disabled = true;
      $("reset").disabled = true;
      $("export-csv").disabled = true;
      $("save-view").disabled = true;
      $("share-view").disabled = true;
      updateSavedActions();
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

  readStudy();
  renderSavedViews();
  $("saved-view").addEventListener("change", updateSavedActions);
  $("save-view-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!database) return;
    const name = $("view-name").value.trim();
    if (!name) { $("view-name").focus(); return; }
    if (study.views.some(item => item.name === name)) {
      $("study-status").textContent = "That name is already saved. Choose another name, or delete the old filter set first.";
      $("view-name").focus();
      return;
    }
    study.views.push({ name, query: publicURL().search });
    persistStudy();
    renderSavedViews(String(study.views.length - 1));
    $("study-status").textContent = `Saved “${name}” ${storageAvailable ? "in this browser" : "for this session"}. Personal progress filters are not saved or shared.`;
  });
  $("load-view").addEventListener("click", () => {
    const saved = study.views[Number($("saved-view").value)];
    if (!database || !saved || $("saved-view").value === "") return;
    clearTimeout(searchTimer);
    restoreURL(saved.query);
    render();
    $("study-status").textContent = `Loaded “${saved.name}”. Personal progress filter reset to All.${["unconfirmed", "all"].includes(new URLSearchParams(saved.query).get("view")) && !collections.unconfirmed ? " The unconfirmed collection is unavailable; showing round verified instead." : ""}`;
  });
  $("delete-view").addEventListener("click", () => {
    if ($("saved-view").value === "") return;
    const [removed] = study.views.splice(Number($("saved-view").value), 1);
    persistStudy();
    renderSavedViews("");
    $("study-status").textContent = `Deleted saved filter set “${removed.name}”. Question marks are unchanged.`;
    $("saved-view").focus();
  });
  $("share-view").addEventListener("click", async () => {
    const url = publicURL().href;
    $("share-url").value = url;
    try {
      await navigator.clipboard.writeText(url);
      $("share-fallback").hidden = true;
      $("study-status").textContent = "Public filter URL copied. No bookmarks, practiced marks, or personal filter are included.";
    } catch {
      $("share-fallback").hidden = false;
      $("share-url").focus();
      $("share-url").select();
      $("study-status").textContent = "Clipboard unavailable. Copy the selected public URL above; it contains no personal study progress.";
    }
  });
  $("collection-switch").addEventListener("change", event => {
    if (event.target.name !== "view") return;
    clearTimeout(searchTimer);
    selectCollection(event.target.value);
    render();
  });
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
