/* Wanyxi client workspace: recommendation engine and Intelligence Brief.
 *
 * Pure computation, no DOM, no network. Input is the period object returned by
 * NovaAnalytics.computePeriods(); output is a list of recommendation objects, a list of
 * data checks and the brief's sentences. Loads in the browser as window.NovaRecommend
 * and in Node via require() for tests.
 *
 * Rules, not generative AI. Every recommendation carries the numbers that triggered it,
 * the threshold it crossed and its limitations. Thresholds live in RULES below and are
 * owner-adjustable; they are defaults, not validated business targets.
 */
(function (root) {
  "use strict";

  var VERSION = "nova-recommend-v1";

  /* Owner-adjustable thresholds (defaults pending owner approval). */
  var RULES = {
    highShareOfNet: 0.02,       // money at stake >= 2% of period net sales -> High priority
    lossMinUnits: 10,           // a product must sell at least this many units to be judged
    methodMinPayments: 100,     // payment-method comparison needs this many payments per method
    methodGap: 0.05,            // and a success-rate gap of at least 5 points
    ratingGap: 0.3,             // delivery-speed rating gap that is worth acting on
    anomalyHighShare: 0.05      // unusual order lines worth >= 5% of net sales -> High
  };

  /* ── Formatting (plain text; the views add markup) ─────────────────── */
  var CUR = "AED";
  function setCurrency(c) { CUR = c || ""; }
  function n0(x) { return Math.round(x).toLocaleString("en-US"); }
  function money(x) {
    if (x === null || x === undefined || !isFinite(x)) return "—";
    var a = Math.abs(x), s = x < 0 ? "−" : "", p = CUR ? CUR + " " : "";
    if (a >= 1e6) return s + p + (a / 1e6).toFixed(2) + "M";
    if (a >= 1e4) return s + p + Math.round(a / 1e3) + "K";
    return s + p + n0(a);
  }
  function pct(x, d) { return x === null || x === undefined || !isFinite(x) ? "—" : (x < 0 ? "−" : "") + Math.abs(x * 100).toFixed(d === undefined ? 1 : d) + "%"; }
  function change(a, b) { return a !== null && b ? a / b - 1 : null; }
  function pts(a, b) { return (a - b) * 100; }
  function sum(arr, f) { var s = 0; arr.forEach(function (x) { s += f(x); }); return s; }
  function list(names) { return names.length < 3 ? names.join(" and ") : names.slice(0, -1).join(", ") + " and " + names[names.length - 1]; }

  var RANK = { high: 0, medium: 1, low: 2 };
  function inPeriod(ctx) { return ctx.mode === "all" ? "between " + ctx.sublabel.replace(" – ", " and ") : "in " + ctx.label; }

  /* ── Rules ─────────────────────────────────────────────────────────── */

  function lossProducts(ctx) {
    var A = ctx.A, net = A.sales.net;
    var losers = A.products.all.filter(function (p) { return p.costed && p.profit < 0 && p.units >= RULES.lossMinUnits; })
      .sort(function (a, b) { return a.profit - b.profit; });
    if (!losers.length) return null;
    var loss = sum(losers, function (p) { return p.profit; });
    var lossNet = sum(losers, function (p) { return p.net; });
    var units = sum(losers, function (p) { return p.units; });
    var atGross = sum(losers, function (p) { return p.profitAtGross || 0; });
    var discount = 1 - lossNet / sum(losers, function (p) { return p.gross; });
    var cats = {};
    losers.forEach(function (p) { cats[p.category] = (cats[p.category] || 0) + 1; });
    var mainCat = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; })[0];
    var catRow = A.categories.filter(function (c) { return c.category === mainCat; })[0];
    var costAbove = losers.filter(function (p) { return p.listCost !== null && p.listPrice !== null && p.listCost > p.listPrice; });
    var w = losers[0];
    var steps = [
      "Stop or cap discounts on " + list(losers.slice(0, 3).map(function (p) { return p.name; })) +
        (losers.length > 3 ? " and " + (losers.length - 3) + " more" : "") + " until each sells above its unit cost.",
      "Review list prices where the markup over cost is smaller than the average discount (" + pct(discount) + " on these products)."
    ];
    if (costAbove.length) steps.unshift("Confirm the unit cost of " + list(costAbove.map(function (p) { return p.name; })) +
      ": it is recorded above the list price, so every sale loses money.");
    return {
      id: "pricing.loss-products", domain: "Pricing & margin", kind: "recommendation",
      title: losers.length === 1 ? w.name + " is sold below cost" : losers.length + " products are sold below cost",
      headline: catRow && catRow.margin !== null && catRow.margin < 0 && catRow === A.categories[0]
        ? mainCat + ", your largest category, loses money after discounts"
        : losers.length + " products lose money after discounts",
      concern: losers.length + " products lost an estimated " + money(-loss) + " of gross profit after discounts, led by " + w.name + " (" + money(w.profit) + ").",
      detected: losers.length + " products lost an estimated " + money(-loss) + " of gross profit " + inPeriod(ctx) +
        " on " + money(lossNet) + " of net sales. " + w.name + " alone lost " + money(-w.profit) + ".",
      whyItMatters: "Every extra unit sold at these prices reduces profit. They make up " + pct(lossNet / net) +
        " of net sales, so volume growth here makes margins worse, not better.",
      action: { summary: "Cap discounts on loss-making products and correct their pricing.", steps: steps },
      metric: { label: "Gross profit lost after discounts", value: -loss, display: money(-loss), tone: "bad" },
      evidence: [
        ["Products below cost", String(losers.length)],
        ["Units sold", n0(units)],
        ["Net sales on these products", money(lossNet)],
        ["Estimated gross profit", money(loss)],
        ["Average discount on these products", pct(discount)],
        ["Same units at full price (no discount)", money(atGross)]
      ],
      rows: losers.map(function (p) {
        return { name: p.name, sub: p.category + " · " + n0(p.units) + " units · " + pct(p.discountRate) + " discount",
                 value: money(p.profit), neg: true };
      }),
      drill: { view: "products" },
      priority: { level: -loss >= RULES.highShareOfNet * net ? "high" : "medium",
                  rationale: "Profit lost is " + pct(-loss / net) + " of net sales (High at " + pct(RULES.highShareOfNet, 0) + " or more)." },
      confidence: { level: units >= 100 && A.profit.coverage >= 0.95 ? "high" : "medium",
                    basis: n0(units) + " units; unit costs recorded for " + pct(A.profit.coverage) + " of net sales." },
      measure: "Estimated gross profit on these products next period (" + ctx.label + ": " + money(loss) + ").",
      limitations: "Uses the product table's unit_cost as the full cost; shipping, payment fees and overheads are excluded. " +
        "The full-price figure assumes unchanged volumes, which a price change would not keep.",
      exposure: -loss
    };
  }

  function uncollected(ctx) {
    var A = ctx.A, U = A.payments.uncollected, net = A.sales.net;
    if (!U.count) return null;
    var prevU = ctx.P ? ctx.P.payments.uncollected : null;
    var steps = [];
    if (U.withPending) steps.push("Chase the " + n0(U.withPending) + " orders with a pending payment, largest first.");
    if (U.failedOnly) steps.push("Send a new payment link for the " + n0(U.failedOnly) + " orders whose payments failed.");
    if (U.noPaymentRecord) steps.push("Reconcile the " + n0(U.noPaymentRecord) + " orders with no payment record against your payment provider.");
    return {
      id: "collection.uncollected", domain: "Payment collection", kind: "recommendation",
      title: "Collect " + money(U.value) + " from " + n0(U.count) + " unpaid orders",
      headline: n0(U.count) + " active orders have no collected payment",
      concern: n0(U.count) + " active orders worth " + money(U.value) + " have no collected payment.",
      detected: n0(U.count) + " orders that are not cancelled or returned have no payment marked as collected. " +
        "Their item value is " + money(U.value) + (prevU ? " (" + ctx.prevLabel + ": " + n0(prevU.count) + " orders, " + money(prevU.value) + ")." : "."),
      whyItMatters: "This is revenue already earned and not yet received: " + pct(U.value / net) + " of net sales for the period.",
      action: { summary: "Work the unpaid-order list by reason, largest value first.", steps: steps },
      metric: { label: "Unpaid order value", value: U.value, display: money(U.value) },
      evidence: [
        ["Unpaid active orders", n0(U.count)],
        ["Item value", money(U.value)],
        ["Payment pending", n0(U.withPending)],
        ["Only failed payments", n0(U.failedOnly)],
        ["No payment record", n0(U.noPaymentRecord)]
      ],
      rows: U.orders.slice(0, 50).map(function (o) {
        return { name: String(o.id), sub: (o.date || "no date") + " · " + o.city + " · " + o.reason, value: money(o.net) };
      }),
      rowsNote: U.orders.length > 50 ? "Largest 50 of " + n0(U.orders.length) + " orders." : null,
      drill: { view: "payments" },
      priority: { level: U.value >= RULES.highShareOfNet * net ? "high" : "medium",
                  rationale: "Unpaid value is " + pct(U.value / net) + " of net sales (High at " + pct(RULES.highShareOfNet, 0) + " or more)." },
      confidence: { level: "high", basis: "Counted order by order from payment statuses." },
      measure: "Unpaid active orders at the next data load (now " + n0(U.count) + ").",
      limitations: "Values are order items after discount, excluding shipping, so the amount to collect may be slightly higher. " +
        "A Pending order status may also mean the order is simply not yet due.",
      exposure: U.value
    };
  }

  function paymentMethod(ctx) {
    var A = ctx.A;
    var m = A.payments.methods.filter(function (x) { return x.count >= RULES.methodMinPayments && x.successRate !== null; });
    if (m.length < 2) return null;
    var byRate = m.slice().sort(function (a, b) { return a.successRate - b.successRate; });
    var worst = byRate[0], best = byRate[byRate.length - 1];
    if (best.successRate - worst.successRate < RULES.methodGap) return null;
    var others = m.filter(function (x) { return x !== worst; });
    var othersRate = sum(others, function (x) { return x.collectedCount; }) / sum(others, function (x) { return x.count; });
    var notCollected = worst.count - worst.collectedCount;
    return {
      id: "collection.payment-method", domain: "Payment collection", kind: "recommendation",
      title: "Steer " + worst.method + " customers to prepaid methods",
      headline: worst.method + " payments succeed least often",
      detected: worst.method + " payments are collected " + pct(worst.successRate) + " of the time (" + n0(worst.count) +
        " payments), against " + pct(othersRate) + " for all other methods together.",
      whyItMatters: n0(notCollected) + " " + worst.method + " payments " + inPeriod(ctx) + " were not collected (failed, pending or refunded).",
      action: { summary: "Make prepaid methods the easier choice and confirm " + worst.method + " orders before dispatch.", steps: [
        "Offer a small incentive or free shipping for card or wallet payment at checkout.",
        "Confirm " + worst.method + " orders by phone or message before they are dispatched.",
        "Compare the " + worst.method + " success rate again next period."
      ] },
      metric: { label: worst.method + " success rate", value: worst.successRate, display: pct(worst.successRate) },
      evidence: m.slice().sort(function (a, b) { return b.successRate - a.successRate; }).map(function (x) {
        return [x.method, pct(x.successRate) + " of " + n0(x.count)];
      }),
      drill: { view: "payments" },
      priority: { level: "medium", rationale: "Gap of " + pts(best.successRate, worst.successRate).toFixed(1) + " points to the best method; impact depends on how many customers switch." },
      confidence: { level: "medium", basis: "Observed difference across " + n0(worst.count) + " payments; the cause is not established by this data." },
      measure: worst.method + " success rate next period (now " + pct(worst.successRate) + ").",
      limitations: "Refunded payments count as not collected, and refunds may reflect returns rather than payment problems.",
      exposure: 0, method: worst.method, othersRate: othersRate
    };
  }

  function deliveryRating(ctx) {
    var fs = ctx.A.ops.fastSlow;
    if (!fs || fs.fastAvg - fs.slowAvg < RULES.ratingGap) return null;
    var slow = ctx.A.ops.slowestCities.slice(0, 3);
    return {
      id: "operations.delivery-rating", domain: "Customer experience", kind: "recommendation",
      title: "Speed up delivery in the slowest cities",
      headline: "Slower deliveries get lower ratings",
      detected: "Orders delivered in " + fs.median.toFixed(0) + " days or fewer average " + fs.fastAvg.toFixed(2) +
        " stars (" + n0(fs.fastN) + " rated orders); slower orders average " + fs.slowAvg.toFixed(2) + " (" + n0(fs.slowN) + ").",
      whyItMatters: "Ratings drop by " + (fs.fastAvg - fs.slowAvg).toFixed(2) + " stars once delivery passes " + fs.median.toFixed(0) + " days.",
      action: { summary: "Review carrier performance in the slowest cities first.", steps: [
        slow.length ? "Start with " + list(slow.map(function (c) { return c.city + " (" + c.avgDays.toFixed(1) + " days)"; })) + "." : "Start with the cities with the longest average delivery.",
        "Set a delivery-time target of " + fs.median.toFixed(0) + " days and track the share of orders that miss it."
      ] },
      metric: { label: "Rating gap", value: fs.fastAvg - fs.slowAvg, display: "−" + (fs.fastAvg - fs.slowAvg).toFixed(2) + "★" },
      evidence: [["Fast deliveries (≤" + fs.median.toFixed(0) + " days)", fs.fastAvg.toFixed(2) + "★ · " + n0(fs.fastN) + " orders"],
                 ["Slower deliveries", fs.slowAvg.toFixed(2) + "★ · " + n0(fs.slowN) + " orders"]]
        .concat(slow.map(function (c) { return [c.city, c.avgDays.toFixed(1) + " days average"]; })),
      drill: { view: "operations" },
      priority: { level: "medium", rationale: "Affects customer experience; no money value can be attached from this data." },
      confidence: { level: "medium", basis: "Correlation across " + n0(fs.fastN + fs.slowN) + " rated orders; it does not prove delivery speed causes the rating." },
      measure: "Average rating of orders delivered after " + fs.median.toFixed(0) + " days (now " + fs.slowAvg.toFixed(2) + ").",
      limitations: "Orders without a delivery time or rating are excluded.",
      exposure: 0
    };
  }

  /* Data checks: problems in the data itself. Shown in the brief, never ranked as actions. */
  function dataChecks(ctx) {
    var an = ctx.full.anomalies, out = [];
    if (an.quantityLines.length) {
      var share = an.quantityShare || 0;
      out.push({
        id: "data.quantity", domain: "Data check", kind: "check",
        level: share >= RULES.anomalyHighShare ? "high" : "medium",
        title: an.quantityLines.length + " order lines have unusually large quantities",
        headline: an.quantityLines.length + " unusually large order lines make up " + pct(share) + " of net sales",
        detected: "Almost every order line has " + n0(an.typicalMaxQty) + " units or fewer, but " + an.quantityLines.length +
          " lines have between " + n0(an.quantityLines.reduce(function (m, l) { return Math.min(m, l.qty); }, Infinity)) + " and " +
          n0(an.quantityLines.reduce(function (m, l) { return Math.max(m, l.qty); }, 0)) + " units, worth " + money(an.quantityActiveNet) + " on active orders.",
        whyItMatters: "If they are entry errors, sales and product rankings are overstated by " + pct(share) + ". If they are genuine bulk orders, they are your largest accounts.",
        action: { summary: "Confirm whether these are bulk orders or data errors.", steps: ["Check each order with the sales team or source system.", "Correct or exclude errors at the next data load."] },
        rows: an.quantityLines.map(function (l) { return { name: l.order + " · " + l.name, sub: n0(l.qty) + " units · " + l.status, value: money(l.net) }; }),
        evidence: [["Usual maximum", n0(an.typicalMaxQty) + " units per line"], ["Flag threshold", "over " + n0(an.qtyThreshold) + " units"],
                   ["Lines flagged", String(an.quantityLines.length)], ["Value on active orders", money(an.quantityActiveNet)], ["Share of net sales", pct(share)]],
        limitations: "Counted across all data, not only the selected period. Nothing has been removed from the figures."
      });
    }
    var cost = an.costAboveList, zero = an.zeroPrice;
    if (cost.length || zero.length) {
      var parts = [];
      if (cost.length) parts.push(list(cost.map(function (p) { return p.name + " (cost " + n0(p.cost) + ", list " + n0(p.price) + ")"; })) + " cost more than " + (cost.length === 1 ? "its" : "their") + " list price");
      if (zero.length) parts.push(list(zero.map(function (p) { return p.name; })) + (zero.length === 1 ? " has" : " have") + " a list price of 0");
      out.push({
        id: "data.product-master", domain: "Data check", kind: "check", level: "medium",
        title: "Product prices need checking",
        headline: "Product price data needs checking",
        detected: parts.join("; ") + ".",
        whyItMatters: "Margin figures and the pricing recommendation depend on these values.",
        action: { summary: "Correct the product table.", steps: ["Confirm unit cost and list price for each product named."] },
        evidence: cost.map(function (p) { return [p.name, "cost " + n0(p.cost) + " > list " + n0(p.price)]; })
          .concat(zero.map(function (p) { return [p.name, "list price 0"]; })),
        limitations: "Taken from the product table as loaded."
      });
    }
    return out;
  }

  /* ── Brief ─────────────────────────────────────────────────────────── */
  function brief(ctx, recs, checks) {
    var A = ctx.A, P = ctx.P, items = { matters: [], concerns: [], opportunities: [] };
    var headline, sub = null;
    var dn = P ? change(A.sales.net, P.sales.net) : null, dp = P ? change(A.profit.profit, P.profit.profit) : null;

    if (P && dn !== null && dp !== null) {
      var vs = " vs " + ctx.prevLabel;
      var S = function (x) { return pct(Math.abs(x)); };
      if (dn < 0 && dp > 0) headline = "Sales fell " + S(dn) + ", yet estimated gross profit rose " + S(dp) + ".";
      else if (dn > 0 && dp < 0) headline = "Sales grew " + S(dn) + ", but estimated gross profit fell " + S(dp) + ".";
      else if (dn >= 0 && dp >= 0) headline = "Sales grew " + S(dn) + " and estimated gross profit " + S(dp) + ".";
      else headline = "Sales fell " + S(dn) + " and estimated gross profit " + S(dp) + ".";
      var dd = pts(A.sales.discountRate, P.sales.discountRate);
      if (Math.abs(dd) >= 2) sub = "Over the same period the average discount " + (dd < 0 ? "fell" : "rose") + " from " +
        pct(P.sales.discountRate) + " to " + pct(A.sales.discountRate) + ", and estimated margin moved from " +
        pct(P.profit.margin) + " to " + pct(A.profit.margin) + ".";
      else sub = "Estimated margin moved from " + pct(P.profit.margin) + " to " + pct(A.profit.margin) + vs + ".";

      var dOrd = change(A.orders.active, P.orders.active), dAov = change(A.sales.aov, P.sales.aov);
      items.matters.push({ text: money(A.sales.net) + " net sales from " + n0(A.orders.active) + " orders: orders " +
        (dOrd < 0 ? "down " : "up ") + pct(Math.abs(dOrd)) + ", average order value " + (dAov < 0 ? "down " : "up ") + pct(Math.abs(dAov)) + vs + ".", ref: { kpi: "sales" } });
    } else {
      var top = recs[0] || checks[0];
      headline = top ? top.headline + "." : "No material issues were detected in this period.";
      sub = money(A.sales.net) + " net sales from " + n0(A.orders.active) + " active orders, " + ctx.sublabel +
        ", at an estimated gross margin of " + pct(A.profit.margin) + ".";
    }

    // Record month with thin margin (chart-worthy, only meaningful across several months).
    var mon = (ctx.mode === "all" ? A : ctx.full).monthly.filter(function (m) { return m.margin !== null; });
    if (mon.length >= 6) {
      var peak = mon.slice().sort(function (a, b) { return b.net - a.net; })[0];
      var avgMargin = ctx.full.profit.margin;
      if (peak.margin !== null && avgMargin !== null && peak.margin < avgMargin / 2) {
        items.matters.push({ text: "Your record sales month, " + monthName(peak.month) + " (" + money(peak.net) + "), earned an estimated margin of only " +
          pct(peak.margin) + ", with discounts averaging " + pct(peak.discountRate) + ".", ref: { chart: peak.month } });
      }
    }

    // Largest category: margin trend vs previous period.
    var big = A.categories[0];
    if (big && P) {
      var pb = P.categories.filter(function (c) { return c.category === big.category; })[0];
      if (pb && big.margin !== null && pb.margin !== null && Math.abs(pts(big.margin, pb.margin)) >= 2) {
        var better = big.margin > pb.margin;
        items[better ? "opportunities" : "concerns"].push({ text: big.category + " margin " + (better ? "improved" : "slipped") + " from " +
          pct(pb.margin) + " to " + pct(big.margin) + " while its discount " + (big.discountRate < pb.discountRate ? "fell" : "rose") + " from " +
          pct(pb.discountRate) + " to " + pct(big.discountRate) + (big.margin < 0 ? ". It is still below cost." : "."), ref: { rec: "pricing.loss-products" } });
      }
    }

    recs.forEach(function (r) {
      if (r.priority.level === "high") items.concerns.push({ text: r.concern || r.headline + ".", ref: { rec: r.id } });
    });
    checks.forEach(function (c) {
      if (c.level === "high") items.concerns.push({ text: c.headline + "; confirm them before relying on product rankings.", ref: { check: c.id } });
    });

    // Opportunities: high-margin categories with real weight.
    var net = A.sales.net;
    var rich = A.categories.filter(function (c) { return c.margin !== null && c.net / net >= 0.03 && c.margin >= 2 * (A.profit.margin || 0) && c.margin > 0.25; })
      .sort(function (a, b) { return b.margin - a.margin; }).slice(0, 2);
    if (rich.length) items.opportunities.push({ text: list(rich.map(function (c) { return c.category + " (" + pct(c.margin) + ")"; })) +
      " carry the highest estimated margins but only " + pct(sum(rich, function (c) { return c.net; }) / net) + " of sales: growing them lifts overall margin.", ref: { view: "products" } });
    var meth = recs.filter(function (r) { return r.id === "collection.payment-method"; })[0];
    if (meth) {
      var mm = meth.metric.value, mo = meth.othersRate;
      items.opportunities.push({ text: "Other payment methods collect " + pct(mo) + " of payments against " + pct(mm) + " for " + meth.method +
        ": moving those buyers to prepaid is the clearest collection lever.", ref: { rec: meth.id } });
    }

    return { headline: headline, sub: sub, sections: items,
             basis: "Rule-based analysis of " + n0(ctx.full.counts.orders + ctx.full.counts.items + ctx.full.counts.payments + ctx.full.counts.customers + ctx.full.counts.products) +
               " records in this workspace. Not generative AI: each statement opens the calculation behind it." };
  }

  function monthName(k) {
    var M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var m = /^(\d{4})-(\d{2})/.exec(k);
    return m ? M[+m[2] - 1] + " " + m[1] : k;
  }

  function build(ctx) {
    var recs = [lossProducts, uncollected, paymentMethod, deliveryRating]
      .map(function (rule) { return rule(ctx); }).filter(Boolean)
      .sort(function (a, b) { return RANK[a.priority.level] - RANK[b.priority.level] || b.exposure - a.exposure; });
    var checks = dataChecks(ctx);
    return { version: VERSION, recommendations: recs, checks: checks, brief: brief(ctx, recs, checks), rules: RULES };
  }

  var api = { VERSION: VERSION, RULES: RULES, build: build, setCurrency: setCurrency, money: money, pct: pct, monthName: monthName };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NovaRecommend = api;
})(typeof window !== "undefined" ? window : this);
