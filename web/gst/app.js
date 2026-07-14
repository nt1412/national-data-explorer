/* India GST consumption flows — state choropleth.
   Producer<->consumer = post/pre SGST uplift (diverging, centred on the national ratio);
   per-capita metrics = sequential. Descriptive (polarity 0), not a league table. */
(function () {
  "use strict";
  var W = 900, H = 980, PAD = 12;
  var st = { metric: "uplift", selected: null };
  var DATA, M_BY_ID, BY_KEY, FEATURES, NAT, projection, path, svg, gRoot;

  Promise.all([
    fetch("data/gst.json").then(function (r) { return r.json(); }),
    fetch("data/states.topo.json").then(function (r) { return r.json(); })
  ]).then(function (res) {
    DATA = res[0];
    var topo = res[1], on = Object.keys(topo.objects)[0];
    FEATURES = topojson.feature(topo, topo.objects[on]).features;
    M_BY_ID = {}; DATA.metrics.forEach(function (m) { M_BY_ID[m.id] = m; });
    BY_KEY = {}; DATA.states.forEach(function (s) { BY_KEY[s.key] = s; });
    NAT = DATA.meta.nationalUplift;
    st.metric = DATA.meta.defaultMetric;
    document.getElementById("notes").innerHTML = DATA.meta.notes.map(function (n) { return "• " + n; }).join("<br>");
    initControls(); initMap(); render();
  }).catch(function (e) {
    document.getElementById("mapcard").innerHTML = '<p style="padding:24px;color:var(--muted)">Could not load data. Run <code>python scripts/build_gst.py</code>.</p>';
    console.error(e);
  });

  var inr = function (n) { return n === null || n === undefined ? "—" : Math.round(n).toLocaleString("en-IN"); };
  function fmt(v, unit) {
    if (v === null || v === undefined) return "—";
    if (unit === "×") return (Math.round(v * 100) / 100) + "×";
    if (unit === "₹/person") return "₹" + inr(v);
    return inr(v);
  }
  function mval(s, id) { var v = s ? s[id] : null; return (v === undefined) ? null : v; }

  function scale() {
    var m = M_BY_ID[st.metric];
    if (m.mode === "diverging") {
      // centre on national uplift; clamp a robust spread so the tiny-UT outliers don't flatten it
      var ups = DATA.states.filter(function (s) { return s.mapped && s.uplift; }).map(function (s) { return s.uplift; }).sort(d3.ascending);
      var hi = d3.quantile(ups, 0.9), K = Math.max(hi - NAT, NAT - d3.min(ups), 0.4);
      return d3.scaleDiverging(function (t) { return d3.interpolateBrBG(1 - t); }) // low uplift=producer→teal, high=consumer→brown
        .domain([NAT - K, NAT, NAT + K]).clamp(true);
    }
    var vals = DATA.states.filter(function (s) { return s.mapped && mval(s, st.metric) != null; }).map(function (s) { return mval(s, st.metric); }).sort(d3.ascending);
    var lo = d3.quantile(vals, 0.02), h2 = d3.quantile(vals, 0.98); if (lo === h2) { lo = d3.min(vals); h2 = d3.max(vals); }
    return d3.scaleSequential(d3.interpolateBlues).domain([lo, h2]).clamp(true);
  }
  function fillFor(f) {
    var s = BY_KEY[String(f.properties.ST_NM)];
    if (!s || !s.mapped) return "url(#nobaseHatch)";
    var v = mval(s, st.metric);
    if (v === null || v === undefined) return "url(#nobaseHatch)";
    return st._sc(v);
  }

  function initMap() {
    svg = d3.select("#map").attr("viewBox", "0 0 " + W + " " + H).attr("preserveAspectRatio", "xMidYMid meet");
    var defs = svg.append("defs");
    var p = defs.append("pattern").attr("id", "nobaseHatch").attr("width", 5).attr("height", 5).attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)");
    p.append("rect").attr("width", 5).attr("height", 5).attr("class", "hatch-bg");
    p.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 5).attr("class", "hatch-line");
    projection = d3.geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], { type: "FeatureCollection", features: FEATURES });
    path = d3.geoPath(projection);
    gRoot = svg.append("g");
    gRoot.selectAll("path.state").data(FEATURES).enter().append("path")
      .attr("class", "state").attr("d", path).attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", function (f) { return f.properties.ST_NM; })
      .on("mousemove", onHover).on("mouseleave", hideTip)
      .on("click", function (e, f) { select(String(f.properties.ST_NM)); })
      .on("focus", function (e, f) { onHover(e, f); }).on("blur", hideTip)
      .on("keydown", function (e, f) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(String(f.properties.ST_NM)); } });
  }
  function render() {
    st._sc = scale();
    gRoot.selectAll("path.state").attr("fill", fillFor).classed("sel", function (f) { return st.selected === String(f.properties.ST_NM); });
    document.getElementById("metricDesc").textContent = M_BY_ID[st.metric].desc;
    renderLegend(); renderPanel();
  }
  function renderLegend() {
    var el = document.getElementById("legend"), m = M_BY_ID[st.metric], sc = st._sc, html;
    if (m.mode === "diverging") {
      var dm = sc.domain(), s = [];
      for (var i = 0; i <= 10; i++) s.push(sc(dm[0] + (dm[2] - dm[0]) * i / 10));
      html = '<div class="lgrp"><div class="bar" style="background:linear-gradient(90deg,' + s.join(",") + ')"></div>' +
        '<div class="ends"><span>net producer</span><span>national ' + NAT.toFixed(2) + '×</span><span>net consumer</span></div></div>';
    } else {
      var dd = sc.domain(), g = [];
      for (var j = 0; j <= 10; j++) g.push(sc(dd[0] + (dd[1] - dd[0]) * j / 10));
      html = '<div class="lgrp"><div class="bar" style="background:linear-gradient(90deg,' + g.join(",") + ')"></div>' +
        '<div class="ends"><span>' + fmt(dd[0], m.unit) + '</span><span>' + fmt(dd[1], m.unit) + '</span></div></div>';
    }
    el.innerHTML = html + '<span class="nb"><i></i> no 2011 boundary</span>';
  }
  function onHover(e, f) {
    var s = BY_KEY[String(f.properties.ST_NM)], tip = document.getElementById("tooltip"), m = M_BY_ID[st.metric];
    var html = "<b>" + f.properties.ST_NM + "</b>";
    if (!s || !s.mapped) html += "<div class='row'>no data</div>";
    else {
      html += "<div class='row'>" + m.label.replace(/ \(.*\)/, "") + ": " + fmt(mval(s, st.metric), m.unit) + "</div>";
      if (s.uplift) html += "<div class='row " + (s.uplift > NAT ? "down" : "up") + "'>" + (s.uplift > NAT ? "net consumer" : "net producer") + " · " + s.uplift.toFixed(2) + "×</div>";
    }
    tip.innerHTML = html; tip.hidden = false;
    var wrap = document.querySelector(".mapwrap").getBoundingClientRect();
    tip.style.left = ((e.clientX !== undefined ? e.clientX - wrap.left : W / 2)) + "px";
    tip.style.top = ((e.clientY !== undefined ? e.clientY - wrap.top : 40)) + "px";
  }
  function hideTip() { document.getElementById("tooltip").hidden = true; }

  function select(key) { var s = BY_KEY[key]; if (!s || !s.mapped) return; st.selected = st.selected === key ? null : key; render(); }
  function narration(s) {
    var consumer = s.uplift > NAT;
    var verdict = consumer ? "a <b>net consumer</b>" : "a <b>net producer</b>";
    var why = consumer
      ? "it pulls in <b>₹" + inr(s.net_settled_percap) + "/person</b> of SGST on goods &amp; services made elsewhere (uplift " + s.uplift.toFixed(2) + "× vs national " + NAT.toFixed(2) + "×)."
      : "its output is largely taxed where it's consumed — a low settlement uplift of " + s.uplift.toFixed(2) + "× (national " + NAT.toFixed(2) + "×), despite ₹" + inr(s.own_percap) + "/person of own SGST.";
    return "<b>" + s.name + "</b> is " + verdict + ": " + why;
  }
  function renderPanel() {
    var el = document.getElementById("panel");
    if (!st.selected) { el.innerHTML = '<div class="panel-empty">Click a state to see its producer/consumer profile and full SGST settlement numbers.</div>'; return; }
    var s = BY_KEY[st.selected];
    function row(lab, val) { return '<div class="metric-row"><span class="lab">' + lab + '</span><span class="vals">' + val + '</span><span class="chg"></span></div>'; }
    el.innerHTML = '<h2>' + s.name + '</h2><p class="p-state">' + (s.uplift > NAT ? "net consumer" : "net producer") + ' · uplift ' + s.uplift.toFixed(2) + '×</p>' +
      '<div class="narr">' + narration(s) + '</div>' +
      row("Own SGST (pre-settlement)", "₹" + inr(s.pre) + " cr") +
      row("Accrued SGST (post-settlement)", "₹" + inr(s.post) + " cr") +
      row("Net IGST settled in", "₹" + inr(s.net_settled) + " cr") +
      row("Net settled, per capita", "₹" + inr(s.net_settled_percap)) +
      row("Own SGST, per capita", "₹" + inr(s.own_percap)) +
      row("YoY accrued growth", (s.yoy_post == null ? "—" : (s.yoy_post > 0 ? "+" : "") + s.yoy_post + "%"));
  }
  function initControls() {
    var sel = document.getElementById("metricSel");
    DATA.metrics.forEach(function (m) { var o = document.createElement("option"); o.value = m.id; o.textContent = m.label; sel.appendChild(o); });
    sel.value = st.metric;
    sel.onchange = function () { st.metric = sel.value; render(); };
    document.getElementById("themeBtn").onclick = function () {
      var r = document.documentElement, dark = r.getAttribute("data-theme") === "dark" || (r.getAttribute("data-theme") === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
      r.setAttribute("data-theme", dark ? "light" : "dark");
    };
  }
})();
