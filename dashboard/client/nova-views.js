/* Wanyxi client workspace: renders the Nova analytics views.
 *
 * Builds DOM with createElement / createElementNS only (no innerHTML, no inline
 * handlers, no style attributes in markup), so it works under the site's
 * Content-Security-Policy. Sizes are set through the CSSOM (element.style),
 * which a strict style-src allows. Exposed as window.NovaViews.
 */
(function (root) {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var nfc = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function sv(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function fInt(n) { return n === null || n === undefined || !isFinite(n) ? "—" : nf0.format(n); }
  function fMoney(n) { return n === null || n === undefined || !isFinite(n) ? "—" : (Math.abs(n) >= 1e6 ? nfc.format(n) : nf0.format(n)); }
  function fMoney2(n) { return n === null || n === undefined || !isFinite(n) ? "—" : nf2.format(n); }
  function fPct(x, d) { return x === null || x === undefined || !isFinite(x) ? "—" : (x * 100).toFixed(d === undefined ? 1 : d) + "%"; }
  function fNum(x, d) { return x === null || x === undefined || !isFinite(x) ? "—" : x.toFixed(d === undefined ? 1 : d); }

  /* ── Building blocks ─────────────────────────────────────────────── */
  function kpis(items) {
    var g = el("div", "kpis");
    items.forEach(function (it) {
      var c = el("div", "card kpi");
      c.appendChild(el("div", "l", it.label));
      c.appendChild(el("div", "v num", it.value));
      if (it.sub) c.appendChild(el("div", "ksub", it.sub));
      g.appendChild(c);
    });
    return g;
  }

  function section(host, title, sub, wide) {
    var card = el("div", "card sec" + (wide ? " sec--wide" : ""));
    var sh = el("div", "sh");
    sh.appendChild(el("h2", "", title));
    if (sub) sh.appendChild(el("span", "", sub));
    card.appendChild(sh);
    host.appendChild(card);
    return card;
  }

  function empty(card, text) { card.appendChild(el("p", "dim", text)); }

  function bars(card, rows, fmt) {
    if (!rows.length) return empty(card, "No data for this section.");
    var max = 0;
    rows.forEach(function (r) { if (r.value > max) max = r.value; });
    var list = el("div", "bars");
    rows.forEach(function (r) {
      var row = el("div", "bar");
      row.appendChild(el("div", "bar__l", r.label));
      var track = el("div", "bar__t"), fill = el("div", "bar__f");
      fill.style.width = (max > 0 ? Math.max(0, r.value / max) * 100 : 0) + "%";
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el("div", "bar__v num", (fmt || fMoney)(r.value) + (r.note ? "  ·  " + r.note : "")));
      list.appendChild(row);
    });
    card.appendChild(list);
  }

  function table(card, cols, rows) {
    if (!rows.length) return empty(card, "No data for this section.");
    var wrap = el("div", "tblwrap"), t = el("table", "tbl"), thead = el("thead"), hr = el("tr");
    cols.forEach(function (c) { var th = el("th", c.num ? "num" : "", c.label); th.scope = "col"; hr.appendChild(th); });
    thead.appendChild(hr); t.appendChild(thead);
    var tb = el("tbody");
    rows.forEach(function (r) {
      var tr = el("tr");
      cols.forEach(function (c) {
        var v = r[c.key];
        tr.appendChild(el("td", c.num ? "num" : "", c.fmt ? c.fmt(v, r) : (v === null || v === undefined ? "—" : String(v))));
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); card.appendChild(wrap);
  }

  /* Line or column chart. points: [{label, value}] */
  function chart(card, points, opts) {
    opts = opts || {};
    if (!points.length) return empty(card, "No dated records to chart.");
    var W = 720, H = 230, L = 52, R = 12, T = 12, B = 30, iw = W - L - R, ih = H - T - B;
    var max = 0;
    points.forEach(function (p) { if (p.value > max) max = p.value; });
    if (max <= 0) max = 1;
    var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, role: "img", class: "chart", preserveAspectRatio: "xMidYMid meet" });
    svg.appendChild(sv("title", {}, opts.title || "Chart"));
    [0, 0.5, 1].forEach(function (f) {
      var y = T + ih - f * ih;
      svg.appendChild(sv("line", { x1: L, x2: W - R, y1: y, y2: y, class: "grid" }));
      svg.appendChild(sv("text", { x: L - 6, y: y + 4, "text-anchor": "end", class: "axl" }, (opts.fmt || fMoney)(max * f)));
    });
    var n = points.length, step = n > 1 ? iw / (n - 1) : 0;
    if (opts.type === "col") {
      var bw = Math.max(2, Math.min(28, iw / n * 0.7));
      points.forEach(function (p, i) {
        var x = L + (iw / n) * (i + 0.5) - bw / 2, h = (p.value / max) * ih;
        var r = sv("rect", { x: x, y: T + ih - h, width: bw, height: h, class: "col" });
        r.appendChild(sv("title", {}, p.label + ": " + (opts.fmt || fMoney)(p.value)));
        svg.appendChild(r);
      });
    } else {
      var d = "";
      points.forEach(function (p, i) {
        var x = n > 1 ? L + i * step : L + iw / 2, y = T + ih - (p.value / max) * ih;
        d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
      });
      svg.appendChild(sv("path", { d: d, class: "ln", fill: "none" }));
      if (n <= 40) points.forEach(function (p, i) {
        var x = n > 1 ? L + i * step : L + iw / 2, y = T + ih - (p.value / max) * ih;
        var c = sv("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: 3, class: "dot" });
        c.appendChild(sv("title", {}, p.label + ": " + (opts.fmt || fMoney)(p.value)));
        svg.appendChild(c);
      });
    }
    var ticks = n <= 6 ? points.map(function (p, i) { return i; }) : [0, Math.floor((n - 1) / 2), n - 1];
    ticks.forEach(function (i) {
      var x = opts.type === "col" ? L + (iw / n) * (i + 0.5) : (n > 1 ? L + i * step : L + iw / 2);
      svg.appendChild(sv("text", { x: x, y: H - 8, "text-anchor": i === 0 && n > 1 ? "start" : (i === n - 1 && n > 1 ? "end" : "middle"), class: "axl" }, points[i].label));
    });
    card.appendChild(svg);
  }

  function grid(host) { var g = el("div", "grid2"); host.appendChild(g); return g; }
  function note(host, text) { host.appendChild(el("div", "note note--info", text)); }

  /* Definitions and data notes: how every figure is calculated */
  function notesCard(host, A) {
    var c = section(host, "How these figures are calculated", "Definitions and data notes", true);
    var d = A.assumptions.discount;
    var disc = d.kind === "none" ? "All discount_pct values are 0 or empty."
      : d.kind === "fraction" ? "discount_pct values run from " + d.min + " to " + d.max + ", so they are read as fractions (0.10 = 10%)."
      : "discount_pct values run from " + d.min + " to " + d.max + ", so they are read as percentages (10 = 10%).";
    var lines = [
      ["Gross sales", "Σ quantity × unit_price over order lines of active orders (before discount)."],
      ["Discounts", disc + " Discount amount = gross − net."],
      ["Net sales", "Σ quantity × unit_price × (1 − discount) over active orders. Shipping cost is not included."],
      ["Active orders", "Orders whose status is not cancelled, returned, refunded or failed. Only active orders count toward sales, products, customers and AOV."],
      ["Average order value", "Net sales ÷ active orders."],
      ["Collected payments", "Σ payment_amount where payment_status is a collected/paid/successful status. Pending, failed and refunded amounts are shown separately and never added to collected."],
      ["Estimated gross profit", "Net line revenue − quantity × products.unit_cost, only for lines whose product has a unit_cost (" + fPct(A.profit.coverage) + " of net sales). It excludes shipping, payment fees and overheads, and assumes unit_cost is a per-unit cost."],
      ["Repeat customer", "A customer with two or more active orders."],
      ["Delivery time", "delivery_days on orders that have a value and are not cancelled."],
      ["Currency", "The dataset has no currency column, so amounts are shown as plain numbers."]
    ];
    var dl = el("dl", "defs");
    lines.forEach(function (l) { dl.appendChild(el("dt", "", l[0])); dl.appendChild(el("dd", "", l[1])); });
    c.appendChild(dl);

    var ob = el("p", "dim", "Order statuses found in the data and how they are treated:");
    c.appendChild(ob);
    table(c, [{ key: "status", label: "Status" }, { key: "cls", label: "Treated as" }, { key: "count", label: "Orders", num: true, fmt: fInt }],
      A.assumptions.orderStatuses.map(function (s) { return { status: s.status, cls: s.cls === "active" ? "active (counted)" : s.cls + " (excluded)", count: s.count }; }));
    c.appendChild(el("p", "dim", "Payment statuses found in the data and how they are treated:"));
    table(c, [{ key: "status", label: "Status" }, { key: "cls", label: "Treated as" }, { key: "count", label: "Payments", num: true, fmt: fInt }, { key: "amount", label: "Amount", num: true, fmt: fMoney }],
      A.assumptions.paymentStatuses);

    var q = A.quality, notes = [];
    if (q.duplicatesDropped) notes.push(q.duplicatesDropped + " duplicate rows ignored.");
    if (q.orphanItems) notes.push(q.orphanItems + " order lines reference a missing order and are excluded.");
    if (q.orphanPayments) notes.push(q.orphanPayments + " payments reference a missing order.");
    if (q.skippedLines) notes.push(q.skippedLines + " order lines lack a usable quantity or price and are excluded.");
    if (q.invalidDiscount) notes.push(q.invalidDiscount + " order lines have an out-of-range discount and were treated as undiscounted.");
    if (q.unknownProductLines) notes.push(q.unknownProductLines + " order lines reference a product not in the product table.");
    if (q.ordersWithoutItems) notes.push(q.ordersWithoutItems + " orders have no order lines.");
    if (q.undatedOrders) notes.push(q.undatedOrders + " orders have no usable date and are left out of time charts.");
    if (q.paymentsMissingAmount) notes.push(q.paymentsMissingAmount + " payments have no amount and count as 0.");
    if (q.invalidDelivery) notes.push(q.invalidDelivery + " orders have a negative delivery time and are excluded.");
    var r = A.assumptions.reconciliation;
    if (r.checked) notes.push("Payment check on " + fInt(r.checked) + " active orders with a collected payment: " + fInt(r.matchNet) + " equal net sales, " + fInt(r.matchNetShipping) + " equal net sales + shipping cost, " + fInt(r.neither) + " match neither.");
    c.appendChild(el("p", "dim", notes.length ? "Data quality notes:" : "Data quality: no duplicate, orphan or unusable rows were found."));
    if (notes.length) { var ul = el("ul", "plain"); notes.forEach(function (n) { ul.appendChild(el("li", "", n)); }); c.appendChild(ul); }
  }

  /* ── Views ───────────────────────────────────────────────────────── */
  var R = {};

  R.overview = function (host, A) {
    var S = A.sales, P = A.payments.totals, O = A.orders;
    host.appendChild(kpis([
      { label: "Orders", value: fInt(O.all), sub: fInt(O.active) + " active" },
      { label: "Customers", value: fInt(A.customers.total), sub: fInt(A.customers.buyers) + " with active orders" },
      { label: "Gross sales", value: fMoney(S.gross), sub: "before discounts" },
      { label: "Net sales", value: fMoney(S.net), sub: fMoney(S.discount) + " discounts (" + fPct(S.discountRate) + ")" },
      { label: "Collected payments", value: fMoney(P.collected), sub: fPct(A.payments.successRate) + " of payments succeeded" },
      { label: "Average order value", value: fMoney2(S.aov), sub: "net sales per active order" },
      { label: "Units sold", value: fInt(S.units), sub: fNum(S.unitsPerOrder, 2) + " per order" },
      { label: "Cancelled / returned / failed", value: fPct(O.all ? (O.cancelled + O.returned + O.failed) / O.all : null), sub: fInt(O.cancelled + O.returned + O.failed) + " orders" },
      { label: "Average rating", value: fNum(A.ops.ratings.avg, 2), sub: fInt(A.ops.ratings.n) + " rated orders" },
      { label: "Estimated gross profit", value: fMoney(A.profit.profit), sub: fPct(A.profit.margin) + " margin on costed lines" }
    ]));
    var c = section(host, "Net sales by month", "Active orders", true);
    chart(c, A.monthly.map(function (m) { return { label: m.month, value: m.net }; }), { title: "Net sales by month" });
    if (A.insights.length) {
      var ic = section(host, "Key findings", "Open Insights for all of them", true);
      var list = el("div", "recs");
      A.insights.slice(0, 3).forEach(function (i) {
        var row = el("div", "rec"); row.appendChild(el("b", "", i.title)); row.appendChild(el("span", "", i.text)); list.appendChild(row);
      });
      ic.appendChild(list);
    }
    notesCard(host, A);
  };

  R.sales = function (host, A) {
    host.appendChild(kpis([
      { label: "Net sales", value: fMoney(A.sales.net) },
      { label: "Active orders", value: fInt(A.orders.active) },
      { label: "Average order value", value: fMoney2(A.sales.aov) },
      { label: "Shipping cost (active)", value: fMoney(A.sales.shipping) }
    ]));
    var c1 = section(host, "Net sales by month", "Active orders", true);
    chart(c1, A.monthly.map(function (m) { return { label: m.month, value: m.net }; }), { title: "Net sales by month" });
    var c2 = section(host, "Orders by month", "Active orders", true);
    chart(c2, A.monthly.map(function (m) { return { label: m.month, value: m.orders }; }), { type: "col", fmt: fInt, title: "Orders by month" });
    var g = grid(host);
    var c3 = section(g, "Order status", "All orders");
    table(c3, [{ key: "status", label: "Status" }, { key: "count", label: "Orders", num: true, fmt: fInt },
               { key: "share", label: "Share", num: true, fmt: fPct }, { key: "cls", label: "Counted in sales", fmt: function (v) { return v === "active" ? "Yes" : "No"; } }],
      A.statuses.map(function (s) { return { status: s.status, count: s.count, share: A.orders.all ? s.count / A.orders.all : null, cls: s.cls }; }));
    var c4 = section(g, "Net sales by weekday", "Active orders");
    bars(c4, A.weekdays.map(function (w) { return { label: w.day, value: w.net, note: fInt(w.orders) + " orders" }; }));
    var c5 = section(host, "Net sales by shipping city", "Top 10 of " + A.cities.length + " cities", true);
    table(c5, [{ key: "city", label: "City" }, { key: "orders", label: "Active orders", num: true, fmt: fInt },
               { key: "net", label: "Net sales", num: true, fmt: fMoney }, { key: "share", label: "Share", num: true, fmt: fPct },
               { key: "aov", label: "AOV", num: true, fmt: fMoney2 }],
      A.cities.slice(0, 10).map(function (c) { return { city: c.city, orders: c.orders, net: c.net, share: A.sales.net ? c.net / A.sales.net : null, aov: c.orders ? c.net / c.orders : null }; }));
  };

  R.products = function (host, A) {
    var Pf = A.profit;
    host.appendChild(kpis([
      { label: "Units sold", value: fInt(A.sales.units) },
      { label: "Products sold", value: fInt(A.products.sold), sub: "of " + fInt(A.products.catalog) + " in catalog" },
      { label: "Discount rate", value: fPct(A.sales.discountRate), sub: fMoney(A.sales.discount) + " given" },
      { label: "Estimated gross profit", value: fMoney(Pf.profit), sub: fPct(Pf.margin) + " margin · " + fPct(Pf.coverage) + " of sales costed" }
    ]));
    note(host, "Estimated gross profit = net line revenue − quantity × unit_cost, on lines whose product has a unit_cost. Shipping, payment fees and overheads are not included.");
    var g = grid(host);
    var c1 = section(g, "Bestsellers by units", "Top 10");
    bars(c1, A.products.top.map(function (p) { return { label: p.name, value: p.units, note: p.category }; }), fInt);
    var c2 = section(g, "Top products by net sales", "Top 10");
    bars(c2, A.products.topRevenue.map(function (p) { return { label: p.name, value: p.net, note: p.category }; }));
    var c3 = section(host, "Category performance", "Active orders", true);
    table(c3, [{ key: "category", label: "Category" }, { key: "units", label: "Units", num: true, fmt: fInt },
               { key: "gross", label: "Gross sales", num: true, fmt: fMoney }, { key: "discountRate", label: "Discount", num: true, fmt: fPct },
               { key: "net", label: "Net sales", num: true, fmt: fMoney }, { key: "profit", label: "Est. gross profit", num: true, fmt: fMoney },
               { key: "margin", label: "Margin", num: true, fmt: fPct }], A.categories);
    var c4 = section(host, "Lowest-selling products", "By net sales, among products sold", true);
    table(c4, [{ key: "name", label: "Product" }, { key: "category", label: "Category" }, { key: "units", label: "Units", num: true, fmt: fInt },
               { key: "net", label: "Net sales", num: true, fmt: fMoney }], A.products.bottom);
    if (A.products.neverSold > 0) note(host, fInt(A.products.neverSold) + " catalog products have no sales in active orders.");
  };

  R.customers = function (host, A) {
    var C = A.customers;
    host.appendChild(kpis([
      { label: "Customers", value: fInt(C.total) },
      { label: "Buying customers", value: fInt(C.buyers), sub: fInt(C.neverBought) + " without an active order" },
      { label: "Repeat customers", value: fInt(C.repeatBuyers), sub: fPct(C.repeatRate) + " of buyers" },
      { label: "Orders per buyer", value: fNum(C.ordersPerBuyer, 2) }
    ]));
    var c1 = section(host, "Customer segments", "Active orders", true);
    table(c1, [{ key: "segment", label: "Segment" }, { key: "customers", label: "Customers", num: true, fmt: fInt },
               { key: "buyers", label: "Buyers", num: true, fmt: fInt }, { key: "orders", label: "Orders", num: true, fmt: fInt },
               { key: "net", label: "Net sales", num: true, fmt: fMoney }, { key: "aov", label: "AOV", num: true, fmt: fMoney2 },
               { key: "repeatRate", label: "Repeat rate", num: true, fmt: fPct }], C.segments);
    var c2 = section(host, "New customers by signup month", "", true);
    chart(c2, C.signups.map(function (s) { return { label: s.month, value: s.count }; }), { type: "col", fmt: fInt, title: "Signups by month" });
    var g = grid(host);
    var c3 = section(g, "Net sales by age group", "");
    bars(c3, C.ageGroups.map(function (a) { return { label: a.group, value: a.net, note: fInt(a.customers) + " customers" }; }));
    var c4 = section(g, "Orders by weekday", "Purchasing pattern");
    bars(c4, A.weekdays.map(function (w) { return { label: w.day, value: w.orders }; }), fInt);
    var c5 = section(host, "Top customers by net sales", "Top 10", true);
    table(c5, [{ key: "name", label: "Customer" }, { key: "segment", label: "Segment" }, { key: "orders", label: "Orders", num: true, fmt: fInt },
               { key: "net", label: "Net sales", num: true, fmt: fMoney }], C.top);
  };

  R.payments = function (host, A) {
    var P = A.payments.totals, U = A.payments.uncollected;
    host.appendChild(kpis([
      { label: "Collected", value: fMoney(P.collected), sub: fInt(P.collectedCount) + " payments" },
      { label: "Pending", value: fMoney(P.pending) },
      { label: "Failed", value: fMoney(P.failed) },
      { label: "Success rate", value: fPct(A.payments.successRate), sub: "of " + fInt(P.count) + " payment records" },
      { label: "Active orders not collected", value: fInt(U.count), sub: fMoney(U.value) + " net value" }
    ]));
    var c1 = section(host, "Payment methods", "", true);
    table(c1, [{ key: "method", label: "Method" }, { key: "count", label: "Payments", num: true, fmt: fInt },
               { key: "collected", label: "Collected", num: true, fmt: fMoney }, { key: "successRate", label: "Success rate", num: true, fmt: fPct },
               { key: "failedCount", label: "Failed", num: true, fmt: fInt }, { key: "pendingCount", label: "Pending", num: true, fmt: fInt }], A.payments.methods);
    var c2 = section(host, "Payment status", "As recorded in the data", true);
    table(c2, [{ key: "status", label: "Status" }, { key: "cls", label: "Treated as" }, { key: "count", label: "Payments", num: true, fmt: fInt },
               { key: "amount", label: "Amount", num: true, fmt: fMoney }], A.payments.statuses);
    var c3 = section(host, "Active orders without a collected payment", "", true);
    table(c3, [{ key: "k", label: "Reason" }, { key: "n", label: "Orders", num: true, fmt: fInt }],
      [{ k: "Payment pending", n: U.withPending }, { k: "Only failed payments", n: U.failedOnly }, { k: "No payment record", n: U.noPaymentRecord }]);
    if (P.collectedOnInactive > 0) note(host, fMoney(P.collectedOnInactive) + " was collected on cancelled, returned or failed orders. It is included in Collected above; check whether it was refunded.");
  };

  R.operations = function (host, A) {
    var D = A.ops.delivery, Sh = A.ops.shipping, Rt = A.ops.ratings;
    host.appendChild(kpis([
      { label: "Avg delivery time", value: D ? fNum(D.mean, 1) + " days" : "—", sub: D ? "median " + fNum(D.median, 1) + " · 90th pct " + fNum(D.p90, 1) : "no delivery data" },
      { label: "Avg shipping cost", value: fMoney2(Sh.avg), sub: fPct(Sh.shareOfNet) + " of net sales" },
      { label: "Average rating", value: fNum(Rt.avg, 2), sub: fInt(Rt.n) + " rated · " + fPct(Rt.coverage) + " of orders" },
      { label: "Cancelled / returned", value: fInt(A.orders.cancelled + A.orders.returned), sub: fPct(A.orders.all ? (A.orders.cancelled + A.orders.returned) / A.orders.all : null) + " of orders" }
    ]));
    var g = grid(host);
    var c1 = section(g, "Delivery time distribution", "Orders");
    bars(c1, A.ops.deliveryBuckets.map(function (b) { return { label: b.bucket, value: b.orders }; }), fInt);
    var c2 = section(g, "Rating distribution", "Rounded to whole points");
    bars(c2, Rt.distribution.map(function (r) { return { label: r.rating, value: r.count }; }), fInt);
    var c3 = section(host, "Average rating by delivery time", "Rated orders only", true);
    table(c3, [{ key: "bucket", label: "Delivery time" }, { key: "orders", label: "Orders", num: true, fmt: fInt },
               { key: "ratedOrders", label: "Rated", num: true, fmt: fInt }, { key: "avgRating", label: "Avg rating", num: true, fmt: function (v) { return fNum(v, 2); } }], A.ops.deliveryBuckets);
    var g2 = grid(host);
    var c4 = section(g2, "Slowest cities", "Average days, at least 20 orders");
    bars(c4, A.ops.slowestCities.map(function (c) { return { label: c.city, value: c.avgDays, note: fInt(c.orders) + " orders" }; }), function (v) { return fNum(v, 1); });
    var c5 = section(g2, "Fastest cities", "Average days, at least 20 orders");
    bars(c5, A.ops.fastestCities.map(function (c) { return { label: c.city, value: c.avgDays, note: fInt(c.orders) + " orders" }; }), function (v) { return fNum(v, 1); });
    var c6 = section(host, "Order performance by status", "Average rating per status", true);
    table(c6, [{ key: "status", label: "Status" }, { key: "n", label: "Rated orders", num: true, fmt: fInt },
               { key: "avg", label: "Avg rating", num: true, fmt: function (v) { return fNum(v, 2); } }], A.ops.ratingByStatus);
  };

  R.insights = function (host, A) {
    if (!A.insights.length) {
      var c = section(host, "Insights", "", true);
      return empty(c, "There is not enough data to produce findings.");
    }
    note(host, "Each finding is generated by a fixed rule from the data in this workspace and lists the numbers behind it. These are observations, not predictions.");
    A.insights.forEach(function (i) {
      var c = el("div", "card ins ins--" + i.tone);
      c.appendChild(el("h3", "", i.title));
      c.appendChild(el("p", "", i.text));
      var chips = el("div", "chips");
      i.metrics.forEach(function (m) {
        var chip = el("span", "chip"); chip.appendChild(el("i", "", m[0])); chip.appendChild(el("b", "", m[1])); chips.appendChild(chip);
      });
      c.appendChild(chips);
      host.appendChild(c);
    });
    notesCard(host, A);
  };

  root.NovaViews = { render: function (view, host, A) { if (!R[view]) throw new Error("Unknown view " + view); R[view](host, A); }, views: Object.keys(R) };
})(window);
