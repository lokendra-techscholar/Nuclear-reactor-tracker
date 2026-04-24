(function () {
  'use strict';

  const REACTOR_DATA_URL = 'data/reactors.json';

  // Brand-aligned palette: warm tones spanning llama (#620d3c) through
  // marigold (#f1a222), with a few deeper / cooler accents so 14 slices
  // remain visually distinguishable.
  const COUNTRY_PALETTE = [
    '#620d3c', // llama
    '#f1a222', // marigold
    '#8a3863', // llama soft
    '#d99a3a', // marigold dark
    '#a86d8a', // llama mute
    '#c98e1a', // amber
    '#3f0826', // deep llama
    '#fbd07d', // marigold soft
    '#74344f', // wine
    '#b85d2e', // rust
    '#9b507a', // mauve
    '#e8b87b', // sand
    '#511031', // burgundy
    '#f4c266', // honey
    '#7c2a52', // plum
    '#dba14b'  // ochre
  ];

  const tooltipEl = document.getElementById('pie-tooltip');
  const container = document.getElementById('pie-container');
  const legendEl = document.getElementById('pie-legend');

  let totalGross = 0;

  async function boot() {
    try {
      const res = await fetch(REACTOR_DATA_URL);
      if (!res.ok) throw new Error('Reactor data failed to load: ' + res.status);
      const data = await res.json();

      const byCountry = aggregateByCountry(data);
      totalGross = byCountry.reduce((s, c) => s + c.gross_mw, 0);

      populateStats(data, byCountry);
      renderPie(byCountry);
      renderLegend(byCountry);

      window.addEventListener('resize', () => renderPie(byCountry));
    } catch (err) {
      console.error(err);
      container.insertAdjacentHTML('afterbegin',
        `<div class="error-banner"><strong>Failed to load data.</strong><br>${escapeHtml(err.message)}</div>`);
    }
  }

  function aggregateByCountry(data) {
    const byCountry = new Map();
    data.sites.forEach(s => {
      const cur = byCountry.get(s.country) || {
        country: s.country, units: 0, gross_mw: 0, sites: 0
      };
      cur.units += s.reactor_count;
      cur.gross_mw += s.total_gross_mw;
      cur.sites += 1;
      byCountry.set(s.country, cur);
    });
    return Array.from(byCountry.values()).sort((a, b) => b.gross_mw - a.gross_mw);
  }

  function populateStats(data, byCountry) {
    document.getElementById('stat-sites').textContent = data.total_sites.toLocaleString();
    document.getElementById('stat-units').textContent = data.total_reactors.toLocaleString();
    document.getElementById('stat-countries').textContent = byCountry.length.toLocaleString();
    document.getElementById('stat-mw').innerHTML = data.total_gross_mw.toLocaleString() + ' MW<sub>e</sub>';
    document.getElementById('pie-center-value').innerHTML = (data.total_gross_mw / 1000).toFixed(1) + '&nbsp;GW<sub>e</sub>';
    document.getElementById('pie-center-sub').textContent =
      data.total_reactors + ' reactor units across ' + byCountry.length + ' countries';
  }

  function renderPie(byCountry) {
    const svg = d3.select('#pie-chart');
    svg.selectAll('*').remove();

    const rect = container.getBoundingClientRect();
    const w = Math.max(280, rect.width);
    const h = Math.max(280, Math.min(rect.height, w));
    const size = Math.min(w, h);
    const radius = size / 2;
    const innerRadius = radius * 0.45;
    const outerRadius = radius * 0.92;
    const hoverPad = radius * 0.04;

    svg.attr('viewBox', `${-w / 2} ${-h / 2} ${w} ${h}`)
       .attr('width', w).attr('height', h);

    const pie = d3.pie()
      .value(d => d.gross_mw)
      .sort(null);

    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .padAngle(0.005);

    const arcHover = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius + hoverPad)
      .padAngle(0.005);

    const arcs = pie(byCountry);

    const g = svg.append('g').attr('class', 'slices');

    g.selectAll('path.slice')
      .data(arcs)
      .join('path')
      .attr('class', 'slice')
      .attr('d', arc)
      .attr('fill', (d, i) => COUNTRY_PALETTE[i % COUNTRY_PALETTE.length])
      .attr('stroke', '#fffbe2')
      .attr('stroke-width', 2)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', d => sliceAriaLabel(d.data))
      .on('mouseenter', function (event, d) { onEnter(this, event, d, arc, arcHover); })
      .on('mousemove', function (event) { positionTooltip(event); })
      .on('mouseleave', function (event, d) { onLeave(this, d, arc); })
      .on('focus', function (event, d) { onEnter(this, event, d, arc, arcHover); })
      .on('blur', function (event, d) { onLeave(this, d, arc); });

    // Slice labels (only for slices large enough to read comfortably)
    const labelArc = d3.arc().innerRadius(outerRadius * 0.78).outerRadius(outerRadius * 0.78);
    g.selectAll('text.slice-label')
      .data(arcs)
      .join('text')
      .attr('class', 'slice-label')
      .attr('transform', d => `translate(${labelArc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .text(d => {
        const pct = (d.data.gross_mw / totalGross) * 100;
        return pct >= 4 ? d.data.country : '';
      });
  }

  function onEnter(node, event, d, arc, arcHover) {
    d3.select(node).classed('focused', true)
      .transition().duration(120).attr('d', arcHover);
    showTooltip(event, d.data);
  }

  function onLeave(node, d, arc) {
    d3.select(node).classed('focused', false)
      .transition().duration(120).attr('d', arc);
    hideTooltip();
  }

  function sliceAriaLabel(c) {
    const pct = ((c.gross_mw / totalGross) * 100).toFixed(1);
    return `${c.country}: ${c.units} units, ${c.gross_mw.toLocaleString()} megawatts, ${pct} percent of global total`;
  }

  function showTooltip(event, c) {
    const pct = (c.gross_mw / totalGross) * 100;
    tooltipEl.innerHTML = `
      <p class="ttp-country">${escapeHtml(c.country)}</p>
      <dl class="ttp-detail">
        <dt>Reactor units</dt><dd>${c.units}</dd>
        <dt>Sites</dt><dd>${c.sites}</dd>
        <dt>Gross capacity</dt><dd>${c.gross_mw.toLocaleString()} MW<sub>e</sub></dd>
        <dt>Share of global</dt><dd><strong>${pct.toFixed(1)}%</strong></dd>
      </dl>
      <div class="ttp-bar"><span style="width:${Math.min(100, pct).toFixed(2)}%"></span></div>
    `;
    tooltipEl.classList.add('visible');
    tooltipEl.setAttribute('aria-hidden', 'false');
    positionTooltip(event);
  }

  function positionTooltip(event) {
    const cRect = container.getBoundingClientRect();
    const tRect = tooltipEl.getBoundingClientRect();
    const margin = 14;
    let x = event.clientX - cRect.left + margin;
    let y = event.clientY - cRect.top + margin;
    if (x + tRect.width + margin > cRect.width) {
      x = event.clientX - cRect.left - tRect.width - margin;
    }
    if (y + tRect.height + margin > cRect.height) {
      y = event.clientY - cRect.top - tRect.height - margin;
    }
    x = Math.max(4, x);
    y = Math.max(4, y);
    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
  }

  function hideTooltip() {
    tooltipEl.classList.remove('visible');
    tooltipEl.setAttribute('aria-hidden', 'true');
  }

  function renderLegend(byCountry) {
    legendEl.innerHTML = '';
    byCountry.forEach((c, i) => {
      const pct = (c.gross_mw / totalGross) * 100;
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="legend-swatch" style="background:${COUNTRY_PALETTE[i % COUNTRY_PALETTE.length]}"></span>
        <span class="legend-name">${escapeHtml(c.country)}</span>
        <span class="legend-meta">${c.units} units &middot; ${c.gross_mw.toLocaleString()} MW &middot; ${pct.toFixed(1)}%</span>
      `;
      legendEl.appendChild(li);
    });
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  boot();
})();
