/* India Data Explorer — NFHS-4 → NFHS-5 district map.
   Data colours are computed (diverging BrBG for Change, sequential for a single round);
   UI chrome colours come from CSS theme tokens. */
(function () {
  "use strict";
  var W = 900, H = 980, PAD = 12;
  var VIEWKEY = { nfhs4: "v4", nfhs5: "v5" }; // view id -> cell field
  var state = { indicatorId: null, view: "change", selected: null };
  var DATA, IND_BY_ID, BY_CODE, FEATURES, projection, path, svg, gRoot;
  var IMP_DIST = {};

  Promise.all([
    fetch("data/district_change.json").then(function (r) { return r.json(); }),
    fetch("data/districts.topo.json").then(function (r) { return r.json(); })
  ]).then(function (res) {
    DATA = res[0];
    var topo = res[1];
    var objName = Object.keys(topo.objects)[0];
    FEATURES = topojson.feature(topo, topo.objects[objName]).features;

    IND_BY_ID = {};
    DATA.indicators.forEach(function (i) { IND_BY_ID[i.id] = i; });
    BY_CODE = {};
    DATA.districts.forEach(function (d) { BY_CODE[String(d.code)] = d; });
    state.indicatorId = DATA.indicators[0].id;

    // national distribution of polarity-adjusted improvement, per indicator,
    // so narration can compare a district across indicators of different units.
    DATA.indicators.forEach(function (ind) {
      var arr = [];
      DATA.districts.forEach(function (d) {
        var c = d.cells[ind.id];
        if (c && c.change !== null && c.change !== undefined && ind.polarity !== 0)
          arr.push(c.change * ind.polarity);
      });
      arr.sort(d3.ascending);
      IMP_DIST[ind.id] = arr;
    });

    document.getElementById("ndist").textContent =
      DATA.districts.filter(function (d) { return d.comparable; }).length;

    initControls();
    initMap();
    render();
    InfraOverlay.init(svg, projection, "shared/data/mh_infra.json", { segSelector: "#overlaySeg", noteId: "overlayNote" });
  }).catch(function (e) {
    document.querySelector(".mapcard").innerHTML =
      '<p style="padding:24px;color:var(--muted)">Could not load data files. Run <code>python scripts/build.py</code> and the boundary prep first.</p>';
    console.error(e);
  });

  /* ---------- helpers ---------- */
  function cell(d) { return d && d.cells ? d.cells[state.indicatorId] : null; }
  function fmtChange(ch, unit) {
    if (ch === null || ch === undefined) return "—";
    var s = ch > 0 ? "+" : (ch < 0 ? "" : "±");
    var suf = unit === "%" ? "pts" : unit;
    return s + (Math.round(ch * 10) / 10) + " " + suf;
  }
  function fmtVal(v, unit) {
    if (v === null || v === undefined) return "—";
    return (Math.round(v * 10) / 10) + (unit === "%" ? "%" : "");
  }

  /* ---------- colour: computed, not eyeballed ---------- */
  function changeScale() {
    var ind = IND_BY_ID[state.indicatorId];
    var imp = [];
    DATA.districts.forEach(function (d) {
      var c = d.cells[state.indicatorId];
      if (c && c.change !== null && c.change !== undefined)
        imp.push(Math.abs(c.change * ind.polarity));
    });
    imp.sort(d3.ascending);
    var M = d3.quantile(imp, 0.92) || d3.max(imp) || 1;
    M = Math.max(M, 1);
    // BrBG diverging: brown(worse) ← neutral → teal(better), CVD-safe
    var sc = d3.scaleDiverging(d3.interpolateBrBG).domain([-M, 0, M]).clamp(true);
    sc._M = M; sc._polarity = ind.polarity;
    return sc;
  }
  function seqScale(round) {
    var vals = [], key = VIEWKEY[round];
    DATA.districts.forEach(function (d) {
      var c = d.cells[state.indicatorId];
      if (c && c[key] !== null && c[key] !== undefined) vals.push(c[key]);
    });
    vals.sort(d3.ascending);
    var lo = d3.quantile(vals, 0.02), hi = d3.quantile(vals, 0.98);
    if (lo === hi) { lo = d3.min(vals); hi = d3.max(vals); }
    return d3.scaleSequential(d3.interpolateYlGnBu).domain([lo, hi]).clamp(true);
  }
  function fillForFeature(f) {
    var code = String(f.properties.censuscode);
    var d = BY_CODE[code], c = d ? d.cells[state.indicatorId] : null;
    if (state.view === "change") {
      if (!d || !c || c.change === null || c.change === undefined) return "url(#nobaseHatch)";
      return state._cs(c.change * IND_BY_ID[state.indicatorId].polarity);
    }
    var v = c ? c[VIEWKEY[state.view]] : null;
    if (v === null || v === undefined) return "url(#nobaseHatch)";
    return state._ss(v);
  }

  /* ---------- map ---------- */
  function initMap() {
    svg = d3.select("#map").attr("viewBox", "0 0 " + W + " " + H)
      .attr("preserveAspectRatio", "xMidYMid meet");
    var defs = svg.append("defs");
    var p = defs.append("pattern").attr("id", "nobaseHatch")
      .attr("width", 5).attr("height", 5).attr("patternUnits", "userSpaceOnUse")
      .attr("patternTransform", "rotate(45)");
    p.append("rect").attr("width", 5).attr("height", 5).attr("class", "hatch-bg");
    p.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 5)
      .attr("class", "hatch-line");
    projection = d3.geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]],
      { type: "FeatureCollection", features: FEATURES });
    path = d3.geoPath(projection);
    gRoot = svg.append("g");
    gRoot.selectAll("path.district").data(FEATURES).enter().append("path")
      .attr("class", "district").attr("d", path)
      .attr("tabindex", 0).attr("role", "button")
      .attr("aria-label", function (f) {
        var d = BY_CODE[String(f.properties.censuscode)];
        return d ? d.name + ", " + d.state : (f.properties.DISTRICT + " (no baseline)");
      })
      .on("mousemove", onHover).on("mouseleave", hideTip)
      .on("click", function (e, f) { selectByFeature(f); })
      .on("focus", function (e, f) { onHover(e, f); })
      .on("blur", hideTip)
      .on("keydown", function (e, f) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectByFeature(f); } });
  }

  function render() {
    state._cs = changeScale();
    state._ss = state.view === "change" ? null : seqScale(state.view);
    gRoot.selectAll("path.district").attr("fill", fillForFeature)
      .classed("sel", function (f) { return state.selected && String(f.properties.censuscode) === state.selected; });
    renderLegend();
    renderPanel();
    if (!document.getElementById("tableview").hidden) renderTable();
  }

  /* ---------- legend ---------- */
  function renderLegend() {
    var el = document.getElementById("legend");
    var ind = IND_BY_ID[state.indicatorId];
    var swatch;
    if (state.view === "change") {
      var M = state._cs._M, stops = [];
      for (var i = 0; i <= 10; i++) stops.push(state._cs(-M + (2 * M) * i / 10));
      swatch =
        '<div class="lgrp"><div class="bar" style="background:linear-gradient(90deg,' + stops.join(",") + ')"></div>' +
        '<div class="ends"><span>worse</span><span>no change</span><span>improved</span></div></div>';
    } else {
      var ss = state._ss, dm = ss.domain(), st = [];
      for (var j = 0; j <= 10; j++) st.push(ss(dm[0] + (dm[1] - dm[0]) * j / 10));
      swatch =
        '<div class="lgrp"><div class="bar" style="background:linear-gradient(90deg,' + st.join(",") + ')"></div>' +
        '<div class="ends"><span>' + fmtVal(dm[0], ind.unit) + '</span><span>' + fmtVal(dm[1], ind.unit) + '</span></div></div>';
    }
    el.innerHTML = swatch + '<span class="nb"><i></i> new district · no baseline</span>';
  }

  /* ---------- tooltip ---------- */
  function onHover(e, f) {
    var d = BY_CODE[String(f.properties.censuscode)];
    var tip = document.getElementById("tooltip");
    var ind = IND_BY_ID[state.indicatorId];
    var html;
    if (!d) {
      html = "<b>" + (f.properties.DISTRICT || "District") + "</b><div class='st'>new district · no baseline</div>";
    } else {
      var c = d.cells[state.indicatorId];
      html = "<b>" + d.name + "</b><div class='st'>" + d.state + "</div>";
      if (c) {
        if (state.view === "change") {
          var cls = c.improved === true ? "up" : (c.improved === false ? "down" : "");
          html += "<div class='row " + cls + "'>" + ind.label + ": " + fmtChange(c.change, ind.unit) + "</div>";
        } else {
          html += "<div class='row'>" + ind.label + ": " + fmtVal(c[VIEWKEY[state.view]], ind.unit) + "</div>";
        }
      } else { html += "<div class='row'>no data for this indicator</div>"; }
    }
    tip.innerHTML = html;
    tip.hidden = false;
    var wrap = document.querySelector(".mapwrap").getBoundingClientRect();
    var px = (e.clientX !== undefined) ? e.clientX - wrap.left : W / 2;
    var py = (e.clientY !== undefined) ? e.clientY - wrap.top : 40;
    tip.style.left = px + "px";
    tip.style.top = py + "px";
  }
  function hideTip() { document.getElementById("tooltip").hidden = true; }

  /* ---------- panel + narration ---------- */
  function selectByFeature(f) {
    var d = BY_CODE[String(f.properties.censuscode)];
    state.selected = d ? state.selected === d.code ? null : String(d.code) : null;
    if (!d) { state.selected = null; }
    else { state.selected = String(d.code); }
    render();
    document.getElementById("panel").scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "nearest" });
  }
  function pctile(indId, val) {
    var a = IMP_DIST[indId];
    if (!a || !a.length) return 0.5;
    var lo = 0, hi = a.length;
    while (lo < hi) { var m = (lo + hi) >> 1; if (a[m] < val) lo = m + 1; else hi = m; }
    return lo / a.length;
  }
  function narration(d) {
    var best = null, worst = null;
    DATA.indicators.forEach(function (ind) {
      var c = d.cells[ind.id];
      if (!c || c.change === null || c.change === undefined || ind.polarity === 0) return;
      var raw = c.change * ind.polarity, pr = pctile(ind.id, raw);
      if (best === null || pr > best.pr) best = { ind: ind, c: c, pr: pr, raw: raw };
      if (worst === null || pr < worst.pr) worst = { ind: ind, c: c, pr: pr, raw: raw };
    });
    if (!best) return "No comparable indicators recorded for this district.";
    var s = "<b>" + d.name + "</b> stood out most on <b>" + best.ind.label.toLowerCase() +
      "</b> (" + fmtChange(best.c.change, best.ind.unit) + ", ahead of " + Math.round(best.pr * 100) + "% of districts)";
    if (worst && worst.raw < 0)
      s += "; <b>" + worst.ind.label.toLowerCase() + "</b> worsened (" + fmtChange(worst.c.change, worst.ind.unit) + ")";
    return s + ".";
  }
  function renderPanel() {
    var el = document.getElementById("panel");
    if (!state.selected) {
      el.innerHTML = '<div class="panel-empty">Hover a district for a quick read; click (or search) to pin its full NFHS-4 → NFHS-5 card here.</div>';
      return;
    }
    var d = BY_CODE[state.selected];
    var rows = DATA.indicators.map(function (ind) {
      var c = d.cells[ind.id];
      var active = ind.id === state.indicatorId ? " active" : "";
      if (!c) return '<div class="ind-row' + active + '"><span class="lab">' + ind.label + '</span><span class="vals">—</span><span class="chg flat">—</span></div>';
      var dir = c.improved === true ? "up" : (c.improved === false ? "down" : "flat");
      var arrow = c.change > 0 ? "▲" : (c.change < 0 ? "▼" : "·");
      return '<div class="ind-row' + active + '"><span class="lab">' + ind.label + '</span>' +
        '<span class="vals">' + fmtVal(c.v4, ind.unit) + " → " + fmtVal(c.v5, ind.unit) + '</span>' +
        '<span class="chg ' + dir + '">' + arrow + " " + fmtChange(c.change, ind.unit) + '</span></div>';
    }).join("");
    el.innerHTML = '<h2>' + d.name + '</h2><p class="p-state">' + d.state + '</p>' +
      '<div class="narr">' + narration(d) + '</div>' + rows;
  }

  /* ---------- table view ---------- */
  var tableSort = { key: "change", dir: -1 };
  function renderTable() {
    var ind = IND_BY_ID[state.indicatorId];
    var rows = DATA.districts.map(function (d) {
      var c = d.cells[state.indicatorId] || {};
      return { name: d.name, state: d.state, v4: c.v4, v5: c.v5, change: c.change, improved: c.improved };
    });
    var k = tableSort.key, dir = tableSort.dir;
    rows.sort(function (a, b) {
      var av = a[k], bv = b[k];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
    var cols = [["name", "District"], ["state", "State"], ["v4", "2015–16"], ["v5", "2019–21"], ["change", "Change"]];
    var head = "<tr>" + cols.map(function (c) {
      var ar = c[0] === k ? (dir < 0 ? " ▾" : " ▴") : "";
      return '<th data-k="' + c[0] + '">' + c[1] + ar + "</th>";
    }).join("") + "</tr>";
    var body = rows.map(function (r) {
      var dcls = r.improved === true ? "up" : (r.improved === false ? "down" : "");
      return "<tr><td>" + r.name + "</td><td>" + r.state + "</td><td>" + fmtVal(r.v4, ind.unit) +
        "</td><td>" + fmtVal(r.v5, ind.unit) + '</td><td class="' + dcls + '">' + fmtChange(r.change, ind.unit) + "</td></tr>";
    }).join("");
    var tv = document.getElementById("tableview");
    tv.innerHTML = "<table><thead>" + head + "</thead><tbody>" + body + "</tbody></table>";
    tv.querySelectorAll("th").forEach(function (th) {
      th.onclick = function () {
        var key = th.dataset.k;
        if (key === tableSort.key) tableSort.dir *= -1;
        else { tableSort.key = key; tableSort.dir = (key === "name" || key === "state") ? 1 : -1; }
        renderTable();
      };
    });
  }

  /* ---------- controls ---------- */
  function prefersReduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function initControls() {
    var sel = document.getElementById("indicatorSel");
    var cats = {};
    DATA.indicators.forEach(function (i) { (cats[i.category] = cats[i.category] || []).push(i); });
    Object.keys(cats).forEach(function (cat) {
      var og = document.createElement("optgroup"); og.label = cat;
      cats[cat].forEach(function (i) {
        var o = document.createElement("option"); o.value = i.id; o.textContent = i.label;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    sel.value = state.indicatorId;
    sel.onchange = function () { state.indicatorId = sel.value; render(); };

    document.querySelectorAll(".seg-btns button").forEach(function (b) {
      b.onclick = function () {
        state.view = b.dataset.view;
        document.querySelectorAll(".seg-btns button").forEach(function (x) {
          var on = x === b; x.classList.toggle("active", on); x.setAttribute("aria-checked", on);
        });
        render();
      };
    });

    var dl = document.getElementById("districtList");
    DATA.districts.slice().sort(function (a, b) { return d3.ascending(a.name, b.name); })
      .forEach(function (d) {
        var o = document.createElement("option");
        o.value = d.name + " — " + d.state; o.dataset.code = d.code; dl.appendChild(o);
      });
    var search = document.getElementById("districtSearch");
    search.onchange = function () {
      var m = DATA.districts.find(function (d) { return (d.name + " — " + d.state) === search.value || d.name === search.value; });
      if (m) { state.selected = String(m.code); render(); document.getElementById("panel").scrollIntoView({ block: "nearest" }); }
    };

    var tbtn = document.getElementById("tableBtn");
    tbtn.onclick = function () {
      var tv = document.getElementById("tableview");
      tv.hidden = !tv.hidden;
      tbtn.setAttribute("aria-pressed", !tv.hidden);
      tbtn.textContent = tv.hidden ? "Table view" : "Hide table";
      if (!tv.hidden) renderTable();
    };

    var tb = document.getElementById("themeBtn");
    tb.onclick = function () {
      var root = document.documentElement;
      var dark = root.getAttribute("data-theme") === "dark" ||
        (root.getAttribute("data-theme") === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.setAttribute("data-theme", dark ? "light" : "dark");
    };
  }
})();
