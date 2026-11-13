/* Concept-map variant: renders the whole page from content/site-content.json.
   Nothing about the lab is hard-coded here; structure comes from `sections` and `includes`. */
(() => {
  'use strict';

  const ROOT = '../../';                                  // site root relative to this folder
  const DATA_URL = ROOT + 'content/site-content.json';
  const FONT_WAIT_MS = 1500;

  /* ---------- tiny DOM helpers ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  function make(create, tag, props, kids) {
    const node = create(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') node.setAttribute('class', v);
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return node;
  }
  const h = (tag, props, ...kids) => make((t) => document.createElement(t), tag, props, kids);
  const s = (tag, props, ...kids) => make((t) => document.createElementNS(NS, t), tag, props, kids);

  const isAbs = (u) => /^(https?:)?\/\//.test(u) || u.startsWith('mailto:');
  const assetUrl = (p) => ROOT + p.split('/').map(encodeURIComponent).join('/');
  const linkUrl = (u) => (isAbs(u) ? u : assetUrl(u));
  const extLink = (url, ...kids) =>
    h('a', { href: linkUrl(url), target: isAbs(url) ? '_blank' : null, rel: isAbs(url) ? 'noopener' : null }, ...kids);

  /* Inline markdown subset used by the schema: *italic*, **bold**, [label](url), \* */
  const INLINE_SRC = /\\\*|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*(.+?)\*/.source;
  function inline(text) {
    const frag = document.createDocumentFragment();
    const re = new RegExp(INLINE_SRC, 'g');       // own regex per call: inline() recurses
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      if (m[0] === '\\*') frag.append('*');
      else if (m[2]) frag.append(extLink(m[2], inline(m[1])));
      else if (m[3]) frag.append(h('strong', null, inline(m[3])));
      else frag.append(h('em', null, inline(m[4])));
      last = re.lastIndex;
    }
    if (last < text.length) frag.append(text.slice(last));
    return frag;
  }

  function blocks(list) {
    const frag = document.createDocumentFragment();
    for (const b of list) {
      if (b.type === 'paragraph') frag.append(h('p', null, inline(b.text)));
      else if (b.type === 'images') {
        frag.append(h('div', { class: 'figure-row' }, b.images.map((img) =>
          h('figure', { class: 'figure', style: 'margin:0' },
            h('img', { src: assetUrl(img.src), alt: img.alt, decoding: 'async' }),   // eager: no reserved height, so lazy loading would shift anchors
            img.caption && h('figcaption', null, img.caption)))));
      }
    }
    return frag;
  }

  /* ---------- shared filter state ---------- */
  const state = { q: '', tags: new Set(), year: '', type: '', person: '', students: false };
  const listeners = [];
  function update(patch) {
    Object.assign(state, patch);
    listeners.forEach((fn) => fn());
    syncUrl();
  }
  const toggleTag = (id) => {
    const tags = new Set(state.tags);
    tags.has(id) ? tags.delete(id) : tags.add(id);
    update({ tags });
  };
  const hasFilters = () => !!(state.q || state.tags.size || state.year || state.type || state.person || state.students);
  const clearAll = () => update({ q: '', tags: new Set(), year: '', type: '', person: '', students: false });

  function readUrl() {
    const p = new URLSearchParams(location.search);
    state.q = p.get('q') || '';
    state.tags = new Set((p.get('topic') || '').split(',').filter(Boolean));
    state.year = p.get('year') || '';
    state.type = p.get('type') || '';
    state.person = p.get('author') || '';
    state.students = p.get('students') === '1';
  }
  function syncUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.tags.size) p.set('topic', [...state.tags].join(','));
    if (state.year) p.set('year', state.year);
    if (state.type) p.set('type', state.type);
    if (state.person) p.set('author', state.person);
    if (state.students) p.set('students', '1');
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  /* ---------- boot ---------- */
  async function boot() {
    // Opened from disk, fetch() of the JSON is blocked, so use the embedded copy.
    // Served over http, always fetch the JSON so the page never shows stale content.
    let data;
    if (location.protocol === 'file:' && window.SITE_CONTENT) data = window.SITE_CONTENT;
    else {
      try {
        const res = await fetch(DATA_URL);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        data = await res.json();
      } catch (err) {
        data = window.SITE_CONTENT;           // served but JSON unreachable: fall back to the embedded copy
        if (!data) {
          $('#main').replaceChildren(h('div', { class: 'error-box' },
            h('h1', null, "The lab's content didn't load"),
            h('p', null, `The page couldn't read ${DATA_URL} (${err.message}).`),
            h('p', null, 'If you opened this page from disk, generate the embedded copy first:'),
            h('p', null, h('code', null, 'cd content && node validate.mjs')),
            h('p', null, 'Or serve the site folder instead:'),
            h('p', null, h('code', null, 'python3 -m http.server 8000'))));
          return;
        }
      }
    }
    render(data);
  }
  const $ = (sel, root = document) => root.querySelector(sel);

  function render(data) {
    readUrl();
    document.title = data.meta.siteTitle;

    const ctx = indexData(data);
    const visible = data.sections.filter((sec) => sec.visible);
    const renderers = { home: renderHome, about: renderAbout, people: renderPeople, publications: renderPublications, software: renderSoftware };

    const main = $('#main');
    main.replaceChildren();
    for (const sec of visible) {
      const fn = renderers[sec.id];
      if (!fn) { console.warn(`No renderer for section "${sec.id}"`); continue; }
      main.append(fn(data, sec, ctx));
    }
    renderHeader(data, visible);
    renderFooter(data);
    watchSections(visible);

    const mapHost = $('#concept-map');
    if (mapHost) startMap(mapHost, data, ctx);
    listeners.forEach((fn) => fn());
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) requestAnimationFrame(() => target.scrollIntoView());
    }
  }

  function indexData(data) {
    const entries = data.publications.entries.map((e, i) => ({ ...e, _i: i }));
    const tagById = new Map(data.publications.tags.map((t) => [t.id, t]));
    const typeById = new Map(data.publications.types.map((t) => [t.id, t]));
    const memberById = new Map(data.people.members.map((m) => [m.id, m]));
    for (const e of entries) {
      e._hay = [e.authors.map((a) => a.display).join(' '), e.year, e.title, e.venue?.name, (e.editors || []).join(' '), e.publisher, e.note,
        e.tags.map((t) => tagById.get(t)?.label).join(' ')].filter(Boolean).join(' ').toLowerCase();
    }
    return { entries, tagById, typeById, memberById };
  }

  /* ---------- header / footer / nav ---------- */
  function renderHeader(data, visible) {
    const header = $('#site-header');
    const links = visible.map((sec) => h('li', null, h('a', { class: 'nav-link', href: '#' + sec.id, 'data-section': sec.id, onclick: closeMenu }, sec.label)));
    const nav = h('nav', { class: 'nav', id: 'site-nav', 'aria-label': 'Sections' }, h('ul', { class: 'nav-list' }, links));
    const button = h('button', { class: 'menu-button', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'site-nav',
      onclick: () => { const open = nav.classList.toggle('is-open'); button.setAttribute('aria-expanded', String(open)); } }, 'Menu');
    function closeMenu() { nav.classList.remove('is-open'); button.setAttribute('aria-expanded', 'false'); }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    document.addEventListener('click', (e) => {            // a click anywhere outside the open menu closes it
      if (nav.classList.contains('is-open') && !nav.contains(e.target) && !button.contains(e.target)) closeMenu();
    });
    header.replaceChildren(h('div', { class: 'wrap header-inner' },
      h('a', { class: 'brand', href: '#home' }, data.meta.labName.full), button, nav));

    const title = $('.hero-title');
    if (title && 'IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => header.classList.toggle('show-brand', !entry.isIntersecting),
        { rootMargin: `-${56}px 0px 0px 0px` }).observe(title);
    } else header.classList.add('show-brand');
  }

  function renderFooter(data) {
    const updated = data.meta.lastUpdated && new Date(data.meta.lastUpdated + 'T00:00:00')
      .toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    $('#site-footer').replaceChildren(h('div', { class: 'footer-inner' },
      h('span', null, `${data.meta.labName.full}, ${data.meta.institution}`),
      updated && h('span', null, `Content updated ${updated}`)));
  }

  function watchSections(visible) {
    if (!('IntersectionObserver' in window)) return;
    const links = new Map([...document.querySelectorAll('.nav-link')].map((a) => [a.dataset.section, a]));
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) {
        links.forEach((a) => a.classList.remove('is-current'));
        links.get(en.target.id)?.classList.add('is-current');
      }
    }, { rootMargin: '-35% 0px -60% 0px' });
    visible.forEach((sec) => { const el = document.getElementById(sec.id); if (el) io.observe(el); });
  }

  /* ---------- home ---------- */
  function renderHome(data, sec) {
    const [question, lede] = data.home.body;
    const themes = [
      { title: 'Knowledge Diversity', description: 'How people understand complex systems differently, and why those differences matter.' },
      { title: 'Collective Intelligence', description: 'When and how diverse perspectives contribute to shared understanding and better decisions.' },
      { title: 'AI & Computation', description: 'Using computational modeling and AI to represent knowledge and support human decisions.' }
    ];

    const hero = h('div', { class: 'wrap hero' },
      h('div', { class: 'hero-grid' },
        h('div', { class: 'hero-copy' },
          h('h1', { class: 'hero-title' }, h('img', { class: 'hero-logo', src: assetUrl('img/plural-intelligence-logo.png'), alt: 'Plural Intelligence Lab — Knowledge Diversity, Collective Intelligence, Sustainable Futures' })),
          question && h('p', { class: 'hero-question' }, inline(question.text)),
          lede && h('p', { class: 'hero-lede' }, inline(lede.text)),
          h('ul', { class: 'theme-list', 'aria-label': 'Research themes' },
            themes.map((theme, i) => h('li', { class: 'theme-item theme-item-' + (i + 1) },
              h('h2', { class: 'theme-title' }, theme.title),
              h('p', { class: 'theme-description' }, theme.description)))),
          h('p', { class: 'hero-place' }, data.meta.institution)),
        h('div', { class: 'map-wrap' },
          h('div', { class: 'map', id: 'concept-map', role: 'group', 'aria-label': 'Research topics. Select a topic to filter the publications.' }),
          h('p', { class: 'map-caption' }, 'Each box is a research area from the publications below. The lines between boxes represent shared papers between research areas. Select a topic to filter the list.'),
          h('p', { class: 'map-status', id: 'map-status', 'aria-live': 'polite' }))));

    const body = null;

    return h('section', { class: 'section hero-section', id: 'home', style: 'padding-block:0' }, hero, body, h('div', { style: 'height:clamp(12px,2vw,24px)' }));
  }

  /* ---------- about ---------- */
  function renderAbout(data, sec) {
    const research = data.about;
    const projects = research.projects.length
      ? h('div', { class: 'about-projects' },
          h('h3', { class: 'about-subtitle' }, 'Selected Research Projects'),
          research.projects.map((p) => h('article', { class: 'about-project' },
            h('h4', null, p.title), h('p', null, inline(p.description)),
            p.themes && h('p', { class: 'project-themes' }, p.themes),
            p.references?.length && h('div', { class: 'project-ref-section' },
              h('h5', { class: 'project-ref-heading' }, 'Selected publications'),
              h('ul', { class: 'project-refs', 'aria-label': 'Selected publications' },
              p.references.map((r) => h('li', null,
                r.url
                  ? h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.label)
                  : r.label)))),
            p.link && h('a', { href: p.link, target: '_blank', rel: 'noopener noreferrer' }, 'Project information'))))
      : null;
    return h('section', { class: 'section', id: sec.id, 'aria-labelledby': 'about-title' },
      h('div', { class: 'wrap about-layout' },
        h('h2', { class: 'section-title', id: 'about-title' }, 'About'),
        h('div', { class: 'prose about-intro' }, blocks(research.intro)),
        projects,
        h('div', { class: 'about-support' },
          h('h3', { class: 'about-subtitle' }, 'Selected Research Support'),
          h('div', { class: 'prose' }, blocks(research.support)))));
  }

  /* ---------- people ---------- */
  function renderPeople(data, sec) {
    const groups = data.people.groups.map((g) => {
      const people = data.people.members.filter((m) => m.groupId === g.id);
      const lead = g.id === data.people.members.find((m) => m.id === data.meta.principalInvestigatorId)?.groupId;
      return h('div', { class: 'group' },
        h('h3', { class: 'group-heading' }, g.label, g.badge && h('span', { class: 'group-badge' }, g.badge)),
        h('div', { class: lead && people.length === 1 ? '' : 'people-grid' }, people.map((m) => person(m, lead && people.length === 1))));
    });
    return h('section', { class: 'section', id: sec.id, 'aria-labelledby': 'people-title' },
      h('div', { class: 'wrap' }, h('h2', { class: 'section-title', id: 'people-title' }, sec.label), groups));
  }

  function person(m, isLead) {
    const bio = h('div', { class: 'person-bio' }, blocks(m.bio));
    const long = m.bio.reduce((n, b) => n + (b.text ? b.text.length : 0), 0) > 380 && !isLead;
    let toggle = null;
    if (long) {
      bio.classList.add('is-clamped');
      const id = 'bio-' + m.id;
      bio.id = id;
      toggle = h('button', { class: 'link-button', type: 'button', 'aria-expanded': 'false', 'aria-controls': id,
        onclick: () => { const open = bio.classList.toggle('is-clamped') === false; toggle.setAttribute('aria-expanded', String(open)); toggle.textContent = open ? 'Show less' : `Read ${m.name.given || m.name.display}'s full bio`; } },
        `Read ${m.name.given || m.name.display}'s full bio`);
    }
    return h('article', { class: 'person' + (isLead ? ' is-lead' : '') },
      m.photo && h('img', { class: 'person-photo', src: assetUrl(m.photo.src), alt: m.photo.alt, loading: 'lazy', decoding: 'async',
        onload: (e) => { if (e.target.naturalWidth > e.target.naturalHeight) e.target.classList.add('is-wide'); } }),
      h('div', null,
        h('h4', { class: 'person-name' }, m.name.display),
        h('p', { class: 'person-role' }, m.role),
        bio, toggle,
        m.links?.length ? h('p', { class: 'person-links' }, m.links.map((l) => extLink(l.url, l.label))) : null));
  }

  /* ---------- publications ---------- */
  function renderPublications(data, sec, ctx) {
    const { entries, tagById, typeById, memberById } = ctx;
    const tagCounts = countBy(entries.flatMap((e) => e.tags));
    const yearCounts = countBy(entries.map((e) => String(e.year)));
    const typeCounts = countBy(entries.map((e) => e.type));
    const personCounts = countBy(entries.flatMap((e) => [...new Set(e.authors.map((a) => a.personId).filter(Boolean))]));

    const search = h('input', { class: 'search-input', type: 'search', id: 'pub-search', placeholder: 'Search authors, titles, journals', autocomplete: 'off',
      oninput: (e) => update({ q: e.target.value.trim().toLowerCase() }) });

    const chipEls = new Map();
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Topics' },
      data.publications.tags.filter((t) => tagCounts[t.id]).sort((a, b) => tagCounts[b.id] - tagCounts[a.id]).map((t) => {
        const el = h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', onclick: () => toggleTag(t.id) }, t.label, h('span', { class: 'chip-count' }, tagCounts[t.id]));
        chipEls.set(t.id, el);
        return el;
      }));
    const topicHint = h('p', { class: 'hint' });

    const yearSel = select('Year', 'All years', Object.keys(yearCounts).sort((a, b) => b - a).map((y) => [y, `${y} (${yearCounts[y]})`]), (v) => update({ year: v }));
    const typeSel = select('Type', 'All types', data.publications.types.filter((t) => typeCounts[t.id]).map((t) => [t.id, `${t.label} (${typeCounts[t.id]})`]), (v) => update({ type: v }));
    const personSel = select('Lab member as author', 'Anyone',
      Object.keys(personCounts).sort((a, b) => personCounts[b] - personCounts[a]).map((id) => [id, `${memberById.get(id)?.name.display || id} (${personCounts[id]})`]), (v) => update({ person: v }));

    const studentBox = h('input', { type: 'checkbox', id: 'pub-students', onchange: (e) => update({ students: e.target.checked }) });
    const legend = data.publications.legend;

    const panel = h('details', { class: 'filters-panel', id: 'filters-panel' },
      h('summary', null, 'Filter by topic, year, author'),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Topic'), chips, topicHint),
      yearSel.field, typeSel.field, personSel.field,
      h('div', { class: 'field' }, h('label', { class: 'check', for: 'pub-students' }, studentBox, `Includes a ${legend.student.toLowerCase()}`)),
      h('div', { class: 'legend' },
        h('span', null, h('span', { class: 'author is-student' }, 'Underlined'), `: ${legend.student.toLowerCase()}`),
        h('span', null, `Asterisk*: ${legend.undergraduate.toLowerCase()}`)));
    const mq = window.matchMedia('(min-width: 960px)');
    const setOpen = () => { panel.open = mq.matches; };
    setOpen();
    mq.addEventListener('change', setOpen);

    const resultsBar = h('div', { class: 'results-bar' });
    const list = h('div', { id: 'pub-list' });

    function filtered() {
      const terms = state.q.split(/\s+/).filter(Boolean);
      return entries.filter((e) =>
        (!state.year || String(e.year) === state.year) &&
        (!state.type || e.type === state.type) &&
        (!state.person || e.authors.some((a) => a.personId === state.person)) &&
        (!state.students || e.authors.some((a) => a.role === 'student')) &&
        (!state.tags.size || e.tags.some((t) => state.tags.has(t))) &&
        terms.every((t) => e._hay.includes(t)));
    }

    function paint() {
      const rows = filtered();
      // controls mirror state (state can change from the map, URL, or active-filter chips)
      if (search.value.trim().toLowerCase() !== state.q) search.value = state.q;
      yearSel.el.value = state.year; typeSel.el.value = state.type; personSel.el.value = state.person;
      studentBox.checked = state.students;
      chipEls.forEach((el, id) => el.setAttribute('aria-pressed', String(state.tags.has(id))));
      topicHint.textContent = state.tags.size > 1 ? 'Showing papers with any of the selected topics.' : '';

      const active = [
        ...[...state.tags].map((id) => [tagById.get(id)?.label || id, () => toggleTag(id)]),
        state.year && [state.year, () => update({ year: '' })],
        state.type && [typeById.get(state.type)?.label, () => update({ type: '' })],
        state.person && [memberById.get(state.person)?.name.display, () => update({ person: '' })],
        state.students && ['With student co-author', () => update({ students: false })],
        state.q && [`“${state.q}”`, () => update({ q: '' })],
      ].filter(Boolean);

      resultsBar.replaceChildren(
        h('span', { class: 'results-count', role: 'status' }, rows.length === entries.length ? `${entries.length} publications` : `${rows.length} of ${entries.length} publications`),
        ...active.map(([label, off]) => h('button', { class: 'active-chip', type: 'button', 'aria-label': `Remove filter: ${label}`, onclick: off }, label, h('span', { 'aria-hidden': 'true' }, '×'))),
        ...(hasFilters() ? [h('button', { class: 'clear-button', type: 'button', onclick: clearAll }, 'Clear all filters')] : []));

      if (!rows.length) {
        list.replaceChildren(h('div', { class: 'empty' },
          h('p', null, 'No publications match these filters.'),
          h('p', null, 'Remove a filter above, or clear them all to see every publication.'),
          h('button', { class: 'button-link', type: 'button', onclick: clearAll }, 'Clear all filters')));
        return;
      }
      const byYear = new Map();
      for (const e of rows.sort((a, b) => b.year - a.year || (a.sortKey ?? 1e6) - (b.sortKey ?? 1e6) || a._i - b._i)) {
        if (!byYear.has(e.year)) byYear.set(e.year, []);
        byYear.get(e.year).push(e);
      }
      list.replaceChildren(...[...byYear].map(([year, items]) =>
        h('section', { class: 'year-group', 'aria-label': String(year) },
          h('h3', { class: 'year-heading' }, year),
          h('ol', { class: 'pub-list' }, items.map((e) => citation(e, ctx))))));
    }
    listeners.push(paint);

    return h('section', { class: 'section', id: sec.id, 'aria-labelledby': 'pubs-title' },
      h('div', { class: 'wrap' },
        h('h2', { class: 'section-title', id: 'pubs-title' }, sec.label),
        h('div', { class: 'pubs-layout' },
          h('div', { class: 'filters' }, h('label', { class: 'search' }, h('span', { class: 'field-label' }, 'Search'), search), panel),
          h('div', null, resultsBar, list))));
  }

  function select(label, allLabel, options, onChange) {
    const id = 'sel-' + label.toLowerCase().replace(/\W+/g, '-');
    const el = h('select', { class: 'select', id, onchange: (e) => onChange(e.target.value) },
      h('option', { value: '' }, allLabel), options.map(([v, l]) => h('option', { value: v }, l)));
    return { el, field: h('div', { class: 'field' }, h('label', { class: 'field-label', for: id }, label), el) };
  }
  function countBy(list) { return list.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {}); }

  /* Build a citation from the structured fields (or use the override when present). */
  function citation(e, ctx) {
    const cite = h('p', { class: 'pub-cite' });
    if (e.citationOverride) cite.append(inline(e.citationOverride));
    else {
      e.authors.forEach((a, i) => {
        if (i) cite.append(', ');
        cite.append(h('span', { class: 'author' + (a.role === 'student' ? ' is-student' : '') + (state.person && a.personId === state.person ? ' is-match' : '') },
          a.display + (a.role === 'undergraduate' ? '*' : '')));
      });
      cite.append(e.status === 'in-press' ? ' (in press). ' : ` (${e.year}). `);
      cite.append(h('span', { class: 'pub-title' }, e.title.replace(/([^.?!])$/, '$1.') + ' '));
      const v = e.venue;
      const chapter = e.type === 'book-chapter' || e.type === 'report';
      if (e.editors?.length && e.type === 'book-chapter') cite.append(`In ${e.editors.join(', ')} (Eds.), `);
      if (v) {
        cite.append(h('em', null, v.name));
        const vi = (v.volume || '') + (v.issue ? `(${v.issue})` : '');
        if (vi) cite.append(', ' + vi);
        if (v.pages) cite.append((vi ? ': ' : chapter ? ', pp. ' : ', ') + v.pages.replace(/-/g, '–'));
        cite.append('.');
      }
      if (e.publisher) cite.append(' ' + e.publisher.replace(/([^.])$/, '$1.'));
      if (e.note) cite.append(h('span', { class: 'pub-note' }, e.note));
    }
    const meta = h('div', { class: 'pub-meta' },
      e.links.map((l) => extLink(l.url, l.label)).map((a) => (a.classList.add('pub-link'), a)),
      e.tags.map((id) => {
        const t = ctx.tagById.get(id);
        const b = h('button', { class: 'tag-link', type: 'button', 'aria-pressed': String(state.tags.has(id)), 'data-tag': id, onclick: () => toggleTag(id) }, t ? t.label : id);
        return b;
      }));
    return h('li', { class: 'pub', id: 'pub-' + e.id }, cite, meta);
  }

  /* ---------- research ---------- */
  function renderResearch(data, sec) {
    const groups = [['current', 'Current funding'], ['past', 'Selected past funding']];
    const funding = groups.map(([status, title]) => {
      const rows = data.research.funding.filter((f) => f.status === status);
      if (!rows.length) return null;
      return h('div', null,
        h('h3', { class: 'funding-group-title' }, title),
        h('ul', { class: 'funding-list' }, rows.map((f) => h('li', { class: 'funding-row' },
          h('div', { class: 'funding-dates' }, f.endYear ? `${f.startYear}–${f.endYear}` : String(f.startYear)),
          h('div', null, h('p', { class: 'funding-funder' }, f.funder), h('p', { class: 'funding-title' }, f.title))))));
    });
    return h('section', { class: 'section', id: sec.id, 'aria-labelledby': 'research-title' },
      h('div', { class: 'wrap research-grid' },
        h('div', null, h('h2', { class: 'section-title', id: 'research-title' }, sec.label), h('div', { class: 'prose' }, blocks(data.research.intro))),
        h('div', null, funding)));
  }

  /* ---------- software ---------- */
  function renderSoftware(data, sec) {
    const imgs = data.software.body.filter((b) => b.type === 'images');
    const text = data.software.body.filter((b) => b.type !== 'images');
    return h('section', { class: 'section', id: sec.id, 'aria-labelledby': 'software-title' },
      h('div', { class: 'wrap' },
        h('h2', { class: 'section-title', id: 'software-title' }, data.software.name),
        h('p', { class: 'software-tagline' }, data.software.tagline),
        h('div', { class: 'software-grid' },
          h('div', { class: 'prose' }, blocks(text), data.software.links?.length ? h('p', null, data.software.links.map((l) => h('a', { class: 'button-link', href: linkUrl(l.url), target: '_blank', rel: 'noopener' }, l.label))) : null),
          imgs.length ? h('div', { class: 'software-figure' }, blocks(imgs)) : null)));
  }

  /* ---------- teaching (hidden in the current data) ---------- */
  function renderTeaching(data, sec) {
    const t = data.teaching;
    return h('section', { class: 'section', id: sec.id, 'aria-labelledby': 'teaching-title' },
      h('div', { class: 'wrap' },
        h('h2', { class: 'section-title', id: 'teaching-title' }, sec.label),
        h('div', { class: 'prose' }, blocks(t.intro)),
        h('ul', { class: 'course-list' }, t.courses.map((c) => h('li', null, h('span', { class: 'course-code' }, c.code), c.title + (c.note ? ` (${c.note})` : ''))))));
  }

  /* ---------- the concept map ---------- */
  function mapModel(data) {
    const counts = {}, pairs = {};
    for (const e of data.publications.entries) {
      const ts = [...new Set(e.tags)].sort();
      ts.forEach((t) => (counts[t] = (counts[t] || 0) + 1));
      for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) pairs[ts[i] + '|' + ts[j]] = (pairs[ts[i] + '|' + ts[j]] || 0) + 1;
    }
    const nodes = data.publications.tags.filter((t) => counts[t.id]).map((t) => ({ id: t.id, label: t.label, count: counts[t.id] }));
    const all = Object.entries(pairs).map(([k, w]) => { const [a, b] = k.split('|'); return { a, b, w }; });
    const edges = all.filter((e) => e.w >= 2);
    const degree = {};
    edges.forEach((e) => { degree[e.a] = (degree[e.a] || 0) + 1; degree[e.b] = (degree[e.b] || 0) + 1; });
    for (const n of nodes) {          // keep every topic attached to the map
      if (degree[n.id]) continue;
      const best = all.filter((e) => e.a === n.id || e.b === n.id).sort((x, y) => y.w - x.w)[0];
      if (best) edges.push(best);
    }
    return { nodes, edges };
  }

  function wrapLabel(ctx, text, max) {
    const lines = []; let cur = '';
    for (const word of text.split(' ')) {
      const test = cur ? cur + ' ' + word : word;
      if (ctx.measureText(test).width > max && cur) { lines.push(cur); cur = word; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function measure(nodes, W) {
    const g = document.createElement('canvas').getContext('2d');
    const narrow = W < 520;
    for (const n of nodes) {
      n.fs = (narrow ? 11.5 : 13) + Math.min(n.count, 20) * (narrow ? 0.09 : 0.11);
      g.font = `600 ${n.fs}px "Familjen Grotesk", system-ui, sans-serif`;
      n.lines = wrapLabel(g, n.label, narrow ? 88 : 118);
      n.w = Math.ceil(Math.max(...n.lines.map((l) => g.measureText(l).width)) + 22);
      n.h = Math.ceil(n.lines.length * n.fs * 1.18 + 14);
    }
  }

  /* Organic topic placement, using deterministic best-candidate sampling.
     Unlike the former row grid, this spreads labels through the whole canvas
     without forcing them onto straight horizontal or vertical lines.
     Rectangular collision checks keep readable gaps between topic labels. */
  function distributeTopics(nodes, W) {
    const H = W >= 1080 ? 700 : W >= 800 ? 750 : W >= 560 ? 900 : W >= 360 ? 1400 : 2050;
    let seed = 79319;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const placed = [];
    // Place prominent topics first, but preserve node order for rendering.
    const ordered = [...nodes].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
    for (const n of ordered) {
      const marginX = n.w / 2 + 24, marginY = n.h / 2 + 28;
      let best = null, bestScore = -Infinity;
      for (let k = 0; k < 220; k++) {
        const x = marginX + random() * Math.max(0, W - marginX * 2);
        const y = marginY + random() * Math.max(0, H - marginY * 2);
        let minGap = Math.min(x - marginX, W - marginX - x, y - marginY, H - marginY - y) * 0.32;
        let overlaps = 0;
        for (const p of placed) {
          const dx = Math.abs(x - p.x) - (n.w + p.w) / 2 - 32;
          const dy = Math.abs(y - p.y) - (n.h + p.h) / 2 - 38;
          if (dx < 0 && dy < 0) overlaps += Math.min(-dx, -dy) + 1000;
          const gap = Math.hypot(Math.max(0, dx), Math.max(0, dy));
          minGap = Math.min(minGap, gap);
        }
        // Gentle randomness stops max-spacing selection from looking like a lattice.
        const score = minGap + random() * 35 - overlaps;
        if (score > bestScore) { bestScore = score; best = { x, y }; }
      }
      n.x = n.baseX = best.x;
      n.y = n.baseY = best.y;
      placed.push(n);
    }
    return H;
  }

  function startMap(host, data, ctx) {
    const { nodes, edges } = mapModel(data);
    const status = $('#map-status');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let nodeEls = [], edgeEls = [], hover = null, links = [], lastW = 0;
    let animationId = 0, mapVisible = true;

    function build() {
      cancelAnimationFrame(animationId);
      const W = Math.max(280, Math.round(host.clientWidth));
      lastW = W;
      measure(nodes, W);
      const H = distributeTopics(nodes, W);
      const byId = new Map(nodes.map(n => [n.id, n]));
      links = edges.map(e => ({ s: byId.get(e.a), t: byId.get(e.b), w: e.w }));

      const svg = s('svg', { class: 'map-svg', viewBox: `0 0 ${W} ${H}`, height: H, role: 'presentation' });
      const gEdges = s('g'), gNodes = s('g');
      edgeEls = links.map((l) => { const el = s('line', { class: 'edge', 'stroke-width': (1 + l.w * 0.7).toFixed(1) }); gEdges.append(el); return { l, el }; });
      nodeEls = nodes.map((n) => {
        const text = s('text', { 'text-anchor': 'middle', 'font-size': n.fs.toFixed(1) },
          n.lines.map((ln, i) => s('tspan', { x: n.w / 2, y: (n.h - n.lines.length * n.fs * 1.18) / 2 + n.fs * (1.0 + i * 1.18) - 1 }, ln)));
        const g = s('g', { class: 'node', tabindex: '0', role: 'button', 'aria-pressed': 'false', 'aria-label': `${n.label}, ${n.count} papers` },
          s('rect', { width: n.w, height: n.h, rx: 8 }), text,
          s('g', { class: 'badge', transform: `translate(${n.w - 3}, 3)` }, s('circle', { r: 9 }), s('text', { 'text-anchor': 'middle', y: 3.5 }, String(n.count))));
        g.addEventListener('click', () => toggleTag(n.id));
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTag(n.id); } });
        g.addEventListener('mouseenter', () => { hover = n.id; refresh(); });
        g.addEventListener('mouseleave', () => { hover = null; refresh(); });
        gNodes.append(g);
        return { n, g };
      });
      svg.append(gEdges, gNodes);
      host.replaceChildren(svg);

      const draw = (elapsedSeconds) => {
        const active = !reducedMotion.matches && !hover;
        nodes.forEach((n, i) => {
          // Individual movement amplitudes differ by roughly +/-25%.
          // Drift speed is 15% quicker than before; motion remains small
          // relative to the padded separation between boxes.
          const phase = i * 2.39996;
          const amplitudeX = 7 * (0.75 + (i % 5) * 0.125);
          const amplitudeY = 6 * (0.75 + ((i * 3) % 5) * 0.125);
          n.x = n.baseX + (active ? amplitudeX * Math.sin(elapsedSeconds * 1.15 * (0.34 + (i % 4) * 0.055) + phase) : 0);
          n.y = n.baseY + (active ? amplitudeY * Math.cos(elapsedSeconds * 1.15 * (0.27 + (i % 3) * 0.045) + phase) : 0);
        });
        edgeEls.forEach(({ l, el }) => {
          el.setAttribute('x1', l.s.x.toFixed(1));
          el.setAttribute('y1', l.s.y.toFixed(1));
          el.setAttribute('x2', l.t.x.toFixed(1));
          el.setAttribute('y2', l.t.y.toFixed(1));
        });
        nodeEls.forEach(({ n, g }) =>
          g.setAttribute('transform', `translate(${(n.x - n.w / 2).toFixed(1)}, ${(n.y - n.h / 2).toFixed(1)})`));
      };
      draw(0);
      if (!reducedMotion.matches) {
        let lastFrame = -Infinity;
        const tick = (time) => {
          if (!mapVisible) return;
          if (time - lastFrame >= 33) {
            draw(time / 1000);
            lastFrame = time;
          }
          animationId = requestAnimationFrame(tick);
        };
        animationId = requestAnimationFrame(tick);
      }
      refresh();
    }

    function refresh() {
      const focus = hover ? new Set([hover]) : state.tags;
      const near = new Set(focus);
      links.forEach((l) => { if (focus.has(l.s.id)) near.add(l.t.id); if (focus.has(l.t.id)) near.add(l.s.id); });
      nodeEls.forEach(({ n, g }) => {
        g.classList.toggle('is-selected', state.tags.has(n.id));
        g.classList.toggle('is-dim', focus.size > 0 && !near.has(n.id));
        g.setAttribute('aria-pressed', String(state.tags.has(n.id)));
      });
      edgeEls.forEach(({ l, el }) => {
        const on = focus.size > 0 && (focus.has(l.s.id) || focus.has(l.t.id));
        el.classList.toggle('is-on', on); el.classList.toggle('is-dim', focus.size > 0 && !on);
      });
    }

    function paintStatus() {
      if (!state.tags.size) { status.replaceChildren(); return; }
      const n = ctx.entries.filter((e) => e.tags.some((t) => state.tags.has(t))).length;
      const names = [...state.tags].map((id) => ctx.tagById.get(id)?.label).filter(Boolean).join(', ');
      status.replaceChildren(`${n} ${n === 1 ? 'paper' : 'papers'} on ${names}. `, h('a', { href: '#publications' }, 'See the list'));
    }
    listeners.push(() => { refresh(); paintStatus(); });

    const go = () => build();
    new IntersectionObserver(([entry]) => {
      const wasVisible = mapVisible;
      mapVisible = entry.isIntersecting;
      if (mapVisible && !wasVisible) build();
      else if (!mapVisible) cancelAnimationFrame(animationId);
    }, { rootMargin: '160px' }).observe(host);
    reducedMotion.addEventListener?.('change', build);
    const ready = document.fonts && document.fonts.load
      ? Promise.race([document.fonts.load('600 13px "Familjen Grotesk"'), new Promise((r) => setTimeout(r, FONT_WAIT_MS))]) : Promise.resolve();
    ready.then(go);
    let t = 0;
    new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => { if (Math.abs(host.clientWidth - lastW) > 8) build(); }, 150); }).observe(host);
  }

  boot();
})();
