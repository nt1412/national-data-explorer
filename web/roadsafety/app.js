/* India Road Safety — MoRTH state & city explorer.
   Data colours computed (sequential Reds for a year's value, diverging BrBG for change);
   UI chrome from CSS theme tokens. Series year-keys are STRINGS (JSON) — always String(y). */
(function () {
  "use strict";
  var W = 900, H = 980, PAD = 12;
  var st = { metric: "severity", view: "year", yearIdx: null, tier: "state", selected: null };
  var DATA, IND_BY_ID, BY_KEY, FEATURES, YEARS, NATIONAL, projection, path, svg, gRoot;

  Promise.all([
    fetch("data/road.json").then(function (r) { return r.json(); }),
    fetch("data/states.topo.json").then(function (r) { return r.json(); })
  ]).then(function (res) {
    DATA = res[0];
    var topo = res[1], on = Object.keys(topo.objects)[0];
    FEATURES = topojson.feature(topo, topo.objects[on]).features;
    YEARS = DATA.meta.years;
    IND_BY_ID = {}; DATA.indicators.forEach(function (i) { IND_BY_ID[i.id] = i; });
    BY_KEY = {}; DATA.states.forEach(function (s) { BY_KEY[s.key] = s; });
    st.metric = DATA.meta.defaultIndicator;
    st.yearIdx = YEARS.length - 1;
    NATIONAL = nationalSeries();
    document.getElementById("unmappedNote").textContent =
      "Shown in lists but not on the map (no 2011 boundary): " + (DATA.unmapped.join(", ") || "none") + ".";
    initControls(); initMap(); render();
    InfraOverlay.init(svg, projection, "../shared/data/mh_infra.json", { segSelector: "#overlaySeg", noteId: "overlayNote" });
  }).catch(function (e) {
    document.getElementById("mapcard").innerHTML =
      '<p style="padding:24px;color:var(--muted)">Could not load data. Run <code>python scripts/build_roadsafety.py</code> + boundary prep.</p>';
    console.error(e);
  });

  /* ---------- helpers ---------- */
  function curYear() { return YEARS[st.yearIdx]; }
  function val(s, metric, year) {
    var ser = s && s.series ? s.series[metric] : null;
    var v = ser ? ser[String(year)] : undefined;
    return (v === undefined || v === null) ? null : v;
  }
  function nationalSeries() {
    var nat = { accidents: {}, deaths: {}, severity: {} };
    YEARS.forEach(function (y) {
      var a = 0, d = 0, ha = false, hd = false;
      DATA.states.forEach(function (s) {
        var av = val(s, "accidents", y), dv = val(s, "deaths", y);
        if (av !== null) { a += av; ha = true; }
        if (dv !== null) { d += dv; hd = true; }
      });
      if (ha) nat.accidents[String(y)] = a;
      if (hd) nat.deaths[String(y)] = d;
      if (ha && hd && a) nat.severity[String(y)] = Math.round(d / a * 1000) / 10;
    });
    return nat;
  }
  var nf = function (n) { return n === null || n === undefined ? "—" : Number(n).toLocaleString("en-IN"); };
  function fmtVal(v, unit) {
    if (v === null || v === undefined) return "—";
    if (unit === "per 100 accidents") return (Math.round(v * 10) / 10) + "";
    return nf(Math.round(v));
  }
  function fmtChange(ch, unit) {
    if (ch === null || ch === undefined) return "—";
    var s = ch > 0 ? "+" : (ch < 0 ? "−" : "±"), a = Math.abs(ch);
    if (unit === "per 100 accidents") return s + (Math.round(a * 10) / 10) + " /100";
    return s + nf(Math.round(a));
  }

  /* ---------- colour ---------- */
  function seqScale(metric, year) {
    var vals = [];
    DATA.states.forEach(function (s) { if (s.mapped) { var v = val(s, metric, year); if (v !== null) vals.push(v); } });
    vals.sort(d3.ascending);
    var lo = d3.quantile(vals, 0.02), hi = d3.quantile(vals, 0.98);
    if (lo === hi) { lo = d3.min(vals); hi = d3.max(vals); }
    return d3.scaleSequential(d3.interpolateReds).domain([lo, hi]).clamp(true); // darker = worse
  }
  function changeScale(metric) {
    var pol = IND_BY_ID[metric].polarity, imp = [];
    DATA.states.forEach(function (s) {
      var c = s.change[metric];
      if (c && c.change !== null) imp.push(Math.abs(c.change * pol));
    });
    imp.sort(d3.ascending);
    var M = d3.quantile(imp, 0.9) || d3.max(imp) || 1; M = Math.max(M, 1e-6);
    var sc = d3.scaleDiverging(d3.interpolateBrBG).domain([-M, 0, M]).clamp(true);
    sc._M = M; return sc;
  }
  function fillFor(f) {
    var s = BY_KEY[String(f.properties.ST_NM)];
    if (!s || !s.mapped) return "url(#nobaseHatch)";
    if (st.view === "change") {
      var c = s.change[st.metric];
      if (!c || c.change === null) return "url(#nobaseHatch)";
      return st._cs(c.change * IND_BY_ID[st.metric].polarity);
    }
    var v = val(s, st.metric, curYear());
    if (v === null) return "url(#nobaseHatch)";
    return st._ss(v);
  }

  /* ---------- map ---------- */
  function initMap() {
    svg = d3.select("#map").attr("viewBox", "0 0 " + W + " " + H).attr("preserveAspectRatio", "xMidYMid meet");
    var defs = svg.append("defs");
    var p = defs.append("pattern").attr("id", "nobaseHatch").attr("width", 5).attr("height", 5)
      .attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)");
    p.append("rect").attr("width", 5).attr("height", 5).attr("class", "hatch-bg");
    p.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 5).attr("class", "hatch-line");
    projection = d3.geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], { type: "FeatureCollection", features: FEATURES });
    path = d3.geoPath(projection);
    gRoot = svg.append("g");
    gRoot.selectAll("path.state").data(FEATURES).enter().append("path")
      .attr("class", "state").attr("d", path).attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", function (f) { return f.properties.ST_NM; })
      .on("mousemove", onHover).on("mouseleave", hideTip)
      .on("click", function (e, f) { selectState(String(f.properties.ST_NM)); })
      .on("focus", function (e, f) { onHover(e, f); }).on("blur", hideTip)
      .on("keydown", function (e, f) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectState(String(f.properties.ST_NM)); } });
  }

  function render() {
    var cityMode = st.tier === "city";
    document.getElementById("mapcard").hidden = cityMode;
    document.getElementById("panel").hidden = cityMode;
    document.getElementById("citiescard").hidden = !cityMode;
    document.getElementById("yearCtl").classList.toggle("disabled", st.view === "change" || cityMode);
    if (cityMode) { renderCities(); return; }

    st._ss = st.view === "year" ? seqScale(st.metric, curYear()) : null;
    st._cs = st.view === "change" ? changeScale(st.metric) : null;
    gRoot.selectAll("path.state").attr("fill", fillFor)
      .classed("sel", function (f) { return st.selected === String(f.properties.ST_NM); });
    renderLegend(); renderPanel();
  }

  /* ---------- legend ---------- */
  function renderLegend() {
    var el = document.getElementById("legend"), ind = IND_BY_ID[st.metric], html;
    if (st.view === "change") {
      var M = st._cs._M, s = [];
      for (var i = 0; i <= 10; i++) s.push(st._cs(-M + 2 * M * i / 10));
      html = '<div class="lgrp"><div class="bar" style="background:linear-gradient(90deg,' + s.join(",") + ')"></div>' +
        '<div class="ends"><span>worsened</span><span>2019→24</span><span>improved</span></div></div>';
    } else {
      var ss = st._ss, dm = ss.domain(), g = [];
      for (var j = 0; j <= 10; j++) g.push(ss(dm[0] + (dm[1] - dm[0]) * j / 10));
      html = '<div class="lgrp"><div class="bar" style="background:linear-gradient(90deg,' + g.join(",") + ')"></div>' +
        '<div class="ends"><span>' + fmtVal(dm[0], ind.unit) + '</span><span>higher = worse</span><span>' + fmtVal(dm[1], ind.unit) + '</span></div></div>';
    }
    el.innerHTML = html + '<span class="nb"><i></i> no 2011 boundary</span>';
  }

  /* ---------- tooltip ---------- */
  function onHover(e, f) {
    var s = BY_KEY[String(f.properties.ST_NM)], tip = document.getElementById("tooltip"), ind = IND_BY_ID[st.metric];
    var html = "<b>" + f.properties.ST_NM + "</b>";
    if (!s || !s.mapped) html += "<div class='row'>no data</div>";
    else if (st.view === "change") {
      var c = s.change[st.metric];
      var cls = c && c.improved === true ? "up" : (c && c.improved === false ? "down" : "");
      html += "<div class='row " + cls + "'>" + ind.label + " 2019→24: " + (c ? fmtChange(c.change, ind.unit) : "—") + "</div>";
    } else {
      html += "<div class='row'>" + ind.label + " " + curYear() + ": " + fmtVal(val(s, st.metric, curYear()), ind.unit) + "</div>";
    }
    tip.innerHTML = html; tip.hidden = false;
    var wrap = document.querySelector(".mapwrap").getBoundingClientRect();
    tip.style.left = ((e.clientX !== undefined ? e.clientX - wrap.left : W / 2)) + "px";
    tip.style.top = ((e.clientY !== undefined ? e.clientY - wrap.top : 40)) + "px";
  }
  function hideTip() { document.getElementById("tooltip").hidden = true; }

  /* ---------- panel: trend sparkline + card + narration ---------- */
  function selectState(key) {
    var s = BY_KEY[key];
    if (!s || !s.mapped) return;
    st.selected = st.selected === key ? null : key;
    render();
  }
  function sparkline(series, natSeries, unit) {
    var w = 286, h = 66, pad = 6;
    var ys = YEARS.filter(function (y) { return series[String(y)] !== undefined; });
    if (ys.length < 2) return "";
    var all = ys.map(function (y) { return series[String(y)]; })
      .concat(YEARS.map(function (y) { return natSeries[String(y)]; }).filter(function (v) { return v !== undefined; }));
    var lo = d3.min(all), hi = d3.max(all); if (lo === hi) { lo -= 1; hi += 1; }
    var x = function (y) { return pad + (w - 2 * pad) * (y - YEARS[0]) / (YEARS[YEARS.length - 1] - YEARS[0]); };
    var yy = function (v) { return h - pad - (h - 2 * pad) * (v - lo) / (hi - lo); };
    function line(ser) {
      return YEARS.filter(function (y) { return ser[String(y)] !== undefined; })
        .map(function (y, i) { return (i ? "L" : "M") + x(y).toFixed(1) + " " + yy(ser[String(y)]).toFixed(1); }).join(" ");
    }
    var last = ys[ys.length - 1];
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
      '<path d="' + line(natSeries) + '" fill="none" stroke="var(--faint)" stroke-width="1.2" stroke-dasharray="3 3"/>' +
      '<path d="' + line(series) + '" fill="none" stroke="var(--accent)" stroke-width="2"/>' +
      '<circle cx="' + x(last).toFixed(1) + '" cy="' + yy(series[String(last)]).toFixed(1) + '" r="3.2" fill="var(--accent)"/></svg>';
  }
  function stateRank(metric, year) {
    var arr = DATA.states.filter(function (s) { return s.mapped && val(s, metric, year) !== null; })
      .map(function (s) { return { k: s.key, v: val(s, metric, year) }; })
      .sort(function (a, b) { return b.v - a.v; }); // worst first (higher = worse)
    return arr;
  }
  function narration(s) {
    var ind = IND_BY_ID[st.metric], y = st.view === "change" ? YEARS[YEARS.length - 1] : curYear();
    var ranked = stateRank(st.metric, y), pos = ranked.findIndex(function (r) { return r.k === s.key; });
    var c = s.change[st.metric];
    var line = "<b>" + s.name + "</b>: " + ind.label.toLowerCase() + " " + y + " = <b>" + fmtVal(val(s, st.metric, y), ind.unit) + "</b> " +
      (ind.unit === "per 100 accidents" ? "per 100 accidents" : ind.unit) +
      (pos >= 0 ? " — ranked <b>" + (pos + 1) + "</b> of " + ranked.length + " states (1 = worst)" : "");
    if (c && c.change !== null)
      line += "; " + (c.improved ? "improved" : "worsened") + " " + fmtChange(c.change, ind.unit) + " since " + c.fromYear + ".";
    return line;
  }
  function renderPanel() {
    var el = document.getElementById("panel");
    if (!st.selected) { el.innerHTML = '<div class="panel-empty">Click (or tap) a state to pin its 2019–2024 trend and full metric card here.</div>'; return; }
    var s = BY_KEY[st.selected], ind = IND_BY_ID[st.metric];
    var rows = DATA.indicators.map(function (i) {
      var c = s.change[i.id], latest = val(s, i.id, YEARS[YEARS.length - 1]);
      var active = i.id === st.metric ? " active" : "";
      var dir = c && c.improved === true ? "up" : (c && c.improved === false ? "down" : "flat");
      var arrow = c && c.change < 0 ? "▼" : (c && c.change > 0 ? "▲" : "·");
      return '<div class="metric-row' + active + '"><span class="lab">' + i.label + '</span>' +
        '<span class="vals">' + fmtVal(latest, i.unit) + '</span>' +
        '<span class="chg ' + dir + '">' + arrow + " " + (c ? fmtChange(c.change, i.unit) : "—") + '</span></div>';
    }).join("");
    el.innerHTML = '<h2>' + s.name + '</h2><p class="p-state">' + (s.mapped ? "State / UT" : "no map baseline") + '</p>' +
      '<div class="narr">' + narration(s) + '</div>' +
      '<div class="trend"><div class="cap"><span>' + ind.label + ', 2019–24</span><span>— state · ·· India</span></div>' +
      sparkline(s.series[st.metric] || {}, NATIONAL[st.metric] || {}, ind.unit) + '</div>' + rows;
  }

  /* ---------- cities ---------- */
  var citySort = { key: "_val", dir: -1 };
  function renderCities() {
    var el = document.getElementById("citiescard"), ind = (DATA.cityIndicators.find(function (i) { return i.id === st.metric; }) || DATA.cityIndicators[0]);
    var yr = DATA.meta.cityYears[DATA.meta.cityYears.length - 1];
    var rows = DATA.cities.map(function (c) {
      var v = (c.series[ind.id] || {})[String(yr)];
      var ch = c.change[ind.id];
      return { name: c.name, v: (v === undefined ? null : v), change: ch ? ch.change : null };
    }).filter(function (r) { return r.v !== null; });
    var mx = d3.max(rows, function (r) { return r.v; }) || 1;
    var k = citySort.key, dir = citySort.dir;
    rows.sort(function (a, b) {
      var av = k === "_val" ? a.v : (k === "_chg" ? a.change : a.name), bv = k === "_val" ? b.v : (k === "_chg" ? b.change : b.name);
      if (av === null) return 1; if (bv === null) return -1;
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
    var body = rows.map(function (r) {
      var w = Math.round(46 * r.v / mx);
      var dcls = r.change === null ? "" : (r.change < 0 ? "up" : (r.change > 0 ? "down" : ""));
      return "<tr><td>" + r.name + '</td><td class="barcell">' + fmtVal(r.v, ind.unit) +
        '<i style="width:' + w + 'px"></i></td><td class="' + dcls + '">' + fmtChange(r.change, ind.unit) + "</td></tr>";
    }).join("");
    el.innerHTML = "<h3>Million-plus cities · " + ind.label + " · " + yr + "</h3>" +
      '<p class="sub2">' + rows.length + " cities. Change is vs " + DATA.meta.cityYears[0] + ". Click a column to sort.</p>" +
      '<table><thead><tr><th data-k="_name">City</th><th data-k="_val">' + ind.label + " " + yr +
      '</th><th data-k="_chg">Change</th></tr></thead><tbody>' + body + "</tbody></table>";
    el.querySelectorAll("th").forEach(function (th) {
      th.onclick = function () {
        var key = th.dataset.k;
        if (key === citySort.key) citySort.dir *= -1; else { citySort.key = key; citySort.dir = key === "_name" ? 1 : -1; }
        renderCities();
      };
    });
  }

  /* ---------- controls ---------- */
  function initControls() {
    var sel = document.getElementById("metricSel");
    DATA.indicators.forEach(function (i) {
      var o = document.createElement("option"); o.value = i.id;
      o.textContent = i.label + (i.category === "Rate" ? " (rate)" : " (count)"); sel.appendChild(o);
    });
    sel.value = st.metric;
    sel.onchange = function () { st.metric = sel.value; render(); };

    document.querySelectorAll("#viewSeg button").forEach(function (b) {
      b.onclick = function () {
        st.view = b.dataset.view;
        document.querySelectorAll("#viewSeg button").forEach(function (x) { var on = x === b; x.classList.toggle("active", on); x.setAttribute("aria-checked", on); });
        render();
      };
    });
    document.querySelectorAll("#tierSeg button").forEach(function (b) {
      b.onclick = function () {
        st.tier = b.dataset.tier;
        document.querySelectorAll("#tierSeg button").forEach(function (x) { var on = x === b; x.classList.toggle("active", on); x.setAttribute("aria-checked", on); });
        render();
      };
    });
    var slider = document.getElementById("yearSlider");
    slider.max = YEARS.length - 1; slider.value = st.yearIdx;
    slider.oninput = function () { st.yearIdx = +slider.value; document.getElementById("yearLabel").textContent = curYear(); render(); };

    var tb = document.getElementById("themeBtn");
    tb.onclick = function () {
      var root = document.documentElement, dark = root.getAttribute("data-theme") === "dark" ||
        (root.getAttribute("data-theme") === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.setAttribute("data-theme", dark ? "light" : "dark");
    };
  }
})();
