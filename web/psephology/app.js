/* Renders the AI-psephologist findings article from findings.json.
   Every displayed number comes from the computed file — no hardcoded stats. */
(function () {
  "use strict";
  var inr = function (n) { return Number(n).toLocaleString("en-IN"); };
  var set = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };

  document.getElementById("themeBtn").onclick = function () {
    var r = document.documentElement, dark = r.getAttribute("data-theme") === "dark" ||
      (r.getAttribute("data-theme") === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    r.setAttribute("data-theme", dark ? "light" : "dark");
  };

  fetch("data/findings.json").then(function (r) { return r.json(); }).then(render).catch(function (e) {
    document.querySelector(".thesis").innerHTML = "<p>Could not load findings. Run <code>python scripts/analyze_elections.py</code>.</p>";
    console.error(e);
  });

  function tbl(id, headers, rows) {
    var h = "<thead><tr>" + headers.map(function (x, i) { return "<th" + (i ? ' class="num"' : "") + ">" + x + "</th>"; }).join("") + "</tr></thead>";
    var b = "<tbody>" + rows.map(function (r) {
      return "<tr>" + r.map(function (c, i) { return "<td" + (i ? ' class="num"' : "") + ">" + c + "</td>"; }).join("") + "</tr>";
    }).join("") + "</tbody>";
    var el = document.getElementById(id); if (el) el.innerHTML = h + b;
  }
  function bars(id, items, max) {
    var el = document.getElementById(id); if (!el) return;
    el.innerHTML = items.map(function (it) {
      return '<div class="bar"><span class="lab">' + it.lab + '</span>' +
        '<span class="track"><span class="fill" style="width:' + (100 * it.v / max) + '%;background:' + (it.c || "var(--accent)") + '"></span></span>' +
        '<span class="val">' + inr(it.v) + '</span></div>';
    }).join("");
  }

  function render(d) {
    var o = d.overview, dp = d.disproportionality;
    set("nseats", inr(o.seats)); set("nseats2", inr(o.seats)); set("ncand", inr(o.candidates));
    set("ncand3", inr(o.candidates)); set("maxc", o.max_cands);

    // thesis
    set("t-nda-s", dp.NDA.seats); set("t-nda-v", dp.NDA.vote_pct);
    set("t-ind-s", dp.INDIA.seats); set("t-ind-v", dp.INDIA.vote_pct);
    set("t-oth-s", dp.OTH.seats); set("t-oth-v", dp.OTH.vote_pct);
    set("votegap", (Math.round((dp.NDA.vote_pct - dp.INDIA.vote_pct) * 10) / 10));
    set("seatgap", dp.NDA.seats - dp.INDIA.seats);

    // 1 — margins
    var mb = d.margin_bands;
    set("u10", inr(mb.under_10pct)); set("u5", inr(mb.under_5pct)); set("u1", inr(mb.under_1pct));
    set("u1000", mb.under_1000_votes);
    var c0 = d.closest[0]; set("closest-name", c0.pc + " (" + c0.state + ")"); set("closest-m", inr(c0.mvotes));
    var contested = o.seats - o.uncontested;
    bars("marginBars", [
      { lab: "< 1 pt", v: mb.under_1pct, c: "var(--del)" },
      { lab: "1–5 pts", v: mb.under_5pct - mb.under_1pct, c: "var(--mod)" },
      { lab: "5–10 pts", v: mb.under_10pct - mb.under_5pct, c: "var(--accent)" },
      { lab: "> 10 pts", v: contested - mb.under_10pct, c: "var(--new)" }
    ], contested - mb.under_10pct);
    tbl("closestTbl", ["The ten closest seats", "Winner", "Party", "Margin", "% "],
      d.closest.slice(0, 10).map(function (m) { return [m.pc, m.winner, party(m.party), inr(m.mvotes), m.mpct + "%"]; }));

    // 2 — disproportionality
    set("d-oth-v", dp.OTH.vote_pct); set("d-oth-s", dp.OTH.seat_pct); set("gall", d.gallagher_index);
    tbl("dispropTbl", ["Bloc", "Vote share", "Seat share", "Seats"],
      ["NDA", "INDIA", "OTH"].map(function (a) {
        return [a === "OTH" ? "Others" : a, dp[a].vote_pct + "%", dp[a].seat_pct + "%", dp[a].seats];
      }));

    // 3 — NOTA
    set("nota-tot", inr(d.nota.total)); set("nota-pct", d.nota.share_pct); set("nota-gt", d.nota.seats_nota_gt_margin);
    var n0 = d.nota.top[0]; set("indore", n0.pc + " — " + inr(n0.nota) + " NOTA votes (" + n0.notapct + "%)");
    tbl("notaTbl", ["Seats where NOTA > victory margin", "Won by", "Margin", "NOTA"],
      d.nota.nota_gt_margin.slice(0, 8).map(function (m) { return [m.pc, party(m.party), inr(m.mvotes), inr(m.nota)]; }));

    // 4 — deposits
    var dep = d.deposits;
    set("ff-pct", dep.forfeit_pct); set("ff-n", inr(dep.forfeited)); set("ff-ind", dep.ind_forfeit_pct);
    tbl("ffTbl", ["Most deposits forfeited (by party)", "Forfeited"],
      dep.by_party.slice(0, 8).map(function (r) { return [party(r[0]), inr(r[1])]; }));

    // 5 — postal
    set("postal-n", d.postal.decisive_seats);
    tbl("postalTbl", ["Seats where postal votes > margin", "Margin", "Postal votes"],
      d.postal.examples.slice(0, 8).map(function (m) { return [m.pc, inr(m.margin), inr(m.postal)]; }));

    // 6 — matchups
    var mu = d.matchups.map(function (x) { return { lab: x[0], v: x[1] }; });
    bars("matchupBars", mu, Math.max.apply(null, mu.map(function (x) { return x.v; })));
    var ff = d.matchups.find(function (x) { return x[0] === "INDIA beat INDIA"; });
    set("friendly", ff ? ff[1] : "—");

    // caveats
    document.getElementById("caveats").innerHTML = d.caveats.map(function (c) { return "<li>" + c + "</li>"; }).join("");
  }
  function party(p) { return (p || "").replace(/\s+\(/g, " (").slice(0, 34); }
})();
