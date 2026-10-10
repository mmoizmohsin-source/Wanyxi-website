/* ═══════════════════════════════════════════════════════════════════════
   WANYXI LEAD INTELLIGENCE — dashboard logic (plain JavaScript, no libraries)

   HOW THE DATA FLOWS
     wanyxi_leads.csv  →  lead.py (the scoring engine)  →  wanyxi_scored_leads.csv  →  this dashboard

   DATA SOURCES (chosen by dashboard/config.js)
     • "supabase": signed-in administrator reads the private dash_scored_leads
       table through Row Level Security (the hosted website).
     • "csv": reads wanyxi_scored_leads.csv (local preview via run_dashboard.py).

   The dashboard NEVER calculates a lead's score, priority or recommended
   action. It reads those values exactly as lead.py wrote them. Everything
   on screen (counts, averages, percentages, charts, insights) is computed
   live from that file each time it loads — nothing is typed in by hand.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── Settings ─────────────────────────────────────────────────────── */
  var DATA_URL = "wanyxi_scored_leads.csv";

  // Columns lead.py reads, plus the columns it adds. Missing any → clear error.
  var RAW_COLUMNS = ["lead_id", "company_name", "industry", "company_size", "service_interest",
    "budget_range", "urgency", "buying_intent", "business_need", "lead_source"];
  var SCORE_COLUMNS = ["intent_score", "urgency_score", "budget_score", "fit_score",
    "total_score", "priority", "scoring_reasons", "recommended_action"];
  // Written by the recommendation engine in lead.py. Optional: an older
  // scored file without them still loads; the recommendation features then
  // explain how to add them instead of showing anything made up.
  var REC_COLUMNS = ["recommended_service", "service_recommendation_confidence", "recommendation_reason",
    "contact_priority", "follow_up_timing", "recommended_channel", "next_best_action", "recommendation_goal"];
  var REC_OK = false;       // true when the loaded file has every REC_COLUMNS column
  var NUMERIC = ["intent_score", "urgency_score", "budget_score", "fit_score", "total_score"];

  // Priority labels exactly as classify_lead() in lead.py returns them.
  var PRIORITIES = ["Hot", "Warm", "Low Priority"];
  var P_META = {
    "Hot": { cls: "hot", color: "var(--p-hot)" },
    "Warm": { cls: "warm", color: "var(--p-warm)" },
    "Low Priority": { cls: "low", color: "var(--p-low)" }
  };
  // These bands mirror classify_lead() in lead.py. They are used ONLY to
  // describe the method and to verify the CSV — never to assign a priority.
  // If you change the thresholds in lead.py, update these two numbers too.
  var BAND = { hot: 80, warm: 50 };

  /* ── State ────────────────────────────────────────────────────────── */
  var all = [];             // every valid lead from the CSV
  var skipped = [];         // rows that could not be used, with reasons
  var source = { name: DATA_URL, updated: null, mode: "server" };
  var view = "overview";
  var F = { q: "", priority: "", industry: "", service: "", source: "" };
  var sort = { key: "total_score", dir: -1 };
  var indSort = "count";
  var lastFocus = null;

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var fmt1 = function (n) { return (Math.round(n * 10) / 10).toFixed(1); };
  var pct = function (n, d) { return d ? fmt1(n / d * 100) + "%" : "—"; };
  var cap = function (s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); };
  var mean = function (rows) {
    if (!rows.length) return null;
    return rows.reduce(function (a, r) { return a + r.total_score; }, 0) / rows.length;
  };
  var plural = function (n, w) { return n + " " + w + (n === 1 ? "" : "s"); };

  /* ── CSV parsing (handles quoted fields, commas and line breaks inside quotes) ── */
  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    var rows = [], row = [], field = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function toLeads(data) {
    // data is CSV text (csv mode) or { head: [...], rows: [[...], ...] } (supabase mode)
    var rows = typeof data === "string" ? parseCSV(data) : [data.head].concat(data.rows);
    if (rows.length < 2) throw new Error(typeof data === "string" ? "The file has no lead rows." : "The dashboard tables contain no leads yet. Load them with the seed SQL or sync_to_supabase.py.");
    var head = rows[0].map(function (h) { return h.trim(); });
    var missingRaw = RAW_COLUMNS.filter(function (c) { return head.indexOf(c) < 0; });
    var missingScore = SCORE_COLUMNS.filter(function (c) { return head.indexOf(c) < 0; });
    if (missingRaw.length) throw new Error("Missing required columns: " + missingRaw.join(", ") + ".");
    if (missingScore.length) {
      throw new Error("This file has not been scored yet (missing " + missingScore.join(", ") +
        "). Run lead.py first — it creates wanyxi_scored_leads.csv.");
    }
    var recOk = REC_COLUMNS.every(function (c) { return head.indexOf(c) >= 0; });
    var leads = [], bad = [], seen = {};
    rows.slice(1).forEach(function (cells, i) {
      var r = {};
      head.forEach(function (h, j) { r[h] = (cells[j] == null ? "" : String(cells[j])).trim(); });
      var line = i + 2, why = [];
      NUMERIC.forEach(function (k) {
        var v = r[k] === "" ? NaN : Number(r[k]);
        if (!isFinite(v)) why.push(k + " is not a number"); else r[k] = v;
      });
      if (!r.lead_id) why.push("lead_id is empty");
      else if (seen[r.lead_id]) why.push("duplicate lead_id " + r.lead_id);
      if (PRIORITIES.indexOf(r.priority) < 0) why.push('unknown priority "' + r.priority + '"');
      if (why.length) { bad.push({ line: line, id: r.lead_id || "(no id)", why: why.join("; ") }); return; }
      seen[r.lead_id] = true;
      // empty text fields are shown as "Not provided" rather than guessed
      ["company_name", "industry", "company_size", "service_interest", "lead_source"].forEach(function (k) {
        if (!r[k]) r[k] = "Not provided";
      });
      r._reasons = r.scoring_reasons ? r.scoring_reasons.split(" | ") : [];
      leads.push(r);
    });
    if (!leads.length) throw new Error("No usable lead rows were found (" + bad.length + " rows had errors).");
    return { leads: leads, bad: bad, recOk: recOk };
  }

  /* ── Loading ──────────────────────────────────────────────────────── */
  function load() {
    if (CFG.mode === "supabase") return sbLoad();
    // A standalone build (build_standalone.py) carries the CSV inside the page.
    var emb = document.getElementById("wanyxi-data");
    if (emb && !load._usedEmbed) {
      load._usedEmbed = true;
      var upd = emb.getAttribute("data-updated");
      setEmbeddedControls();
      return accept(emb.textContent.replace(/^\s*\n/, ""), { name: emb.getAttribute("data-name") || DATA_URL, updated: upd ? new Date(upd) : null, mode: "embedded" });
    }
    gate("loading");
    fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw Object.assign(new Error("HTTP " + res.status), { http: res.status });
        var lm = res.headers.get("Last-Modified");
        return res.text().then(function (t) { return { text: t, updated: lm ? new Date(lm) : null }; });
      })
      .then(function (d) { accept(d.text, { name: DATA_URL, updated: d.updated, mode: "server" }); })
      .catch(function (err) {
        if (err && err.parse) return gate("error", err.message);
        if (location.protocol === "file:") gate("file");
        else gate("error", err && err.http === 404
          ? "wanyxi_scored_leads.csv was not found next to index.html. Run lead.py to create it."
          : "The data file could not be read (" + esc(err && err.message) + ").");
      });
  }

  function accept(data, src) {
    var out;
    try { out = toLeads(data); } catch (e) { return gate(src.mode === "supabase" ? "sberror" : "error", esc(e.message)); }
    all = out.leads; skipped = out.bad; source = src; REC_OK = out.recOk;
    $("gate").hidden = true; $("app").hidden = false; $("nav").hidden = false;
    setUserControls();
    buildFilterOptions();
    render();
    if (skipped.length) toast(plural(skipped.length, "row") + " skipped — see Scoring Method → Data checks");
  }

  function gate(kind, msg) {
    var g = $("gate");
    g.hidden = false; $("app").hidden = true;
    $("nav").hidden = true;                      // no section menu until data is loaded
    if (CFG.mode === "supabase") $("srcName").textContent = "Supabase";
    g.className = "gate" + (kind === "error" ? " err" : "");
    $("srcMeta").textContent = kind === "loading" ? "Loading…" : "Not loaded";
    if (kind === "loading") {
      g.innerHTML = '<div class="kicker">Lead Intelligence</div><h2>Loading scored leads…</h2>' +
        (CFG.mode === "supabase" ? '<p>Reading your private lead data from Supabase.</p>'
          : '<p>Reading <code>' + DATA_URL + '</code> produced by <code>lead.py</code>.</p>');
      return;
    }
    var picker = '<label class="drop" id="drop"><input type="file" accept=".csv,text/csv" id="pick">' +
      '<b style="color:var(--char)">Choose wanyxi_scored_leads.csv</b><br>or drag the file here</label>';
    if (kind === "login") {
      if ($("loginForm") && !g.hidden) return;   // already showing: keep what the user typed
      g.className = "gate";
      g.innerHTML = '<div class="kicker">Wanyxi · Administrator</div><h2>Sign in to Lead Intelligence</h2>' +
        '<p>This dashboard contains private lead data. Sign in with the Wanyxi administrator account.</p>' +
        '<form class="login" id="loginForm" novalidate>' +
        '<label for="lEmail">Email</label><input id="lEmail" name="email" type="email" autocomplete="username" required>' +
        '<label for="lPass">Password</label><input id="lPass" name="password" type="password" autocomplete="current-password" required>' +
        '<p class="login__err" id="lErr" role="alert" hidden></p>' +
        '<button class="btn btn--dark" type="submit" id="lBtn">Sign in</button></form>' +
        '<p class="login__note"><a href="/">← Back to the Wanyxi website</a></p>';
      $("srcMeta").textContent = "Signed out";
      $("loginForm").onsubmit = sbSignIn;
      setTimeout(function () { var e = $("lEmail"); if (e) e.focus(); }, 30);
      return;
    }
    if (kind === "notadmin") {
      g.className = "gate err";
      g.innerHTML = '<div class="kicker" style="color:var(--err)">No access</div><h2>This account cannot open the dashboard</h2>' +
        '<p style="color:var(--char)">You are signed in as <b>' + esc(msg) + '</b>, which is not a Wanyxi dashboard administrator.</p>' +
        '<p>Lead data is only available to accounts listed by the site owner.</p>' +
        '<button class="btn btn--dark" data-signout type="button">Sign out</button>';
      $("srcMeta").textContent = "No access";
      return;
    }
    if (kind === "sberror") {
      g.className = "gate err";
      g.innerHTML = '<div class="kicker" style="color:var(--err)">Data could not be loaded</div><h2>The dashboard could not reach its data</h2>' +
        '<p style="color:var(--char)">' + msg + '</p><p>Nothing has been estimated or filled in.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--dark" id="retry" type="button">Try again</button>' +
        (SB ? '<button class="btn btn--line" data-signout type="button">Sign out</button>' : '') + '</div>';
      $("retry").onclick = function () { sbLoad(); };
      $("srcMeta").textContent = "Not loaded";
      return;
    }
    if (kind === "pick") {
      g.innerHTML = '<div class="kicker">Load data</div><h2>Load an updated lead file</h2>' +
        '<p>Run <code>python lead.py</code> on your computer, then choose the new <code>wanyxi_scored_leads.csv</code> here.</p>' +
        picker + '<p style="margin-top:14px"><button class="btn btn--line" id="cancelPick">Back to dashboard</button></p>';
      $("cancelPick").onclick = function () { g.hidden = true; $("app").hidden = false; $("nav").hidden = false; };
      $("srcMeta").textContent = all.length + " leads loaded";
    } else if (kind === "file") {
      g.innerHTML = '<div class="kicker">One more step</div><h2>Open the dashboard through the launcher</h2>' +
        '<p>Browsers block web pages opened directly from your disk from reading other files, so the dashboard could not load the lead data on its own.</p>' +
        '<ol><li>Open a terminal in the project folder.</li><li>Run <code>python run_dashboard.py</code></li>' +
        '<li>Your browser opens the dashboard with fresh scores.</li></ol>' +
        '<p>Or load the scored file manually:</p>' + picker;
    } else {
      g.innerHTML = '<div class="kicker" style="color:var(--err)">Data could not be loaded</div><h2>Something is wrong with the lead file</h2>' +
        '<p style="color:var(--char)">' + msg + '</p>' +
        '<p>Nothing has been estimated or filled in — the dashboard only shows real scored data.</p>' +
        '<button class="btn btn--dark" id="retry">Try again</button>' + picker;
      var rb = $("retry"); if (rb) rb.onclick = load;
    }
    wirePicker();
  }

  function wirePicker() {
    var pick = $("pick"), drop = $("drop");
    if (!pick) return;
    var read = function (file) {
      if (!file) return;
      var fr = new FileReader();
      fr.onload = function () { accept(fr.result, { name: file.name, updated: new Date(file.lastModified), mode: document.getElementById("wanyxi-data") ? "file-embedded" : "file" }); };
      fr.onerror = function () { gate("error", "The selected file could not be read."); };
      fr.readAsText(file);
    };
    pick.onchange = function () { read(pick.files[0]); };
    drop.ondragover = function (e) { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = function () { drop.classList.remove("over"); };
    drop.ondrop = function (e) { e.preventDefault(); drop.classList.remove("over"); read(e.dataTransfer.files[0]); };
  }

  /* ── Filtering ────────────────────────────────────────────────────── */
  var FILTER_DEF = [
    { id: "fpriority", key: "priority", field: "priority", label: "All priorities" },
    { id: "findustry", key: "industry", field: "industry", label: "All industries" },
    { id: "fservice", key: "service", field: "service_interest", label: "All services" },
    { id: "fsource", key: "source", field: "lead_source", label: "All sources" }
  ];

  function uniq(field) {
    var c = {};
    all.forEach(function (r) { c[r[field]] = (c[r[field]] || 0) + 1; });
    var keys = Object.keys(c);
    if (field === "priority") keys = PRIORITIES.filter(function (p) { return c[p]; });
    else keys.sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b); });
    return keys.map(function (k) { return { v: k, n: c[k] }; });
  }

  function buildFilterOptions() {
    FILTER_DEF.forEach(function (d) {
      var el = $(d.id);
      el.innerHTML = '<option value="">' + d.label + '</option>' + uniq(d.field).map(function (o) {
        var txt = d.field === "priority" || d.field === "industry" || d.field === "lead_source" ? o.v : cap(o.v);
        return '<option value="' + esc(o.v) + '">' + esc(txt) + ' (' + o.n + ')</option>';
      }).join("");
      if (F[d.key] && !uniq(d.field).some(function (o) { return o.v === F[d.key]; })) F[d.key] = "";
      el.value = F[d.key];
    });
    $("fq").value = F.q;
  }

  function matches(r) {
    if (F.priority && r.priority !== F.priority) return false;
    if (F.industry && r.industry !== F.industry) return false;
    if (F.service && r.service_interest !== F.service) return false;
    if (F.source && r.lead_source !== F.source) return false;
    if (F.q) {
      var q = F.q.toLowerCase();
      if (r.company_name.toLowerCase().indexOf(q) < 0 && r.lead_id.toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  }
  function filtered() { return all.filter(matches); }
  function anyFilter() { return !!(F.q || F.priority || F.industry || F.service || F.source); }

  function setFilter(key, value, opts) {
    F[key] = value;
    FILTER_DEF.forEach(function (d) { $(d.id).value = F[d.key]; });
    render();
    if (opts && opts.go) go(opts.go);
  }
  function resetFilters() {
    F = { q: "", priority: "", industry: "", service: "", source: "" };
    buildFilterOptions(); render();
  }
  var keyForField = { priority: "priority", industry: "industry", service_interest: "service", lead_source: "source" };

  /* ── Group statistics ─────────────────────────────────────────────── */
  function groupBy(rows, field) {
    var m = {};
    rows.forEach(function (r) { (m[r[field]] = m[r[field]] || []).push(r); });
    return Object.keys(m).map(function (k) {
      var g = m[k];
      return { key: k, rows: g, count: g.length, avg: mean(g),
        hot: g.filter(function (r) { return r.priority === "Hot"; }).length };
    });
  }
  function byScore(a, b) {
    return b.total_score - a.total_score || b.urgency_score - a.urgency_score ||
      b.intent_score - a.intent_score || b.budget_score - a.budget_score;
  }

  /* ── Render all ───────────────────────────────────────────────────── */
  function render() {
    var f = filtered();
    FILTER_DEF.forEach(function (d) { $(d.id).classList.toggle("set", !!F[d.key]); });
    $("fcount").innerHTML = anyFilter()
      ? "Showing <b>" + f.length + "</b> of " + all.length + " leads"
      : "<b>" + all.length + "</b> leads";
    $("navCount").textContent = f.length;
    var when = source.updated && !isNaN(source.updated) ? source.updated.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : source.mode === "supabase" ? "date not recorded" : "time unknown";
    $("srcName").textContent = source.name;
    $("srcMeta").textContent = all.length + " leads · updated " + when;
    $("subtitle").textContent = "Scored by lead.py · synthetic demonstration data · scores rank priority, they are not conversion probabilities";
    var st = $("status");
    st.classList.toggle("bad", skipped.length > 0);
    st.querySelector("span").textContent = skipped.length
      ? all.length + " loaded · " + skipped.length + " skipped" : all.length + " leads loaded";
    renderKpis(f); renderPriority(f); renderServices(f); renderSources(f); renderIndustries(f);
    renderInsights(f); renderTable(f); renderQueue(f); renderMethod();
  }

  /* ── KPIs ─────────────────────────────────────────────────────────── */
  function kpiData(f) {
    var hot = f.filter(function (r) { return r.priority === "Hot"; });
    var warm = f.filter(function (r) { return r.priority === "Warm"; });
    var avg = mean(f);
    return [
      { id: "total", label: "Total leads", value: f.length,
        ctx: anyFilter() ? "of " + all.length + " in file" : "in the scored file",
        chip: anyFilter() ? pct(f.length, all.length) + " shown" : "All sources" },
      { id: "hot", label: "Hot leads", value: hot.length, ctx: "score " + BAND.hot + "+", chip: pct(hot.length, f.length) },
      { id: "warm", label: "Warm leads", value: warm.length, ctx: "score " + BAND.warm + "–" + (BAND.hot - 1), chip: pct(warm.length, f.length) },
      { id: "avg", label: "Average lead score", value: avg == null ? "—" : fmt1(avg), suffix: avg == null ? "" : "/100",
        ctx: "rule-based points", chip: avg == null ? "No leads" : median(f) + " median" }
    ];
  }
  function median(f) {
    var s = f.map(function (r) { return r.total_score; }).sort(function (a, b) { return a - b; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : fmt1((s[m - 1] + s[m]) / 2).replace(/\.0$/, "");
  }
  function renderKpis(f) {
    $("kpis").innerHTML = kpiData(f).map(function (k) {
      return '<button class="card kpi" data-kpi="' + k.id + '" aria-label="' + esc(k.label) + ': ' + k.value + '. Open explanation">' +
        '<span class="l">' + k.label + '<i>Explain →</i></span>' +
        '<span class="v num">' + k.value + (k.suffix ? '<small>' + k.suffix + '</small>' : '') + '</span>' +
        '<span class="r"><span class="chip">' + k.chip + '</span>' + k.ctx + '</span></button>';
    }).join("");
  }

  var KPI_TEXT = {
    total: {
      title: "Total leads",
      means: "The number of leads in the scored file that match the filters currently applied.",
      calc: "A count of rows in wanyxi_scored_leads.csv after the search and filters are applied. Rows with errors are never counted (see Scoring Method → Data checks).",
      why: "It is the size of the pipeline you are working with. Every percentage on this dashboard uses this number as its base.",
      act: "Narrow it with the filters to focus on one industry, service or source before deciding where to spend sales time.",
      filter: null
    },
    hot: {
      title: "Hot leads",
      means: "Leads the scoring engine classed as Hot — the strongest mix of buying intent, urgency, budget and fit.",
      calc: "Counted directly from the priority column written by lead.py. classify_lead() marks a lead Hot when its total score is " + BAND.hot + " or higher.",
      why: "These are the leads most likely to be worth a sales conversation right now, according to Wanyxi's own rules.",
      act: "The engine recommends contacting every Hot lead within 24 hours and offering a discovery call about the service they asked for.",
      filter: "Hot"
    },
    warm: {
      title: "Warm leads",
      means: "Leads with real interest but a weaker score than Hot — usually lower urgency or budget.",
      calc: "Counted from the priority column. classify_lead() marks a lead Warm when its total score is " + BAND.warm + "–" + (BAND.hot - 1) + ".",
      why: "Warm leads are the next wave of opportunities. Handled well, some become Hot as their situation changes.",
      act: "The engine recommends a tailored follow-up about the requested service within 3 business days, suggesting a short call.",
      filter: "Warm"
    },
    avg: {
      title: "Average lead score",
      means: "The mean total score (0–100) of the leads currently shown.",
      calc: "Sum of total_score ÷ number of leads. Each total is lead.py's sum of buying intent (max 30), urgency (25), budget (25) and service fit + company size (20).",
      why: "It is a quick read of lead quality for any segment — compare it across industries or sources with the filters.",
      act: "Use it to compare segments, not as a forecast. It is a rule-based priority score, not a probability that a lead will buy.",
      filter: null
    }
  };
  function openKpi(id) {
    var f = filtered(), k = kpiData(f).filter(function (x) { return x.id === id; })[0], t = KPI_TEXT[id];
    var btns = "";
    if (t.filter) btns += '<button class="btn btn--dark" data-act="kpi-view" data-v="' + t.filter + '">View these ' + k.value + ' leads</button>';
    else btns += '<button class="btn btn--dark" data-act="go-leads">Open lead table</button>';
    btns += '<button class="btn btn--line" data-close>Close</button>';
    openModal("Metric", t.title,
      '<div class="val num">' + k.value + (k.suffix || "") + '</div><p class="dim" style="font-size:12.5px">' +
      (anyFilter() ? "For the current filters (" + f.length + " leads)" : "Across all " + all.length + " leads") + '</p>' +
      q("What it means", t.means) + q("How it is calculated", t.calc) + q("Why it matters", t.why) +
      q("What to do next", t.act) + '<div class="btns">' + btns + '</div>');
  }
  function q(h, p) { return '<div class="q"><h4>' + h + '</h4><p>' + p + '</p></div>'; }

  /* ── Priority distribution ────────────────────────────────────────── */
  function renderPriority(f) {
    var n = f.length;
    var groups = PRIORITIES.map(function (p) {
      var c = f.filter(function (r) { return r.priority === p; }).length;
      return { p: p, c: c };
    });
    var bar = n ? groups.filter(function (g) { return g.c; }).map(function (g) {
      return '<button style="flex:' + g.c + ';background:' + P_META[g.p].color + '" data-group="priority" data-v="' + esc(g.p) +
        '" data-tip="<b>' + g.c + ' ' + esc(g.p) + '</b><span>' + pct(g.c, n) + ' of leads shown</span>" aria-label="' + esc(g.p) + ': ' + g.c + ' leads"></button>';
    }).join("") : "";
    $("priority").innerHTML = '<div class="stack" role="img" aria-label="Priority split">' + bar + '</div>' +
      groups.map(function (g) {
        var range = g.p === "Hot" ? BAND.hot + "–100" : g.p === "Warm" ? BAND.warm + "–" + (BAND.hot - 1) : "0–" + (BAND.warm - 1);
        return '<button class="prow" data-group="priority" data-v="' + esc(g.p) + '"' + (g.c ? "" : " disabled") + '>' +
          '<span class="sw" style="background:' + P_META[g.p].color + '"></span><span><b>' + g.p + '</b> <small class="dim">score ' + range + '</small></span>' +
          '<span class="num">' + g.c + '</span><span class="pct num">' + pct(g.c, n) + '</span></button>';
      }).join("") +
      histogram(f);
  }

  // score distribution in 10-point bins (90–100 is one bin, so a score of 100 is counted)
  function histogram(f) {
    if (!f.length) return "";
    var bins = []; for (var i = 0; i < 10; i++) bins.push(0);
    f.forEach(function (r) { bins[Math.min(9, Math.floor(r.total_score / 10))]++; });
    var max = Math.max.apply(null, bins) || 1;
    return '<div class="hist" role="img" aria-label="Score distribution in 10-point bands">' + bins.map(function (c, i) {
      var lo = i * 10, hi = i === 9 ? 100 : lo + 9;
      var col = lo >= BAND.hot ? "var(--p-hot)" : lo >= BAND.warm ? "var(--p-warm)" : "var(--p-low)";
      return '<span style="height:' + (c / max * 100) + '%;background:' + col + '" data-tip="<b>' + c + ' leads</b><span>score ' + lo + '–' + hi + '</span>"></span>';
    }).join("") + '</div><div class="hax"><span>0</span><span>Score distribution</span><span>100</span></div>';
  }

  /* ── Service demand / Lead sources (volume bar + share + avg score) ── */
  function hbars(f, field, el, capitalise) {
    var g = groupBy(f, field).sort(function (a, b) { return b.count - a.count || a.key.localeCompare(b.key); });
    if (!g.length) { $(el).innerHTML = '<p class="dim" style="font-size:13px">No leads in this view.</p>'; return; }
    var max = g[0].count;
    $(el).innerHTML = '<div class="hhead"><span>' + (field === "lead_source" ? "Source" : "Service") + '</span><span>Volume</span><span>Leads · share · avg</span></div>' +
      '<div class="hb">' + g.map(function (x) {
        return '<button class="hrow" data-group="' + field + '" data-v="' + esc(x.key) + '" data-tip="<b>' + esc(capitalise ? cap(x.key) : x.key) +
          '</b>' + x.count + ' leads · ' + pct(x.count, f.length) + '<br>Avg score ' + fmt1(x.avg) + '<br>' + PRIORITIES.map(function (p) { return x.rows.filter(function (r) { return r.priority === p; }).length + ' ' + p; }).join(' · ') + '">' +
          '<span class="n' + (capitalise ? '' : ' keep') + '">' + esc(x.key) + '</span>' +
          '<span class="track" style="background:none"><span class="mix" style="width:' + (x.count / max * 100) + '%">' + mixBar(x.rows) + '</span></span>' +
          '<span class="val num"><b>' + x.count + '</b> · ' + pct(x.count, f.length) + ' · ' + fmt1(x.avg) + '</span></button>';
      }).join("") + '</div>' + mixLegend();
  }
  function mixBar(rows) {
    return PRIORITIES.map(function (p) {
      var c = rows.filter(function (r) { return r.priority === p; }).length;
      return c ? '<span style="flex:' + c + ';background:' + P_META[p].color + '"></span>' : "";
    }).join("");
  }
  function mixLegend() {
    return '<div class="legend">' + PRIORITIES.map(function (p) {
      return '<span><i style="background:' + P_META[p].color + '"></i>' + p + '</span>';
    }).join("") + '<span>Bar length = leads</span></div>';
  }
  function renderServices(f) { hbars(f, "service_interest", "services", true); }
  function renderSources(f) { hbars(f, "lead_source", "sources", false); }

  /* ── Industries: volume and quality on two separate scales ────────── */
  function renderIndustries(f) {
    var g = groupBy(f, "industry");
    if (!g.length) { $("industries").innerHTML = '<p class="dim" style="font-size:13px">No leads in this view.</p>'; return; }
    var maxC = Math.max.apply(null, g.map(function (x) { return x.count; }));
    var topVol = g.slice().sort(function (a, b) { return b.count - a.count; })[0];
    var eligible = g.filter(function (x) { return x.count >= 5; });
    var topQ = (eligible.length ? eligible : g).slice().sort(function (a, b) { return b.avg - a.avg; })[0];
    g.sort(indSort === "count"
      ? function (a, b) { return b.count - a.count || b.avg - a.avg; }
      : function (a, b) { return b.avg - a.avg || b.count - a.count; });
    $("industries").innerHTML =
      '<p class="indsum"><span>Most leads: <b>' + esc(topVol.key) + '</b> (' + topVol.count + ')</span>' +
      '<span>Highest avg score: <b>' + esc(topQ.key) + '</b> (' + fmt1(topQ.avg) + ', ' + plural(topQ.count, "lead") + ')</span>' +
      (g.some(function (x) { return x.count < 5; }) ? '<span>Industries under 5 leads are not ranked for score</span>' : '') + '</p>' +
      '<div class="hhead"><span>Industry</span><span>Lead volume</span><span style="min-width:0;text-align:right">#</span><span>Avg score (0–100)</span><span style="min-width:0;text-align:right">Avg</span></div>' +
      g.map(function (x) {
        return '<button class="irow" data-group="industry" data-v="' + esc(x.key) + '" data-tip="<b>' + esc(x.key) + '</b>' +
          x.count + ' leads (' + pct(x.count, f.length) + ')<br>Avg score ' + fmt1(x.avg) + ' · ' + x.hot + ' Hot">' +
          '<span class="n"><span style="overflow:hidden;text-overflow:ellipsis">' + esc(x.key) + '</span>' + (x.count < 5 ? '<span class="flag s">n&lt;5</span>' : '') + '</span>' +
          '<span class="track"><i style="width:' + (x.count / maxC * 100) + '%"></i></span><span class="v num">' + x.count + '</span>' +
          '<span class="track q"><i style="width:' + x.avg + '%"></i></span><span class="v num">' + fmt1(x.avg) + '</span></button>';
      }).join("") +
      '';
  }

  /* ── Insights (all computed from the current view) ────────────────── */
  function insights(f) {
    var out = [];
    if (!f.length) return out;
    var n = f.length;
    var hot = f.filter(function (r) { return r.priority === "Hot"; }).sort(byScore);
    if (hot.length) {
      out.push({ tag: "Act now", group: ["priority", "Hot"],
        title: plural(hot.length, "Hot lead") + " to contact within 24 hours",
        body: "Highest scores: " + hot.slice(0, 3).map(function (r) { return r.company_name + " (" + r.total_score + ")"; }).join(", ") + ".",
        act: "Book discovery calls with these first — this is lead.py's recommended action for Hot leads." });
    }
    var ind = groupBy(f, "industry");
    if (ind.length > 1) {
      var el = ind.filter(function (x) { return x.count >= 5; });
      var vol = ind.slice().sort(function (a, b) { return b.count - a.count; })[0];
      if (el.length) {
        var qi = el.slice().sort(function (a, b) { return b.avg - a.avg; })[0];
        var same = qi === vol;
        out.push({ tag: "Lead quality", group: ["industry", qi.key],
          title: qi.key + " has the highest average score (" + fmt1(qi.avg) + ")",
          body: same ? "It is also the industry with the most leads (" + qi.count + ")."
            : "Based on " + qi.count + " leads. The largest industry by volume is " + vol.key + " (" + vol.count + " leads, avg " + fmt1(vol.avg) + ") — volume and quality are not the same thing.",
          act: same ? "Prioritise outreach and case studies for " + qi.key + "." : "Investigate " + qi.key + " as a focus segment; " + (qi.count < 15 ? "the sample is small, so confirm with more leads." : "test a tailored offer for it.") });
      }
    }
    var src = groupBy(f, "lead_source");
    if (src.length > 1) {
      var sv = src.slice().sort(function (a, b) { return b.count - a.count; })[0];
      var sq = src.filter(function (x) { return x.count >= 5; }).sort(function (a, b) { return b.avg - a.avg; })[0];
      if (sq) out.push({ tag: "Lead sources", group: ["lead_source", sq.key],
        title: sq === sv ? sq.key + " brings the most leads and the highest scores"
          : sq.key + " scores highest (avg " + fmt1(sq.avg) + ") — " + sv.key + " brings the most leads",
        body: sq.key + ": " + sq.count + " leads (" + pct(sq.count, n) + "). " + (sq === sv ? "" : sv.key + ": " + sv.count + " leads (" + pct(sv.count, n) + "), avg " + fmt1(sv.avg) + ". ") +
          "This compares score, not sales — the data has no won/lost outcomes.",
        act: "Track which leads become customers per source before shifting budget toward " + sq.key + "." });
    }
    var svc = groupBy(f, "service_interest").sort(function (a, b) { return b.count - a.count; });
    if (svc.length) {
      var top = svc[0], hotSvc = svc.slice().sort(function (a, b) { return b.hot - a.hot; })[0];
      out.push({ tag: "Service demand", group: ["service_interest", top.key],
        title: cap(top.key) + " is the most requested service (" + pct(top.count, n) + ")",
        body: top.count + " of " + n + " leads, " + plural(top.hot, "Hot lead") + "." +
          (hotSvc !== top && hotSvc.hot > top.hot ? " " + cap(hotSvc.key) + " has more Hot leads (" + hotSvc.hot + ")." : ""),
        act: "Make sure " + top.key + " has a ready-to-send proposal template and a demo." });
    }
    var low = f.filter(function (r) { return r.priority === "Low Priority"; }).length;
    if (low) out.push({ tag: "Nurture", group: ["priority", "Low Priority"],
      title: pct(low, n) + " of leads are Low Priority",
      body: plural(low, "lead") + " scored below " + BAND.warm + ", mostly from low urgency, budget or intent.",
      act: "Add them to a monthly nurture list and re-score when their situation changes (lead.py's recommendation)." });
    var exact = f.filter(function (r) { return /\(\+12\/12\)/.test(r.scoring_reasons); }).length;
    out.push({ tag: "Limitations", lim: true,
      title: "Read these scores as priorities, not predictions",
      body: "The data is synthetic, the scoring is rule-based (not machine learning), and there is no conversion data." +
        (exact === n ? " Every lead in this view gets the full service-match points, so service fit is not separating leads." : ""),
      act: "See Scoring Method for details and the data checks." });
    return out;
  }
  function renderInsights(f) {
    var list = insights(f);
    $("insights").innerHTML = list.length ? list.map(function (x, i) {
      return '<button class="ins' + (x.lim ? ' lim' : '') + '" data-ins="' + i + '"><div class="tg">' + x.tag + '</div><h3>' + esc(x.title) +
        '</h3><p>' + esc(x.body) + '</p><span class="act">→ ' + esc(x.act) + '</span></button>';
    }).join("") : '<p class="dim" style="font-size:13px;color:var(--muted-dk)">No leads match the current filters, so there is nothing to analyse.</p>';
  }
  function openInsight(i) {
    var x = insights(filtered())[i];
    if (!x) return;
    if (x.lim) return go("method");
    openGroup(x.group[0], x.group[1]);
  }
  function openAllInsights() {
    var list = insights(filtered());
    openModal("Wanyxi Intelligence", "Insights for this view",
      '<p class="dim" style="font-size:12.5px;margin-bottom:6px">' + (anyFilter() ? "Based on the " + filtered().length + " leads matching your filters." : "Based on all " + all.length + " leads.") + ' Recalculated every time the data or filters change.</p>' +
      (list.map(function (x) { return q(x.tag, "<b>" + esc(x.title) + "</b><br>" + esc(x.body) + '<br><span style="color:var(--accent);font-weight:600">→ ' + esc(x.act) + "</span>"); }).join("") || "<p>No leads match.</p>") +
      '<div class="btns"><button class="btn btn--line" data-close>Close</button></div>');
  }

  /* ── Group drawer (click on any chart element) ────────────────────── */
  var FIELD_LABEL = { priority: "Priority", industry: "Industry", service_interest: "Service interest", lead_source: "Lead source" };
  function openGroup(field, value) {
    var f = filtered(), rows = f.filter(function (r) { return r[field] === value; }).sort(byScore);
    var name = field === "service_interest" ? cap(value) : value;
    $("dKick").textContent = FIELD_LABEL[field];
    $("dTitle").textContent = name;
    $("dSub").textContent = plural(rows.length, "lead") + " · " + pct(rows.length, f.length) + " of leads shown · avg score " +
      (rows.length ? fmt1(mean(rows)) : "—") + (anyFilter() ? " · within current filters" : "");
    var mix = PRIORITIES.map(function (p) {
      var c = rows.filter(function (r) { return r.priority === p; }).length;
      return c ? '<span class="tag tag--' + P_META[p].cls + '">' + c + " " + p + "</span>" : "";
    }).join(" ");
    $("dBody").innerHTML = (field !== "priority" ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + mix + '</div>' : "") +
      '<h4 class="sub" style="margin-top:0">Leads, highest score first</h4>' +
      (rows.map(function (r) {
        return '<button class="mini" data-lead="' + esc(r.lead_id) + '"><span><b>' + esc(r.company_name) + '</b><small>' + esc(r.industry) + ' · ' + esc(r.service_interest) +
          '</small></span><span class="tag tag--' + P_META[r.priority].cls + '">' + r.priority + '</span><span class="num">' + r.total_score + '</span></button>';
      }).join("") || '<p class="dim">No leads.</p>');
    var key = keyForField[field];
    $("dAct").innerHTML = (F[key] === value ? '' :
      '<button class="btn btn--dark" data-act="apply" data-k="' + key + '" data-v="' + esc(value) + '">Filter dashboard to ' + esc(name) + '</button>') +
      '<button class="btn btn--line" data-act="apply-table" data-k="' + key + '" data-v="' + esc(value) + '">Open in lead table</button>';
    openDrawer();
  }

  /* ── Lead detail drawer ───────────────────────────────────────────── */
  function parts(reason) {
    var m = /\(\+(\d+)\/(\d+)\)/.exec(reason || "");
    return m ? { got: +m[1], max: +m[2] } : null;
  }
  function openLead(id, fromGroup) {
    var r = all.filter(function (x) { return x.lead_id === id; })[0];
    if (!r) return;
    var rs = r._reasons;
    var fitMax = rs.slice(3).reduce(function (a, s) { var p = parts(s); return p && a != null ? a + p.max : null; }, 0);
    var comps = [
      ["Buying intent", r.intent_score, parts(rs[0]) && parts(rs[0]).max],
      ["Urgency", r.urgency_score, parts(rs[1]) && parts(rs[1]).max],
      ["Budget", r.budget_score, parts(rs[2]) && parts(rs[2]).max],
      ["Service fit + company size", r.fit_score, rs.length > 3 ? fitMax : null]
    ];
    $("dKick").textContent = r.lead_id;
    $("dTitle").textContent = r.company_name;
    $("dSub").textContent = r.industry + " · " + cap(r.company_size) + " company · via " + r.lead_source;
    $("dBody").innerHTML =
      '<div class="big"><b class="num">' + r.total_score + '</b><span>/ 100 total score</span><span class="tag tag--' + P_META[r.priority].cls + '" style="margin-left:auto">' + r.priority + '</span></div>' +
      '<div class="recom"><div class="kicker">Recommended action · from lead.py</div><p>' + esc(r.recommended_action) + '</p></div>' +
      recPanel(r) +
      '<h4 class="sub" style="margin-top:0">Score breakdown</h4>' +
      comps.map(function (c) {
        return '<div class="comp"><div class="t"><span>' + c[0] + '</span><span class="num">' + c[1] + (c[2] ? " / " + c[2] : "") + '</span></div>' +
          (c[2] ? '<div class="track"><i style="width:' + Math.min(100, c[1] / c[2] * 100) + '%"></i></div>' : '') + '</div>';
      }).join("") +
      '<h4 class="sub">Why it scored this way</h4><ul class="reasons">' + rs.map(function (s) { return '<li>' + esc(cap(s)) + '</li>'; }).join("") + '</ul>' +
      '<h4 class="sub">Lead details</h4><dl class="dl">' +
      [["Service interest", cap(r.service_interest)], ["Budget", cap(r.budget_range)], ["Urgency", cap(r.urgency)],
       ["Buying intent", cap(r.buying_intent)], ["Company size", cap(r.company_size)], ["Industry", r.industry],
       ["Lead source", r.lead_source], ["Business need", r.business_need || "Not provided"]]
        .map(function (d) { return '<dt>' + d[0] + '</dt><dd>' + esc(d[1] || "Not provided") + '</dd>'; }).join("") + '</dl>';
    $("dAct").innerHTML = (fromGroup ? '<button class="btn btn--line" data-act="back" data-f="' + esc(fromGroup[0]) + '" data-v="' + esc(fromGroup[1]) + '">← Back to list</button>' : '') +
      '<button class="btn btn--dark" data-act="copy" data-id="' + esc(r.lead_id) + '">Copy lead summary</button>';
    openDrawer();
  }

  /* ── Lead table ───────────────────────────────────────────────────── */
  var COLS = [
    { k: "company_name", t: "Lead" }, { k: "industry", t: "Industry" }, { k: "service_interest", t: "Service" },
    { k: "lead_source", t: "Source" }, { k: "company_size", t: "Size" }, { k: "total_score", t: "Score" },
    { k: "priority", t: "Priority" }, { k: null, t: "Recommended action" }
  ];
  var SIZE_ORDER = { small: 1, medium: 2, large: 3 };
  function sorter() {
    var k = sort.key, d = sort.dir;
    return function (a, b) {
      var v;
      if (k === "total_score") v = byScore(b, a);
      else if (k === "priority") v = PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority) || byScore(b, a);
      else if (k === "company_size") v = (SIZE_ORDER[a[k]] || 0) - (SIZE_ORDER[b[k]] || 0) || byScore(b, a);
      else v = String(a[k]).localeCompare(String(b[k])) || byScore(b, a) * -d;
      return v * d;
    };
  }
  function renderTable(f) {
    $("thead").innerHTML = COLS.map(function (c) {
      if (!c.k) return '<th scope="col"><span>' + c.t + '</span></th>';
      var on = sort.key === c.k;
      return '<th scope="col" aria-sort="' + (on ? (sort.dir > 0 ? "ascending" : "descending") : "none") + '"><button data-sort="' + c.k + '" class="' + (on ? "on" : "") + '">' +
        c.t + '<em>' + (on ? (sort.dir > 0 ? "↑" : "↓") : "↕") + '</em></button></th>';
    }).join("");
    var rows = f.slice().sort(sorter());
    $("tbody").innerHTML = rows.map(function (r) {
      return '<tr tabindex="0" data-lead="' + esc(r.lead_id) + '"><td class="co"><b>' + esc(r.company_name) + '</b><small>' + esc(r.lead_id) + '</small></td>' +
        '<td>' + esc(r.industry) + '</td><td class="cap">' + esc(r.service_interest) + '</td><td>' + esc(r.lead_source) + '</td>' +
        '<td class="cap">' + esc(r.company_size) + '</td>' +
        '<td><span class="sc"><b class="num">' + r.total_score + '</b><span class="track"><i style="width:' + r.total_score + '%;background:' + P_META[r.priority].color + '"></i></span></span></td>' +
        '<td><span class="tag tag--' + P_META[r.priority].cls + '">' + r.priority + '</span></td>' +
        '<td class="action">' + esc(r.recommended_action) + '</td></tr>';
    }).join("");
    $("empty").hidden = rows.length > 0;
    document.querySelector("#tableWrap table").hidden = rows.length === 0;
    var s = COLS.filter(function (c) { return c.k === sort.key; })[0];
    $("tinfo").textContent = plural(rows.length, "lead") + " · sorted by " + s.t.toLowerCase() + (sort.dir > 0 ? " (ascending)" : " (descending)");
  }

  /* ── Method + data checks ─────────────────────────────────────────── */
  function renderMethod() {
    var sample = all.filter(function (r) { return r._reasons.length >= 5; })[0];
    var mx = function (i) { var p = sample && parts(sample._reasons[i]); return p ? p.max : "?"; };
    var fitMax = sample ? sample._reasons.slice(3).reduce(function (a, s) { var p = parts(s); return a + (p ? p.max : 0); }, 0) : "?";
    // verification only — compares what lead.py wrote against its own rules
    var sumBad = all.filter(function (r) {
      return Math.max(0, Math.min(100, r.intent_score + r.urgency_score + r.budget_score + r.fit_score)) !== r.total_score;
    });
    var bandBad = all.filter(function (r) {
      var exp = r.total_score >= BAND.hot ? "Hot" : r.total_score >= BAND.warm ? "Warm" : "Low Priority";
      return exp !== r.priority;
    });
    var emptyNeed = all.filter(function (r) { return !r.business_need; }).length;
    var exact = all.filter(function (r) { return /\(\+12\/12\)/.test(r.scoring_reasons); }).length;
    var counts = {}; PRIORITIES.forEach(function (p) { counts[p] = all.filter(function (r) { return r.priority === p; }).length; });
    var example = function (p) { var r = all.filter(function (x) { return x.priority === p; })[0]; return r ? r.recommended_action : "—"; };
    var chk = function (ok, txt, level) { return '<div class="check ' + (ok ? "" : (level || "fail")) + '"><i>' + (ok ? "✓" : "!") + '</i><span>' + txt + '</span></div>'; };

    $("method").innerHTML =
      '<div class="card g6"><div class="sh"><h2>How a lead is scored</h2><span>lead.py</span></div><ul class="mlist">' +
      '<li><span>Buying intent</span><span>up to ' + mx(0) + ' points</span></li>' +
      '<li><span>Urgency</span><span>up to ' + mx(1) + ' points</span></li>' +
      '<li><span>Budget</span><span>up to ' + mx(2) + ' points</span></li>' +
      '<li><span>Service fit + company size</span><span>up to ' + fitMax + ' points</span></li>' +
      '<li><span><b>Total</b></span><span><b style="color:var(--char)">0–100</b></span></li></ul>' +
      '<p class="note">A transparent <b>rule-based points system</b>: each answer earns fixed points. It is not machine learning, and a score is <b>not a probability of buying</b>. Missing or invalid values earn 0 points rather than being guessed. Maximums above are read from the engine’s own scoring reasons.</p></div>' +

      '<div class="card g6"><div class="sh"><h2>Priority bands</h2><span>classify_lead()</span></div><ul class="mlist">' +
      PRIORITIES.map(function (p) {
        var range = p === "Hot" ? BAND.hot + "–100" : p === "Warm" ? BAND.warm + "–" + (BAND.hot - 1) : "0–" + (BAND.warm - 1);
        return '<li><span><span class="tag tag--' + P_META[p].cls + '">' + p + '</span> &nbsp;score ' + range + '</span><span>' + counts[p] + ' leads</span></li>';
      }).join("") + '</ul>' +
      '<p class="note"><b>Example actions written by lead.py:</b><br>Hot — ' + esc(example("Hot")) + '<br>Warm — ' + esc(example("Warm")) + '<br>Low Priority — ' + esc(example("Low Priority")) + '</p></div>' +

      '<div class="card g12"><div class="sh"><h2>Data checks run on every load</h2><span>' + esc(source.name) + '</span></div>' +
      chk(true, "<b>" + all.length + "</b> leads loaded with all " + (RAW_COLUMNS.length + SCORE_COLUMNS.length) + " required columns.") +
      chk(!skipped.length, skipped.length ? "<b>" + skipped.length + "</b> rows skipped: " + skipped.slice(0, 5).map(function (s) { return "line " + s.line + " (" + esc(s.why) + ")"; }).join("; ") + (skipped.length > 5 ? "…" : "") : "No rows had invalid scores, unknown priorities or duplicate IDs.") +
      chk(!sumBad.length, sumBad.length ? "<b>" + sumBad.length + "</b> leads where total_score ≠ intent + urgency + budget + fit (e.g. " + esc(sumBad[0].lead_id) + "). Re-run lead.py." : "Every total score equals the sum of its four components.") +
      chk(!bandBad.length, bandBad.length ? "<b>" + bandBad.length + "</b> leads whose priority does not match the score bands (e.g. " + esc(bandBad[0].lead_id) + "). The bands in app.js may be out of date with lead.py." : "Every priority matches its score band.") +
      (REC_OK ? chk(true, "Recommendation fields (" + REC_COLUMNS.length + " columns from lead.py) present for all " + all.length + " leads; " +
        all.filter(function (r) { var i = recInfo(r); return i.kind === "discovery" || i.kind === "unclear"; }).length + " need discovery before a service is chosen.")
        : chk(false, "This file has no recommendation columns. Run the updated lead.py to add them; the Action Queue will then fill in.", "warn")) +
      chk(!emptyNeed, emptyNeed ? "<b>" + emptyNeed + "</b> leads have no business need (they earn 0 service-match points)." : "Every lead has a business need.", "warn") +
      chk(exact < all.length, exact === all.length
        ? "<b>Scoring note:</b> all " + all.length + " leads received the full 12/12 service-match points, so this part of the score does not separate leads. Likely cause: broad keywords in lead.py (e.g. “planning” matches the timeline phrase “Planning to act…”, and “live” matches inside “delivery”). Changing this would change scores, so it has been left for review."
        : exact + " of " + all.length + " leads received the full service-match points.", "warn") +
      '</div>';
  }

  /* ═══════ RECOMMENDATIONS (read from lead.py's recommendation engine) ═══════ */
  var val = function (v) { return v ? v : "Not provided"; };
  var SERVICES = ["automation", "custom dashboards", "data analysis", "forecasting"];
  // Discovery questions are written by the dashboard, not by lead.py. They are
  // shown only for leads the engine itself marked as needing discovery, one per
  // service the engine listed, and they never change a score or a recommendation.
  var DISCOVERY_Q = {
    "automation": "Which steps are done by hand today, how often, and by whom?",
    "custom dashboards": "Who needs to see which figures, how often, and where do those figures live now?",
    "data analysis": "Which business question should the data answer, and what data already exists?",
    "forecasting": "What needs to be predicted, how far ahead, and how much history is available?"
  };
  var qMode = "all", qTime = "", qCombo = "";

  // Turns the engine's recommended_service text into a display state, without
  // changing it. "Discovery required: a, b" is never shown as a single service.
  function recInfo(r) {
    var s = (r.recommended_service || "").trim(), c = (r.service_recommendation_confidence || "").trim();
    var m = /^discovery required:\s*(.*)$/i.exec(s);
    if (m) {
      var opts = m[1].split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      return { kind: "discovery", options: opts, label: "Discovery required: " + opts.join(" or "), status: c || "Multiple possible matches", key: opts.join(", ") };
    }
    if (!s) return { kind: "missing", options: [], label: "Not provided", status: "No recommendation", key: "" };
    if (/^needs clarification$/i.test(s) || /insufficient/i.test(c)) return { kind: "unclear", options: [], label: "Needs clarification", status: c || "Insufficient information", key: "" };
    if (/^tentative$/i.test(c)) return { kind: "tentative", options: [s], label: s, status: "Tentative", key: s };
    return { kind: "clear", options: [s], label: s, status: c || "Not provided", key: s };
  }
  function recChip(i) {
    if (i.kind === "discovery") return '<span class="rchip rchip--disc">Discovery · ' + i.options.length + ' options</span>';
    if (i.kind === "unclear") return '<span class="rchip rchip--disc">Needs clarification</span>';
    if (i.kind === "tentative") return '<span class="rchip rchip--tent">Tentative</span>';
    if (i.kind === "missing") return '<span class="rchip rchip--tent">Not provided</span>';
    return '<span class="rchip">' + esc(i.status) + '</span>';
  }
  function recService(i) {
    if (i.kind === "discovery") return '<span class="rsvc rsvc--disc">' + i.options.map(function (o) { return '<span>' + esc(cap(o)) + '</span>'; }).join('<em>or</em>') + '</span>';
    return '<b class="rsvc">' + esc(i.kind === "clear" || i.kind === "tentative" ? cap(i.label) : i.label) + '</b>';
  }

  function recPanel(r) {
    if (!REC_OK) return '<div class="rec rec--off"><div class="kicker">Recommendation</div><p>This lead file has no recommendation columns. Run the updated <code>lead.py</code> to add them.</p></div>';
    var i = recInfo(r);
    var head = (i.kind === "discovery" || i.kind === "unclear")
      ? '<div class="rec__svc"><span class="kicker">Recommended service</span><div class="rec__disc"><b>Not decided yet: discovery required</b>' +
        (i.options.length ? '<p>The business need matches ' + i.options.length + ' services equally, so the engine did not choose one. Possible matches:</p>' + recService(i)
          : '<p>The engine did not have enough information to suggest a service.</p>') + '</div></div>'
      : '<div class="rec__svc"><span class="kicker">Recommended service</span><div class="rec__row">' + recService(i) + recChip(i) + '</div></div>';
    var qs = i.kind === "discovery" ? i.options.filter(function (o) { return DISCOVERY_Q[o]; }) : [];
    return '<section class="rec" aria-label="Recommendation">' +
      '<div class="rec__top"><div class="kicker" style="color:var(--accent)">Recommendation · from lead.py</div></div>' +
      head +
      '<div class="rec__next"><span class="kicker">Next best action</span><p>' + esc(val(r.next_best_action)) + '</p></div>' +
      '<div class="rec__grid">' +
        '<div><span class="kicker">Contact priority</span><b>' + esc(val(r.contact_priority)) + '</b></div>' +
        '<div><span class="kicker">Follow up</span><b>' + esc(val(r.follow_up_timing)) + '</b></div>' +
        '<div><span class="kicker">Channel</span><b>' + esc(val(r.recommended_channel)) + '</b></div>' +
      '</div>' +
      '<div class="rec__more"><span class="kicker">Goal</span><p>' + esc(val(r.recommendation_goal)) + '</p></div>' +
      '<div class="rec__more"><span class="kicker">Why</span><p>' + esc(val(r.recommendation_reason)) + '</p></div>' +
      (qs.length ? '<div class="rec__q"><span class="kicker">Questions for the discovery call</span><ol>' +
        qs.map(function (o) { return '<li><b>' + esc(cap(o)) + ':</b> ' + DISCOVERY_Q[o] + '</li>'; }).join("") +
        '<li><b>To decide:</b> Which of these problems costs the business most today?</li></ol>' +
        '<small>Suggested by the dashboard for the services lead.py listed. Not part of the scoring.</small></div>' : '') +
    '</section>';
  }

  function queueRows(f) {
    return f.filter(function (r) {
      var i = recInfo(r);
      if (qMode === "clear" && !(i.kind === "clear" || i.kind === "tentative")) return false;
      if (qMode === "discovery" && !(i.kind === "discovery" || i.kind === "unclear")) return false;
      if (qTime && r.follow_up_timing !== qTime) return false;
      if (qCombo && i.key !== qCombo) return false;
      return true;
    }).sort(byScore);   // same order lead.py writes its recommendation queue in
  }

  function renderQueue(f) {
    var box = $("queue");
    if (!REC_OK) {
      box.innerHTML = '<div class="card empty"><h3>No recommendations in this file</h3><p>The loaded <code>' + esc(source.name) +
        '</code> was made by a version of lead.py without the recommendation engine. Run the updated <code>lead.py</code> and reload.</p></div>';
      return;
    }
    var info = f.map(function (r) { return { r: r, i: recInfo(r) }; });
    // timing groups in the order the engine uses (most urgent first)
    var timings = [];
    PRIORITIES.forEach(function (p) {
      f.forEach(function (r) { if (r.priority === p && r.follow_up_timing && timings.indexOf(r.follow_up_timing) < 0) timings.push(r.follow_up_timing); });
    });
    f.forEach(function (r) { if (r.follow_up_timing && timings.indexOf(r.follow_up_timing) < 0) timings.push(r.follow_up_timing); });
    var disc = info.filter(function (x) { return x.i.kind === "discovery" || x.i.kind === "unclear"; });
    var tiles = timings.map(function (t) {
      var rows = f.filter(function (r) { return r.follow_up_timing === t; });
      var cp = rows[0] ? rows[0].contact_priority : "";
      return '<button class="card qt' + (qTime === t ? ' on' : '') + '" data-qtime="' + esc(t) + '" aria-pressed="' + (qTime === t) + '">' +
        '<span class="l">' + esc(t) + '</span><span class="v num">' + rows.length + '</span>' +
        '<span class="r"><span class="chip">' + esc(cp ? cp + " contact priority" : "") + '</span>' + pct(rows.length, f.length) + '</span></button>';
    }).join("") +
      '<button class="card qt qt--disc' + (qMode === "discovery" && !qCombo ? ' on' : '') + '" data-qmode="discovery" aria-pressed="' + (qMode === "discovery") + '">' +
      '<span class="l">Need discovery first</span><span class="v num">' + disc.length + '</span>' +
      '<span class="r"><span class="chip chip--disc">Service not decided</span>' + pct(disc.length, f.length) + '</span></button>';

    // recommended services: clear picks, plus how often each appears as a discovery option
    var svcs = {};
    info.forEach(function (x) {
      if (x.i.kind === "clear" || x.i.kind === "tentative") { svcs[x.i.key] = svcs[x.i.key] || { clear: 0, opt: 0 }; svcs[x.i.key].clear++; }
      if (x.i.kind === "discovery") x.i.options.forEach(function (o) { svcs[o] = svcs[o] || { clear: 0, opt: 0 }; svcs[o].opt++; });
    });
    var sk = Object.keys(svcs).sort(function (a, b) { return svcs[b].clear - svcs[a].clear || svcs[b].opt - svcs[a].opt; });
    var maxS = Math.max.apply(null, sk.map(function (k) { return svcs[k].clear + svcs[k].opt; }).concat([1]));
    var svcHtml = sk.length ? '<div class="hhead"><span>Service</span><span>Recommended · possible</span><span>Leads</span></div>' + sk.map(function (k) {
      var c = svcs[k];
      return '<button class="hrow" data-qsvc="' + esc(k) + '" data-tip="<b>' + esc(cap(k)) + '</b>' + c.clear + ' leads recommended this service<br>' + c.opt + ' more list it as a discovery option">' +
        '<span class="n">' + esc(k) + '</span><span class="track" style="background:none"><span class="mix" style="width:' + ((c.clear + c.opt) / maxS * 100) + '%">' +
        (c.clear ? '<span style="flex:' + c.clear + ';background:var(--accent)"></span>' : '') + (c.opt ? '<span style="flex:' + c.opt + ';background:var(--disc-lt)"></span>' : '') +
        '</span></span><span class="val num"><b>' + c.clear + '</b> · +' + c.opt + ' possible</span></button>';
    }).join("") + '<div class="legend"><span><i></i>Recommended</span><span><i style="background:var(--disc-lt)"></i>Possible (discovery)</span></div>'
      : '<p class="dim" style="font-size:13px">No leads in this view.</p>';

    var combos = {};
    disc.forEach(function (x) { var k = x.i.key || "No clear signal"; combos[k] = (combos[k] || 0) + 1; });
    var ck = Object.keys(combos).sort(function (a, b) { return combos[b] - combos[a] || a.localeCompare(b); });
    var comboHtml = ck.length ? ck.map(function (k) {
      return '<button class="crow' + (qCombo === k ? ' on' : '') + '" data-qcombo="' + esc(k) + '"><span>' + esc(k.split(", ").map(cap).join(" or ")) + '</span><b class="num">' + combos[k] + '</b></button>';
    }).join("") : '<p class="dim" style="font-size:13px">Every lead in this view has a clear service recommendation.</p>';

    var rows = queueRows(f);
    var active = qMode !== "all" || qTime || qCombo;
    box.innerHTML =
      '<div class="qtiles">' + tiles + '</div>' +
      '<div class="qmid">' +
        '<div class="card"><div class="sh"><h2>Recommended services</h2><span>Click a service to list its leads</span></div>' + svcHtml + '</div>' +
        '<div class="card"><div class="sh"><h2>Discovery required</h2><span>Services the need could fit</span></div>' +
          '<p class="qnote">The business need matched several services equally, so lead.py did not pick one. Clarify the main problem on the call.</p>' + comboHtml + '</div>' +
      '</div>' +
      '<div class="qbar"><div class="seg" role="group" aria-label="Show">' +
        [["all", "All leads"], ["clear", "Clear service"], ["discovery", "Needs discovery"]].map(function (m) {
          return '<button data-qmode="' + m[0] + '" class="' + (qMode === m[0] ? "on" : "") + '">' + m[1] + '</button>';
        }).join("") + '</div>' +
        '<span class="qinfo">' + plural(rows.length, "lead") + ', contact in this order' +
        (qTime ? ' · ' + esc(qTime) : '') + (qCombo ? ' · ' + esc(cap(qCombo)) : '') + '</span>' +
        (active ? '<button class="btn btn--line" id="qclear" type="button">Show all</button>' : '') + '</div>' +
      '<div class="tw qtw">' + (rows.length ? '<table class="qt-table"><thead><tr>' +
        ['#', 'Lead', 'Score', 'Recommended service', 'Follow up', 'Channel', 'Next best action'].map(function (h) { return '<th scope="col"><span>' + h + '</span></th>'; }).join("") +
        '</tr></thead><tbody id="qbody">' + rows.map(function (r, n) {
          var i = recInfo(r);
          return '<tr tabindex="0" data-lead="' + esc(r.lead_id) + '"><td class="qn num">' + (n + 1) + '</td>' +
            '<td class="co"><b>' + esc(r.company_name) + '</b><small>' + esc(r.lead_id) + ' · ' + esc(r.industry) + '</small></td>' +
            '<td><span class="sc"><b class="num">' + r.total_score + '</b><span class="tag tag--' + P_META[r.priority].cls + '">' + r.priority + '</span></span></td>' +
            '<td class="qs">' + recService(i) + (i.kind === "clear" ? '' : recChip(i)) + '</td>' +
            '<td class="qf">' + esc(val(r.follow_up_timing)) + '</td><td class="qc">' + esc(val(r.recommended_channel)) + '</td>' +
            '<td class="action">' + esc(val(r.next_best_action)) + '</td></tr>';
        }).join("") + '</tbody></table>'
        : '<div class="empty"><h3>No leads match</h3><p>Change the view above or clear the filters.</p><button class="btn btn--dark" id="qclear" type="button">Show all</button></div>') +
      '</div>';
  }

  /* ═══════ SUPABASE MODE (hosted website) ═══════ */
  var CFG = window.WANYXI_DASHBOARD || {};
  var SB = null, SB_USER = null;
  // The 26 columns lead.py writes, in its own order. Selected explicitly so the
  // dashboard never depends on database-only columns (import_id, updated_at).
  var DB_COLUMNS = RAW_COLUMNS.concat(SCORE_COLUMNS, REC_COLUMNS);
  var PAGE = 1000;

  function sbClient() {
    if (SB) return SB;
    var url = String(CFG.supabaseUrl || ""), key = String(CFG.supabaseKey || "");
    // https://<project>.supabase.co, or a local Supabase CLI stack (http://127.0.0.1:54321)
    var okUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url);
    if (!okUrl || !key || /YOUR-/.test(url + key)) {
      throw new Error("The dashboard is not configured yet. Set supabaseUrl and supabaseKey in dashboard/config.js.");
    }
    // Refuse privileged keys: they bypass Row Level Security and must never be in a web page.
    var role = "";
    try { role = key.indexOf("eyJ") === 0 ? JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role : ""; } catch (e) { /* not a JWT */ }
    if (/^sb_secret_/.test(key) || role === "service_role") {
      throw new Error("dashboard/config.js contains a secret service key. Remove it now, rotate it in Supabase, and use the publishable (anon) key instead.");
    }
    if (!window.supabase || !window.supabase.createClient) throw new Error("The Supabase library did not load (assets/vendor/supabase-2.117.1.js).");
    SB = window.supabase.createClient(url.replace(/\/$/, ""), key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    SB.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_OUT") { clearData(); gate("login"); }
    });
    return SB;
  }

  function clearData() {
    all = []; skipped = []; SB_USER = null; REC_OK = false;
    closeAll();
    ["tbody", "kpis", "priority", "services", "sources", "industries", "insights", "queue", "method"].forEach(function (id) { var el = $(id); if (el) el.innerHTML = ""; });
  }

  function sbLoad(isReload) {
    var client;
    try { client = sbClient(); } catch (e) { return gate("sberror", esc(e.message)); }
    if (!isReload) gate("loading");
    else toast("Reloading from Supabase…");
    return client.auth.getSession().then(function (r) {
      var session = r && r.data && r.data.session;
      if (!session) return gate("login");
      var email = session.user && session.user.email || "this account";
      return client.from("dash_admins").select("display_name").maybeSingle().then(function (a) {
        if (a.error) throw a.error;
        if (!a.data) return routeNonAdmin(client, session, email);
        SB_USER = { name: a.data.display_name, email: email };
        return Promise.all([fetchAllLeads(client), fetchLastImport(client)])
          .then(function (res) {
            var rows = res[0], last = res[1];
            if (last && last.row_count != null && last.row_count !== rows.length) toast("Note: last import recorded " + last.row_count + " rows, " + rows.length + " were returned");
            // Use the 26 engine columns that the table actually has; extra database
            // columns (import_id, updated_at, …) are ignored. A missing required
            // column is reported clearly by toLeads().
            var head = rows.length ? DB_COLUMNS.filter(function (c) { return Object.prototype.hasOwnProperty.call(rows[0], c); }) : DB_COLUMNS;
            accept({ head: head, rows: rows.map(function (o) { return head.map(function (c) { return o[c] == null ? "" : o[c]; }); }) },
              { name: "Supabase · dash_scored_leads", updated: last ? new Date(last.imported_at) : null, mode: "supabase" });
            if (isReload) toast("Loaded " + plural(all.length, "lead") + " from Supabase");
          });
      });
    }).catch(function (err) {
      var m = err && (err.message || err.error_description) || String(err);
      if (/JWT|token|session/i.test(m)) return client.auth.signOut();
      gate("sberror", "Supabase returned: " + esc(m));
    });
  }

  // A signed-in account that is not an administrator is sent to the client
  // workspace ONLY if the database confirms it has a client membership.
  // The query is subject to Row Level Security, so it can only ever return
  // the caller's own membership rows. Any error or empty result keeps the
  // original "No access" screen. The client page re-verifies on its own.
  function routeNonAdmin(client, session, email) {
    return client.from("workspace_members").select("workspace_id").eq("user_id", session.user.id).eq("role", "client").limit(1)
      .then(function (m) {
        if (!m.error && m.data && m.data.length) { location.replace("/dashboard/client/"); return; }
        return gate("notadmin", email);
      }, function () { return gate("notadmin", email); });
  }

  function fetchAllLeads(client) {
    var out = [];
    function page(from) {
      return client.from("dash_scored_leads").select("*").order("lead_id").range(from, from + PAGE - 1)
        .then(function (r) {
          if (r.error) throw r.error;
          out = out.concat(r.data || []);
          return (r.data || []).length === PAGE ? page(from + PAGE) : out;
        });
    }
    return page(0);
  }

  // The import log is optional: an empty dash_imports table, or one that cannot
  // be read, only means the "updated" date is not shown. It never blocks loading.
  function fetchLastImport(client) {
    return client.from("dash_imports").select("*").order("imported_at", { ascending: false }).limit(1)
      .then(function (r) {
        if (r.error) { if (window.console) console.warn("dash_imports not readable; continuing without import date:", r.error.message); return null; }
        return (r.data && r.data[0]) || null;
      }, function () { return null; });
  }

  function sbSignIn(e) {
    e.preventDefault();
    var email = $("lEmail").value.trim(), pass = $("lPass").value, err = $("lErr"), btn = $("lBtn");
    err.hidden = true;
    if (!email || !pass) { err.textContent = "Enter your email and password."; err.hidden = false; return; }
    var client;
    try { client = sbClient(); } catch (x) { err.textContent = x.message; err.hidden = false; return; }
    btn.disabled = true; btn.textContent = "Signing in…";
    client.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
      btn.disabled = false; btn.textContent = "Sign in";
      if (r.error) {
        err.textContent = /rate|too many/i.test(r.error.message) ? "Too many attempts. Wait a few minutes and try again."
          : /confirm/i.test(r.error.message) ? "This email address has not been confirmed in Supabase yet."
          : "Email or password is incorrect.";
        err.hidden = false; $("lPass").value = ""; $("lPass").focus();
        return;
      }
      sbLoad();
    }, function () {
      btn.disabled = false; btn.textContent = "Sign in";
      err.textContent = "Could not reach Supabase. Check your connection and try again."; err.hidden = false;
    });
  }

  function sbSignOut() {
    if (!SB) return;
    // The SIGNED_OUT listener clears the data and shows the sign-in form.
    SB.auth.signOut().then(function () { toast("Signed out"); }, function () { clearData(); gate("login"); });
  }

  function setUserControls() {
    var hosted = source.mode === "supabase";
    var so = $("signout"), who = $("who");
    if (so) so.hidden = !hosted;
    if (who) { who.hidden = !(hosted && SB_USER); if (SB_USER) $("whoName").textContent = SB_USER.name; }
  }

  /* ── Navigation ───────────────────────────────────────────────────── */
  function go(v) {
    view = v;
    ["overview", "leads", "queue", "method"].forEach(function (k) { $("v-" + k).hidden = k !== v; });
    $("filters").hidden = v === "method";
    document.querySelectorAll("#nav button").forEach(function (b) {
      var on = b.dataset.view === v;
      b.classList.toggle("on", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    $("title").textContent = { overview: "Lead Intelligence", leads: "Leads", queue: "Action Queue", method: "Scoring Method" }[v];
    try { history.replaceState(null, "", "#" + v); } catch (e) { /* ignore */ }
    $("main").scrollTop = 0; window.scrollTo(0, 0);
  }

  /* ── Drawer / modal / toast / tooltip ─────────────────────────────── */
  function openDrawer() {
    lastFocus = lastFocus || document.activeElement;
    closeModal(true);
    $("drawer").classList.add("on"); $("scrim").classList.add("on");
    $("dBody").scrollTop = 0; $("drawer").focus();
  }
  function closeDrawer() { $("drawer").classList.remove("on"); maybeHideScrim(); restoreFocus(); }
  function openModal(kick, title, html) {
    lastFocus = document.activeElement;
    $("mKick").textContent = kick; $("mTitle").textContent = title; $("mBody").innerHTML = html;
    $("modal").classList.add("on"); $("scrim").classList.add("on");
    $("modal").querySelector(".mc").focus();
  }
  function closeModal(silent) { $("modal").classList.remove("on"); if (!silent) { maybeHideScrim(); restoreFocus(); } }
  function maybeHideScrim() { if (!$("drawer").classList.contains("on") && !$("modal").classList.contains("on")) $("scrim").classList.remove("on"); }
  function restoreFocus() { if (lastFocus && document.contains(lastFocus) && !$("scrim").classList.contains("on")) { lastFocus.focus(); lastFocus = null; } }
  function closeAll() { $("drawer").classList.remove("on"); $("modal").classList.remove("on"); $("scrim").classList.remove("on"); restoreFocus(); }

  function toast(t) { var el = $("toast"); el.textContent = t; el.classList.add("on"); clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove("on"); }, 3200); }

  var tip = $("tip");
  document.addEventListener("mousemove", function (e) {
    var t = e.target.closest && e.target.closest("[data-tip]");
    if (!t) { tip.style.opacity = 0; return; }
    if (tip._for !== t) { tip.innerHTML = t.getAttribute("data-tip"); tip._for = t; }
    var x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8), y = e.clientY + 16;
    if (y + tip.offsetHeight > window.innerHeight - 8) y = e.clientY - tip.offsetHeight - 12;
    tip.style.left = x + "px"; tip.style.top = y + "px"; tip.style.opacity = 1;
  });
  document.addEventListener("scroll", function () { tip.style.opacity = 0; }, true);

  function setEmbeddedControls() {
    var r = $("reload"), x = $("export");
    r.lastChild.textContent = "Load CSV"; r.title = "Load an updated wanyxi_scored_leads.csv";
    x.lastChild.textContent = "Copy view as CSV"; x.title = "Copy the leads currently shown, as CSV";
  }

  /* ── Export ───────────────────────────────────────────────────────── */
  function exportCSV() {
    var rows = filtered().sort(sorter());
    if (!rows.length) return toast("Nothing to export — no leads match the filters");
    var cols = RAW_COLUMNS.concat(SCORE_COLUMNS, REC_OK ? REC_COLUMNS : []);
    var cell = function (v) { v = String(v == null ? "" : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var csv = cols.join(",") + "\n" + rows.map(function (r) { return cols.map(function (c) { return cell(r[c]); }).join(","); }).join("\n") + "\n";
    if (source.mode === "embedded" || source.mode === "file-embedded") {
      var n = rows.length, okMsg = function () { toast("Copied " + plural(n, "lead") + " as CSV — paste into Excel or Sheets"); };
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(csv).then(okMsg, function () { fallbackCopy(csv); okMsg(); });
      fallbackCopy(csv); return okMsg();
    }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "wanyxi_leads_view_" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast("Exported " + plural(rows.length, "lead"));
  }
  function copySummary(id) {
    var r = all.filter(function (x) { return x.lead_id === id; })[0];
    var txt = r.company_name + " (" + r.lead_id + ") — " + r.priority + ", score " + r.total_score + "/100\n" +
      r.industry + " · " + r.service_interest + " · via " + r.lead_source + "\nNeed: " + r.business_need + "\nNext step: " + r.recommended_action;
    if (REC_OK) {
      var ri = recInfo(r);
      txt += "\nRecommended service: " + ri.label + " (" + ri.status + ")" +
        "\nFollow up: " + val(r.follow_up_timing) + " via " + val(r.recommended_channel) +
        "\nNext best action: " + val(r.next_best_action);
    }
    var done = function () { toast("Lead summary copied"); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt); done(); });
    else { fallbackCopy(txt); done(); }
  }
  function fallbackCopy(t) { var ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = 0; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) { /* ignore */ } ta.remove(); }

  /* ── Events (one delegated listener keeps every control wired) ────── */
  document.addEventListener("click", function (e) {
    var t = e.target;
    var el;
    if ((el = t.closest("[data-close]"))) return el.closest("#drawer") ? closeDrawer() : closeModal();
    if (t === $("scrim")) return closeAll();
    if ((el = t.closest("#nav [data-view]"))) return go(el.dataset.view);
    if ((el = t.closest("[data-kpi]"))) return openKpi(el.dataset.kpi);
    if ((el = t.closest("[data-group]"))) return openGroup(el.dataset.group, el.dataset.v);
    if ((el = t.closest("[data-lead]"))) {
      var inDrawer = el.closest("#drawer");
      return openLead(el.dataset.lead, inDrawer ? [currentGroup.f, currentGroup.v] : null);
    }
    if ((el = t.closest("[data-ins]"))) return openInsight(+el.dataset.ins);
    if ((el = t.closest("[data-qmode]"))) { qMode = el.dataset.qmode; qCombo = ""; return renderQueue(filtered()); }
    if ((el = t.closest("[data-qtime]"))) { qTime = qTime === el.dataset.qtime ? "" : el.dataset.qtime; return renderQueue(filtered()); }
    if ((el = t.closest("[data-qcombo]"))) { qMode = "discovery"; qCombo = qCombo === el.dataset.qcombo ? "" : el.dataset.qcombo; return renderQueue(filtered()); }
    if ((el = t.closest("[data-qsvc]"))) { qMode = "clear"; qCombo = qCombo === el.dataset.qsvc ? "" : el.dataset.qsvc; return renderQueue(filtered()); }
    if (t.closest("#qclear")) { qMode = "all"; qTime = ""; qCombo = ""; return renderQueue(filtered()); }
    if ((el = t.closest("[data-sort]"))) {
      var k = el.dataset.sort;
      sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: (k === "total_score" || k === "priority" || k === "company_size") ? -1 : 1 };
      return renderTable(filtered());
    }
    if ((el = t.closest("#indSort button"))) {
      indSort = el.dataset.k;
      document.querySelectorAll("#indSort button").forEach(function (b) { b.classList.toggle("on", b === el); });
      return renderIndustries(filtered());
    }
    if (t.closest("[data-reset]") || t.closest("#freset")) return resetFilters();
    if ((el = t.closest("[data-act]"))) {
      var a = el.dataset.act;
      if (a === "apply") { closeAll(); return setFilter(el.dataset.k, el.dataset.v); }
      if (a === "apply-table") { closeAll(); return setFilter(el.dataset.k, el.dataset.v, { go: "leads" }); }
      if (a === "kpi-view") { closeAll(); return setFilter("priority", el.dataset.v, { go: "leads" }); }
      if (a === "go-leads") { closeAll(); return go("leads"); }
      if (a === "back") return openGroup(el.dataset.f, el.dataset.v);
      if (a === "copy") return copySummary(el.dataset.id);
    }
    if (t.closest("#allIns")) return openAllInsights();
    if (t.closest("#reload")) {
      if (source.mode === "supabase") return sbLoad(true);
      if (source.mode === "file") { toast("Choose the updated CSV file"); return gate("file"); }
      if (source.mode === "embedded" || source.mode === "file-embedded") return gate("pick");
      return load();
    }
    if (t.closest("#export")) return exportCSV();
    if (t.closest("#signout") || t.closest("[data-signout]")) return sbSignOut();
  });
  // remember which group list a lead was opened from, for the Back button
  var currentGroup = { f: null, v: null };
  var _openGroup = openGroup;
  openGroup = function (f, v) { currentGroup = { f: f, v: v }; _openGroup(f, v); };

  FILTER_DEF.forEach(function (d) { $(d.id).addEventListener("change", function () { F[d.key] = this.value; render(); }); });
  var qt;
  $("fq").addEventListener("input", function () { var v = this.value.trim(); clearTimeout(qt); qt = setTimeout(function () { F.q = v; render(); }, 120); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") return closeAll();
    if (e.key === "Enter" && e.target.matches && e.target.matches("tr[data-lead]")) openLead(e.target.dataset.lead);
    if (e.key === "/" && document.activeElement.tagName !== "INPUT" && !$("app").hidden) { e.preventDefault(); $("fq").focus(); }
  });

  /* ── Start ────────────────────────────────────────────────────────── */
  var start = (location.hash || "").replace("#", "");
  if (["overview", "leads", "queue", "method"].indexOf(start) >= 0) go(start);
  load();
})();
