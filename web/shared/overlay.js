/* Shared Maharashtra infrastructure overlay — reused by both explorers.
   Renders OSM/OurAirports point layers on top of whatever base choropleth is showing,
   using that map's own projection. Kept separate so the OSM (ODbL) layer stays isolable. */
(function () {
  "use strict";
  var DATA = null, on = { industrial: false, malls: false, airports: false }, SVG, PROJ, NOTE;

  window.InfraOverlay = {
    init: function (svg, projection, dataUrl, opts) {
      SVG = svg; PROJ = projection; NOTE = opts.noteId;
      fetch(dataUrl).then(function (r) { return r.json(); })
        .then(function (d) { DATA = d; render(); })
        .catch(function (e) { console.warn("infra overlay load failed", e); });
      document.querySelectorAll(opts.segSelector + " button").forEach(function (b) {
        b.onclick = function () {
          var L = b.dataset.layer; on[L] = !on[L];
          b.classList.toggle("active", on[L]); b.setAttribute("aria-pressed", on[L]);
          render();
        };
      });
    }
  };

  function render() {
    if (!DATA || !PROJ) return;
    var g = SVG.select("g.infra");
    if (g.empty()) g = SVG.append("g").attr("class", "infra").attr("pointer-events", "none");
    g.selectAll("*").remove();
    function dots(arr, cls, r) {
      g.selectAll("circle." + cls).data(arr).enter().append("circle").attr("class", "infra-dot " + cls)
        .attr("cx", function (d) { return PROJ([d.lon, d.lat])[0]; })
        .attr("cy", function (d) { return PROJ([d.lon, d.lat])[1]; }).attr("r", r);
    }
    if (on.industrial) dots(DATA.industrial, "ind", 1.3);
    if (on.malls) dots(DATA.malls, "mall", 2);
    if (on.airports) {
      g.selectAll("path.air").data(DATA.airports).enter().append("path").attr("class", "infra-air")
        .attr("transform", function (d) { var p = PROJ([d.lon, d.lat]); return "translate(" + p[0] + "," + p[1] + ")"; })
        .attr("d", "M0,-4.5 L4.5,0 L0,4.5 L-4.5,0 Z")
        .append("title").text(function (d) { return d.name + (d.iata ? " (" + d.iata + ")" : ""); });
    }
    note();
  }

  function note() {
    var el = document.getElementById(NOTE); if (!el) return;
    var any = on.industrial || on.malls || on.airports;
    el.hidden = !any; if (!any) return;
    var parts = [];
    if (on.industrial) parts.push('<span class="ovsw ind"></span>industrial areas (' + DATA.counts.industrial + ')');
    if (on.malls) parts.push('<span class="ovsw mall"></span>malls (' + DATA.counts.malls + ')');
    if (on.airports) parts.push('<span class="ovsw air"></span>airports (' + DATA.counts.airports + ')');
    el.innerHTML = '<b>Maharashtra overlay</b> — ' + parts.join(" · ") + '. ' + DATA.note + ' ' + DATA.attribution;
  }
})();
