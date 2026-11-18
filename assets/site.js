/* Curriculum site scripts. Every page works without them; they add filtering,
   highlighting and the simulators. Data comes from data.js (window.SITE). */
(function () {
  'use strict';
  var S = window.SITE || {};
  var body = document.body;
  var ROOT = body.getAttribute('data-root') || './';
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var url = function (u) { return ROOT + u; };
  var params = new URLSearchParams(location.search);

  function courseLink(code, withTitle) {
    var c = S.courses && S.courses[code];
    if (!c) return esc(code);
    return '<a class="code" href="' + url(c.u) + '">' + esc(code) + '</a>' + (withTitle ? ' ' + esc(c.t) : '');
  }
  function pkgLink(pk, withTitle) {
    var p = S.pkgs[pk];
    var label = p.codes[0] + p.codes.slice(1).map(function (c) { return '/' + c.split('-')[1]; }).join('');
    return '<a class="code" href="' + url(p.u) + '">' + esc(label) + '</a>' + (withTitle ? ' ' + esc(p.t) : '');
  }
  function fmt(n) { return (Math.round(n * 10) / 10).toString(); }

  /* open every <details> before printing */
  window.addEventListener('beforeprint', function () { $$('details').forEach(function (d) { d.setAttribute('open', ''); }); });

  /* ------------------------------------------------ prerequisite closure (package level) */
  function closure(start, dir, track) {
    var seen = {}, stack = [start];
    while (stack.length) {
      var x = stack.pop();
      var next = [];
      if (dir === 'pre') {
        var p = S.pkgs[x];
        next = p.pre.concat(p.co);
        if (p.t1) S.trackOrder.forEach(function (t) { if (!track || t === track) next.push(S.tracks[t].slots[0][0]); });
      } else {
        Object.keys(S.pkgs).forEach(function (k) {
          var q = S.pkgs[k];
          if (q.pre.indexOf(x) >= 0 || q.co.indexOf(x) >= 0) next.push(k);
          if (q.t1 && S.pkgs[x].sl === 1) next.push(k);
        });
      }
      next.forEach(function (n) { if (!seen[n] && S.pkgs[n]) { seen[n] = true; stack.push(n); } });
    }
    return seen;
  }

  /* ------------------------------------------------ catalogue */
  function initCatalogue() {
    var form = $('#catalogue-filters');
    if (!form) return;
    var rows = $$('table.catalogue tbody tr');
    var q = $('#cat-q');
    var selects = $$('select[data-filter]', form);
    if (params.get('sem')) { var s = $('select[data-filter=sem]'); if (s) s.value = params.get('sem'); }
    function apply() {
      var text = (q.value || '').trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (tr) {
        var ok = true;
        selects.forEach(function (sel) {
          var v = sel.value;
          if (!v) return;
          var key = sel.getAttribute('data-filter');
          var have = tr.getAttribute('data-' + key) || '';
          if (key === 'ai') { if (have === '' || have !== v) ok = false; }
          else if (have !== v) ok = false;
        });
        if (ok && text) {
          var code = tr.getAttribute('data-code');
          var c = S.courses[code];
          var hay = (code + ' ' + c.t).toLowerCase();
          if (c.pk && S.topics[c.pk]) hay += ' ' + S.topics[c.pk];
          ok = text.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
        }
        tr.hidden = !ok;
        if (ok) shown++;
      });
      $('#cat-count').textContent = shown + ' of ' + rows.length + ' codes shown';
    }
    q.addEventListener('input', apply);
    selects.forEach(function (s) { s.addEventListener('change', apply); });
    $('#cat-reset').addEventListener('click', function () { q.value = ''; selects.forEach(function (s) { s.value = ''; }); apply(); });
    $('#cat-csv').addEventListener('click', function () {
      var head = $$('table.catalogue thead th').map(function (th) { return th.textContent.trim(); });
      var lines = [head];
      rows.forEach(function (tr) { if (!tr.hidden) lines.push($$('td', tr).map(function (td) { return td.textContent.trim(); })); });
      var csv = lines.map(function (r) { return r.map(function (x) { return '"' + x.replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
      var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'cse-courses.csv';
      document.body.appendChild(a); a.click(); a.remove();
    });
    apply();
  }

  /* ------------------------------------------------ roadmap */
  function initRoadmap() {
    var map = $('#roadmap');
    if (!map) return;
    function setTrack(t) {
      $$('.road li.trackopt', map).forEach(function (li) { li.hidden = li.getAttribute('data-track') !== t; });
      $$('.road li.slot', map).forEach(function (li) { li.hidden = !!t; });
    }
    $$('input[name=track]').forEach(function (r) { r.addEventListener('change', function () { setTrack(r.value); }); });
    var g = $('#show-ged');
    g.addEventListener('change', function () { map.classList.toggle('hide-ged', !g.checked); });
    var o = $('#show-2022');
    o.addEventListener('change', function () { $$('details.old2022', map).forEach(function (d) { d.open = o.checked; }); });
    function clear() { $$('.road li', map).forEach(function (li) { li.classList.remove('is-focus', 'is-pre', 'is-post'); }); }
    function mark(li) {
      clear();
      var pk = li.getAttribute('data-pkg');
      if (!pk || !S.pkgs[pk]) return;
      var t = (document.querySelector('input[name=track]:checked') || {}).value || null;
      var pre = closure(pk, 'pre', t), post = closure(pk, 'post', t);
      $$('.road li[data-pkg]', map).forEach(function (x) {
        var k = x.getAttribute('data-pkg');
        if (k === pk) x.classList.add('is-focus');
        else if (pre[k]) x.classList.add('is-pre');
        else if (post[k]) x.classList.add('is-post');
      });
    }
    $$('.road li[data-pkg]', map).forEach(function (li) {
      li.addEventListener('mouseenter', function () { mark(li); });
      li.addEventListener('focusin', function () { mark(li); });
      li.addEventListener('mouseleave', clear);
    });
  }

  /* ------------------------------------------------ graph */
  function initGraph() {
    var svg = $('svg.pgraph');
    if (!svg) return;
    var nodes = $$('.node', svg), edges = $$('.edge', svg);
    var focusSel = $('#g-focus'), trackSel = $('#g-track');
    function highlight(pk) {
      nodes.forEach(function (n) { n.classList.remove('hl', 'hl-self', 'hl-pre', 'hl-post'); });
      edges.forEach(function (e) { e.classList.remove('hl'); });
      if (!pk) { svg.classList.remove('has-focus'); return; }
      var t = trackSel.value || null;
      var pre = closure(pk, 'pre', t), post = closure(pk, 'post', t);
      svg.classList.add('has-focus');
      nodes.forEach(function (n) {
        var k = n.getAttribute('data-code');
        if (k === pk) n.classList.add('hl', 'hl-self');
        else if (pre[k]) n.classList.add('hl', 'hl-pre');
        else if (post[k]) n.classList.add('hl', 'hl-post');
      });
      edges.forEach(function (e) {
        var f = e.getAttribute('data-from'), to = e.getAttribute('data-to');
        var inPre = (pre[f] || f === pk) && (pre[to] || to === pk);
        var inPost = (post[f] || f === pk) && (post[to] || to === pk);
        if (inPre || inPost) e.classList.add('hl');
      });
    }
    nodes.forEach(function (n) {
      n.addEventListener('mouseenter', function () { highlight(n.getAttribute('data-code')); });
      n.addEventListener('focus', function () { highlight(n.getAttribute('data-code')); });
      n.addEventListener('mouseleave', function () { highlight(focusSel.value); });
      n.addEventListener('blur', function () { highlight(focusSel.value); });
    });
    focusSel.addEventListener('change', function () { highlight(focusSel.value); });
    trackSel.addEventListener('change', function () {
      var t = trackSel.value;
      svg.classList.toggle('track-filter', !!t);
      nodes.forEach(function (n) { var nt = n.getAttribute('data-track'); n.classList.toggle('off', !!t && !!nt && nt !== t); });
      edges.forEach(function (e) {
        var f = S.pkgs[e.getAttribute('data-from')], to = S.pkgs[e.getAttribute('data-to')];
        e.classList.toggle('off', !!t && ((f.tr && f.tr !== t) || (to.tr && to.tr !== t)));
      });
      highlight(focusSel.value);
    });
    var f = params.get('focus');
    if (f && S.pkgs[f]) {
      focusSel.value = f; highlight(f);
      var n = svg.querySelector('.node[data-code="' + f + '"]');
      if (n && n.scrollIntoView) n.scrollIntoView({ block: 'center', inline: 'center' });
    }
    initDelay(svg, nodes);
  }

  /* ------------------------------------------------ delay simulator */
  function planFor(track, sub) {
    /* package list for one student; sub = {give: code, take: code} */
    var list = [];
    Object.keys(S.pkgs).forEach(function (k) {
      var p = S.pkgs[k];
      if (p.tr && p.tr !== track) return;
      list.push(k);
    });
    if (sub && sub.give && sub.take) {
      list = list.filter(function (k) { return k !== sub.give; });
      list.push(sub.take);
    }
    return list;
  }
  function simulate(track, failed, times, sub) {
    var list = planFor(track, sub);
    var planned = {}, start = {}, pass = {};
    list.forEach(function (k) { planned[k] = S.pkgs[k].s; });
    var t1 = S.tracks[track].slots[0][0];
    var order = list.slice().sort(function (a, b) { return planned[a] - planned[b]; });
    for (var iter = 0; iter < 20; iter++) {
      var changed = false;
      order.forEach(function (k) {
        var p = S.pkgs[k];
        var st = planned[k];
        var pre = p.pre.slice();
        if (p.t1) pre.push(t1);
        pre.forEach(function (r) { if (pass[r] !== undefined && list.indexOf(r) >= 0) st = Math.max(st, pass[r] + 1); });
        p.co.forEach(function (r) { if (start[r] !== undefined && list.indexOf(r) >= 0) st = Math.max(st, start[r]); });
        var ps = st + (k === failed ? times : 0);
        if (start[k] !== st || pass[k] !== ps) { start[k] = st; pass[k] = ps; changed = true; }
      });
      if (!changed) break;
    }
    return { list: list, planned: planned, start: start, pass: pass };
  }
  function semesterLoad(list, when, extra) {
    var load = {};
    list.forEach(function (k) {
      var s = when[k];
      load[s] = load[s] || { cr: 0, h: 0, th: 0, codes: [] };
      load[s].cr += S.pkgs[k].cr; load[s].h += S.pkgs[k].h; load[s].th += S.pkgs[k].th; load[s].codes.push(k);
    });
    Object.keys(S.courses).forEach(function (code) {
      var c = S.courses[code];
      if (!c.ged) return;
      load[c.s] = load[c.s] || { cr: 0, h: 0, th: 0, codes: [] };
      load[c.s].cr += c.cr; load[c.s].h += c.h; if (c.cr > 0) load[c.s].th += 1;
    });
    (extra || []).forEach(function (e) {
      load[e.s] = load[e.s] || { cr: 0, h: 0, th: 0, codes: [] };
      load[e.s].cr += S.pkgs[e.k].cr; load[e.s].h += S.pkgs[e.k].h; load[e.s].th += S.pkgs[e.k].th;
    });
    return load;
  }
  function initDelay(svg, nodes) {
    var tr = $('#d-track'), co = $('#d-course'), tm = $('#d-times'), out = $('#delay-result');
    if (!tr) return;
    function run() {
      var track = tr.value, failed = co.value, times = parseInt(tm.value, 10);
      nodes.forEach(function (n) { n.classList.remove('moved'); });
      var p = S.pkgs[failed];
      if (p.tr && p.tr !== track) {
        out.innerHTML = '<p class="warn">' + esc(failed) + ' belongs to the ' + esc(p.tr) + ' track. Pick that track, or a core course.</p>';
        return;
      }
      var r = simulate(track, failed, times);
      var moved = r.list.filter(function (k) { return r.start[k] !== r.planned[k]; });
      moved.sort(function (a, b) { return r.planned[a] - r.planned[b] || (a < b ? -1 : 1); });
      var grad = Math.max.apply(null, r.list.map(function (k) { return r.pass[k]; }));
      var retakes = [];
      for (var i = 1; i <= times; i++) retakes.push({ k: failed, s: r.planned[failed] + i });
      var load = semesterLoad(r.list, r.start, retakes);
      var html = '<p class="sim-summary">' + esc(failed) + ' ' + esc(p.t) + ', failed ' + times + ' time' + (times > 1 ? 's' : '') +
        ' in semester ' + r.planned[failed] + ': passed in semester ' + r.pass[failed] + '. ' +
        (moved.length ? moved.length + ' other course' + (moved.length > 1 ? 's move' : ' moves') + '. ' : 'No other course moves. ') +
        (grad > 8 ? '<span class="warn">Graduation moves to semester ' + grad + ' (' + (grad - 8) + ' semester' + (grad - 8 > 1 ? 's' : '') + ' late).</span>' : 'Graduation stays at semester 8.') + '</p>';
      if (moved.length) {
        html += '<div class="table-wrap"><table><thead><tr><th>Course</th><th>Planned</th><th>New semester</th><th>Held back by</th></tr></thead><tbody>';
        moved.forEach(function (k) {
          var q = S.pkgs[k];
          var pre = q.pre.slice(); if (q.t1) pre.push(S.tracks[track].slots[0][0]);
          var why = pre.concat(q.co).filter(function (x) { return r.list.indexOf(x) >= 0 && (r.pass[x] + 1 > r.planned[k] || r.start[x] > r.planned[k]); });
          html += '<tr><td>' + pkgLink(k, true) + '</td><td>' + r.planned[k] + '</td><td><strong>' + r.start[k] + '</strong></td><td>' +
            why.map(function (x) { return pkgLink(x, false); }).join(', ') + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      var sems = Object.keys(load).map(Number).sort(function (a, b) { return a - b; });
      html += '<h3>Load by semester after the change</h3><div class="table-wrap"><table class="compact"><thead><tr><th>Semester</th><th>Credits</th><th>Contact h/week</th><th>Theory courses</th><th>Check</th></tr></thead><tbody>';
      sems.forEach(function (s) {
        var l = load[s];
        var w = [];
        if (l.h > 24) w.push('over 24 h');
        if (l.th > 5) w.push('over 5 theory courses');
        html += '<tr><td>' + s + '</td><td>' + fmt(l.cr) + '</td><td>' + fmt(l.h) + '</td><td>' + l.th + '</td><td>' +
          (w.length ? '<span class="warn">' + w.join(', ') + '</span>' : '<span class="ok">within limits</span>') + '</td></tr>';
      });
      html += '</tbody></table></div><p class="muted">Retakes are counted in the semester after each failure. GED and MDP courses are assumed to stay in place.</p>';
      out.innerHTML = html;
      moved.concat([failed]).forEach(function (k) { var n = svg.querySelector('.node[data-code="' + k + '"]'); if (n) n.classList.add('moved'); });
    }
    [tr, co, tm].forEach(function (e) { e.addEventListener('change', run); });
    if (S.pkgs['CSE-2425']) co.value = 'CSE-2425';
    run();
  }

  /* ------------------------------------------------ substitution checker */
  function verdictHtml(track, give, take) {
    var vs = (S.swaps[track] || []).filter(function (v) { return v.g === give && v.s === take; });
    var g = S.courses[give], t = S.courses[take];
    if (!vs.length) {
      var why = [];
      if (t.tr === track) why.push(take + ' is a course of the ' + track + ' track itself.');
      else if (t.sl === 1) why.push(take + ' is Track Course I of ' + t.tr + ', in semester 6; only courses offered in the same semester as ' + give + ' (semester ' + g.s + ') may replace it.');
      else if (t.s !== g.s) why.push(take + ' is in semester ' + t.s + '; ' + give + ' is in semester ' + g.s + '. A substitute must be offered in the same semester (framework section 9).');
      else why.push('This pair is not covered by the rules.');
      return '<div class="verdict no"><p><strong>Not allowed.</strong></p><p>' + why.map(esc).join(' ') + '</p></div>';
    }
    var v = vs[0];
    var h = '<div class="verdict ' + (v.ok ? 'yes' : 'no') + '"><p><strong>' + (v.ok ? 'Allowed, with the adviser’s approval.' : 'Not allowed.') + '</strong>' +
      (v.nm ? ' Named as a natural substitution in framework section 9.' : '') + '</p>';
    v.r.forEach(function (x) { h += '<p>' + esc(x) + '</p>'; });
    v.n.forEach(function (x) { h += '<p class="muted">Note: ' + esc(x) + '</p>'; });
    if (v.me) h += '<p class="muted">The ' + esc(track) + ' track’s own notes discuss this course; read them before deciding.</p>';
    return h + '</div>';
  }
  function initCheckers() {
    $$('form.checker').forEach(function (f) {
      var track = f.getAttribute('data-track'), g = $('.ck-give', f), s = $('.ck-sub', f), out = $('.ck-result', f);
      function run() { out.innerHTML = verdictHtml(track, g.value, s.value); }
      g.addEventListener('change', run); s.addEventListener('change', run);
      run();
    });
  }

  /* ------------------------------------------------ study-plan builder */
  function initPlanner() {
    var tr = $('#pl-track'), sub = $('#pl-sub'), out = $('#planner-result');
    if (!tr) return;
    function fillSubs() {
      var t = tr.value;
      sub.innerHTML = '<option value="">None</option>' + (S.swaps[t] || []).map(function (v) {
        return '<option value="' + v.g + '|' + v.s + '">' + esc('Give up ' + v.g + ', take ' + v.s + ' ' + S.courses[v.s].t) + (v.ok ? '' : ' (not allowed)') + '</option>';
      }).join('');
    }
    function run() {
      var t = tr.value, sv = sub.value, swap = null, problems = [], notes = [];
      if (sv) {
        var parts = sv.split('|');
        swap = { give: parts[0], take: parts[1] };
        var v = (S.swaps[t] || []).filter(function (x) { return x.g === swap.give && x.s === swap.take; })[0];
        if (v && !v.ok) problems = problems.concat(v.r);
        if (v) notes = notes.concat(v.n);
      }
      var list = planFor(t, swap);
      var when = {};
      list.forEach(function (k) { when[k] = S.pkgs[k].s; });
      var t1 = S.tracks[t].slots[0][0];
      list.forEach(function (k) {
        var p = S.pkgs[k];
        var pre = p.pre.slice(); if (p.t1) pre.push(t1);
        pre.forEach(function (r) {
          var rp = S.pkgs[r];
          if (rp.tr && list.indexOf(r) < 0) problems.push(k + ' needs ' + r + ' ' + rp.t + ', which is not in this plan.');
          else if (list.indexOf(r) >= 0 && when[r] >= when[k]) problems.push(k + ' needs ' + r + ', which is not in an earlier semester.');
        });
        if (p.gate && when['CSE-2440'] >= when[k]) problems.push(k + ' needs a pass in CSE-2440 in an earlier semester.');
      });
      var load = semesterLoad(list, when);
      var html = '';
      var total = 0;
      html += '<div class="table-wrap"><table><thead><tr><th>Semester</th><th>Courses</th><th>Credits</th><th>Contact h/week</th><th>Theory courses</th></tr></thead><tbody>';
      for (var s = 1; s <= 8; s++) {
        var l = load[s] || { cr: 0, h: 0, th: 0, codes: [] };
        total += l.cr;
        var codes = l.codes.sort().map(function (k) { return pkgLink(k, true) + (swap && k === swap.take ? ' <strong>(substitute)</strong>' : ''); });
        var ged = Object.keys(S.courses).filter(function (c) { return S.courses[c].ged && S.courses[c].s === s; }).map(function (c) { return courseLink(c, false); });
        var w = [];
        if (l.h > 24) w.push('over 24 h');
        if (l.th > 5) w.push('over 5 theory courses');
        if (w.length) problems.push('Semester ' + s + ': ' + w.join(', ') + '.');
        html += '<tr><td>' + s + '</td><td>' + codes.join('<br>') + (ged.length ? '<br><span class="muted">University: ' + ged.join(', ') + '</span>' : '') + '</td><td>' + fmt(l.cr) +
          '</td><td>' + fmt(l.h) + (s === 8 && l.h > 11 ? ' <span class="warn">(semester 8 is planned at 11 h)</span>' : '') + '</td><td>' + l.th + '</td></tr>';
      }
      html += '</tbody></table></div>';
      var head = '<div class="verdict ' + (problems.length ? 'no' : 'yes') + '"><p><strong>' + (problems.length ? 'This plan has problems.' : 'This plan passes the checks.') + '</strong> Total ' + fmt(total) +
        ' credits (140–145 required).</p>' + problems.map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') +
        notes.map(function (x) { return '<p class="muted">Note: ' + esc(x) + '</p>'; }).join('') + '</div>';
      out.innerHTML = head + html;
    }
    tr.addEventListener('change', function () { fillSubs(); run(); });
    sub.addEventListener('change', run);
    fillSubs(); run();
  }

  /* ------------------------------------------------ decision and fate filters */
  function initFilters() {
    var dec = $$('.dec-filter');
    if (dec.length) {
      var apply = function () {
        var on = dec.filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
        $$('table.decisions tbody tr').forEach(function (tr) { tr.hidden = on.indexOf(tr.getAttribute('data-status')) < 0; });
      };
      dec.forEach(function (c) { c.addEventListener('change', apply); });
    }
    var fates = $$('input[name=fate]');
    if (fates.length) {
      fates.forEach(function (r) {
        r.addEventListener('change', function () {
          $$('table.fates tbody tr').forEach(function (tr) { tr.hidden = !!r.value && tr.getAttribute('data-fate') !== r.value; });
        });
      });
    }
  }

  /* ------------------------------------------------ search */
  function initSearch() {
    var out = $('#search-results');
    if (!out || !window.SEARCH_INDEX) return;
    var q = (params.get('q') || '').trim();
    var input = $('#sq'); if (input) input.value = q;
    if (!q) { out.innerHTML = '<p class="muted">Type a word above, for example a course code, "SQL" or "viva".</p>'; return; }
    var words = q.toLowerCase().split(/\s+/);
    var hits = [];
    window.SEARCH_INDEX.forEach(function (e) {
      var t = e.t.toLowerCase(), x = (e.x || '').toLowerCase();
      var score = 0, all = true;
      words.forEach(function (w) {
        if (t.indexOf(w) >= 0) score += 10;
        else if (x.indexOf(w) >= 0) score += 2;
        else all = false;
      });
      if (all && score) hits.push({ e: e, s: score + (e.k === 'Course' ? 3 : 0) });
    });
    hits.sort(function (a, b) { return b.s - a.s; });
    if (!hits.length) { out.innerHTML = '<p>No results for “' + esc(q) + '”.</p>'; return; }
    out.innerHTML = '<p>' + hits.length + ' result' + (hits.length > 1 ? 's' : '') + ' for “' + esc(q) + '”.</p><ol class="results">' +
      hits.slice(0, 80).map(function (h) {
        var x = h.e.x || '', i = x.toLowerCase().indexOf(words[0]);
        var snip = i >= 0 ? '…' + x.substr(Math.max(0, i - 60), 160) + '…' : '';
        return '<li><span class="muted">' + esc(h.e.k) + '</span> <a href="' + url(h.e.u) + '">' + esc(h.e.t) + '</a>' + (snip ? '<br><span class="muted">' + esc(snip) + '</span>' : '') + '</li>';
      }).join('') + '</ol>';
  }

  initCatalogue(); initRoadmap(); initGraph(); initCheckers(); initPlanner(); initFilters(); initSearch();
})();
