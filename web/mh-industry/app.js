/* Maharashtra industry vs child health — district scatter.
   Descriptive economic geography: no good/bad grading; the dot cloud + correlation
   answer "do more-industrial districts have healthier children?" for 34–35 districts. */
(function () {
  "use strict";
  var W = 640, H = 460, M = { t: 16, r: 18, b: 46, l: 56 };
  var DATA, X, svg, gPlot, xScale, yScale;
  var state = { xMetric: "est_per_lakh", selected: null };

  fetch("data/mh_industry.json").then(function (r) { return r.json(); }).then(function (d) {
    DATA = d;
    X = d.metrics;
    document.getElementById("ndist").textContent =
      d.districts.filter(function (x) { return x.est_per_lakh != null && x.stunting != null; }).length;
    document.getElementById("attrib").textContent = d.attribution + " " + d.note;
    initControls();
    initScatter();
    render();
  }).catch(function (e) {
    document.querySelector(".scattercard").innerHTML = '<p style="padding:20px;color:var(--muted)">Could not load data. Run <code>python scripts/build_mhindustry.py</code>.</p>';
    console.error(e);
  });

  function metric(id) { return X.find(function (m) { return m.id === id; }); }
  function pts() {
    return DATA.districts.filter(function (d) { return d[state.xMetric] != null && d.stunting != null; });
  }
  function pearson(p) {
    var n = p.length; if (n < 3) return null;
    var xs = p.map(function (d) { return d[state.xMetric]; }), ys = p.map(function (d) { return d.stunting; });
    var mx = d3.mean(xs), my = d3.mean(ys);
    var cov = 0, vx = 0, vy = 0;
    for (var i = 0; i < n; i++) { cov += (xs[i] - mx) * (ys[i] - my); vx += (xs[i] - mx) ** 2; vy += (ys[i] - my) ** 2; }
    return (vx && vy) ? cov / Math.sqrt(vx * vy) : 0;
  }
  function fmt(v, unit) {
    if (v == null) return "—";
    if (unit === "₹") return "₹" + Math.round(v).toLocaleString("en-IN");
    if (unit === "%") return (Math.round(v * 10) / 10) + "%";
    return Math.round(v).toLocaleString("en-IN");
  }

  function initScatter() {
    svg = d3.select("#scatter").attr("viewBox", "0 0 " + W + " " + H).attr("preserveAspectRatio", "xMidYMid meet");
    gPlot = svg.append("g").attr("transform", "translate(" + M.l + "," + M.t + ")");
  }

  function render() {
    var p = pts(), xm = metric(state.xMetric), iw = W - M.l - M.r, ih = H - M.t - M.b;
    xScale = d3.scaleLinear().domain(d3.extent(p, function (d) { return d[state.xMetric]; })).nice().range([0, iw]);
    yScale = d3.scaleLinear().domain(d3.extent(p, function (d) { return d.stunting; })).nice().range([ih, 0]);
    gPlot.selectAll("*").remove();

    // grid + axes
    gPlot.append("g").attr("class", "grid").call(d3.axisLeft(yScale).ticks(6).tickSize(-iw).tickFormat("")).select(".domain").remove();
    gPlot.append("g").attr("class", "axis").attr("transform", "translate(0," + ih + ")").call(d3.axisBottom(xScale).ticks(6));
    gPlot.append("g").attr("class", "axis").call(d3.axisLeft(yScale).ticks(6));
    gPlot.append("text").attr("class", "axis-label").attr("x", iw / 2).attr("y", ih + 38).attr("text-anchor", "middle").text(xm.label + " (" + xm.unit + ") →");
    gPlot.append("text").attr("class", "axis-label").attr("transform", "rotate(-90)").attr("x", -ih / 2).attr("y", -42).attr("text-anchor", "middle").text("↑ Children under 5 stunted (%)");

    // linear fit line
    var mx = d3.mean(p, function (d) { return d[state.xMetric]; }), my = d3.mean(p, function (d) { return d.stunting; });
    var num = 0, den = 0;
    p.forEach(function (d) { num += (d[state.xMetric] - mx) * (d.stunting - my); den += (d[state.xMetric] - mx) ** 2; });
    if (den) {
      var slope = num / den, b = my - slope * mx, dom = xScale.domain();
      gPlot.append("line").attr("class", "fitline")
        .attr("x1", xScale(dom[0])).attr("y1", yScale(slope * dom[0] + b))
        .attr("x2", xScale(dom[1])).attr("y2", yScale(slope * dom[1] + b));
    }

    // dots
    gPlot.selectAll("circle.dot").data(p).enter().append("circle").attr("class", "dot")
      .attr("cx", function (d) { return xScale(d[state.xMetric]); })
      .attr("cy", function (d) { return yScale(d.stunting); }).attr("r", 6)
      .classed("hi", function (d) { return d.census_code === state.selected; })
      .on("mousemove", hover).on("mouseleave", hideTip)
      .on("click", function (e, d) { state.selected = state.selected === d.census_code ? null : d.census_code; render(); renderTable(); });

    // label the extremes only (keep it legible)
    var byX = p.slice().sort(function (a, b) { return b[state.xMetric] - a[state.xMetric]; });
    var byY = p.slice().sort(function (a, b) { return b.stunting - a.stunting; });
    var lab = new Set([byX[0], byX[byX.length - 1], byY[0], byY[byY.length - 1]]);
    if (state.selected) { var s = p.find(function (d) { return d.census_code === state.selected; }); if (s) lab.add(s); }
    gPlot.selectAll("text.dotlabel").data([...lab]).enter().append("text").attr("class", "dotlabel")
      .attr("x", function (d) { return xScale(d[state.xMetric]) + 8; })
      .attr("y", function (d) { return yScale(d.stunting) + 3; }).text(function (d) { return d.name; });

    var r = pearson(p);
    document.getElementById("corr").innerHTML = r == null ? "" :
      "correlation r = <b>" + (r > 0 ? "+" : "") + r.toFixed(2) + "</b> · " + p.length + " districts";
    renderTable();
  }

  function hover(e, d) {
    var tip = document.getElementById("tooltip"), xm = metric(state.xMetric);
    tip.innerHTML = "<b>" + d.name + "</b><div class='row'>" + xm.label + ": " + fmt(d[state.xMetric], xm.unit) + "</div>" +
      "<div class='row'>stunting: " + fmt(d.stunting, "%") + "</div>";
    tip.hidden = false;
    var wrap = document.querySelector(".scatterwrap").getBoundingClientRect();
    var sv = document.getElementById("scatter").getBoundingClientRect();
    tip.style.left = (e.clientX - wrap.left) + "px";
    tip.style.top = (e.clientY - wrap.top) + "px";
  }
  function hideTip() { document.getElementById("tooltip").hidden = true; }

  var sort = { key: "est_per_lakh", dir: -1 };
  function renderTable() {
    var cols = [["name", "District"]].concat(X.map(function (m) { return [m.id, m.label.split(" (")[0]]; })).concat([["stunting", "Stunting %"]]);
    document.getElementById("thead").innerHTML = cols.map(function (c) {
      var a = c[0] === sort.key ? (sort.dir < 0 ? " ▾" : " ▴") : "";
      return '<th data-k="' + c[0] + '">' + c[1] + a + "</th>";
    }).join("");
    var rows = DATA.districts.slice().sort(function (a, b) {
      var av = a[sort.key], bv = b[sort.key];
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === "string") return av.localeCompare(bv) * sort.dir;
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
    });
    document.getElementById("tbody").innerHTML = rows.map(function (d) {
      var cells = cols.map(function (c, i) {
        if (i === 0) return "<td>" + d.name + "</td>";
        var m = c[0] === "stunting" ? { unit: "%" } : metric(c[0]);
        return "<td>" + fmt(d[c[0]], m.unit) + "</td>";
      }).join("");
      return '<tr class="' + (d.census_code === state.selected ? "hi" : "") + '" data-c="' + d.census_code + '">' + cells + "</tr>";
    }).join("");
    document.querySelectorAll("#thead th").forEach(function (th) {
      th.onclick = function () { var k = th.dataset.k; if (k === sort.key) sort.dir *= -1; else { sort.key = k; sort.dir = k === "name" ? 1 : -1; } renderTable(); };
    });
    document.querySelectorAll("#tbody tr").forEach(function (tr) {
      tr.onclick = function () { state.selected = state.selected === tr.dataset.c ? null : tr.dataset.c; render(); };
    });
  }

  function initControls() {
    var sel = document.getElementById("xSel");
    X.forEach(function (m) { var o = document.createElement("option"); o.value = m.id; o.textContent = m.label; sel.appendChild(o); });
    sel.value = state.xMetric;
    sel.onchange = function () { state.xMetric = sel.value; render(); };
    document.getElementById("themeBtn").onclick = function () {
      var r = document.documentElement, dark = r.getAttribute("data-theme") === "dark" ||
        (r.getAttribute("data-theme") === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
      r.setAttribute("data-theme", dark ? "light" : "dark");
    };
  }
})();
