/* ── Language toggle ── */
const root = document.body;

function applyPlaceholders(lang) {
  document.querySelectorAll('[data-placeholder-en]').forEach(el => {
    el.placeholder = lang === 'am' ? (el.dataset.placeholderAm || '') : (el.dataset.placeholderEn || '');
  });
}

document.querySelectorAll('[data-set-lang]').forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.setLang;
    root.setAttribute('data-lang', lang);
    document.querySelectorAll('.lang-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.setLang === lang)
    );
    applyPlaceholders(lang);
  });
});

/* Apply placeholders on load */
applyPlaceholders(root.dataset.lang || 'en');

/* ── Active navigation ── */
function updateActiveNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a[href]').forEach(link => {
    const href = link.getAttribute('href');
    const [targetPageRaw, targetHash] = href.split('#');
    const targetPage = targetPageRaw || currentPage;
    const isCurrentPage = targetPage === currentPage || (currentPage === '' && targetPage === 'index.html');

    link.removeAttribute('aria-current');
    if (isCurrentPage && !targetHash) {
      link.setAttribute('aria-current', 'page');
    } else if (isCurrentPage && window.location.hash === `#${targetHash}`) {
      link.setAttribute('aria-current', 'location');
    }
  });
}

updateActiveNav();
window.addEventListener('hashchange', updateActiveNav);

/* ── Gallery image handling ── */
document.querySelectorAll('img[data-gallery-img]').forEach(img => {
  img.addEventListener('error', () => {
    const removable = img.closest('[data-gallery-card]');
    if (removable) {
      removable.remove();
    } else {
      img.remove();
    }
  });
});

/* ── Donation tabs ── */
document.querySelectorAll('.donation-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const group = tab.dataset.tabGroup || 'default';
    document.querySelectorAll(`.donation-tab[data-tab-group="${group}"]`).forEach(t => t.classList.remove('active'));
    document.querySelectorAll(`.donation-panel[data-tab-group="${group}"]`).forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById(tab.dataset.tab);
    if (panel) panel.classList.add('active');
  });
});

/* ── Copy to clipboard ── */
document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(btn.dataset.copy).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    });
  });
});

/* ── Contact / volunteer form ── */
const typeSelect = document.getElementById('contact-type');
const volunteerFields = document.getElementById('volunteer-fields');
if (typeSelect && volunteerFields) {
  typeSelect.addEventListener('change', () => {
    volunteerFields.hidden = typeSelect.value !== 'volunteer';
  });
}

const contactForm = document.getElementById('contact-form');
const formResponse = document.getElementById('form-response');
if (contactForm) {
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    if (formResponse) {
      formResponse.textContent = root.dataset.lang === 'am'
        ? 'መልዕክትዎ ደርሷል። ብዙም ሳይቆይ እናነጋግርዎታለን!'
        : 'Your message has been received. We will be in touch soon!';
    }
    contactForm.reset();
    if (volunteerFields) volunteerFields.hidden = true;
  });
}

/* ── Volunteer form (support page) ── */
const volunteerForm = document.getElementById('volunteer-form');
const volResponse = document.getElementById('vol-response');
if (volunteerForm) {
  volunteerForm.addEventListener('submit', e => {
    e.preventDefault();
    if (volResponse) {
      volResponse.textContent = root.dataset.lang === 'am'
        ? 'አመሰግናለን! የፈቃደኝነት ፍላጎትዎ ደርሷል። ብዙም ሳይቆይ እናነጋግርዎታለን።'
        : 'Thank you! Your volunteer interest has been received. We will be in touch soon.';
    }
    volunteerForm.reset();
  });
}

/* ── Join / membership form ── */
const joinForm = document.getElementById('join-form');
const joinResponse = document.getElementById('join-response');
if (joinForm) {
  joinForm.addEventListener('submit', e => {
    e.preventDefault();
    if (joinResponse) {
      joinResponse.textContent = root.dataset.lang === 'am'
        ? 'አመሰግናለን! ብዙም ሳይቆይ እናነጋግርዎታለን።'
        : 'Thank you! We will contact you soon.';
    }
    joinForm.reset();
  });
}

/* ── Ethiopian Baptism Calculator ── */
const baptismForm = document.getElementById('baptism-form');
const baptismResult = document.getElementById('baptism-result');

function gregorianToJdn(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + (12 * a) - 3;
  return day + Math.floor(((153 * m) + 2) / 5) + (365 * y) + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function jdnToGregorian(jdn) {
  const a = jdn + 32044;
  const b = Math.floor(((4 * a) + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor(((4 * c) + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor(((5 * e) + 2) / 153);
  return {
    day: e - Math.floor(((153 * m) + 2) / 5) + 1,
    month: m + 3 - (12 * Math.floor(m / 10)),
    year: (100 * b) + d - 4800 + Math.floor(m / 10)
  };
}

function ethiopianToJdn(year, month, day) {
  return 1723856 + (365 * year) + Math.floor(year / 4) + (30 * month) + day - 31;
}

function jdnToEthiopian(jdn) {
  let year = Math.floor(((4 * (jdn - 1723856)) + 1463) / 1461) - 1;
  while (ethiopianToJdn(year + 1, 1, 1) <= jdn) year += 1;
  while (ethiopianToJdn(year, 1, 1) > jdn) year -= 1;
  const month = Math.floor((jdn - ethiopianToJdn(year, 1, 1)) / 30) + 1;
  const day = jdn - ethiopianToJdn(year, month, 1) + 1;
  return { year, month, day };
}

const ethMonthsEn = ['Meskerem','Tikimt','Hidar','Tahsas','Tir','Yekatit','Megabit','Miyazya','Ginbot','Sene','Hamle','Nehase','Pagume'];
const ethMonthsAm = ['መስከረም','ጥቅምት','ህዳር','ታህሳስ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜ'];
const gregMonthsEn = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatGreg(g) {
  return `${gregMonthsEn[g.month - 1]} ${g.day}, ${g.year}`;
}

function formatEth(e) {
  const lang = root.dataset.lang;
  const months = lang === 'am' ? ethMonthsAm : ethMonthsEn;
  return `${months[Math.min(e.month - 1, 12)]} ${e.day}, ${e.year}`;
}

if (baptismForm && baptismResult) {
  baptismForm.addEventListener('submit', e => {
    e.preventDefault();
    const bdateVal = document.getElementById('bdate').value;
    const gender = document.querySelector('input[name="gender"]:checked')?.value || 'male';
    if (!bdateVal) return;
    const [year, month, day] = bdateVal.split('-').map(Number);
    // Birth date = Day 1 (inclusive boundary). Day 40/80 = birth + 39/79 days.
    const dayCount = gender === 'male' ? 40 : 80;
    const daysToAdd = dayCount - 1; // Day 1 = birth, so Day 40 = birth + 39

    // Ecclesiastical night-birth adjustment: births midnight–5:59 AM align to preceding day's index
    const nightBirth = document.getElementById('night-birth')?.checked;
    const birthJdn = gregorianToJdn(year, month, day) - (nightBirth ? 1 : 0);

    const baptismJdn = birthJdn + daysToAdd;
    const baptismGreg = jdnToGregorian(baptismJdn);
    const baptismEth = jdnToEthiopian(baptismJdn);
    const birthEth = jdnToEthiopian(birthJdn);

    const lang = root.dataset.lang;
    const gLabel = lang === 'am'
      ? (gender === 'male' ? 'ወንድ ልጅ' : 'ሴት ልጅ')
      : (gender === 'male' ? 'Boy' : 'Girl');
    const nightNote = nightBirth
      ? (lang === 'am' ? ' (ሌሊት ልደት — የቀድሞው ቀን ኢንዴክስ ጥቅም ላይ ዋለ)' : ' (Night birth — preceding day index applied)')
      : '';

    baptismResult.innerHTML = `
      <span class="mini-label">${lang === 'am' ? 'የጥምቀት ቀን' : 'Baptism Date'} — ${lang === 'am' ? `${dayCount}ኛ ቀን` : `Day ${dayCount}`}</span>
      <p>
        <strong>${formatGreg(baptismGreg)}</strong>
        <span>${formatEth(baptismEth)}</span>
        <span style="margin-top:8px;font-size:0.9rem;opacity:0.8">
          ${lang === 'am'
            ? `${gLabel} — ${dayCount}ኛ ቀን (ልደት = ቀን 1)${nightNote}`
            : `${gLabel} — Day ${dayCount} (birth = Day 1)${nightNote}`}
        </span>
        <span style="font-size:0.88rem;opacity:0.72;margin-top:4px">
          ${lang === 'am'
            ? `የልደት ቀን: ${formatGreg({year, month, day})} / ${formatEth(birthEth)}`
            : `Birth date: ${formatGreg({year, month, day})} / ${formatEth(birthEth)}`}
        </span>
      </p>`;
    baptismResult.style.display = 'block';
  });
}

/* ── Age Roadmap tabs ── */
document.querySelectorAll('.roadmap-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.closest('.age-roadmap');
    group.querySelectorAll('.roadmap-tab-btn').forEach(b => b.classList.remove('active'));
    group.querySelectorAll('.roadmap-panel').forEach(p => { p.hidden = true; });
    btn.classList.add('active');
    const panel = group.querySelector('#' + btn.dataset.panel);
    if (panel) panel.hidden = false;
  });
});

/* ── Playlist tabs ── */
document.querySelectorAll('.playlist-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.playlist-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.playlist;
    document.querySelectorAll('.video-card').forEach(card => {
      if (target === 'all' || card.dataset.playlist === target) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  });
});
