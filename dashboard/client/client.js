/* Wanyxi Client Dashboard — Nova Analytics connection */
(function () {
  "use strict";

  var CFG = window.WANYXI_DASHBOARD || {};
  var SB = null;
  var WS = null;
  var navToken = 0;
  var PAGE_SIZE = 1000;
  var REQUEST_TIMEOUT_MS = 30000;
  var STALE_DAYS = 45;          // data older than this is flagged in the header

  /* Workspace-scoped cache: one download per sign-in (or per Refresh), never shared
   * across workspaces or sessions. Cleared on sign-out and when the workspace changes. */
  var CACHE = null;             // { ws, promise, data, loadedAt, periods: {} }
  var PERIOD = "quarter";       // overview reporting period: quarter | year | all

  var ANALYTICS_VIEWS = [
    "overview", "sales", "products", "customers",
    "payments", "operations", "insights"
  ];

  var VIEWS = {
    overview:    { title: "Overview", sub: "Your business at a glance" },
    sales:       { title: "Sales", sub: "Revenue, orders and sales trends" },
    products:    { title: "Products", sub: "Product performance and profitability" },
    customers:   { title: "Customers", sub: "Customer segments and purchasing behaviour" },
    payments:    { title: "Payments", sub: "Payment collection and payment status" },
    operations:  { title: "Operations", sub: "Delivery, shipping and customer ratings" },
    insights:    { title: "Insights & actions", sub: "Recommended actions, data checks and the findings behind them · all data" },
    datasets:    { title: "Datasets", sub: "Files stored in your workspace", table: "client_datasets", empty: "No datasets found." },
    analysis:    { title: "Data Analysis", sub: "Saved analysis results", table: "client_analysis", empty: "No saved analyses found." },
    reports:     { title: "Reports", sub: "Reports built from your data", table: "client_reports", empty: "No reports found." },
    automations: { title: "Automations", sub: "Automation configurations", table: "client_automations", empty: "No automations found." }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function errText(e) {
    return e && (e.message || e.error_description) || String(e);
  }

  function sbClient() {
    if (SB) return SB;

    var url = CFG.supabaseUrl;
    var key = CFG.supabaseKey;

    if (!url || !key) {
      throw new Error("Supabase URL or publishable key is missing from dashboard/config.js.");
    }

    if (/^sb_secret_/.test(key)) {
      throw new Error("A secret key cannot be used in the browser. Configure the publishable key.");
    }

    try {
      if (key.indexOf("eyJ") === 0) {
        var payload = JSON.parse(
          atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
        );
        if (payload.role === "service_role") {
          throw new Error("A service-role key cannot be used in the browser.");
        }
      }
    } catch (e) {
      if (/service-role key/.test(errText(e))) throw e;
    }

    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("The Supabase browser library did not load.");
    }

    SB = window.supabase.createClient(url.replace(/\/$/, ""), key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });

    SB.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_OUT") {
        WS = null;
        CACHE = null;
        navToken++;
        if ($("gate") && !$("gate").hidden) return;
        showGate("login");
      }
    });

    return SB;
  }

  function showGate(kind, message) {
    var gate = $("gate");
    if (!gate) return;

    gate.hidden = false;
    $("app").hidden = true;
    $("nav").hidden = true;
    $("who").hidden = true;
    gate.replaceChildren();
    gate.className = "gate" + (kind === "error" ? " err" : "");

    if (kind === "loading") {
      gate.appendChild(el("div", "kicker", "Client Workspace"));
      gate.appendChild(el("h2", "", "Loading workspace…"));
      gate.appendChild(el("p", "", "Verifying access and preparing your dashboard."));
      return;
    }

    if (kind === "login") {
      gate.appendChild(el("div", "kicker", "Wanyxi · Client"));
      gate.appendChild(el("h2", "", "Sign in to your workspace"));
      gate.appendChild(el("p", "", "Use your Wanyxi client account."));

      var form = el("form", "login");
      form.id = "loginForm";
      form.noValidate = true;

      var emailLabel = el("label", "", "Email");
      emailLabel.htmlFor = "cEmail";
      var email = el("input");
      email.id = "cEmail";
      email.type = "email";
      email.autocomplete = "username";
      email.required = true;

      var passLabel = el("label", "", "Password");
      passLabel.htmlFor = "cPass";
      var pass = el("input");
      pass.id = "cPass";
      pass.type = "password";
      pass.autocomplete = "current-password";
      pass.required = true;

      var err = el("p", "login__err", message || "");
      err.id = "cErr";
      err.setAttribute("role", "alert");
      err.hidden = !message;

      var btn = el("button", "btn btn--dark", "Sign in");
      btn.id = "cBtn";
      btn.type = "submit";

      form.append(emailLabel, email, passLabel, pass, err, btn);
      gate.appendChild(form);
      form.addEventListener("submit", signIn);
      return;
    }

    gate.appendChild(el("div", "kicker", "Wanyxi Workspace"));
    gate.appendChild(el("h2", "", kind === "noaccess" ? "Workspace access unavailable" : "Could not load dashboard"));
    gate.appendChild(el("p", "", message || "An unexpected error occurred."));

    var actions = el("div", "row");
    var retry = el("button", "btn btn--dark", "Try again");
    retry.type = "button";
    retry.dataset.retry = "";
    var out = el("button", "btn btn--line", "Sign out");
    out.type = "button";
    out.dataset.signout = "";
    actions.append(retry, out);
    gate.appendChild(actions);
  }

  function signIn(ev) {
    ev.preventDefault();

    var email = $("cEmail").value.trim();
    var password = $("cPass").value;
    var error = $("cErr");
    var button = $("cBtn");

    error.hidden = true;

    if (!email || !password) {
      error.textContent = "Enter your email and password.";
      error.hidden = false;
      return;
    }

    button.disabled = true;
    button.textContent = "Signing in…";

    sbClient().auth.signInWithPassword({
      email: email,
      password: password
    }).then(function (r) {
      if (r.error) throw r.error;
      showGate("loading");
      return openWorkspace();
    }).catch(function (e) {
      var currentError = $("cErr");
      if (!currentError) return showGate("error", errText(e));
      currentError.textContent = errText(e);
      currentError.hidden = false;
      button.disabled = false;
      button.textContent = "Sign in";
    });
  }

  function signOut() {
    WS = null;
    CACHE = null;
    navToken++;
    return SB.auth.signOut().finally(function () {
      showGate("login");
    });
  }

  function openWorkspace() {
    var client = sbClient();

    return client.auth.getUser().then(function (r) {
      if (r.error) throw r.error;
      if (!r.data || !r.data.user) {
        showGate("login", "Please sign in again.");
        return;
      }

      var user = r.data.user;

      return client.from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id)
        .then(function (m) {
          if (m.error) throw m.error;

          var memberships = (m.data || []).filter(function (x) {
            return x.role === "client" && x.workspace_id;
          });

          if (memberships.length !== 1) {
            showGate("noaccess", memberships.length
              ? "This account has multiple client workspaces. Workspace selection is not supported yet."
              : "No client workspace is assigned to this account.");
            return;
          }

          return client.from("workspaces")
            .select("id, name")
            .eq("id", memberships[0].workspace_id)
            .maybeSingle()
            .then(function (w) {
              if (w.error) throw w.error;
              if (!w.data) {
                showGate("noaccess", "The assigned workspace could not be found.");
                return;
              }

              if (!WS || WS.id !== w.data.id) CACHE = null;
              WS = { id: w.data.id, name: w.data.name || "Workspace" };

              $("gate").hidden = true;
              $("app").hidden = false;
              $("nav").hidden = false;
              $("who").hidden = false;
              $("whoName").textContent = user.email || "";
              $("wsName").textContent = WS.name;
              $("wsMeta").textContent = "Private workspace";

              var requested = (location.hash || "").slice(1);
              return go(VIEWS[requested] ? requested : "overview");
            });
        });
    }).catch(function (e) {
      showGate("error", errText(e));
    });
  }

  /*
   * Fetch every page, but only rows belonging to the verified workspace.
   * Do not remove the workspace filter to work around empty results.
   * Pages are ordered by the table's key: without an ORDER BY, Postgres may return
   * overlapping or missing rows across .range() pages.
   */
  function loadTable(table, columns, key) {
    var all = [];

    function page(from) {
      var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, REQUEST_TIMEOUT_MS) : null;
      var q = SB.from(table)
        .select(columns)
        .eq("workspace_id", WS.id)
        .order(key, { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (ctl && q.abortSignal) q = q.abortSignal(ctl.signal);
      return q.then(function (r) {
          if (timer) clearTimeout(timer);
          if (r.error) {
            if (ctl && ctl.signal.aborted) throw new Error(table + ": the request timed out. Check your connection and retry.");
            throw new Error(table + ": " + r.error.message);
          }

          var rows = r.data || [];
          all = all.concat(rows);

          if (rows.length === PAGE_SIZE) return page(from + PAGE_SIZE);
          return all;
        });
    }

    return page(0);
  }

  function loadNovaData() {
    var definitions = {
      customers: {
        table: "nova_customers", key: "customer_id",
        columns: "customer_id,customer_name,gender,age,city,customer_segment,signup_date"
      },
      products: {
        table: "nova_products", key: "product_id",
        columns: "product_id,product_name,category,sub_category,supplier,unit_cost,selling_price"
      },
      orders: {
        table: "nova_orders", key: "order_id",
        columns: "order_id,customer_id,order_date,order_status,shipping_city,shipping_cost,delivery_days,customer_rating"
      },
      items: {
        table: "nova_order_items", key: "row_id",
        columns: "row_id,order_id,product_id,quantity,unit_price,discount_pct"
      },
      payments: {
        table: "nova_payments", key: "payment_id",
        columns: "payment_id,order_id,payment_method,payment_status,payment_amount"
      }
    };

    var result = {};
    var names = Object.keys(definitions);

    return Promise.all(names.map(function (name) {
      var d = definitions[name];
      return loadTable(d.table, d.columns, d.key).then(function (rows) {
        result[name] = rows;
      });
    })).then(function () {
      return result;
    });
  }

  function go(view, force) {
    if (!WS || !VIEWS[view]) return;

    var token = ++navToken;
    var def = VIEWS[view];

    $("title").textContent = def.title;
    $("subtitle").textContent = def.sub;

    if (location.hash !== "#" + view) {
      history.replaceState(null, "", "#" + view);
    }

    document.querySelectorAll("#nav button[data-view]").forEach(function (button) {
      var active = button.dataset.view === view;
      button.classList.toggle("on", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

    var host = $("view");
    host.replaceChildren();
    host.dataset.view = view;
    document.body.dataset.view = view;
    window.scrollTo(0, 0);

    if (ANALYTICS_VIEWS.indexOf(view) !== -1) {
      return renderAnalytics(view, host, token, force);
    }

    setHead(view, null);
    host.appendChild(el("p", "dim", "Loading " + def.title.toLowerCase() + "…"));

    return renderList(view, def, host, token);
  }

  /* One download per workspace session; concurrent callers share the same promise. */
  function getData(force) {
    if (force || !CACHE || CACHE.ws !== WS.id) {
      var entry = { ws: WS.id, data: null, loadedAt: null, periods: {}, full: null };
      entry.promise = loadNovaData().then(function (data) {
        entry.data = data;
        entry.loadedAt = new Date();
        return entry;
      }, function (e) {
        if (CACHE === entry) CACHE = null;   // do not cache a failure
        throw e;
      });
      CACHE = entry;
    }
    return CACHE.promise;
  }

  function analyticsFor(entry, view) {
    var NA = window.NovaAnalytics;
    if (!entry.full) entry.full = NA.compute(entry.data);
    if (view !== "overview" && view !== "insights") return { A: entry.full, ctx: null };
    var mode = view === "insights" ? "all" : PERIOD;
    if (!entry.periods[mode]) {
      var ctx = NA.computePeriods(entry.data, mode, entry.full);
      ctx.loadedAt = entry.loadedAt;
      ctx.workspace = WS.name;
      ctx.intel = window.NovaRecommend ? window.NovaRecommend.build(ctx) : null;
      entry.periods[mode] = ctx;
    }
    return { A: entry.periods[mode].A, ctx: entry.periods[mode] };
  }

  function daysBetween(isoDate, now) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
    if (!m) return null;
    return Math.floor((now - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86400000);
  }

  function setStatus(entry) {
    var st = $("dataStatus");
    if (!st) return;
    var dr = entry && entry.full && entry.full.dateRange;
    st.hidden = !dr;
    if (!dr) return;
    var age = daysBetween(dr.last, entry.loadedAt);
    var d = new Date(dr.last + "T00:00:00Z");
    var when = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    st.classList.toggle("stale", age !== null && age > STALE_DAYS);
    $("dataStatusText").textContent = "Data through " + when + (age !== null && age > STALE_DAYS ? " · " + age + " days old" : "");
    st.title = "Latest order date in your workspace data. Loaded from the database at " +
      entry.loadedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " today.";
  }

  function greeting() {
    var h = new Date().getHours();
    return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }

  function setHead(view, ctx) {
    var period = $("periodSeg");
    if (period) period.hidden = view !== "overview";
    if (view !== "overview" || !ctx) return;
    $("title").textContent = greeting() + ", " + WS.name;
    $("subtitle").textContent = "Executive overview · " + ctx.label +
      (ctx.mode !== "all" ? " (" + ctx.sublabel + ")" : " (" + ctx.sublabel + ")") +
      (ctx.prevLabel ? " compared with " + ctx.prevLabel : ctx.note ? " · " + ctx.note : "");
    document.querySelectorAll("#periodSeg button").forEach(function (b) {
      var on = b.dataset.period === PERIOD;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function renderAnalytics(view, host, token, force) {
    if (!window.NovaAnalytics || !window.NovaViews) {
      host.replaceChildren();
      host.appendChild(el("p", "note",
        "Analytics modules did not load. Check that the nova-*.js files are deployed under /dashboard/client/."));
      return;
    }

    setHead(view, null);
    if (!CACHE || !CACHE.data || force) host.appendChild(el("p", "dim", "Loading your business data…"));

    return getData(force).then(function (entry) {
      if (token !== navToken) return;

      var r = analyticsFor(entry, view);
      host.replaceChildren();
      setStatus(entry);
      setHead(view, r.ctx);
      window.NovaViews.render(view, host, r.A, r.ctx);

      if (view !== "overview") {
        var A = entry.full;
        host.appendChild(el("p", "dim",
          "Loaded " + A.counts.customers.toLocaleString() + " customers, " +
          A.counts.products.toLocaleString() + " products, " +
          A.counts.orders.toLocaleString() + " orders, " +
          A.counts.items.toLocaleString() + " order lines and " +
          A.counts.payments.toLocaleString() + " payments."));
      }
    }).catch(function (e) {
      if (token !== navToken) return;
      host.replaceChildren();
      host.appendChild(el("h2", "", "Could not load your business data"));
      host.appendChild(el("p", "note", errText(e)));
      var retry = el("button", "btn btn--dark", "Retry loading data");
      retry.type = "button";
      retry.addEventListener("click", function () {
        go(view, true);
      });
      host.appendChild(retry);
    });
  }

  function renderList(view, def, host, token) {
    var card = el("div", "card");
    card.appendChild(el("h2", "", def.title));
    card.appendChild(el("p", "dim", "Loading records…"));
    host.replaceChildren(card);

    return SB.from(def.table)
      .select("*")
      .eq("workspace_id", WS.id)
      .limit(100)
      .then(function (r) {
        if (token !== navToken) return;
        if (r.error) throw r.error;

        var rows = r.data || [];
        card.replaceChildren(el("h2", "", def.title));

        if (!rows.length) {
          card.appendChild(el("p", "dim", def.empty));
          return;
        }

        rows.forEach(function (row) {
          var item = el("div", "rec");
          item.appendChild(el("b", "", String(
            row.name || row.title || row.file_name || row.source_file || "Record"
          )));

          var meta = [];
          if (row.row_count != null) meta.push(row.row_count + " rows");
          if (row.status) meta.push(String(row.status));
          if (row.created_at) meta.push(new Date(row.created_at).toLocaleString());

          item.appendChild(el("span", "", meta.join(" · ")));
          card.appendChild(item);
        });
      }).catch(function (e) {
        if (token !== navToken) return;
        card.replaceChildren(el("h2", "", def.title));
        card.appendChild(el("p", "note", errText(e)));
      });
  }

  document.addEventListener("click", function (ev) {
    var target = ev.target;
    if (!target || !target.closest) return;

    if (target.closest("[data-signout]")) {
      signOut();
      return;
    }

    if (target.closest("[data-retry]")) {
      showGate("loading");
      openWorkspace();
      return;
    }

    if (target.closest("[data-refresh]")) {
      var current = (location.hash || "#overview").slice(1);
      go(VIEWS[current] ? current : "overview", true);
      return;
    }

    var periodBtn = target.closest("#periodSeg button[data-period]");
    if (periodBtn) {
      if (periodBtn.dataset.period !== PERIOD) {
        PERIOD = periodBtn.dataset.period;
        go("overview");
      }
      return;
    }

    var goto = target.closest("[data-goto]");
    if (goto && VIEWS[goto.dataset.goto]) {
      go(goto.dataset.goto);
      return;
    }

    var button = target.closest("#nav button[data-view]");
    if (button) go(button.dataset.view);
  });

  function start() {
    try {
      sbClient();
    } catch (e) {
      showGate("error", errText(e));
      return;
    }

    showGate("loading");

    SB.auth.getSession().then(function (r) {
      if (r.error) throw r.error;
      if (!r.data || !r.data.session) {
        showGate("login");
        return;
      }
      return openWorkspace();
    }).catch(function (e) {
      showGate("error", errText(e));
    });
  }

  start();
})();
