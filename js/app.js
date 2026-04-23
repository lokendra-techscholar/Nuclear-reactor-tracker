(function () {
  'use strict';

  const WORLD_TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json';
  const REACTOR_DATA_URL = 'data/reactors.json';

  const svg = d3.select('#map');
  const tooltipEl = document.getElementById('tooltip');
  const container = document.getElementById('map-container');

  const gRoot = svg.append('g').attr('class', 'root');
  const gLand = gRoot.append('g').attr('class', 'layer-land');
  const gGrat = gRoot.append('g').attr('class', 'layer-grat');
  const gSites = gRoot.append('g').attr('class', 'layer-sites');

  let projection, path, zoom, landFeature;
  let reactorData = null;

  function resize() {
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    svg.attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h);

    projection = d3.geoEqualEarth()
      .fitExtent([[10, 10], [w - 10, h - 10]], { type: 'Sphere' });
    path = d3.geoPath(projection);

    const sphere = { type: 'Sphere' };
    gLand.selectAll('path.sphere').data([sphere]).join(
      enter => enter.append('path').attr('class', 'sphere').attr('fill', 'var(--ocean)')
    ).attr('d', path);

    if (landFeature) {
      gLand.selectAll('path.land').data([landFeature]).join(
        enter => enter.append('path').attr('class', 'land')
      ).attr('d', path);
    }

    const graticule = d3.geoGraticule10();
    gGrat.selectAll('path.graticule').data([graticule]).join(
      enter => enter.append('path').attr('class', 'graticule')
    ).attr('d', path);

    if (reactorData) renderSites();
  }

  function renderSites() {
    const sites = reactorData.sites;

    const classify = (site) => {
      const opCount = site.reactors.filter(r => r.status === 'Operational').length;
      const totCount = site.reactors.length;
      if (opCount === totCount) return 'operational';
      if (opCount === 0) return 'construction';
      return 'mixed';
    };

    const groups = gSites.selectAll('g.site').data(sites, d => d.site_name + '_' + d.country);
    groups.exit().remove();

    const enterG = groups.enter().append('g').attr('class', 'site');
    enterG.append('circle').attr('class', 'marker-halo').attr('r', 5);
    enterG.append('circle').attr('class', 'reactor-marker');

    const allG = enterG.merge(groups);

    allG.attr('transform', d => {
      const p = projection([d.lon, d.lat]);
      if (!p) return 'translate(-9999,-9999)';
      return `translate(${p[0]}, ${p[1]})`;
    });

    allG.select('circle.reactor-marker')
      .attr('class', d => 'reactor-marker ' + classify(d))
      .attr('r', d => Math.max(4, Math.min(11, 3 + Math.sqrt(d.total_gross_mw) / 15)))
      .on('mouseenter', handleEnter)
      .on('mousemove', handleMove)
      .on('mouseleave', handleLeave)
      .on('focus', handleEnter)
      .on('blur', handleLeave)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', d => `${d.site_name}, ${d.country} — ${d.reactor_count} reactor${d.reactor_count > 1 ? 's' : ''}`);
  }

  function handleEnter(event, d) {
    d3.select(this).classed('focused', true);
    showTooltip(event, d);
  }
  function handleMove(event, d) { positionTooltip(event); }
  function handleLeave() {
    d3.select(this).classed('focused', false);
    hideTooltip();
  }

  function fmtDate(s) {
    if (!s) return '—';
    const [y, m] = s.split('-');
    if (!m) return y;
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mi = parseInt(m, 10) - 1;
    return monthNames[mi] + ' ' + y;
  }

  function reactorTypeLabel(t) {
    return ({
      PWR: 'Pressurised Water Reactor (PWR)',
      BWR: 'Boiling Water Reactor (BWR)',
      PHWR: 'Pressurised Heavy Water Reactor (PHWR)',
      FBR: 'Fast Breeder Reactor (FBR)',
      HTGR: 'High-Temperature Gas-cooled Reactor (HTGR)',
      LWGR: 'Light-Water-cooled Graphite-moderated Reactor (LWGR)',
      GCR: 'Gas-Cooled Reactor (GCR)',
    })[t] || t;
  }

  function showTooltip(event, d) {
    const opCount = d.reactors.filter(r => r.status === 'Operational').length;
    const conCount = d.reactors.length - opCount;

    let html = '';
    html += `<p class="tt-site">${escapeHtml(d.site_name)}</p>`;
    html += `<p class="tt-country">${escapeHtml(d.country)}</p>`;
    html += `<div class="tt-meta">
      <span>${d.reactor_count} unit${d.reactor_count > 1 ? 's' : ''}</span>
      <span>${d.total_gross_mw.toLocaleString()} MW<sub>e</sub> gross</span>
      <span>${opCount} op. / ${conCount} constr.</span>
    </div>`;

    d.reactors.forEach(r => {
      const status = r.status === 'Operational' ? 'op' : 'con';
      const statusLabel = r.status === 'Operational' ? 'Operational' : 'Construction';
      html += `
        <div class="tt-reactor">
          <div class="tt-reactor-head">
            <span class="tt-reactor-name">${escapeHtml(r.name)}</span>
            <span class="tt-reactor-status ${status}">${statusLabel}</span>
          </div>
          <dl class="tt-reactor-detail">
            <dt>Type</dt><dd>${escapeHtml(reactorTypeLabel(r.type))}${r.model ? ' &mdash; ' + escapeHtml(r.model) : ''}</dd>
            <dt>Gross capacity</dt><dd>${r.gross_mw.toLocaleString()} MW<sub>e</sub></dd>
            <dt>Construction start</dt><dd>${fmtDate(r.const_start)}</dd>
            <dt>Grid connection</dt><dd>${fmtDate(r.grid_connection)}</dd>
            <dt>Commercial op.</dt><dd>${fmtDate(r.commercial_op)}</dd>
          </dl>
        </div>`;
    });

    tooltipEl.innerHTML = html;
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

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function setupZoom() {
    zoom = d3.zoom()
      .scaleExtent([1, 18])
      .on('zoom', (event) => {
        gRoot.attr('transform', event.transform);
        const k = event.transform.k;
        gSites.selectAll('circle.reactor-marker')
          .attr('stroke-width', 1 / Math.sqrt(k));
        gSites.selectAll('.marker-halo')
          .attr('stroke-width', 1.5 / Math.sqrt(k));
      });
    svg.call(zoom);

    d3.select('#zoom-in').on('click', () => svg.transition().duration(250).call(zoom.scaleBy, 1.6));
    d3.select('#zoom-out').on('click', () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.6));
    d3.select('#zoom-reset').on('click', () => svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity));
  }

  function populateStats() {
    document.getElementById('stat-sites').textContent = reactorData.total_sites.toLocaleString();
    document.getElementById('stat-units').textContent = reactorData.total_reactors.toLocaleString();
    const countries = Array.from(new Set(reactorData.sites.map(s => s.country))).sort();
    document.getElementById('stat-countries').textContent = countries.length.toLocaleString();
    const mwEl = document.getElementById('stat-mw');
    mwEl.innerHTML = reactorData.total_gross_mw.toLocaleString() + ' MW<sub>e</sub>';

    const byCountry = {};
    reactorData.sites.forEach(s => {
      byCountry[s.country] = byCountry[s.country] || { units: 0, mw: 0 };
      byCountry[s.country].units += s.reactor_count;
      byCountry[s.country].mw += s.total_gross_mw;
    });

    const ul = document.getElementById('country-breakdown');
    const rows = Object.keys(byCountry).sort((a, b) => byCountry[b].units - byCountry[a].units);
    rows.forEach(c => {
      const li = document.createElement('li');
      const cs = byCountry[c];
      li.innerHTML = `<span>${escapeHtml(c)}</span><span class="c-units">${cs.units} &middot; ${cs.mw.toLocaleString()} MW</span>`;
      ul.appendChild(li);
    });
  }

  async function boot() {
    try {
      const [worldTopo, reactors] = await Promise.all([
        fetch(WORLD_TOPO_URL).then(r => {
          if (!r.ok) throw new Error('World map failed to load: ' + r.status);
          return r.json();
        }),
        fetch(REACTOR_DATA_URL).then(r => {
          if (!r.ok) throw new Error('Reactor data failed to load: ' + r.status);
          return r.json();
        })
      ]);

      landFeature = topojson.feature(worldTopo, worldTopo.objects.land);
      reactorData = reactors;

      setupZoom();
      resize();
      populateStats();

      window.addEventListener('resize', resize);
    } catch (err) {
      console.error(err);
      container.insertAdjacentHTML('afterbegin',
        `<div style="padding:18px;color:#ffb3b3;background:#3a0e0e;border:1px solid #6a1a1a;border-radius:6px;margin:18px">
           <strong>Failed to load map data.</strong><br>${escapeHtml(err.message)}
         </div>`);
    }
  }

  boot();
})();
