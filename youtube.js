/* ================================================================
   Lejochachen · YouTube Live Resource Hub
   ================================================================

   SETUP — add your YouTube Data API v3 key below:
   ─────────────────────────────────────────────────────────────────
   1. Go to  https://console.cloud.google.com/
   2. Create a project  →  APIs & Services  →  Enable "YouTube Data API v3"
   3. Credentials  →  + Create Credentials  →  API key
   4. Click the key  →  API restrictions: YouTube Data API v3
      Website restrictions: add  *yourdomain.com/*
   5. Paste the key as the value of  API_KEY  below
   ================================================================ */

(function () {
  'use strict';

  /* ── Configuration ──────────────────────────────────────────── */
  const CFG = {
    API_KEY:        'AIzaSyBRXkBDPmN75t9zirI-iBnt5UN5JI50W6s',                    // ← paste your key here
    CHANNEL_HANDLE: 'lejochachen',
    CACHE_TTL:      60 * 60 * 1000,       // 1 hour
    PER_PAGE:       24,
    BASE:           'https://www.googleapis.com/youtube/v3',
  };

  /* ── State ──────────────────────────────────────────────────── */
  const S = {
    channel: null,
    uploadsId: null,
    playlists: [],
    activePlaylistId: null,   // null = uploads
    videos: [],               // all loaded for current view
    nextPageToken: null,
    loading: false,
    searchTimer: null,
    searchActive: false,
  };

  /* ── Cache ───────────────────────────────────────────────────── */
  const cache = {
    get(k) {
      try {
        const d = JSON.parse(localStorage.getItem('yt3_' + k));
        if (!d || Date.now() - d.ts > CFG.CACHE_TTL) return null;
        return d.v;
      } catch { return null; }
    },
    set(k, v) {
      try { localStorage.setItem('yt3_' + k, JSON.stringify({ ts: Date.now(), v })); } catch {}
    },
  };

  /* ── API ─────────────────────────────────────────────────────── */
  async function api(endpoint, params) {
    const url = new URL(CFG.BASE + '/' + endpoint);
    url.searchParams.set('key', CFG.API_KEY);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'API error ' + res.status);
    }
    return res.json();
  }

  async function getChannel() {
    const ck = 'ch_' + CFG.CHANNEL_HANDLE;
    const hit = cache.get(ck);
    if (hit) return hit;
    const d = await api('channels', {
      forHandle: CFG.CHANNEL_HANDLE,
      part: 'id,snippet,statistics,contentDetails',
    });
    const ch = d.items?.[0];
    if (!ch) throw new Error('Channel not found');
    cache.set(ck, ch);
    return ch;
  }

  async function getPlaylists(channelId) {
    const ck = 'pl_' + channelId;
    const hit = cache.get(ck);
    if (hit) return hit;
    const d = await api('playlists', {
      channelId,
      part: 'id,snippet',
      maxResults: 50,
    });
    const pls = d.items || [];
    cache.set(ck, pls);
    return pls;
  }

  async function getPlaylistVideos(playlistId, pageToken = '') {
    const ck = 'v_' + playlistId + '_' + (pageToken || 'start');
    const hit = cache.get(ck);
    if (hit) return hit;
    const params = { playlistId, part: 'snippet', maxResults: CFG.PER_PAGE };
    if (pageToken) params.pageToken = pageToken;
    const d = await api('playlistItems', params);
    const result = { items: d.items || [], nextPageToken: d.nextPageToken || null };
    cache.set(ck, result);
    return result;
  }

  /* ── Helpers ─────────────────────────────────────────────────── */
  const $  = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  function lang() { return document.body.dataset.lang || 'en'; }

  function bi(en, am) {
    return `<span class="lang en">${en}</span><span class="lang am">${am}</span>`;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function fmtNum(n) {
    const x = parseInt(n, 10);
    if (isNaN(x)) return '—';
    if (x >= 1e6) return (x / 1e6).toFixed(1) + 'M';
    if (x >= 1e3) return (x / 1e3).toFixed(1) + 'K';
    return x.toLocaleString();
  }

  function bestThumb(v) {
    const t = v.snippet?.thumbnails;
    return t?.maxres?.url || t?.high?.url || t?.medium?.url || t?.default?.url || '';
  }

  function vidId(item) {
    return item.snippet?.resourceId?.videoId || '';
  }

  function ytLink(id) { return `https://www.youtube.com/watch?v=${id}`; }

  /* ── Skeletons ───────────────────────────────────────────────── */
  function skeletons(n = 8) {
    const g = $('yt-video-grid');
    if (!g) return;
    g.innerHTML = Array.from({ length: n }, () => `
      <div class="yt-skel-card">
        <div class="yt-skel-thumb yt-shimmer"></div>
        <div class="yt-skel-info">
          <div class="yt-skel-line yt-shimmer" style="width:45%;height:11px;margin-bottom:7px;"></div>
          <div class="yt-skel-line yt-shimmer" style="width:90%;height:14px;margin-bottom:5px;"></div>
          <div class="yt-skel-line yt-shimmer" style="width:72%;height:14px;"></div>
        </div>
      </div>
    `).join('');
  }

  /* ── Render: channel banner ──────────────────────────────────── */
  function renderBanner(ch) {
    const el = $('yt-channel-banner');
    if (!el) return;
    const subs   = fmtNum(ch.statistics?.subscriberCount);
    const videos = fmtNum(ch.statistics?.videoCount);
    const views  = fmtNum(ch.statistics?.viewCount);
    const avatar = ch.snippet?.thumbnails?.high?.url
                || ch.snippet?.thumbnails?.default?.url
                || 'assets/logo.png';
    el.innerHTML = `
      <div class="ytb-avatar">
        <img src="${avatar}" alt="${ch.snippet?.title || 'Lejochachen'}"
             onerror="this.src='assets/logo.png'">
      </div>
      <div class="ytb-info">
        <h3 class="ytb-name">${ch.snippet?.title || 'Lejochachen'}</h3>
        <p class="ytb-handle">youtube.com/@${CFG.CHANNEL_HANDLE}</p>
        <div class="ytb-stats">
          <span class="ytb-stat"><strong>${subs}</strong> ${bi('subscribers','ደንበኞች')}</span>
          <span class="ytb-sep">·</span>
          <span class="ytb-stat"><strong>${videos}</strong> ${bi('videos','ቪዲዮዎች')}</span>
          <span class="ytb-sep">·</span>
          <span class="ytb-stat"><strong>${views}</strong> ${bi('views','ተመልካቾች')}</span>
        </div>
      </div>
      <a class="btn primary ytb-cta" href="https://www.youtube.com/@${CFG.CHANNEL_HANDLE}"
         target="_blank" rel="noopener">
        ${bi('Subscribe','ደንበኛ ይሁኑ')} ▶
      </a>
    `;
    el.className = 'channel-banner channel-banner--live';
    el.removeAttribute('hidden');
  }

  /* ── Render: featured video ──────────────────────────────────── */
  function renderFeatured(video) {
    const wrap = $('yt-featured');
    if (!wrap || !video) return;
    const id    = vidId(video);
    if (!id) return;
    const title = video.snippet?.title || '';
    const desc  = (video.snippet?.description || '').slice(0, 240);
    const date  = fmtDate(video.snippet?.publishedAt);
    const img   = bestThumb(video);

    wrap.innerHTML = `
      <div class="ytf-inner">
        <div class="ytf-player" id="ytf-player">
          <img class="ytf-thumb" src="${img}" alt="${title.replace(/"/g,"'")}">
          <button class="ytf-play-btn" id="ytf-play-btn" aria-label="Play ${title.replace(/"/g,"'")}">
            <span class="ytf-play-ring">
              <span class="ytf-play-triangle"></span>
            </span>
          </button>
          <div class="ytf-iframe-wrap" id="ytf-iframe-wrap" hidden>
            <iframe
              src=""
              data-src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1"
              title="${title.replace(/"/g,"'")}"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen></iframe>
          </div>
        </div>
        <div class="ytf-meta">
          <span class="mini-label ytf-badge">
            ${bi('Latest Upload','ቅርብ ቪዲዮ')}
          </span>
          <h3 class="ytf-title">${title}</h3>
          <p class="ytf-date">${date}</p>
          <p class="ytf-desc">${desc}${desc.length >= 240 ? '…' : ''}</p>
          <div class="ytf-actions">
            <button class="btn primary ytf-play-inline" data-id="${id}">
              ${bi('▶ Play Here','▶ እዚህ ይጫወቱ')}
            </button>
            <a class="btn ghost ytf-yt-link" href="${ytLink(id)}" target="_blank" rel="noopener"
               style="color:var(--green);border-color:var(--green);">
              ${bi('Open in YouTube','ዩቱብ ይክፈቱ')}
            </a>
          </div>
        </div>
      </div>
    `;

    // Activate in-page embed on play button click
    [document.getElementById('ytf-play-btn'), wrap.querySelector('.ytf-play-inline')].forEach(btn => {
      btn?.addEventListener('click', () => {
        const iw = document.getElementById('ytf-iframe-wrap');
        const iframe = iw?.querySelector('iframe');
        if (!iframe || !iw) return;
        if (!iframe.src) iframe.src = iframe.dataset.src;
        iw.hidden = false;
        // Hide the thumbnail + play button
        document.getElementById('ytf-play-btn')?.remove();
        wrap.querySelector('.ytf-thumb')?.remove();
      });
    });

    wrap.removeAttribute('hidden');
  }

  /* ── Render: playlist tabs ───────────────────────────────────── */
  function renderTabs(playlists) {
    const el = $('yt-playlist-tabs');
    if (!el) return;

    const allBtn = `
      <button class="playlist-tab-btn active yt-dyn-tab" data-plid="uploads">
        ${bi('All Videos','ሁሉም ቪዲዮዎች')}
      </button>`;

    const plBtns = playlists.map(pl => {
      const raw  = pl.snippet?.title || 'Playlist';
      const name = raw.length > 32 ? raw.slice(0, 30) + '…' : raw;
      return `<button class="playlist-tab-btn yt-dyn-tab" data-plid="${pl.id}" title="${raw}">${name}</button>`;
    }).join('');

    el.innerHTML = allBtn + plBtns;

    el.querySelectorAll('.yt-dyn-tab').forEach(btn => {
      btn.addEventListener('click', async () => {
        el.querySelectorAll('.yt-dyn-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        S.activePlaylistId = btn.dataset.plid === 'uploads' ? S.uploadsId : btn.dataset.plid;
        S.videos = [];
        S.nextPageToken = null;
        S.searchActive = false;
        clearSearch();
        updateGridHeading();
        skeletons(8);
        await loadVideos();
      });
    });
  }

  /* ── Render: video grid ──────────────────────────────────────── */
  function renderVideos(videos, append = false) {
    const grid = $('yt-video-grid');
    if (!grid) return;

    if (!videos.length) {
      if (!append) {
        grid.innerHTML = `<p class="yt-empty">${bi('No videos found.','ቪዲዮ አልተገኘም።')}</p>`;
      }
      return;
    }

    const html = videos.map(v => {
      const id    = vidId(v);
      if (!id) return '';
      const title = (v.snippet?.title || '').replace(/</g,'&lt;');
      const date  = fmtDate(v.snippet?.publishedAt);
      const img   = bestThumb(v) || `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
      return `
        <a class="video-card yt-dyn-card"
           href="${ytLink(id)}" target="_blank" rel="noopener"
           data-title="${title.toLowerCase()}">
          <div class="video-thumb">
            <img src="${img}" alt="${title}"
                 loading="lazy"
                 onerror="this.src='https://img.youtube.com/vi/${id}/mqdefault.jpg'">
            <div class="video-play"><div class="video-play-icon"></div></div>
          </div>
          <div class="video-info">
            <span class="video-date">${date}</span>
            <span class="video-title">${title}</span>
          </div>
        </a>`;
    }).join('');

    if (append) grid.insertAdjacentHTML('beforeend', html);
    else        grid.innerHTML = html;
  }

  /* ── Search ──────────────────────────────────────────────────── */
  function clearSearch() {
    const s = $('yt-search');
    if (s) s.value = '';
  }

  function applySearch(q) {
    S.searchActive = q.trim().length > 0;
    const lq = q.trim().toLowerCase();
    const cards = $$('#yt-video-grid .yt-dyn-card');
    let visible = 0;
    cards.forEach(c => {
      const match = !lq || (c.dataset.title || '').includes(lq);
      c.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    updateLoadMore();
    // Show empty state if nothing matches
    const grid = $('yt-video-grid');
    const empty = grid?.querySelector('.yt-search-empty');
    if (lq && visible === 0) {
      if (!empty) {
        grid.insertAdjacentHTML('beforeend',
          `<p class="yt-empty yt-search-empty">${bi(`No results for "${q}"`,`"${q}" አልተገኘም`)}</p>`);
      }
    } else {
      empty?.remove();
    }
  }

  /* ── Load more ───────────────────────────────────────────────── */
  function updateLoadMore() {
    const wrap = $('yt-load-more-wrap');
    if (!wrap) return;
    wrap.hidden = !S.nextPageToken || S.searchActive;
  }

  /* ── Grid heading ────────────────────────────────────────────── */
  function updateGridHeading() {
    const el = $('yt-grid-title');
    if (!el) return;
    if (!S.activePlaylistId || S.activePlaylistId === S.uploadsId) {
      el.innerHTML = bi('All Videos — ' + (S.channel?.statistics?.videoCount || '') + ' episodes',
                        'ሁሉም ቪዲዮዎች — ' + (S.channel?.statistics?.videoCount || '') + ' ክፍሎች');
    } else {
      const pl = S.playlists.find(p => p.id === S.activePlaylistId);
      el.textContent = pl?.snippet?.title || '';
    }
  }

  /* ── Load videos ─────────────────────────────────────────────── */
  async function loadVideos(append = false) {
    if (S.loading) return;
    S.loading = true;

    const plId  = S.activePlaylistId || S.uploadsId;
    const token = append ? (S.nextPageToken || '') : '';

    try {
      const result = await getPlaylistVideos(plId, token);
      const fresh  = result.items.filter(v => vidId(v)); // skip deleted
      S.nextPageToken = result.nextPageToken;

      if (append) {
        S.videos = [...S.videos, ...fresh];
        renderVideos(fresh, true);
      } else {
        S.videos = fresh;
        renderVideos(S.videos);
      }

      updateLoadMore();
    } catch (err) {
      const grid = $('yt-video-grid');
      if (grid && !append) {
        grid.innerHTML = `<p class="yt-error">
          ${bi('Could not load videos — please try again shortly.',
               'ቪዲዮዎቹ ሊጫኑ አልተቻለም — ቆይተው ይሞክሩ።')}
        </p>`;
      }
    } finally {
      S.loading = false;
    }
  }

  /* ── Show static fallback (no API key) ───────────────────────── */
  function showStaticMode() {
    // Static channel banner, tabs, and videos remain in place.
    // app.js handles .playlist-tab-btn clicks for static filtering.
  }

  /* ── Setup search for static cards ──────────────────────────── */
  function bindStaticSearch() {
    const s = $('yt-search');
    if (!s) return;
    s.addEventListener('input', e => {
      clearTimeout(S.searchTimer);
      S.searchTimer = setTimeout(() => {
        const q = e.target.value.trim().toLowerCase();
        $$('#yt-video-grid .video-card').forEach(c => {
          const title = (c.querySelector('.video-title')?.textContent || '').toLowerCase();
          c.style.display = (!q || title.includes(q)) ? '' : 'none';
        });
      }, 250);
    });
  }

  /* ── Main init ───────────────────────────────────────────────── */
  async function init() {
    if (!$('youtube')) return; // only on resources.html

    // Always bind search (works for static cards too)
    bindStaticSearch();

    if (!CFG.API_KEY) {
      showStaticMode();
      return;
    }

    try {
      /* 1 — Channel (fetch first; only replace static content once we know it works) */
      S.channel = await getChannel();
      S.uploadsId = S.channel.contentDetails?.relatedPlaylists?.uploads;
      S.activePlaylistId = S.uploadsId;
      renderBanner(S.channel);
      skeletons(8);

      /* 2 — First batch of videos */
      await loadVideos();

      /* 3 — Feature the first video */
      if (S.videos.length) renderFeatured(S.videos[0]);

      /* 4 — Grid heading */
      updateGridHeading();

      /* 5 — Playlists (async, doesn't block) */
      getPlaylists(S.channel.id)
        .then(pls => { S.playlists = pls; renderTabs(pls); })
        .catch(() => renderTabs([]));

      /* 6 — Search */
      const searchEl = $('yt-search');
      if (searchEl) {
        searchEl.addEventListener('input', e => {
          clearTimeout(S.searchTimer);
          S.searchTimer = setTimeout(() => applySearch(e.target.value), 280);
        });
        searchEl.addEventListener('keydown', e => {
          if (e.key === 'Escape') { searchEl.value = ''; applySearch(''); }
        });
      }

      /* 7 — Load more */
      const loadMoreBtn = $('yt-load-more');
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
          loadMoreBtn.disabled = true;
          loadMoreBtn.innerHTML = '<span class="yt-spinner"></span>';
          await loadVideos(true);
          loadMoreBtn.disabled = false;
          loadMoreBtn.innerHTML = bi('Load more videos', 'ተጨማሪ ቪዲዮዎች');
        });
      }

    } catch (err) {
      console.warn('[Lejochachen YouTube]', err.message);
      showStaticMode();
    }
  }

  /* ── Boot ────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
