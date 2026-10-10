/* Wanyxi client workspace — Phase 1 (sign-in, routing, workspace shell).
 *
 * Loaded as an external file because the site's Content-Security-Policy
 * (script-src 'self') blocks inline scripts. Uses only config.js and the
 * locally vendored Supabase library; the publishable key is read from
 * window.WANYXI_DASHBOARD and no other credential exists in this file.
 *
 * Security model: this script decides what to SHOW. What a user can READ is
 * decided by the database (Row Level Security). Every query below is also
 * scoped by the verified workspace_id as defence in depth, never as the only
 * protection.
 */
(function () {
  "use strict";

  var CFG = window.WANYXI_DASHBOARD || {};
  var ADMIN_URL = "/dashboard/";
  var SB = null;
  var WS = null;        // { id, name } of the verified workspace
  var navToken = 0;     // ignores late responses from a view the user already left

  var VIEWS = {
    overview:    { title: "Overview",      sub: "A summary of your workspace" },
    datasets:    { title: "Datasets",      sub: "Files stored in your workspace", table: "client_datasets",
                   empty: "No datasets yet. Uploading CSV and Excel files is not enabled in this release." },
    analysis:    { title: "Data Analysis", sub: "Saved analysis results",         table: "client_analysis",
                   empty: "No saved analyses yet." },
    reports:     { title: "Reports",       sub: "Reports built from your data",   table: "client_reports",
                   empty: "No reports yet." },
    automations: { title: "Automations",   sub: "Automation configurations and their status", table: "client_automations",
                   empty: "No automations configured yet. A listed automation will be marked as configured only, unless a real execution mechanism is running it." }
  };

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  /* ── Supabase client ─────────────────────────────────────────────── */
  function sbClient() {
    if (SB) return SB;
    var url = CFG.supabaseUrl, key = CFG.supabaseKey;
    if (!url || !key) throw new Error("The workspace is not configured. supabaseUrl and supabaseKey are missing from /dashboard/config.js.");
    var role = "";
    try { role = key.indexOf("eyJ") === 0 ? JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role : ""; } catch (e) { /* not a JWT */ }
    if (/^sb_secret_/.test(key) || role === "service_role") {
      throw new Error("config.js contains a secret service key. Remove it, rotate it in Supabase, and use the publishable key.");
    }
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("The Supabase library did not load (/dashboard/assets/vendor/supabase-2.117.1.js).");
    }
    // Same options as the administrator dashboard, so both pages share one browser session.
    SB = window.supabase.createClient(url.replace(/\/$/, ""), key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    SB.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_OUT") {
        WS = null; navToken++;
        if ($("loginForm") && !$("gate").hidden) return;   // keep any message already shown on the sign-in form
        gate("login");
      }
    });
    return SB;
  }

  function errText(err) {
    return (err && (err.message || err.error_description)) || String(err);
  }

  function isNetworkError(err) {
    return !!err && (err.name === "AuthRetryableFetchError" || /failed to fetch|networkerror|network request failed|load failed/i.test(errText(err)));
  }

  /* ── Gate (loading, sign-in, no access, errors) ──────────────────── */
  function chrome(signedIn, email) {
    $("nav").hidden = !signedIn;
    $("who").hidden = !signedIn;
    if (signedIn) $("whoName").textContent = email || "";
    $("wsName").textContent = signedIn && WS ? WS.name : "Wanyxi";
    $("wsMeta").textContent = signedIn ? "Private workspace" : "Not signed in";
  }

  function gate(kind, a, b) {
    var g = $("gate");
    g.hidden = false;
    $("app").hidden = true;
    chrome(false);
    g.className = "gate" + (kind === "error" || kind === "noaccess" ? " err" : "");
    g.replaceChildren();

    if (kind === "loading") {
      g.appendChild(el("div", "kicker", "Client Workspace"));
      g.appendChild(el("h2", "", "Loading…"));
      g.appendChild(el("p", "", "Checking your sign-in."));
      return;
    }

    if (kind === "login") {
      g.appendChild(el("div", "kicker", "Wanyxi · Client"));
      g.appendChild(el("h2", "", "Sign in to your workspace"));
      g.appendChild(el("p", "", "Sign in with the account Wanyxi created for your company."));
      var f = el("form", "login");
      f.id = "loginForm";
      f.noValidate = true;
      f.innerHTML =
        '<label for="cEmail">Email</label><input id="cEmail" name="email" type="email" autocomplete="username" required>' +
        '<label for="cPass">Password</label><input id="cPass" name="password" type="password" autocomplete="current-password" required>' +
        '<p class="login__err" id="cErr" role="alert" hidden></p>' +
        '<button class="btn btn--dark" type="submit" id="cBtn">Sign in</button>';
      g.appendChild(f);
      if (a) { var e = $("cErr"); e.textContent = a; e.hidden = false; }
      f.addEventListener("submit", onSignIn);
      setTimeout(function () { var i = $("cEmail"); if (i) i.focus(); }, 30);
      return;
    }

    if (kind === "noaccess") {
      var why = {
        none: "No client workspace is assigned to this account.",
        notclient: "This page is for client accounts. This account belongs to a different kind of workspace.",
        multiple: "This account belongs to more than one workspace. Workspace selection is not available yet."
      }[b] || "This account cannot open a client workspace.";
      g.appendChild(el("div", "kicker", "No access"));
      g.appendChild(el("h2", "", "This account cannot open this workspace"));
      var p1 = el("p", "", "You are signed in as ");
      p1.appendChild(el("b", "", a || "this account"));
      p1.appendChild(document.createTextNode(". " + why));
      g.appendChild(p1);
      g.appendChild(el("p", "", "If you think this is a mistake, contact Wanyxi."));
      var row = el("div", "row");
      var out = el("button", "btn btn--dark", "Sign out");
      out.type = "button"; out.setAttribute("data-signout", "");
      row.appendChild(out);
      if (b === "notclient") {
        var adm = el("a", "btn btn--line", "Administrator dashboard");
        adm.href = ADMIN_URL;
        row.appendChild(adm);
      }
      g.appendChild(row);
      return;
    }

    // kind === "error"
    g.appendChild(el("div", "kicker", "Could not load"));
    g.appendChild(el("h2", "", a || "Something went wrong"));
    g.appendChild(el("p", "", b || ""));
    g.appendChild(el("p", "", "Nothing has been estimated or filled in."));
    var r2 = el("div", "row");
    var retry = el("button", "btn btn--dark", "Try again");
    retry.type = "button"; retry.setAttribute("data-retry", "");
    var out2 = el("button", "btn btn--line", "Sign out");
    out2.type = "button"; out2.setAttribute("data-signout", "");
    r2.appendChild(retry); r2.appendChild(out2);
    g.appendChild(r2);
  }

  /* ── Sign in / out ───────────────────────────────────────────────── */
  function onSignIn(ev) {
    ev.preventDefault();
    var email = $("cEmail").value.trim(), pass = $("cPass").value, err = $("cErr"), btn = $("cBtn");
    err.hidden = true;
    if (!email || !pass) { err.textContent = "Enter your email and password."; err.hidden = false; return; }
    btn.disabled = true; btn.textContent = "Signing in…";
    sbClient().auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
      if (r.error) throw r.error;
      gate("loading");
      return openWorkspace();
    }).catch(function (e) {
      if (!$("cErr")) return fail(e);  // the form was replaced by another state
      var m = isNetworkError(e) ? "Could not reach the server. Check your connection and try again." : (errText(e) || "Sign-in failed.");
      err.textContent = m; err.hidden = false;
      btn.disabled = false; btn.textContent = "Sign in";
    });
  }

  function signOut() {
    WS = null; navToken++;
    var done = function () { gate("login"); };
    if (!SB) return done();
    return SB.auth.signOut().then(done, done);
  }

  /* ── Workspace access (membership verified in the database) ──────── */
  function fail(err) {
    if (/jwt|token|session/i.test(errText(err)) && !isNetworkError(err)) {
      return sbClient().auth.signOut().then(function () { gate("login", "Your session has expired. Please sign in again."); },
                                            function () { gate("login", "Your session has expired. Please sign in again."); });
    }
    return gate("error",
      isNetworkError(err) ? "The workspace could not be reached" : "The workspace could not be loaded",
      isNetworkError(err) ? "Check your connection and try again." : errText(err));
  }

  function openWorkspace() {
    var c = sbClient();
    // getUser() asks the auth server to validate the token instead of trusting local storage.
    return c.auth.getUser().then(function (r) {
      if (r.error && isNetworkError(r.error)) throw r.error;
      if (r.error || !r.data || !r.data.user) {
        return c.auth.signOut().then(function () { gate("login", "Your session has expired. Please sign in again."); },
                                     function () { gate("login", "Your session has expired. Please sign in again."); });
      }
      
var user = r.data.user;

return c.from("workspace_members")
  .select("workspace_id, role")
  .eq("user_id", user.id)
  .then(function (m) {
    if (m.error) throw m.error;

    var rows = m.data || [];
    if (!rows.length) return gate("noaccess", user.email, "none");

    var mine = rows.filter(function (x) {
      return x.role === "client" && x.workspace_id;
    });

    if (!mine.length) return gate("noaccess", user.email, "notclient");
    if (mine.length > 1) return gate("noaccess", user.email, "multiple");

    return c.from("workspaces")
      .select("id, name")
      .eq("id", mine[0].workspace_id)
      .maybeSingle()
      .then(function (w) {
        if (w.error) throw w.error;
        if (!w.data) return gate("noaccess", user.email, "workspace-unavailable");

        WS = {
          id: mine[0].workspace_id,
          name: w.data.name || "Workspace"
        };

        $("gate").hidden = true;
        $("app").hidden = false;
        chrome(true, user.email);

        var v = (location.hash || "").replace("#", "");
        return go(VIEWS[v] ? v : "overview");
    
      });
  });
}).catch(fail);
}


  /* ── Views ───────────────────────────────────────────────────────── */
  function go(view) {
    var def = VIEWS[view];
    if (!def || !WS) return;
    var token = ++navToken;
    $("title").textContent = def.title;
    $("subtitle").textContent = def.sub;
    if (("#" + view) !== location.hash) history.replaceState(null, "", "#" + view);
    document.querySelectorAll("#nav button").forEach(function (b) {
      var on = b.dataset.view === view;
      b.classList.toggle("on", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    var host = $("view");
    host.replaceChildren();
    return (view === "overview" ? renderOverview(host, token) : renderList(host, def, token));
  }

  function countOf(table) {
    return SB.from(table).select("id", { count: "exact", head: true }).eq("workspace_id", WS.id)
      .then(function (r) { if (r.error) throw r.error; return r.count; });
  }

  function renderOverview(host, token) {
    var items = [
      { label: "Datasets",    table: "client_datasets" },
      { label: "Analyses",    table: "client_analysis" },
      { label: "Reports",     table: "client_reports" },
      { label: "Automations", table: "client_automations" }
    ];
    var kpis = el("div", "kpis");
    var vals = items.map(function (it) {
      var card = el("div", "card kpi");
      card.appendChild(el("div", "l", it.label));
      var v = el("div", "v num", "…");
      card.appendChild(v);
      kpis.appendChild(card);
      return v;
    });
    host.appendChild(kpis);

    return Promise.all(items.map(function (it, i) {
      return countOf(it.table).then(function (n) { return n; }, function (e) { return { error: e }; });
    })).then(function (res) {
      if (token !== navToken) return;
      var errors = [], total = 0;
      res.forEach(function (r, i) {
        if (r && r.error) { vals[i].textContent = "—"; errors.push(items[i].label + ": " + errText(r.error)); }
        else { vals[i].textContent = String(r); total += r; }
      });
      if (errors.length) {
        var n = el("div", "note", "Some totals could not be loaded. " + errors.join(" · "));
        host.insertBefore(n, kpis);
        return;
      }
      var card = el("div", "card empty");
      if (total === 0) {
        card.appendChild(el("h3", "", "Your workspace is empty"));
        card.appendChild(el("p", "", "Nothing has been uploaded or created yet, so there are no figures to show. Totals above come directly from your workspace and will update as data is added."));
      } else {
        card.appendChild(el("h3", "", "Totals come from your workspace"));
        card.appendChild(el("p", "", "Open a section from the menu to see its records."));
      }
      host.appendChild(card);
    });
  }

  function renderList(host, def, token) {
    var card = el("div", "card");
    var sh = el("div", "sh");
    sh.appendChild(el("h2", "", def.title));
    sh.appendChild(el("span", "", "Up to 100 most recent records"));
    card.appendChild(sh);
    var body = el("p", "dim", "Loading…");
    card.appendChild(body);
    host.appendChild(card);

    return SB.from(def.table).select("*").eq("workspace_id", WS.id).limit(100).then(function (r) {
      if (token !== navToken) return;
      if (r.error) throw r.error;
      var rows = r.data || [];
      if (!rows.length) { body.className = "dim"; body.textContent = def.empty; return; }
      var list = el("div", "recs");
      rows.forEach(function (x) {
        var row = el("div", "rec");
        row.appendChild(el("b", "", String(x.name || x.title || x.file_name || x.source_file || "Record")));
        var meta = [];
        if (x.row_count != null) meta.push(x.row_count + " rows");
        if (x.status) meta.push(String(x.status));
        if (x.created_at) meta.push(new Date(x.created_at).toLocaleString());
        row.appendChild(el("span", "", meta.join(" · ")));
        list.appendChild(row);
      });
      card.replaceChild(list, body);
    }).catch(function (e) {
      if (token !== navToken) return;
      body.className = "note";
      body.textContent = "Could not load " + def.title.toLowerCase() + ": " + (isNetworkError(e) ? "network error, check your connection." : errText(e));
    });
  }

  /* ── Events (delegated; no inline handlers because of the CSP) ───── */
  document.addEventListener("click", function (ev) {
    var t = ev.target, b;
    if (t.closest("[data-signout]")) return signOut();
    if (t.closest("[data-retry]")) { gate("loading"); return openWorkspace(); }
    if ((b = t.closest("#nav button[data-view]"))) return go(b.dataset.view);
  });

  /* ── Start ───────────────────────────────────────────────────────── */
  (function start() {
    var c;
    try { c = sbClient(); } catch (e) { return gate("error", "The workspace is not configured", errText(e)); }
    gate("loading");
    c.auth.getSession().then(function (r) {
      if (r.error) throw r.error;
      if (!r.data || !r.data.session) return gate("login");
      return openWorkspace();
    }).catch(fail);
  })();
})();
