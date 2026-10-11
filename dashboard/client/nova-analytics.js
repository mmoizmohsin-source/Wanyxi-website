/* Wanyxi client workspace: business analytics for the Nova dataset.
 *
 * Pure computation, no DOM, no network. Input is the five tables as arrays of
 * row objects; output is one plain object that the views render. Loads in the
 * browser as window.NovaAnalytics and in Node via require() for tests.
 *
 * Nothing is assumed about the data that can be read from the data itself:
 *  - discount_pct scale (fraction 0-1 or percent 0-100) is DETECTED from the values;
 *  - every distinct order_status / payment_status found is listed with its count
 *    and the class it was given, so the mapping is visible, not hidden;
 *  - rows that cannot be used (missing quantity, orphan rows, duplicates) are
 *    counted and reported, never silently filled in.
 */
(function (root) {
  "use strict";

  var VERSION = "nova-analytics-v1";

  /* ── Helpers ─────────────────────────────────────────────────────── */
  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = typeof v === "number" ? v : Number(v);
    return isFinite(n) ? n : null;
  }
  function str(v) { return v === null || v === undefined ? "" : String(v).trim(); }
  function lc(v) { return str(v).toLowerCase(); }
  function ratio(a, b) { return b ? a / b : null; }
  function sum(arr) { var s = 0; arr.forEach(function (x) { s += x; }); return s; }
  function pctile(sorted, p) {
    if (!sorted.length) return null;
    var i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }
  function monthKey(d) {
    var s = str(d), m = /^(\d{4})-(\d{2})/.exec(s);
    if (m) return m[1] + "-" + m[2];
    if (!s) return null;
    var t = new Date(s);
    return isNaN(t) ? null : t.getUTCFullYear() + "-" + ("0" + (t.getUTCMonth() + 1)).slice(-2);
  }
  function weekday(d) {
    var s = str(d), m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s), t;
    t = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(s);
    return isNaN(t) ? null : t.getUTCDay();
  }
  function dedupe(rows, key) {
    var seen = Object.create(null), out = [], dropped = 0;
    (rows || []).forEach(function (r) {
      var k = r[key];
      if (k === null || k === undefined) { out.push(r); return; }
      if (seen[k]) { dropped++; return; }
      seen[k] = 1; out.push(r);
    });
    return { rows: out, dropped: dropped };
  }
  function index(rows, key) {
    var m = Object.create(null);
    rows.forEach(function (r) { if (r[key] !== null && r[key] !== undefined) m[r[key]] = r; });
    return m;
  }
  function get(map, key, make) { return map[key] || (map[key] = make()); }
  function values(map) { return Object.keys(map).map(function (k) { return map[k]; }); }

  /* ── Status classification (shown to the user, never hidden) ─────── */
  function classifyOrder(status) {
    var v = lc(status);
    if (!v) return "unknown";
    if (/cancel/.test(v)) return "cancelled";
    if (/return|refund/.test(v)) return "returned";
    if (/fail/.test(v)) return "failed";
    return "active";
  }
  function classifyPayment(status) {
    var v = lc(status);
    if (!v) return "unknown";
    if (/refund|revers|chargeback/.test(v)) return "refunded";
    if (/fail|declin|reject|error|denied/.test(v)) return "failed";
    if (/not paid|unpaid|pend|await|processing|initiat|on hold/.test(v)) return "pending";
    if (/cancel|void|expire/.test(v)) return "cancelled";
    if (/paid|success|complete|captur|settle|approv|collect/.test(v)) return "collected";
    return "other";
  }

  function detectDiscount(items) {
    var max = 0, min = 0, n = 0, missing = 0, nonzero = 0;
    items.forEach(function (it) {
      var d = num(it.discount_pct);
      if (d === null) { missing++; return; }
      n++; if (d > max) max = d; if (d < min) min = d; if (d !== 0) nonzero++;
    });
    var kind = nonzero === 0 ? "none" : (max <= 1 ? "fraction" : "percent");
    return { kind: kind, divisor: kind === "percent" ? 100 : 1, max: max, min: min, nonzero: nonzero, n: n, missing: missing };
  }

  function ageBucket(a) {
    if (a === null || a < 0 || a > 120) return "Unknown";
    if (a < 25) return "Under 25";
    if (a < 35) return "25–34";
    if (a < 45) return "35–44";
    if (a < 55) return "45–54";
    return "55+";
  }
  var AGE_ORDER = ["Under 25", "25–34", "35–44", "45–54", "55+", "Unknown"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function deliveryBucket(d) {
    if (d <= 2) return "0–2 days";
    if (d <= 4) return "3–4 days";
    if (d <= 7) return "5–7 days";
    if (d <= 10) return "8–10 days";
    return "Over 10 days";
  }
  var DELIVERY_ORDER = ["0–2 days", "3–4 days", "5–7 days", "8–10 days", "Over 10 days"];

  /* ── Main ────────────────────────────────────────────────────────── */
  function compute(data) {
    var dc = dedupe(data.customers, "customer_id"), dp = dedupe(data.products, "product_id"),
        dor = dedupe(data.orders, "order_id"), dpay = dedupe(data.payments, "payment_id"),
        di = dedupe(data.items, "row_id");
    var customers = dc.rows, products = dp.rows, items = di.rows, payments = dpay.rows;
    var prodById = index(products, "product_id"), custById = index(customers, "customer_id");

    var quality = {
      duplicatesDropped: dc.dropped + dp.dropped + dor.dropped + dpay.dropped + di.dropped,
      orphanItems: 0, orphanPayments: 0, skippedLines: 0, invalidDiscount: 0,
      ordersWithoutItems: 0, undatedOrders: 0, paymentsMissingAmount: 0, unknownProductLines: 0,
      invalidDelivery: 0
    };

    /* Orders */
    var ord = dor.rows.map(function (o) {
      var status = str(o.order_status) || "(blank)";
      return {
        id: o.order_id, cust: o.customer_id, month: monthKey(o.order_date), wd: weekday(o.order_date),
        status: status, cls: classifyOrder(o.order_status), city: str(o.shipping_city) || "Unspecified",
        ship: num(o.shipping_cost), dd: num(o.delivery_days), rating: num(o.customer_rating),
        date: str(o.order_date).slice(0, 10),
        gross: 0, net: 0, units: 0, lines: 0, collected: 0, pending: 0, failed: 0, payN: 0,
        costRev: 0, cost: 0
      };
    });
    var ordById = Object.create(null);
    ord.forEach(function (o) { ordById[o.id] = o; });
    var active = ord.filter(function (o) { return o.cls === "active"; });

    var statusMap = Object.create(null);
    ord.forEach(function (o) {
      var s = get(statusMap, o.status, function () { return { status: o.status, cls: o.cls, count: 0 }; });
      s.count++;
    });

    /* Order items → order totals, products, categories */
    var disc = detectDiscount(items);
    var pAgg = Object.create(null), cAgg = Object.create(null);
    var T = { gross: 0, net: 0, units: 0, lines: 0, discountedLines: 0,
              profitRev: 0, cost: 0, noCostRev: 0 };
    items.forEach(function (it) {
      var o = ordById[it.order_id];
      if (!o) { quality.orphanItems++; return; }
      var q = num(it.quantity), p = num(it.unit_price);
      if (q === null || p === null || q < 0 || p < 0) { quality.skippedLines++; return; }
      var d = num(it.discount_pct), f = 0;
      if (d !== null) { f = d / disc.divisor; if (f < 0 || f > 1) { quality.invalidDiscount++; f = 0; } }
      var g = q * p, n = g * (1 - f);
      o.gross += g; o.net += n; o.units += q; o.lines++;
      if (o.cls !== "active") return;

      T.gross += g; T.net += n; T.units += q; T.lines++;
      if (f > 0) T.discountedLines++;
      var prod = prodById[it.product_id];
      if (!prod) quality.unknownProductLines++;
      var cat = prod ? (str(prod.category) || "Unspecified") : "Unknown product";
      var cost = prod ? num(prod.unit_cost) : null, hasCost = cost !== null && cost >= 0;
      var pa = get(pAgg, it.product_id, function () {
        return { id: it.product_id, name: prod ? (str(prod.product_name) || String(it.product_id)) : String(it.product_id),
                 category: cat, units: 0, gross: 0, net: 0, costRev: 0, cost: 0 };
      });
      var ca = get(cAgg, cat, function () { return { category: cat, units: 0, gross: 0, net: 0, costRev: 0, cost: 0 }; });
      [pa, ca].forEach(function (a) { a.units += q; a.gross += g; a.net += n; });
      if (hasCost) {
        var lcost = q * cost;
        pa.costRev += n; pa.cost += lcost; ca.costRev += n; ca.cost += lcost;
        T.profitRev += n; T.cost += lcost;
        o.costRev += n; o.cost += lcost;
        pa.grossCostRev = (pa.grossCostRev || 0) + g;
      } else { T.noCostRev += n; }
    });
    ord.forEach(function (o) { if (!o.lines) quality.ordersWithoutItems++; if (!o.month) quality.undatedOrders++; });

    function finish(a) {
      a.discount = a.gross - a.net;
      a.discountRate = ratio(a.discount, a.gross);
      a.profit = a.costRev ? a.costRev - a.cost : null;
      a.margin = a.costRev ? (a.costRev - a.cost) / a.costRev : null;
      return a;
    }
    var productList = values(pAgg).map(finish);
    var categoryList = values(cAgg).map(finish).sort(function (a, b) { return b.net - a.net; });

    /* Payments */
    var methodMap = Object.create(null), pstatMap = Object.create(null);
    var P = { collected: 0, collectedCount: 0, pending: 0, failed: 0, refunded: 0, total: 0, count: payments.length,
              collectedOnInactive: 0 };
    payments.forEach(function (pay) {
      var o = ordById[pay.order_id];
      if (!o) quality.orphanPayments++;
      var amt = num(pay.payment_amount);
      if (amt === null) { quality.paymentsMissingAmount++; amt = 0; }
      var cls = classifyPayment(pay.payment_status), status = str(pay.payment_status) || "(blank)";
      var method = str(pay.payment_method) || "Unspecified";
      var m = get(methodMap, method, function () {
        return { method: method, count: 0, amount: 0, collectedCount: 0, collected: 0, failedCount: 0, pendingCount: 0 };
      });
      m.count++; m.amount += amt;
      var s = get(pstatMap, status, function () { return { status: status, cls: cls, count: 0, amount: 0 }; });
      s.count++; s.amount += amt; P.total += amt;
      if (cls === "collected") {
        m.collectedCount++; m.collected += amt; P.collected += amt; P.collectedCount++;
        if (o && o.cls !== "active") P.collectedOnInactive += amt;
      } else if (cls === "failed") { m.failedCount++; P.failed += amt; }
      else if (cls === "pending") { m.pendingCount++; P.pending += amt; }
      else if (cls === "refunded") { P.refunded += amt; }
      if (o) {
        o.payN++;
        if (cls === "collected") o.collected += amt;
        else if (cls === "pending") o.pending += amt;
        else if (cls === "failed") o.failed += amt;
      }
    });
    var methods = values(methodMap).map(function (m) { m.successRate = ratio(m.collectedCount, m.count); return m; })
      .sort(function (a, b) { return b.collected - a.collected; });

    /* Do payments match item totals, or item totals + shipping? (diagnostic only) */
    var TOL = 0.05, rec = { checked: 0, matchNet: 0, matchNetShipping: 0, neither: 0 };
    active.forEach(function (o) {
      if (o.collected > 0 && o.net > 0) {
        rec.checked++;
        if (Math.abs(o.collected - o.net) <= TOL) rec.matchNet++;
        else if (o.ship !== null && Math.abs(o.collected - (o.net + o.ship)) <= TOL) rec.matchNetShipping++;
        else rec.neither++;
      }
    });
    var unc = { count: 0, value: 0, withPending: 0, failedOnly: 0, noPaymentRecord: 0, orders: [] };
    active.forEach(function (o) {
      if (o.collected > 0) return;
      unc.count++; unc.value += o.net;
      var reason = "other";
      if (!o.payN) { unc.noPaymentRecord++; reason = "no payment record"; }
      else if (o.pending > 0) { unc.withPending++; reason = "payment pending"; }
      else if (o.failed > 0) { unc.failedOnly++; reason = "failed only"; }
      unc.orders.push({ id: o.id, date: o.date, city: o.city, net: o.net, reason: reason });
    });
    unc.orders.sort(function (a, b) { return b.net - a.net; });

    /* Sales over time and by city */
    var monthMap = Object.create(null), cityMap = Object.create(null), wdMap = Object.create(null);
    var shipSum = 0, shipN = 0;
    active.forEach(function (o) {
      if (o.month) {
        var m = get(monthMap, o.month, function () { return { month: o.month, orders: 0, gross: 0, net: 0, costRev: 0, cost: 0 }; });
        m.orders++; m.gross += o.gross; m.net += o.net; m.costRev += o.costRev; m.cost += o.cost;
      }
      var c = get(cityMap, o.city, function () { return { city: o.city, orders: 0, net: 0 }; });
      c.orders++; c.net += o.net;
      if (o.wd !== null) {
        var w = get(wdMap, o.wd, function () { return { day: DAYS[o.wd], i: o.wd, orders: 0, net: 0 }; });
        w.orders++; w.net += o.net;
      }
      if (o.ship !== null && o.ship >= 0) { shipSum += o.ship; shipN++; }
    });
    var monthly = values(monthMap).sort(function (a, b) { return a.month < b.month ? -1 : 1; });
    monthly.forEach(function (m) {
      m.discountRate = ratio(m.gross - m.net, m.gross);
      m.profit = m.costRev ? m.costRev - m.cost : null;
      m.margin = m.costRev ? (m.costRev - m.cost) / m.costRev : null;
    });
    var dated = ord.filter(function (o) { return /^\d{4}-\d{2}-\d{2}$/.test(o.date); })
      .map(function (o) { return o.date; }).sort();
    var dateRange = dated.length ? { first: dated[0], last: dated[dated.length - 1], undated: ord.length - dated.length } : null;
    var cities = values(cityMap).sort(function (a, b) { return b.net - a.net; });
    var weekdays = values(wdMap).sort(function (a, b) { return a.i - b.i; });

    /* Customers */
    var custAgg = Object.create(null);
    active.forEach(function (o) {
      var c = get(custAgg, o.cust, function () { return { id: o.cust, orders: 0, net: 0 }; });
      c.orders++; c.net += o.net;
    });
    var segMap = Object.create(null), ageMap = Object.create(null), signMap = Object.create(null);
    function seg(name) {
      return get(segMap, name, function () { return { segment: name, customers: 0, buyers: 0, repeat: 0, orders: 0, net: 0 }; });
    }
    customers.forEach(function (c) {
      var name = str(c.customer_segment) || "Unspecified";
      var s = seg(name); s.customers++;
      var a = custAgg[c.customer_id];
      if (a) { s.buyers++; s.orders += a.orders; s.net += a.net; if (a.orders >= 2) s.repeat++; }
      var ab = ageBucket(num(c.age));
      var g = get(ageMap, ab, function () { return { group: ab, customers: 0, orders: 0, net: 0 }; });
      g.customers++; if (a) { g.orders += a.orders; g.net += a.net; }
      var mk = monthKey(c.signup_date);
      if (mk) get(signMap, mk, function () { return { month: mk, count: 0 }; }).count++;
    });
    var unknownBuyers = 0;
    Object.keys(custAgg).forEach(function (k) {
      if (!custById[k]) {
        unknownBuyers++;
        var s = seg("Unknown customer"), a = custAgg[k];
        s.buyers++; s.orders += a.orders; s.net += a.net; if (a.orders >= 2) s.repeat++;
      }
    });
    var segments = values(segMap).map(function (s) {
      s.aov = ratio(s.net, s.orders); s.repeatRate = ratio(s.repeat, s.buyers); return s;
    }).sort(function (a, b) { return b.net - a.net; });
    var ageGroups = values(ageMap).sort(function (a, b) { return AGE_ORDER.indexOf(a.group) - AGE_ORDER.indexOf(b.group); });
    var signups = values(signMap).sort(function (a, b) { return a.month < b.month ? -1 : 1; });
    var buyerList = values(custAgg);
    var buyers = buyerList.length, repeatBuyers = buyerList.filter(function (c) { return c.orders >= 2; }).length;
    var topCustomers = buyerList.slice().sort(function (a, b) { return b.net - a.net; }).slice(0, 10).map(function (c) {
      var cu = custById[c.id];
      return { id: c.id, name: cu ? (str(cu.customer_name) || String(c.id)) : String(c.id), segment: cu ? (str(cu.customer_segment) || "Unspecified") : "Unknown customer",
               orders: c.orders, net: c.net };
    });

    /* Operations */
    var dels = [];
    ord.forEach(function (o) {
      if (o.dd === null || o.cls === "cancelled") return;
      if (o.dd < 0) { quality.invalidDelivery++; return; }
      dels.push(o.dd);
    });
    dels.sort(function (a, b) { return a - b; });
    var delBucket = Object.create(null), delCity = Object.create(null), ratingDist = Object.create(null),
        rateByDel = Object.create(null), rateByStatus = Object.create(null);
    var rated = [], fastSlow = null;
    ord.forEach(function (o) {
      var hasDel = o.dd !== null && o.dd >= 0 && o.cls !== "cancelled";
      if (hasDel) {
        var b = deliveryBucket(o.dd);
        get(delBucket, b, function () { return { bucket: b, orders: 0, ratingSum: 0, ratingN: 0 }; }).orders++;
        var dc2 = get(delCity, o.city, function () { return { city: o.city, orders: 0, sum: 0 }; });
        dc2.orders++; dc2.sum += o.dd;
      }
      if (o.rating !== null && o.rating >= 0) {
        rated.push(o.rating);
        var rk = String(Math.round(o.rating));
        get(ratingDist, rk, function () { return { rating: rk, count: 0 }; }).count++;
        var rs = get(rateByStatus, o.status, function () { return { status: o.status, n: 0, sum: 0 }; });
        rs.n++; rs.sum += o.rating;
        if (hasDel) {
          var bb = delBucket[deliveryBucket(o.dd)]; bb.ratingSum += o.rating; bb.ratingN++;
        }
      }
    });
    var delMedian = pctile(dels, 0.5);
    if (delMedian !== null) {
      var fast = [], slow = [];
      ord.forEach(function (o) {
        if (o.rating === null || o.rating < 0 || o.dd === null || o.dd < 0 || o.cls === "cancelled") return;
        (o.dd <= delMedian ? fast : slow).push(o.rating);
      });
      if (fast.length >= 30 && slow.length >= 30) {
        fastSlow = { median: delMedian, fastN: fast.length, slowN: slow.length,
                     fastAvg: sum(fast) / fast.length, slowAvg: sum(slow) / slow.length };
      }
    }
    var ops = {
      delivery: dels.length ? { n: dels.length, mean: sum(dels) / dels.length, median: delMedian, p90: pctile(dels, 0.9),
                                min: dels[0], max: dels[dels.length - 1] } : null,
      deliveryBuckets: DELIVERY_ORDER.filter(function (b) { return delBucket[b]; }).map(function (b) {
        var x = delBucket[b]; return { bucket: b, orders: x.orders, avgRating: ratio(x.ratingSum, x.ratingN), ratedOrders: x.ratingN };
      }),
      slowestCities: values(delCity).filter(function (c) { return c.orders >= 20; })
        .map(function (c) { return { city: c.city, orders: c.orders, avgDays: c.sum / c.orders }; })
        .sort(function (a, b) { return b.avgDays - a.avgDays; }).slice(0, 10),
      fastestCities: values(delCity).filter(function (c) { return c.orders >= 20; })
        .map(function (c) { return { city: c.city, orders: c.orders, avgDays: c.sum / c.orders }; })
        .sort(function (a, b) { return a.avgDays - b.avgDays; }).slice(0, 10),
      shipping: { total: shipSum, orders: shipN, avg: ratio(shipSum, shipN), shareOfNet: ratio(shipSum, T.net) },
      ratings: { n: rated.length, avg: rated.length ? sum(rated) / rated.length : null,
                 min: rated.length ? Math.min.apply(null, rated) : null, max: rated.length ? Math.max.apply(null, rated) : null,
                 coverage: ratio(rated.length, ord.length),
                 distribution: values(ratingDist).sort(function (a, b) { return Number(a.rating) - Number(b.rating); }) },
      ratingByStatus: values(rateByStatus).map(function (r) { return { status: r.status, n: r.n, avg: r.sum / r.n }; })
        .sort(function (a, b) { return b.n - a.n; }),
      fastSlow: fastSlow
    };

    var cnt = { all: ord.length };
    ["active", "cancelled", "returned", "failed", "unknown"].forEach(function (k) {
      cnt[k] = ord.filter(function (o) { return o.cls === k; }).length;
    });

    var A = {
      version: VERSION,
      counts: { customers: customers.length, products: products.length, orders: ord.length, items: items.length, payments: payments.length },
      dateRange: dateRange,
      quality: quality,
      assumptions: { discount: disc, orderStatuses: values(statusMap).sort(function (a, b) { return b.count - a.count; }),
                     paymentStatuses: values(pstatMap).sort(function (a, b) { return b.count - a.count; }), reconciliation: rec },
      orders: cnt,
      sales: { gross: T.gross, discount: T.gross - T.net, net: T.net, discountRate: ratio(T.gross - T.net, T.gross),
               units: T.units, lines: T.lines, discountedLineShare: ratio(T.discountedLines, T.lines),
               aov: ratio(T.net, active.length), unitsPerOrder: ratio(T.units, active.length),
               shipping: shipSum, allStatusesNet: sum(ord.map(function (o) { return o.net; })),
               allStatusesGross: sum(ord.map(function (o) { return o.gross; })) },
      monthly: monthly, cities: cities, weekdays: weekdays, statuses: A_statuses(statusMap),
      products: { top: productList.slice().sort(function (a, b) { return b.units - a.units; }).slice(0, 10),
                  topRevenue: productList.slice().sort(function (a, b) { return b.net - a.net; }).slice(0, 10),
                  bottom: productList.slice().sort(function (a, b) { return a.net - b.net; }).slice(0, 5),
                  all: productList.map(function (p) {
                    p.costed = p.costRev > 0;
                    p.listCost = prodById[p.id] ? num(prodById[p.id].unit_cost) : null;
                    p.listPrice = prodById[p.id] ? num(prodById[p.id].selling_price) : null;
                    p.profitAtGross = p.costed ? (p.grossCostRev || 0) - p.cost : null;
                    return p;
                  }),
                  sold: productList.length, catalog: products.length,
                  neverSold: products.length - productList.filter(function (p) { return prodById[p.id]; }).length },
      categories: categoryList,
      profit: { revenue: T.profitRev, cost: T.cost, profit: T.profitRev - T.cost, margin: ratio(T.profitRev - T.cost, T.profitRev),
                revenueWithoutCost: T.noCostRev, coverage: ratio(T.profitRev, T.profitRev + T.noCostRev) },
      customers: { total: customers.length, buyers: buyers, repeatBuyers: repeatBuyers, repeatRate: ratio(repeatBuyers, buyers),
                   neverBought: customers.length - buyers + unknownBuyers, ordersPerBuyer: ratio(active.length, buyers),
                   segments: segments, ageGroups: ageGroups, signups: signups, top: topCustomers },
      payments: { totals: P, methods: methods,
                  statuses: values(pstatMap).sort(function (a, b) { return b.count - a.count; }),
                  uncollected: unc, successRate: ratio(P.collectedCount, P.count) }
    };
    A.ops = ops;
    A.anomalies = findAnomalies(items, products, ordById, prodById, disc, T.net);
    A.insights = buildInsights(A);
    return A;
  }

  /* ── Anomalies: values far outside the data's own range (flagged, never removed) ── */
  function findAnomalies(items, products, ordById, prodById, disc, totalNet) {
    var qs = [];
    items.forEach(function (it) { var q = num(it.quantity); if (q !== null && q > 0) qs.push(q); });
    qs.sort(function (a, b) { return a - b; });
    // Robust threshold: the median is not pulled up by the outliers it is meant to catch.
    var median = pctile(qs, 0.5);
    var threshold = median === null ? null : Math.max(20, median * 20);
    var p99 = threshold === null ? null : pctile(qs.filter(function (q) { return q <= threshold; }), 0.99);
    var lines = [], activeNet = 0;
    if (threshold !== null) items.forEach(function (it) {
      var q = num(it.quantity), p = num(it.unit_price);
      if (q === null || q <= threshold) return;
      var o = ordById[it.order_id], prod = prodById[it.product_id];
      var d = num(it.discount_pct), f = d === null ? 0 : d / disc.divisor;
      if (f < 0 || f > 1) f = 0;
      var net = p === null ? 0 : q * p * (1 - f);
      var isActive = !!o && o.cls === "active";
      if (isActive) activeNet += net;
      lines.push({ order: it.order_id, product: it.product_id, name: prod ? str(prod.product_name) : String(it.product_id),
                   qty: q, net: net, status: o ? o.status : "(no order)", active: isActive });
    });
    lines.sort(function (a, b) { return b.net - a.net; });
    var zeroPrice = [], costAboveList = [], noCost = [];
    products.forEach(function (p) {
      var c = num(p.unit_cost), s = num(p.selling_price), nm = str(p.product_name) || String(p.product_id);
      if (s !== null && s <= 0) zeroPrice.push({ id: p.product_id, name: nm });
      else if (c !== null && s !== null && c > s) costAboveList.push({ id: p.product_id, name: nm, cost: c, price: s });
      if (c === null) noCost.push({ id: p.product_id, name: nm });
    });
    return { typicalMaxQty: p99, qtyThreshold: threshold, quantityLines: lines, quantityActiveNet: activeNet,
             quantityShare: ratio(activeNet, totalNet), zeroPrice: zeroPrice, costAboveList: costAboveList, noCost: noCost };
  }

  /* ── Reporting periods ──────────────────────────────────────────────
   * Periods are anchored to the latest COMPLETE calendar month in the data, never to
   * today's date, so a comparison never sets a partial month against a full one.
   * Payments carry no date, so they are attributed to their order's period. */
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function ym(y, m) { while (m < 0) { m += 12; y--; } while (m > 11) { m -= 12; y++; } return { y: y, m: m }; }
  function ymKey(p) { return p.y + "-" + ("0" + (p.m + 1)).slice(-2); }
  function lastDay(p) { return new Date(Date.UTC(p.y, p.m + 1, 0)).getUTCDate(); }
  function range(start, end) { // start/end {y,m}, inclusive
    return { from: ymKey(start) + "-01", to: ymKey(end) + "-" + ("0" + lastDay(end)).slice(-2), start: start, end: end };
  }
  function label(r) {
    if (r.start.y === r.end.y && r.start.m === r.end.m) return MON[r.start.m] + " " + r.start.y;
    return MON[r.start.m] + (r.start.y !== r.end.y ? " " + r.start.y : "") + " – " + MON[r.end.m] + " " + r.end.y;
  }
  function filterData(data, r) {
    var ids = Object.create(null), orders = [];
    (data.orders || []).forEach(function (o) {
      var d = str(o.order_date).slice(0, 10);
      if (d && d >= r.from && d <= r.to) { orders.push(o); ids[o.order_id] = 1; }
    });
    return { customers: data.customers, products: data.products, orders: orders,
             items: (data.items || []).filter(function (i) { return ids[i.order_id]; }),
             payments: (data.payments || []).filter(function (p) { return ids[p.order_id]; }) };
  }

  function computePeriods(data, mode, full) {
    full = full || compute(data);
    var out = { mode: mode, full: full, A: full, P: null, label: null, prevLabel: null, range: null, prevRange: null, note: null };
    var dr = full.dateRange;
    if (!dr) { out.mode = "all"; out.note = "No dated orders."; return out; }
    var f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dr.first), l = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dr.last);
    var first = { y: +f[1], m: +f[2] - 1 }, last = { y: +l[1], m: +l[2] - 1 };
    var complete = +l[3] >= lastDay(last) - 1;
    var anchor = complete ? last : ym(last.y, last.m - 1);
    out.anchorComplete = complete;
    out.allLabel = label(range(first, last));
    function before(a, b) { return a.y < b.y || (a.y === b.y && a.m < b.m); }

    if (mode === "quarter") {
      var qEnd = anchor.m - ((anchor.m + 1) % 3 === 0 ? 0 : (anchor.m % 3) + 1);
      var end = ym(anchor.y, qEnd), start = ym(end.y, end.m - 2);
      var pEnd = ym(start.y, start.m - 1), pStart = ym(pEnd.y, pEnd.m - 2);
      out.range = range(start, end);
      out.label = "Q" + (Math.floor(start.m / 3) + 1) + " " + start.y;
      out.sublabel = label(out.range);
      if (!before(pStart, first)) { out.prevRange = range(pStart, pEnd); out.prevLabel = "Q" + (Math.floor(pStart.m / 3) + 1) + " " + pStart.y; }
      else out.note = "No earlier quarter in the data to compare with.";
    } else if (mode === "year") {
      var yEnd = anchor, yStart = ym(anchor.y, anchor.m - 11);
      var pyEnd = ym(yStart.y, yStart.m - 1), pyStart = ym(pyEnd.y, pyEnd.m - 11);
      out.range = range(yStart, yEnd);
      out.label = "Last 12 months";
      out.sublabel = label(out.range);
      if (!before(pyStart, first)) { out.prevRange = range(pyStart, pyEnd); out.prevLabel = "the previous 12 months"; }
      else out.note = "The data does not reach back far enough for a 12-month comparison.";
    } else {
      out.mode = "all";
      out.label = "All data";
      out.sublabel = out.allLabel;
      return out;
    }
    out.A = compute(filterData(data, out.range));
    if (out.prevRange) out.P = compute(filterData(data, out.prevRange));

    // New buying customers: first active order (across all data) falls inside the period.
    var firstOrder = Object.create(null);
    (data.orders || []).forEach(function (o) {
      var d = str(o.order_date).slice(0, 10);
      if (!d || classifyOrder(o.order_status) !== "active") return;
      if (!firstOrder[o.customer_id] || d < firstOrder[o.customer_id]) firstOrder[o.customer_id] = d;
    });
    function countNew(r) { var n = 0; Object.keys(firstOrder).forEach(function (k) { var d = firstOrder[k]; if (d >= r.from && d <= r.to) n++; }); return n; }
    out.newCustomers = countNew(out.range);
    out.prevNewCustomers = out.prevRange ? countNew(out.prevRange) : null;
    return out;
  }

  function A_statuses(statusMap) {
    return values(statusMap).sort(function (a, b) { return b.count - a.count; });
  }

  /* ── Insights: deterministic rules, every one carries its numbers ── */
  function pct(x, d) { return x === null || x === undefined ? "n/a" : (x * 100).toFixed(d === undefined ? 1 : d) + "%"; }
  function money(x) { return Math.round(x).toLocaleString("en-US"); }
  function buildInsights(A) {
    var out = [];
    function add(id, tone, title, text, metrics) { out.push({ id: id, tone: tone, title: title, text: text, metrics: metrics }); }
    var net = A.sales.net;

    if (A.cities.length > 1 && net > 0) {
      var c0 = A.cities[0], top3 = sum(A.cities.slice(0, 3).map(function (c) { return c.net; }));
      add("city", "info", "Sales are concentrated in " + c0.city,
        c0.city + " produces " + pct(c0.net / net) + " of net sales across " + A.cities.length +
        " shipping cities; the top three cities together produce " + pct(top3 / net) + ".",
        [["Top city net sales", money(c0.net)], ["Top city share", pct(c0.net / net)], ["Top 3 share", pct(top3 / net)]]);
    }

    if (A.categories.length > 1 && net > 0) {
      var k0 = A.categories[0];
      var withM = A.categories.filter(function (c) { return c.margin !== null && c.net / net >= 0.05; });
      var m = [["Top category", k0.category], ["Share of net sales", pct(k0.net / net)]];
      var txt = k0.category + " is the largest category with " + pct(k0.net / net) + " of net sales.";
      if (withM.length > 1) {
        var best = withM.slice().sort(function (a, b) { return b.margin - a.margin; })[0],
            worst = withM.slice().sort(function (a, b) { return a.margin - b.margin; })[0];
        txt += " Among categories with at least 5% of sales, " + best.category + " has the highest estimated gross margin (" + pct(best.margin) +
               ") and " + worst.category + " the lowest (" + pct(worst.margin) + ").";
        m.push(["Highest margin", best.category + " " + pct(best.margin)], ["Lowest margin", worst.category + " " + pct(worst.margin)]);
      }
      add("category", "info", "Category mix and margin", txt, m);
    }

    if (A.sales.gross > 0) {
      var dr = A.assumptions.discount;
      add("discount", A.sales.discountRate > 0.1 ? "watch" : "info", "Discounts reduce gross sales by " + pct(A.sales.discountRate),
        pct(A.sales.discountedLineShare) + " of order lines carry a discount. Discounts total " + money(A.sales.discount) +
        " against gross sales of " + money(A.sales.gross) + " (active orders only).",
        [["Gross sales", money(A.sales.gross)], ["Discount amount", money(A.sales.discount)], ["Discounted lines", pct(A.sales.discountedLineShare)]]);
    }

    var lost = A.orders.cancelled + A.orders.returned + A.orders.failed;
    if (A.orders.all > 0 && lost > 0) {
      add("lost", lost / A.orders.all > 0.1 ? "risk" : "watch", "Cancelled, returned or failed orders: " + pct(lost / A.orders.all),
        lost + " of " + A.orders.all + " orders are cancelled, returned or failed and are excluded from sales figures. Their item value was " +
        money(A.sales.allStatusesNet - A.sales.net) + " (net).",
        [["Cancelled", String(A.orders.cancelled)], ["Returned", String(A.orders.returned)], ["Failed", String(A.orders.failed)],
         ["Excluded net value", money(A.sales.allStatusesNet - A.sales.net)]]);
    }

    var P = A.payments;
    if (P.totals.count > 0) {
      var m2 = [["Payments", String(P.totals.count)], ["Collected", money(P.totals.collected)], ["Success rate", pct(P.successRate)]];
      var txt2 = pct(P.successRate) + " of payment records are collected. Failed payments total " + money(P.totals.failed) +
        " and pending payments " + money(P.totals.pending) + ".";
      var meth = P.methods.filter(function (x) { return x.count >= 30; });
      if (meth.length > 1) {
        var lo = meth.slice().sort(function (a, b) { return a.successRate - b.successRate; })[0];
        txt2 += " " + lo.method + " has the lowest success rate (" + pct(lo.successRate) + " of " + lo.count + " payments).";
        m2.push(["Lowest method", lo.method + " " + pct(lo.successRate)]);
      }
      add("payments", P.successRate < 0.9 ? "risk" : "info", "Payment collection", txt2, m2);
    }

    if (P.uncollected.count > 0) {
      add("uncollected", "risk", P.uncollected.count + " active orders have no collected payment",
        "These orders are not cancelled, returned or failed but have no payment with a collected status. Their net item value is " +
        money(P.uncollected.value) + ". Of them, " + P.uncollected.withPending + " have a pending payment, " + P.uncollected.failedOnly +
        " only failed payments and " + P.uncollected.noPaymentRecord + " no payment record.",
        [["Orders", String(P.uncollected.count)], ["Net value", money(P.uncollected.value)], ["Pending", String(P.uncollected.withPending)],
         ["Failed only", String(P.uncollected.failedOnly)], ["No payment record", String(P.uncollected.noPaymentRecord)]]);
    }

    if (A.customers.buyers > 0) {
      var segs = A.customers.segments.filter(function (s) { return s.buyers >= 30; });
      var txt3 = pct(A.customers.repeatRate) + " of buying customers placed two or more active orders (" + A.customers.repeatBuyers + " of " + A.customers.buyers + ").";
      var m3 = [["Buyers", String(A.customers.buyers)], ["Repeat buyers", String(A.customers.repeatBuyers)], ["Orders per buyer", A.customers.ordersPerBuyer.toFixed(2)]];
      if (segs.length > 1) {
        var hi = segs.slice().sort(function (a, b) { return b.repeatRate - a.repeatRate; })[0];
        var hv = segs.slice().sort(function (a, b) { return b.aov - a.aov; })[0];
        txt3 += " The " + hi.segment + " segment repeats most (" + pct(hi.repeatRate) + "); " + hv.segment + " has the highest average order value (" + money(hv.aov) + ").";
        m3.push(["Best repeat segment", hi.segment + " " + pct(hi.repeatRate)], ["Highest AOV segment", hv.segment + " " + money(hv.aov)]);
      }
      add("repeat", "info", "Repeat purchasing", txt3, m3);
    }

    var fs = A.ops.fastSlow;
    if (fs) {
      var diff = fs.fastAvg - fs.slowAvg;
      add("delivery-rating", Math.abs(diff) >= 0.2 ? "watch" : "info", "Delivery speed and customer rating",
        "Orders delivered in " + fs.median.toFixed(0) + " days or fewer average a rating of " + fs.fastAvg.toFixed(2) + " (" + fs.fastN +
        " rated orders); slower orders average " + fs.slowAvg.toFixed(2) + " (" + fs.slowN + "). This is an observed difference, not proof of cause.",
        [["Fast avg rating", fs.fastAvg.toFixed(2)], ["Slow avg rating", fs.slowAvg.toFixed(2)], ["Difference", diff.toFixed(2)]]);
    }

    if (A.ops.shipping.orders > 0 && A.ops.shipping.shareOfNet !== null) {
      add("shipping", "info", "Shipping cost is " + pct(A.ops.shipping.shareOfNet) + " of net sales",
        "Shipping cost on active orders totals " + money(A.ops.shipping.total) + ", an average of " + A.ops.shipping.avg.toFixed(2) + " per order.",
        [["Total shipping cost", money(A.ops.shipping.total)], ["Average per order", A.ops.shipping.avg.toFixed(2)]]);
    }

    if (A.monthly.length >= 3) {
      var peak = A.monthly.slice().sort(function (a, b) { return b.net - a.net; })[0];
      var last = A.monthly[A.monthly.length - 1], prev = A.monthly[A.monthly.length - 2];
      add("trend", "info", "Sales trend",
        "Peak month is " + peak.month + " with " + money(peak.net) + " net sales. The latest month in the data (" + last.month + ") is " +
        pct(prev.net ? last.net / prev.net - 1 : null) + " versus " + prev.month + "; the latest month may be incomplete.",
        [["Peak month", peak.month], ["Latest month", last.month + " " + money(last.net)], ["Previous month", prev.month + " " + money(prev.net)]]);
    }
    return out;
  }

  var api = { VERSION: VERSION, compute: compute, computePeriods: computePeriods, filterData: filterData,
              classifyOrder: classifyOrder, classifyPayment: classifyPayment,
              detectDiscount: detectDiscount, monthKey: monthKey };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NovaAnalytics = api;
})(typeof window !== "undefined" ? window : this);
