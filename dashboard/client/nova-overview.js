/* Wanyxi client workspace: Executive Overview.
 *
 * Renders the overview from the period object built by NovaAnalytics.computePeriods()
 * and the intelligence built by NovaRecommend.build(). Builds DOM with createElement
 * only (no innerHTML, no inline handlers), so it runs under the site's strict CSP.
 * Exposed as window.NovaOverview and registered as the "overview" view.
 */
(function (root) {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var NR = function () { return root.NovaRecommend; };
  var DEFAULT_CURRENCY = "AED";   // assumption until dashboard/config.js sets `currency`
  var CUR = DEFAULT_CURRENCY, CUR_CONFIRMED = false;

  /* ── DOM helpers ──────────────────────────────────────────────────── */
  function h(tag, props) {
    var n = document.createElement(tag);
    props = props || {};
    if (props.cls) n.className = props.cls;
    if (props.text !== undefined && props.text !== null) n.textContent = props.text;
    if (props.attrs) Object.keys(props.attrs).forEach(function (k) { if (props.attrs[k] !== null && props.attrs[k] !== undefined) n.setAttribute(k, props.attrs[k]); });
    if (props.on) Object.keys(props.on).forEach(function (k) { n.addEventListener(k, props.on[k]); });
    for (var i = 2; i < arguments.length; i++) add(n, arguments[i]);
    return n;
  }
  function add(n, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(n, x); }); return; }
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  function sv(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); }
    return n;
  }
  function btn(cls, text, onClick, attrs) {
    var b = h("button", { cls: cls, text: text, attrs: attrs, on: onClick ? { click: onClick } : null });
    b.type = "button";
    return b;
  }

  /* ── Formatting ───────────────────────────────────────────────────── */
  var nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  function fInt(n) { return n === null || n === undefined || !isFinite(n) ? "—" : nf0.format(n); }
  function fShort(x) {
    if (x === null || x === undefined || !isFinite(x)) return "—";
    var a = Math.abs(x), s = x < 0 ? "−" : "";
    if (a >= 1e6) return s + (a / 1e6).toFixed(2) + "M";
    if (a >= 1e4) return s + Math.round(a / 1e3) + "K";
    return s + nf0.format(a);
  }
  function fMoney(x) { return (CUR ? CUR + " " : "") + fShort(x); }
  function fPct(x, d) { return x === null || x === undefined || !isFinite(x) ? "—" : (x < 0 ? "−" : "") + Math.abs(x * 100).toFixed(d === undefined ? 1 : d) + "%"; }
  function change(a, b) { return a !== null && a !== undefined && b ? a / b - 1 : null; }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function monShort(k) { var m = /^(\d{4})-(\d{2})/.exec(k || ""); return m ? MON[+m[2] - 1] + " " + m[1] : k; }

  /* ── Drawer (shared markup in index.html; same component as the admin dashboard) ── */
  var lastFocus = null;
  function openDrawer(o) {
    var d = document.getElementById("drawer"), s = document.getElementById("scrim");
    if (!d) return;
    lastFocus = document.activeElement;
    document.getElementById("dKick").textContent = o.kicker || "";
    document.getElementById("dTitle").textContent = o.title || "";
    document.getElementById("dSub").textContent = o.sub || "";
    var body = document.getElementById("dBody"), act = document.getElementById("dAct");
    body.replaceChildren(); act.replaceChildren();
    add(body, o.body);
    add(act, o.actions || []);
    add(act, btn("btn btn--line", "Close", closeDrawer));
    body.scrollTop = 0;
    d.classList.add("on"); s.classList.add("on");
    d.setAttribute("aria-hidden", "false");
    var x = d.querySelector(".x");
    if (x) x.focus();
  }
  function closeDrawer() {
    var d = document.getElementById("drawer"), s = document.getElementById("scrim");
    if (!d || !d.classList.contains("on")) return;
    d.classList.remove("on"); s.classList.remove("on");
    d.setAttribute("aria-hidden", "true");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener("click", function (ev) {
    if (ev.target && ev.target.closest && (ev.target.closest("#drawer [data-close]") || ev.target.id === "scrim")) closeDrawer();
  });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeDrawer(); });

  function gotoBtn(view, label) {
    var b = btn("btn btn--dark", label, function () { closeDrawer(); }, { "data-goto": view });
    return b;
  }

  /* Recommendation / check detail, written as a short analyst memo. */
  function openRec(r) {
    var isCheck = r.kind === "check";
    var body = [];
    body.push(h("div", { cls: "recom" + (isCheck ? " recom--check" : "") },
      h("div", { cls: "kicker", text: isCheck ? "What to check" : "Recommended action" }),
      h("p", { text: r.action.summary })));
    body.push(h("h4", { cls: "sub", text: "What we found" }), h("p", { cls: "dp", text: r.detected }));
    body.push(h("h4", { cls: "sub", text: "Why it matters" }), h("p", { cls: "dp", text: r.whyItMatters }));
    if (r.evidence && r.evidence.length) {
      var dl = h("dl", { cls: "evi" });
      r.evidence.forEach(function (e) { dl.appendChild(h("div", null, h("dt", { text: e[0] }), h("dd", { cls: "num", text: e[1] }))); });
      body.push(h("h4", { cls: "sub", text: "Evidence" }), dl);
    }
    var ol = h("ol", { cls: "steps" });
    r.action.steps.forEach(function (s) { ol.appendChild(h("li", { text: s })); });
    body.push(h("h4", { cls: "sub", text: "Next steps" }), ol);
    if (r.rows && r.rows.length) {
      body.push(h("h4", { cls: "sub", text: "Behind the numbers" }));
      r.rows.forEach(function (row) {
        body.push(h("div", { cls: "mini" },
          h("span", null, h("b", { text: row.name }), h("small", { text: row.sub })),
          h("span"),
          h("span", { cls: "num" + (row.neg ? " neg" : ""), text: row.value })));
      });
      if (r.rowsNote) body.push(h("p", { cls: "note", text: r.rowsNote }));
    }
    if (r.measure) body.push(h("h4", { cls: "sub", text: "How to measure it" }), h("p", { cls: "dp", text: r.measure }));
    if (r.priority) body.push(h("h4", { cls: "sub", text: "Priority and confidence" }),
      h("p", { cls: "dp", text: cap(r.priority.level) + " priority. " + r.priority.rationale }),
      h("p", { cls: "dp", text: cap(r.confidence.level) + " confidence. " + r.confidence.basis }));
    if (r.limitations) body.push(h("h4", { cls: "sub", text: "Limitations" }), h("p", { cls: "dp dim", text: r.limitations }));
    body.push(h("p", { cls: "provenance", text: "Generated by a fixed rule (" + r.id + ") from the data in this workspace. Not generative AI." }));
    openDrawer({
      kicker: r.domain, title: r.title,
      sub: isCheck ? "Data check" : cap(r.priority.level) + " priority · " + cap(r.confidence.level) + " confidence",
      body: body,
      actions: r.drill ? [gotoBtn(r.drill.view, "Open " + cap(r.drill.view))] : []
    });
  }
  function cap(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ── KPI row ──────────────────────────────────────────────────────── */
  function deltaChip(cur, prev, label, goodWhenUp) {
    var c = change(cur, prev);
    if (c === null) return null;
    var flat = Math.abs(c) < 0.005, up = c > 0;
    var tone = flat ? "flat" : (up === goodWhenUp ? "good" : "bad");
    return h("span", { cls: "chip delta delta--" + tone, attrs: { title: "Compared with " + label } },
      (flat ? "■ " : up ? "▲ " : "▼ ") + fPct(Math.abs(c)) + " vs " + label);
  }

  function kpiCard(o) {
    var b = h("button", { cls: "card kpi kpi2", attrs: { type: "button", "aria-label": o.label + ": " + o.aria } },
      h("span", { cls: "l" }, o.label, h("i", { text: "Explain →" })),
      h("span", { cls: "v num" }, o.prefix ? h("small", { cls: "pre", text: o.prefix }) : null, o.value),
      h("span", { cls: "r" }, o.chip, h("span", { cls: "ctx", text: o.context })));
    b.addEventListener("click", function () {
      var dl = h("dl", { cls: "evi" });
      o.rows.forEach(function (r) { dl.appendChild(h("div", null, h("dt", { text: r[0] }), h("dd", { cls: "num", text: r[1] }))); });
      openDrawer({
        kicker: "Key figure", title: o.label, sub: o.periodLine,
        body: [h("div", { cls: "big" }, h("b", { text: (o.prefix ? o.prefix + " " : "") + o.value }), h("span", { text: o.periodLabel })),
               h("h4", { cls: "sub", text: "What it means" }), h("p", { cls: "dp", text: o.means }),
               h("h4", { cls: "sub", text: "How it is calculated" }), h("p", { cls: "dp", text: o.calc }),
               h("h4", { cls: "sub", text: "The numbers" }), dl],
        actions: o.view ? [gotoBtn(o.view, "Open " + cap(o.view))] : []
      });
    });
    return b;
  }

  function kpis(ctx) {
    var A = ctx.A, P = ctx.P, pl = ctx.prevLabel, prevTxt = P ? pl : null;
    function row(label, cur, prev, fmt) { return [label, fmt(cur) + (P ? "  (" + pl + ": " + fmt(prev) + ")" : "")]; }
    var newC = ctx.newCustomers, buyers = A.customers.buyers;
    var cards = [
      kpiCard({ label: "Sales", prefix: CUR, value: fShort(A.sales.net), aria: fMoney(A.sales.net) + " net sales",
        chip: P ? deltaChip(A.sales.net, P.sales.net, pl, true) : null,
        context: "net of " + fMoney(A.sales.discount) + " discounts (" + fPct(A.sales.discountRate) + ")",
        periodLabel: ctx.label, periodLine: ctx.label + " · " + ctx.sublabel, view: "sales",
        means: "Revenue from active orders after discounts. Cancelled and returned orders are excluded; shipping is not included.",
        calc: "Σ quantity × unit price × (1 − discount) over order lines of active orders dated in the period.",
        rows: [row("Net sales", A.sales.net, P && P.sales.net, fMoney), row("Gross sales (before discount)", A.sales.gross, P && P.sales.gross, fMoney),
               row("Average discount", A.sales.discountRate, P && P.sales.discountRate, fPct)] }),
      kpiCard({ label: "Orders", value: fInt(A.orders.active), aria: fInt(A.orders.active) + " active orders",
        chip: P ? deltaChip(A.orders.active, P.orders.active, pl, true) : null,
        context: fMoney(A.sales.aov) + " average order value",
        periodLabel: ctx.label, periodLine: ctx.label + " · " + ctx.sublabel, view: "sales",
        means: "Orders that were not cancelled or returned. Pending orders are counted.",
        calc: "Count of orders dated in the period whose status is not cancelled, returned, refunded or failed.",
        rows: [row("Active orders", A.orders.active, P && P.orders.active, fInt), row("All orders", A.orders.all, P && P.orders.all, fInt),
               row("Average order value", A.sales.aov, P && P.sales.aov, fMoney),
               row("Cancelled or returned", A.orders.cancelled + A.orders.returned, P && (P.orders.cancelled + P.orders.returned), fInt)] }),
      kpiCard({ label: "Customers", value: fInt(buyers), aria: fInt(buyers) + " buying customers",
        chip: P ? deltaChip(buyers, P.customers.buyers, pl, true) : null,
        context: ctx.mode === "all" ? "of " + fInt(A.customers.total) + " customers on file" : fInt(newC) + " first-time buyers",
        periodLabel: ctx.label, periodLine: ctx.label + " · " + ctx.sublabel, view: "customers",
        means: "Customers who placed at least one active order in the period.",
        calc: "Distinct customer IDs on active orders in the period. First-time buyers placed their first-ever active order in the period.",
        rows: [row("Buying customers", buyers, P && P.customers.buyers, fInt)]
          .concat(ctx.mode !== "all" ? [row("First-time buyers", newC, ctx.prevNewCustomers, fInt)] : [])
          .concat([["Customers on file", fInt(A.customers.total)]]) }),
      kpiCard({ label: "Est. gross profit", prefix: CUR, value: fShort(A.profit.profit), aria: fMoney(A.profit.profit) + " estimated gross profit",
        chip: P ? deltaChip(A.profit.profit, P.profit.profit, pl, true) : null,
        context: fPct(A.profit.margin) + " margin" + (P ? " (was " + fPct(P.profit.margin) + ")" : ""),
        periodLabel: ctx.label, periodLine: ctx.label + " · " + ctx.sublabel, view: "products",
        means: "An estimate of profit on products sold, before shipping, payment fees and overheads. It is not accounting profit.",
        calc: "Net line revenue − quantity × product unit cost, on lines whose product has a unit cost (" + fPct(A.profit.coverage) + " of net sales).",
        rows: [row("Estimated gross profit", A.profit.profit, P && P.profit.profit, fMoney), row("Estimated margin", A.profit.margin, P && P.profit.margin, fPct),
               ["Sales with a recorded cost", fPct(A.profit.coverage)]] })
    ];
    return h("div", { cls: "kpis" }, cards);
  }

  /* ── Intelligence Brief (hero) ────────────────────────────────────── */
  function brief(ctx, intel, onChart) {
    var B = intel.brief;
    var byId = {};
    intel.recommendations.concat(intel.checks).forEach(function (r) { byId[r.id] = r; });

    function itemBtn(it, tone) {
      var r = it.ref || {};
      var target = r.rec ? byId[r.rec] : r.check ? byId[r.check] : null;
      var b = h("button", { cls: "bi bi--" + tone + (r.check ? " bi--check" : ""), attrs: { type: "button" } },
        h("span", { cls: "bi__t", text: it.text }),
        h("span", { cls: "bi__go", attrs: { "aria-hidden": "true" }, text: "→" }));
      b.addEventListener("click", function () {
        if (target) openRec(target);
        else if (r.chart) onChart(r.chart);
        else if (r.kpi) { var k = document.querySelector(".kpis .kpi"); if (k) k.click(); }
        else if (r.view) { var g = document.createElement("button"); g.dataset.goto = r.view; g.hidden = true; document.body.appendChild(g); g.click(); g.remove(); }
      });
      return b;
    }

    function col(key, title, tone) {
      var items = B.sections[key];
      if (!items.length) return null;
      return h("div", { cls: "bcol" },
        h("h3", { cls: "bcol__h" }, h("i", { cls: "dot dot--" + tone, attrs: { "aria-hidden": "true" } }), title),
        items.map(function (it) { return itemBtn(it, tone); }));
    }

    var seeAll = btn("btn btn--onDark", "All insights & actions", null, { "data-goto": "insights" });
    return h("section", { cls: "brief", attrs: { "aria-labelledby": "briefTitle" } },
      h("div", { cls: "brief__top" },
        h("div", { cls: "brief__mark" },
          h("span", { cls: "brief__logo", text: "WANYXI" }),
          h("span", { cls: "brief__kick", text: "Intelligence Brief" })),
        h("span", { cls: "brief__badge", attrs: { title: B.basis } },
          h("i", { attrs: { "aria-hidden": "true" } }), "Rule-based · " + ctx.label)),
      h("h2", { cls: "brief__head", attrs: { id: "briefTitle" }, text: B.headline }),
      B.sub ? h("p", { cls: "brief__sub", text: B.sub }) : null,
      h("div", { cls: "brief__cols" },
        col("matters", "What changed", "info"),
        col("concerns", "Needs attention", "warn"),
        col("opportunities", "Opportunities", "good")),
      h("div", { cls: "brief__foot" },
        h("p", { text: B.basis }),
        seeAll));
  }

  /* ── Business performance chart ───────────────────────────────────── */
  var METRICS = {
    net: { label: "Net sales", get: function (m) { return m.net; }, fmt: fMoney, axis: fShort, unit: CUR },
    profit: { label: "Est. gross profit", get: function (m) { return m.profit; }, fmt: fMoney, axis: fShort, unit: CUR },
    orders: { label: "Orders", get: function (m) { return m.orders; }, fmt: function (v) { return fInt(v) + " orders"; }, axis: fShort, unit: "orders" },
    discount: { label: "Avg discount", get: function (m) { return m.discountRate; }, fmt: function (v) { return fPct(v); }, axis: function (v) { return fPct(v, 0); }, unit: "%" }
  };

  function niceMax(v) {
    if (!(v > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
    var n = f <= 1 ? 1 : f <= 1.2 ? 1.2 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 3 ? 3 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 6 ? 6 : f <= 8 ? 8 : 10;
    return n * p;
  }

  function perfCard(ctx, state) {
    var months = ctx.full.monthly;
    var card = h("section", { cls: "card perf", attrs: { "aria-labelledby": "perfTitle" } });
    var seg = h("div", { cls: "seg", attrs: { role: "group", "aria-label": "Chart measure" } });
    Object.keys(METRICS).forEach(function (k) {
      var b = btn(k === state.metric ? "on" : "", METRICS[k].label, function () { state.metric = k; draw(); syncSeg(); }, { "aria-pressed": k === state.metric ? "true" : "false" });
      b.dataset.metric = k;
      seg.appendChild(b);
    });
    function syncSeg() {
      seg.querySelectorAll("button").forEach(function (b) { var on = b.dataset.metric === state.metric; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    }
    var sub = h("p", { cls: "perf__sub" });
    var plot = h("div", { cls: "perf__plot" });
    var legend = h("div", { cls: "perf__legend" });
    var live = h("p", { cls: "sr-only", attrs: { "aria-live": "polite" } });
    var tableWrap = h("details", { cls: "perf__table" }, h("summary", { text: "Show the numbers as a table" }));
    card.appendChild(h("div", { cls: "perf__head" },
      h("div", null, h("h2", { attrs: { id: "perfTitle" }, text: "Business performance" }), sub), seg));
    card.appendChild(plot);
    card.appendChild(legend);
    card.appendChild(live);
    card.appendChild(tableWrap);

    function draw() {
      var M = METRICS[state.metric];
      var pts = months.map(function (m) { return { k: m.month, v: M.get(m), m: m }; }).filter(function (p) { return p.v !== null && p.v !== undefined; });
      plot.replaceChildren();
      if (pts.length < 2) { plot.appendChild(h("p", { cls: "dim", text: "Not enough dated months to chart." })); return; }
      var W = Math.max(300, Math.round(plot.clientWidth || 1000)), H = W < 560 ? 230 : 300;
      var L = W < 560 ? 46 : 58, R = 16, T = 24, B = 34, iw = W - L - R, ih = H - T - B;
      var minV = Math.min(0, Math.min.apply(null, pts.map(function (p) { return p.v; })));
      var maxV = niceMax(Math.max.apply(null, pts.map(function (p) { return p.v; })) * 1.04);
      var lo = minV < 0 ? -niceMax(-minV) : 0;
      var X = function (i) { return L + (pts.length === 1 ? iw / 2 : i * iw / (pts.length - 1)); };
      var Y = function (v) { return T + ih - (v - lo) / (maxV - lo) * ih; };
      var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, class: "pchart", role: "img", tabindex: "0",
        "aria-label": M.label + " by month, " + monShort(pts[0].k) + " to " + monShort(pts[pts.length - 1].k) + ". Use the arrow keys to read each month." });

      // Period bands
      function band(r, cls, text) {
        if (!r) return;
        var i0 = -1, i1 = -1;
        pts.forEach(function (p, i) { var d = p.k + "-15"; if (d >= r.from && d <= r.to) { if (i0 < 0) i0 = i; i1 = i; } });
        if (i0 < 0) return;
        var half = iw / (pts.length - 1) / 2;
        var x0 = Math.max(L, X(i0) - half), x1 = Math.min(W - R, X(i1) + half);
        svg.appendChild(sv("rect", { x: x0, y: T, width: x1 - x0, height: ih, class: cls }));
        if (x1 - x0 >= 72) svg.appendChild(sv("text", { x: (x0 + x1) / 2, y: T - 8, "text-anchor": "middle", class: "pchart__bandl" }, text));
      }
      if (ctx.mode !== "all") { band(ctx.prevRange, "pchart__band pchart__band--prev", ctx.prevLabel || ""); band(ctx.range, "pchart__band", ctx.label); }

      // Grid + axis
      for (var g = 0; g <= 4; g++) {
        var v = lo + (maxV - lo) * g / 4, y = Y(v);
        svg.appendChild(sv("line", { x1: L, x2: W - R, y1: y, y2: y, class: v === 0 ? "pchart__zero" : "pchart__grid" }));
        svg.appendChild(sv("text", { x: L - 10, y: y + 4, "text-anchor": "end", class: "pchart__axl" }, M.axis(v)));
      }
      var fit = Math.max(2, Math.floor(iw / 78)), step = Math.max(1, Math.ceil(pts.length / fit));
      pts.forEach(function (p, i) {
        var lastI = pts.length - 1;
        if (i % step && i !== lastI) return;
        if (i !== lastI && X(lastI) - X(i) < 64) return;
        svg.appendChild(sv("text", { x: X(i), y: H - 10, "text-anchor": i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle", class: "pchart__axl" }, monShort(p.k)));
      });

      // Area + line
      var d = "", a = "";
      pts.forEach(function (p, i) { d += (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.v).toFixed(1); });
      a = d + "L" + X(pts.length - 1).toFixed(1) + " " + Y(Math.max(lo, 0)).toFixed(1) + "L" + X(0).toFixed(1) + " " + Y(Math.max(lo, 0)).toFixed(1) + "Z";
      svg.appendChild(sv("path", { d: a, class: "pchart__area" }));
      svg.appendChild(sv("path", { d: d, class: "pchart__line" }));

      // Peak annotation
      var pk = 0; pts.forEach(function (p, i) { if (p.v > pts[pk].v) pk = i; });
      svg.appendChild(sv("circle", { cx: X(pk), cy: Y(pts[pk].v), r: 4.5, class: "pchart__peak" }));
      var peakText = (W < 560 ? "" : "Peak · ") + monShort(pts[pk].k) + " · " + M.fmt(pts[pk].v);
      var flip = X(pk) + 14 + peakText.length * 6.6 > W - R;
      svg.appendChild(sv("text", { x: X(pk) + (flip ? -10 : 10), y: Y(pts[pk].v) + 4, "text-anchor": flip ? "end" : "start", class: "pchart__peakl" }, peakText));

      // Hover / keyboard focus
      var cross = sv("line", { x1: 0, x2: 0, y1: T, y2: T + ih, class: "pchart__cross", visibility: "hidden" });
      var dot = sv("circle", { cx: 0, cy: 0, r: 5, class: "pchart__dot", visibility: "hidden" });
      svg.appendChild(cross); svg.appendChild(dot);
      var tip = document.getElementById("tip");
      function show(i, evt) {
        var p = pts[i];
        state.focus = i;
        cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("visibility", "visible");
        dot.setAttribute("cx", X(i)); dot.setAttribute("cy", Y(p.v)); dot.setAttribute("visibility", "visible");
        var detail = fMoney(p.m.net) + " net · " + fInt(p.m.orders) + " orders · " + fPct(p.m.discountRate) + " avg discount" +
          (p.m.margin !== null ? " · " + fPct(p.m.margin) + " est. margin" : "");
        live.textContent = monShort(p.k) + ": " + M.label + " " + M.fmt(p.v) + ". " + detail;
        if (tip) {
          tip.replaceChildren(h("span", { text: monShort(p.k) }), h("b", { text: M.fmt(p.v) }), h("span", { text: detail }));
          var box = svg.getBoundingClientRect();
          var px = box.left + X(i) / W * box.width, py = box.top + Y(p.v) / H * box.height;
          tip.style.opacity = "1";
          var tw = tip.offsetWidth || 220;
          tip.style.left = Math.max(8, Math.min(window.innerWidth - tw - 8, px - tw / 2)) + "px";
          tip.style.top = Math.max(8, py - (tip.offsetHeight || 60) - 14) + "px";
        }
      }
      function hide() {
        cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden");
        if (tip) tip.style.opacity = "0";
      }
      function idxFromEvent(e) {
        var box = svg.getBoundingClientRect();
        var x = (e.clientX - box.left) / box.width * W;
        return Math.max(0, Math.min(pts.length - 1, Math.round((x - L) / (iw / (pts.length - 1)))));
      }
      svg.addEventListener("mousemove", function (e) { show(idxFromEvent(e), e); });
      svg.addEventListener("mouseleave", hide);
      svg.addEventListener("blur", hide);
      svg.addEventListener("focus", function () { show(state.focus === undefined || state.focus === null ? pts.length - 1 : Math.min(state.focus, pts.length - 1)); });
      svg.addEventListener("keydown", function (e) {
        var i = state.focus === undefined || state.focus === null ? pts.length - 1 : state.focus;
        if (e.key === "ArrowLeft") { e.preventDefault(); show(Math.max(0, i - 1)); }
        else if (e.key === "ArrowRight") { e.preventDefault(); show(Math.min(pts.length - 1, i + 1)); }
        else if (e.key === "Home") { e.preventDefault(); show(0); }
        else if (e.key === "End") { e.preventDefault(); show(pts.length - 1); }
      });
      svg.addEventListener("touchstart", function (e) { if (e.touches[0]) show(idxFromEvent(e.touches[0])); }, { passive: true });
      plot.appendChild(svg);

      // Summary line: current period vs previous for the selected metric
      var A = ctx.A, P = ctx.P, cur = null, prev = null;
      if (state.metric === "net") { cur = A.sales.net; prev = P && P.sales.net; }
      else if (state.metric === "profit") { cur = A.profit.profit; prev = P && P.profit.profit; }
      else if (state.metric === "orders") { cur = A.orders.active; prev = P && P.orders.active; }
      else { cur = A.sales.discountRate; prev = P && P.sales.discountRate; }
      sub.textContent = M.label + " by month, " + monShort(pts[0].k) + " – " + monShort(pts[pts.length - 1].k) +
        (ctx.mode !== "all" ? " · " + ctx.label + ": " + M.fmt(cur) + (P ? " (" + ctx.prevLabel + ": " + M.fmt(prev) + ")" : "") : "");

      legend.replaceChildren.apply(legend, [
        h("span", null, h("i", { cls: "lg lg--line" }), M.label + (M.unit === CUR ? " (" + CUR + ")" : "")),
        ctx.mode !== "all" ? h("span", null, h("i", { cls: "lg lg--band" }), ctx.label) : null,
        ctx.mode !== "all" && ctx.prevRange ? h("span", null, h("i", { cls: "lg lg--prev" }), ctx.prevLabel) : null,
        state.metric === "profit" ? h("span", { cls: "dim", text: "Estimated: unit costs cover " + fPct(ctx.full.profit.coverage) + " of sales" }) : null
      ].filter(Boolean));

      // Accessible table
      var tbl = h("table", { cls: "tbl" },
        h("thead", null, h("tr", null, ["Month", "Net sales", "Orders", "Avg discount", "Est. gross profit", "Est. margin"].map(function (t, i) {
          var th = h("th", { cls: i ? "num" : "", text: t }); th.scope = "col"; return th; }))),
        h("tbody", null, months.map(function (m) {
          return h("tr", null, h("td", { text: monShort(m.month) }), h("td", { cls: "num", text: fMoney(m.net) }), h("td", { cls: "num", text: fInt(m.orders) }),
            h("td", { cls: "num", text: fPct(m.discountRate) }), h("td", { cls: "num", text: fMoney(m.profit) }), h("td", { cls: "num", text: fPct(m.margin) }));
        })));
      var old = tableWrap.querySelector(".tblwrap");
      if (old) old.remove();
      tableWrap.appendChild(h("div", { cls: "tblwrap" }, tbl));
    }

    card.redraw = draw;
    card.focusMonth = function (k) {
      var i = months.map(function (m) { return m.month; }).indexOf(k);
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      var svg = plot.querySelector("svg");
      if (svg && i >= 0) { state.focus = i; setTimeout(function () { svg.focus({ preventScroll: true }); }, 350); }
    };
    return card;
  }

  /* ── Recommended actions ──────────────────────────────────────────── */
  function actionCol(r, i) {
    var prio = h("span", { cls: "tag tag--" + (r.priority.level === "high" ? "hot" : r.priority.level === "medium" ? "warm" : "low"), text: r.priority.level + " priority" });
    var b = btn("btn btn--line act__open", "Open analysis", function () { openRec(r); });
    return h("article", { cls: "act" },
      h("div", { cls: "act__top" }, h("span", { cls: "act__n", text: "0" + (i + 1) }), prio, h("span", { cls: "act__dom", text: r.domain })),
      h("h3", { cls: "act__title", text: r.title }),
      h("div", { cls: "act__metric" }, h("b", { cls: "num" + (r.metric.tone === "bad" ? " neg" : ""), text: r.metric.display }), h("span", { text: r.metric.label })),
      h("p", { cls: "act__why", text: r.whyItMatters }),
      h("div", { cls: "act__next" }, h("span", { cls: "kicker", text: "Next step" }), h("p", { text: r.action.steps[0] })),
      h("div", { cls: "act__foot" },
        h("span", { cls: "act__conf", text: cap(r.confidence.level) + " confidence · " + r.confidence.basis }),
        b));
  }

  function actions(intel) {
    var recs = intel.recommendations;
    var card = h("section", { cls: "card acts", attrs: { "aria-labelledby": "actsTitle" } });
    card.appendChild(h("div", { cls: "sh" },
      h("h2", { attrs: { id: "actsTitle" }, text: "Recommended actions" }),
      h("span", null, recs.length ? "Top " + Math.min(3, recs.length) + " of " + recs.length + ", ranked by priority and money at stake · " : "",
        btn("linkbtn", "See all", null, { "data-goto": "insights" }))));
    if (!recs.length) {
      card.appendChild(h("p", { cls: "dim", text: "No rule found an action worth taking in this period." }));
      return card;
    }
    card.appendChild(h("div", { cls: "acts__grid" }, recs.slice(0, 3).map(actionCol)));
    return card;
  }

  /* ── Ask WANYXI ───────────────────────────────────────────────────── */
  function ask(ctx, intel) {
    var connected = !!(root.WANYXI_DASHBOARD && root.WANYXI_DASHBOARD.askEndpoint);   // no live AI backend exists yet
    var byId = {};
    intel.recommendations.forEach(function (r) { byId[r.id] = r; });
    var A = ctx.A;

    var Q = [
      { q: "Where am I losing money?", kw: /los(e|s|ing)|margin|below cost|unprofit/i, a: function () {
        var r = byId["pricing.loss-products"];
        return r ? { text: r.detected + " " + r.whyItMatters, rec: r } : { text: "No product sold below its unit cost in " + ctx.label + "." };
      } },
      { q: "Which payments need follow-up?", kw: /pay|collect|unpaid|owe|outstanding|cash/i, a: function () {
        var r = byId["collection.uncollected"];
        return r ? { text: r.detected + " " + r.action.steps.join(" "), rec: r } : { text: "Every active order in " + ctx.label + " has a collected payment." };
      } },
      { q: "What changed this period?", kw: /chang|trend|quarter|month|compare|growth|grow|declin|fell|drop/i, a: function () {
        return { text: intel.brief.headline + (intel.brief.sub ? " " + intel.brief.sub : "") +
          (ctx.mode === "all" ? " Choose Quarter at the top of the page to compare periods." : "") };
      } },
      { q: "Which products earn the most?", kw: /best|top|earn|profit|product|bestsell/i, a: function () {
        var top = A.products.all.filter(function (p) { return p.costed; }).sort(function (a, b) { return b.profit - a.profit; }).slice(0, 3);
        return { text: top.length ? "By estimated gross profit in " + ctx.label + ": " + top.map(function (p, i) {
          return (i + 1) + ". " + p.name + ", " + fMoney(p.profit) + " (" + fPct(p.margin) + " margin)"; }).join("; ") + "." : "No product has a recorded unit cost." };
      } }
    ];

    var thread = h("div", { cls: "ask__thread", attrs: { "aria-live": "polite" } });
    function answer(question, match, matchedNote) {
      var res = match.a();
      thread.replaceChildren(
        h("div", { cls: "ask__q" }, h("span", { cls: "kicker", text: "You asked" }), h("p", { text: question })),
        h("div", { cls: "ask__a" },
          h("span", { cls: "ask__who" }, h("b", { text: "WANYXI" }), h("em", { text: matchedNote ? "Rule-based answer · " + matchedNote : "Rule-based answer from your data · not generative AI" })),
          h("p", { text: res.text }),
          res.rec ? btn("linkbtn", "Open the evidence →", function () { openRec(res.rec); }) : null));
    }
    function notAvailable(question) {
      thread.replaceChildren(
        h("div", { cls: "ask__q" }, h("span", { cls: "kicker", text: "You asked" }), h("p", { text: question })),
        h("div", { cls: "ask__a ask__a--off" },
          h("span", { cls: "ask__who" }, h("b", { text: "WANYXI" }), h("em", { text: "Live AI not connected" })),
          h("p", { text: "Free-form questions need the live AI connection, which is not enabled for this workspace yet. Choose one of the questions above: WANYXI answers those from your data with fixed rules." })));
    }

    var input = h("input", { attrs: { type: "text", id: "askInput", placeholder: "Ask about sales, margins, payments or products…", autocomplete: "off", maxlength: "200" } });
    var lbl = h("label", { cls: "sr-only", attrs: { for: "askInput" }, text: "Ask WANYXI a question" });
    var send = h("button", { cls: "btn btn--dark", attrs: { type: "submit" }, text: "Ask" });
    var form = h("form", { cls: "ask__form", attrs: { novalidate: "" } }, lbl, input, send);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) return;
      var m = Q.filter(function (x) { return x.kw.test(q); })[0];
      if (m && !connected) answer(q, m, "matched to “" + m.q + "”");
      else notAvailable(q);
    });

    return h("section", { cls: "card ask", attrs: { "aria-labelledby": "askTitle" } },
      h("div", { cls: "ask__head" },
        h("div", null,
          h("h2", { attrs: { id: "askTitle" }, text: "Ask WANYXI" }),
          h("p", { cls: "ask__lead", text: "Questions about your business, answered with the evidence behind them." })),
        h("span", { cls: "ask__status" + (connected ? " on" : "") }, h("i", { attrs: { "aria-hidden": "true" } }),
          connected ? "Live AI connected" : "Live AI not connected · rule-based answers only")),
      h("div", { cls: "ask__chips", attrs: { role: "group", "aria-label": "Suggested questions" } },
        Q.map(function (x) { return btn("ask__chip", x.q, function () { input.value = x.q; answer(x.q, x); }); })),
      form,
      thread);
  }

  /* ── Data checks strip ────────────────────────────────────────────── */
  /* Figures stay "provisional" until the currency is configured and every data check is resolved. */
  function checksStrip(intel) {
    var open = [];
    if (!CUR_CONFIRMED) open.push({ text: "Currency assumed to be " + CUR + ": the source data has no currency field." });
    intel.checks.forEach(function (c) { open.push({ text: c.title + ".", check: c }); });
    if (!open.length) return null;
    return h("div", { cls: "dcheck", attrs: { role: "note", "aria-label": "Provisional figures" } },
      h("span", { cls: "dcheck__tag", text: "Provisional figures" }),
      h("ul", { cls: "dcheck__list" }, open.map(function (o) {
        return h("li", null, o.text, o.check ? [" ", btn("linkbtn", "Review", function () { openRec(o.check); })] : null);
      })));
  }

  /* ── Render ───────────────────────────────────────────────────────── */
  var STATE = { metric: "net" };

  function render(host, A, ctx) {
    if (!ctx || !ctx.intel) throw new Error("The overview needs the period and recommendation modules.");
    var cfgCur = root.WANYXI_DASHBOARD && root.WANYXI_DASHBOARD.currency;
    CUR = cfgCur || DEFAULT_CURRENCY;
    CUR_CONFIRMED = !!cfgCur;
    if (NR()) NR().setCurrency(CUR);
    STATE.focus = null;
    var perf = perfCard(ctx, STATE);
    var page = h("div", { cls: "xo" },
      kpis(ctx),
      brief(ctx, ctx.intel, function (k) { perf.focusMonth(k); }),
      checksStrip(ctx.intel),
      perf,
      actions(ctx.intel),
      ask(ctx, ctx.intel),
      h("p", { cls: "xo__foot" },
        "Figures are calculated in your browser from " + fInt(ctx.full.counts.orders) + " orders, " + fInt(ctx.full.counts.items) + " order lines and " +
        fInt(ctx.full.counts.payments) + " payments in this workspace. Amounts in " + CUR + (CUR_CONFIRMED ? ". " : " (assumed, not yet confirmed). "),
        btn("linkbtn", "How figures are calculated", null, { "data-goto": "insights" })));
    host.appendChild(page);
    CURRENT_PERF = perf;
    perf.redraw();
  }

  var CURRENT_PERF = null, resizeTimer = null, lastW = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!CURRENT_PERF || !document.body.contains(CURRENT_PERF)) return;
      var w = CURRENT_PERF.clientWidth;
      if (Math.abs(w - lastW) > 8) { lastW = w; CURRENT_PERF.redraw(); }
    }, 120);
  });

  root.NovaOverview = { render: render, openRec: openRec, openDrawer: openDrawer, closeDrawer: closeDrawer, actionCol: actionCol };
  if (root.NovaViews && root.NovaViews.register) root.NovaViews.register("overview", render);
})(window);
