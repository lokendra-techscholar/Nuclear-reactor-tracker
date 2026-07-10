(function () {
  'use strict';

  const PRE_URL = 'data/reactors_pre.json';
  const POST_URL = 'data/reactors.json';

  const PRE_COLOR = '#8a3863';   // llama soft
  const POST_COLOR = '#f1a222';  // marigold

  const container = document.getElementById('bar-container');
  const tooltipEl = document.getElementById('bar-tooltip');

  let rows = [];            // [{country, preUnits, preMw, postUnits, postMw}]
  let metric = 'units';     // 'units' | 'mw'

  async function boot() {
    try {
      const [pre, post] = await Promise.all([
        fetch(PRE_URL).then(r => { if (!r.ok) throw new Error('Pre-Fukushima data failed: ' + r.status); return r.json(); }),
        fetch(POST_URL).then(r => { if (!r.ok) throw new Error('Post-Fukushima data failed: ' + r.status); return r.json(); })
      ]);

      rows = buildRows(pre, post);
      populateSummary(pre, post);
      renderTable(pre, post);
      renderChart();

      document.getElementById('toggle-units').addEventListener('click', () => setMetric('units'));
      document.getElementById('toggle-mw').addEventListener('click', () => setMetric('mw'));
      window.addEventListener('resize', renderChart);
    } catch (err) {
      console.error(err);
      container.insertAdjacentHTML('afterbegin',
        `<div class="error-banner"><strong>Failed to load data.</strong><br>${escapeHtml(err.message)}</div>`);
    }
  }

  function aggregate(data) {
    const m = new Map();
    data.sites.forEach(s => {
      const cur = m.get(s.country) || { units: 0, mw: 0 };
      cur.units += s.reactor_count;
      cur.mw += s.total_gross_mw;
      m.set(s.country, cur);
    });
    return m;
  }

  function buildRows(pre, post) {
    const preAgg = aggregate(pre);
    const postAgg = aggregate(post);
    const countries = new Set([...preAgg.keys(), ...postAgg.keys()]);
    const out = [];
    countries.forEach(c => {
      const p = preAgg.get(c) || { units: 0, mw: 0 };
      const q = postAgg.get(c) || { units: 0, mw: 0 };
      out.push({ country: c, preUnits: p.units, preMw: p.mw, postUnits: q.units, postMw: q.mw });
    });
    out.sort((a, b) => (b.preUnits + b.postUnits) - (a.preUnits + a.postUnits) || a.country.localeCompare(b.country));
    return out;
  }

  function populateSummary(pre, post) {
    const preCountries = new Set(pre.sites.map(s => s.country)).size;
    const postCountries = new Set(post.sites.map(s => s.country)).size;

    document.getElementById('pre-units').textContent = pre.total_reactors;
    document.getElementById('pre-mw').innerHTML = pre.total_gross_mw.toLocaleString() + ' MW<sub>e</sub>';
    document.getElementById('pre-countries').textContent = preCountries;
    document.getElementById('post-units').textContent = post.total_reactors;
    document.getElementById('post-mw').innerHTML = post.total_gross_mw.toLocaleString() + ' MW<sub>e</sub>';
    document.getElementById('post-countries').textContent = postCountries;

    const dUnits = post.total_reactors - pre.total_reactors;
    const dMwPct = ((post.total_gross_mw - pre.total_gross_mw) / pre.total_gross_mw) * 100;
    const verdict = document.getElementById('comparison-verdict');
    verdict.innerHTML =
      `Worldwide, construction commenced on <strong>${post.total_reactors}</strong> reactors in the 13 years after ` +
      `Fukushima versus <strong>${pre.total_reactors}</strong> in the 13 years before ` +
      `(${dUnits >= 0 ? '+' : ''}${dUnits} units, ${dMwPct >= 0 ? '+' : ''}${dMwPct.toFixed(0)}% gross capacity), ` +
      `while the number of countries starting new builds rose from ${new Set(pre.sites.map(s => s.country)).size} ` +
      `to ${new Set(post.sites.map(s => s.country)).size}.`;
  }

  function setMetric(m) {
    metric = m;
    document.getElementById('toggle-units').classList.toggle('active', m === 'units');
    document.getElementById('toggle-mw').classList.toggle('active', m === 'mw');
    renderChart();
  }

  function renderChart() {
    const svg = d3.select('#bar-chart');
    svg.selectAll('*').remove();

    const rect = container.getBoundingClientRect();
    const margin = { top: 8, right: 70, bottom: 34, left: 130 };
    const w = Math.max(420, rect.width);
    const rowH = 44;
    const h = margin.top + margin.bottom + rows.length * rowH;

    svg.attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h);

    const val = d => metric === 'units'
      ? { pre: d.preUnits, post: d.postUnits }
      : { pre: d.preMw, post: d.postMw };

    const maxVal = d3.max(rows, d => Math.max(val(d).pre, val(d).post)) || 1;

    const x = d3.scaleLinear()
      .domain([0, maxVal * 1.06])
      .range([margin.left, w - margin.right]);

    const y = d3.scaleBand()
      .domain(rows.map(d => d.country))
      .range([margin.top, h - margin.bottom])
      .paddingInner(0.32)
      .paddingOuter(0.12);

    const barH = y.bandwidth() / 2;

    // x axis
    const xAxis = d3.axisBottom(x)
      .ticks(6)
      .tickFormat(v => metric === 'mw' ? d3.format('~s')(v).replace('k', 'k') : v)
      .tickSizeOuter(0);
    svg.append('g')
      .attr('class', 'axis axis-x')
      .attr('transform', `translate(0, ${h - margin.bottom})`)
      .call(xAxis);

    // y axis (country labels)
    svg.append('g')
      .attr('class', 'axis axis-y')
      .attr('transform', `translate(${margin.left - 8}, 0)`)
      .call(d3.axisLeft(y).tickSize(0))
      .select('.domain').remove();

    // grid lines
    svg.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(x.ticks(6))
      .join('line')
      .attr('x1', d => x(d)).attr('x2', d => x(d))
      .attr('y1', margin.top).attr('y2', h - margin.bottom);

    const g = svg.append('g');

    const groups = g.selectAll('g.country-row')
      .data(rows)
      .join('g')
      .attr('class', 'country-row')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', d => rowAriaLabel(d))
      .on('mouseenter', function (event, d) { showTooltip(event, d); d3.select(this).classed('focused', true); })
      .on('mousemove', function (event) { positionTooltip(event); })
      .on('mouseleave', function () { hideTooltip(); d3.select(this).classed('focused', false); })
      .on('focus', function (event, d) { showTooltip(event, d); d3.select(this).classed('focused', true); })
      .on('blur', function () { hideTooltip(); d3.select(this).classed('focused', false); });

    groups.append('rect')
      .attr('class', 'row-hit')
      .attr('x', 0)
      .attr('y', d => y(d.country) - y.step() * 0.16)
      .attr('width', w)
      .attr('height', y.step())
      .attr('fill', 'transparent');

    groups.append('rect')
      .attr('class', 'bar bar-pre')
      .attr('x', x(0))
      .attr('y', d => y(d.country))
      .attr('width', d => Math.max(0, x(val(d).pre) - x(0)))
      .attr('height', barH)
      .attr('fill', PRE_COLOR)
      .attr('rx', 2);

    groups.append('rect')
      .attr('class', 'bar bar-post')
      .attr('x', x(0))
      .attr('y', d => y(d.country) + barH)
      .attr('width', d => Math.max(0, x(val(d).post) - x(0)))
      .attr('height', barH)
      .attr('fill', POST_COLOR)
      .attr('rx', 2);

    // value labels at bar ends
    const fmt = v => metric === 'mw' ? v.toLocaleString() : String(v);
    groups.append('text')
      .attr('class', 'bar-value')
      .attr('x', d => x(val(d).pre) + 5)
      .attr('y', d => y(d.country) + barH / 2)
      .attr('dy', '0.35em')
      .text(d => fmt(val(d).pre));
    groups.append('text')
      .attr('class', 'bar-value')
      .attr('x', d => x(val(d).post) + 5)
      .attr('y', d => y(d.country) + barH * 1.5)
      .attr('dy', '0.35em')
      .text(d => fmt(val(d).post));
  }

  function rowAriaLabel(d) {
    return `${d.country}: pre-Fukushima ${d.preUnits} units (${d.preMw.toLocaleString()} megawatts), ` +
           `post-Fukushima ${d.postUnits} units (${d.postMw.toLocaleString()} megawatts)`;
  }

  function showTooltip(event, d) {
    const dUnits = d.postUnits - d.preUnits;
    const dMw = d.postMw - d.preMw;
    const sign = v => (v > 0 ? '+' : '') + v.toLocaleString();
    tooltipEl.innerHTML = `
      <p class="ttp-country">${escapeHtml(d.country)}</p>
      <dl class="ttp-detail ttp-compare">
        <dt><span class="cl-swatch cl-pre"></span> Pre (1998&ndash;2010)</dt>
        <dd>${d.preUnits} units &middot; ${d.preMw.toLocaleString()} MW</dd>
        <dt><span class="cl-swatch cl-post"></span> Post (2012&ndash;2024)</dt>
        <dd>${d.postUnits} units &middot; ${d.postMw.toLocaleString()} MW</dd>
        <dt>Change</dt>
        <dd><strong>${sign(dUnits)} units</strong> &middot; ${sign(dMw)} MW</dd>
      </dl>
    `;
    tooltipEl.classList.add('visible');
    tooltipEl.setAttribute('aria-hidden', 'false');
    positionTooltip(event);
  }

  function positionTooltip(event) {
    const cRect = container.getBoundingClientRect();
    const tRect = tooltipEl.getBoundingClientRect();
    const margin = 14;
    let xPos = event.clientX - cRect.left + margin;
    let yPos = event.clientY - cRect.top + margin;
    if (xPos + tRect.width + margin > cRect.width) {
      xPos = event.clientX - cRect.left - tRect.width - margin;
    }
    if (yPos + tRect.height + margin > container.scrollHeight) {
      yPos = event.clientY - cRect.top - tRect.height - margin;
    }
    tooltipEl.style.left = Math.max(4, xPos) + 'px';
    tooltipEl.style.top = Math.max(4, yPos) + 'px';
  }

  function hideTooltip() {
    tooltipEl.classList.remove('visible');
    tooltipEl.setAttribute('aria-hidden', 'true');
  }

  function renderTable(pre, post) {
    const tbody = document.getElementById('comparison-tbody');
    const tfoot = document.getElementById('comparison-tfoot');
    tbody.innerHTML = '';
    rows.forEach(d => {
      const dUnits = d.postUnits - d.preUnits;
      const cls = dUnits > 0 ? 'delta-up' : dUnits < 0 ? 'delta-down' : 'delta-flat';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <th scope="row">${escapeHtml(d.country)}</th>
        <td>${d.preUnits || '&mdash;'}</td>
        <td>${d.preMw ? d.preMw.toLocaleString() : '&mdash;'}</td>
        <td>${d.postUnits || '&mdash;'}</td>
        <td>${d.postMw ? d.postMw.toLocaleString() : '&mdash;'}</td>
        <td class="${cls}">${dUnits > 0 ? '+' : ''}${dUnits}</td>
      `;
      tbody.appendChild(tr);
    });
    const dTotal = post.total_reactors - pre.total_reactors;
    tfoot.innerHTML = `
      <tr>
        <th scope="row">Worldwide</th>
        <td>${pre.total_reactors}</td>
        <td>${pre.total_gross_mw.toLocaleString()}</td>
        <td>${post.total_reactors}</td>
        <td>${post.total_gross_mw.toLocaleString()}</td>
        <td class="${dTotal >= 0 ? 'delta-up' : 'delta-down'}">${dTotal > 0 ? '+' : ''}${dTotal}</td>
      </tr>
    `;
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  boot();
})();
