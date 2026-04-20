const stateKey = 'propoisk_state_v1';
const defaultState = {
  profile: { id: crypto.randomUUID(), name: '', avatar: '' },
  pin: '',
  stars: 0,
  premiumUntil: null,
  lastRewardMs: null,
  history: [],
  campaigns: [],
  claimedRefs: {},
  incognito: false,
  cookiesAccepted: false,
};

let currentTab = 'web';
let state = loadState();

const $ = (id) => document.getElementById(id);
const results = $('results');
const modal = $('appModal');
const modalBody = $('modalBody');
const modalTitle = $('modalTitle');

init();

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(stateKey) || '{}') };
  } catch {
    return structuredClone(defaultState);
  }
}
function saveState() { localStorage.setItem(stateKey, JSON.stringify(state)); }
function isPremium() { return state.premiumUntil && Date.now() < state.premiumUntil; }

function init() {
  initPinFlow();
  bindUI();
  loadServices();
  hydrateProfile();
  handleReferralFromURL();
  if (!state.cookiesAccepted) $('cookieBanner').classList.remove('hidden');
}

function initPinFlow() {
  const overlay = $('pinOverlay');
  const input = $('pinInput');
  const text = $('pinText');
  const btn = $('pinActionBtn');
  overlay.classList.remove('hidden');

  btn.onclick = () => {
    const v = input.value.trim();
    if (!v) return alert('Введите PIN');

    if (!state.pin) {
      state.pin = v;
      saveState();
      overlay.classList.add('hidden');
      return;
    }
    if (v !== state.pin) return alert('Неверный PIN');
    overlay.classList.add('hidden');
  };

  if (state.pin) text.textContent = 'Введите PIN-код для входа.';
}

function bindUI() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
    };
  });

  $('searchBtn').onclick = runSearch;
  $('searchInput').addEventListener('keydown', (e) => e.key === 'Enter' && runSearch());
  $('voiceBtn').onclick = startVoice;
  $('profileBtn').onclick = () => $('profilePanel').classList.toggle('hidden');
  $('modalClose').onclick = closeModal;
  $('cookieAccept').onclick = () => { state.cookiesAccepted = true; saveState(); $('cookieBanner').classList.add('hidden'); };

  $('incognitoBtn').onclick = () => {
    const pin = prompt('Введите PIN для переключения инкогнито');
    if (pin !== state.pin) return alert('PIN неверный');
    state.incognito = !state.incognito;
    saveState();
    $('incognitoBtn').textContent = `Инкогнито: ${state.incognito ? 'ON' : 'OFF'}`;
  };

  $('saveProfileBtn').onclick = () => {
    state.profile.name = $('nameInput').value.trim();
    saveState();
    hydrateProfile();
  };

  $('avatarInput').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    state.profile.avatar = b64;
    saveState();
    hydrateProfile();
  };

  $('dailyRewardBtn').onclick = claimDailyReward;
  $('buySubBtn').onclick = buySubscription;
  $('createRefBtn').onclick = createReferral;
}

function hydrateProfile() {
  $('oinkId').textContent = state.profile.id;
  $('nameInput').value = state.profile.name || '';
  $('avatarPreview').src = state.profile.avatar || 'https://placehold.co/72x72';
  $('starsValue').textContent = state.stars;
  $('premiumUntil').textContent = state.premiumUntil ? new Date(state.premiumUntil).toLocaleString('ru-RU') : 'Нет';
  $('historyList').innerHTML = state.history.slice(0, 40).map((h) => `<li>${h}</li>`).join('');
  $('incognitoBtn').textContent = `Инкогнито: ${state.incognito ? 'ON' : 'OFF'}`;
}

async function runSearch() {
  const q = $('searchInput').value.trim();
  if (!q) return;
  if (!state.incognito) {
    state.history.unshift(q);
    state.history = state.history.slice(0, 200);
    saveState();
    hydrateProfile();
  }

  results.innerHTML = '<div class="result-item">Ищу...</div>';

  if (currentTab === 'web') return searchWeb(q);
  if (currentTab === 'images') return searchImages(q);
  return searchVideo(q);
}

async function searchWeb(q) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`;
  const res = await fetch(url);
  const data = await res.json();
  const topics = data.RelatedTopics?.flatMap((t) => (t.Topics ? t.Topics : [t])) || [];

  results.innerHTML = '';
  if (data.AbstractURL) renderResult({ title: data.Heading || q, snippet: data.AbstractText, url: data.AbstractURL });
  topics.slice(0, 12).forEach((t) => {
    if (!t.FirstURL) return;
    renderResult({ title: t.Text?.split(' - ')[0] || 'Результат', snippet: t.Text || '', url: t.FirstURL });
  });
  if (!results.innerHTML) results.innerHTML = '<div class="result-item">По вашему запросу мало структурированных результатов.</div>';
}

function searchImages(q) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`;
  results.innerHTML = `<div class="result-item"><h4>Картинки DuckDuckGo</h4><p>Откройте встроенную галерею.</p><button class="btn primary">Открыть</button></div>`;
  results.querySelector('button').onclick = () => openIframeModal(`Картинки: ${q}`, url);
}

function searchVideo(q) {
  const platforms = [
    { title: 'YouTube', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
    { title: 'Vimeo', url: `https://vimeo.com/search?q=${encodeURIComponent(q)}` },
    { title: 'Dailymotion', url: `https://www.dailymotion.com/search/${encodeURIComponent(q)}` },
    { title: 'Rutube', url: `https://rutube.ru/search/?query=${encodeURIComponent(q)}` },
    { title: 'DuckDuckGo Видео', url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=videos&ia=videos` },
  ];
  results.innerHTML = '';
  platforms.forEach((p) => {
    const el = document.createElement('div');
    el.className = 'result-item';
    el.innerHTML = `<h4>${p.title}</h4><p>Открыть видео внутри ProPoisk (модальное окно).</p><button class="btn">Открыть</button>`;
    el.querySelector('button').onclick = () => openIframeModal(`${p.title}: ${q}`, p.url);
    results.appendChild(el);
  });
}

function renderResult(item) {
  const el = document.createElement('div');
  el.className = 'result-item';
  el.innerHTML = `<h4>${escapeHTML(item.title)}</h4><p>${escapeHTML(item.snippet || '')}</p><button class="btn">Открыть сайт</button>`;
  el.querySelector('button').onclick = () => openIframeModal(item.title, item.url);
  results.appendChild(el);
}

async function loadServices() {
  const menu = $('serviceMenu');
  const data = await fetch('services.json').then((r) => r.json());
  menu.innerHTML = '';
  data.forEach((service) => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = service.title;
    btn.title = service.description;
    const locked = service.premium && !isPremium();
    if (locked) btn.classList.add('locked');
    btn.onclick = () => {
      if (service.premium && !isPremium()) return alert('Сервис защищен. Нужна подписка One Premium.');
      openIframeModal(service.title, service.url);
    };
    menu.appendChild(btn);
  });
}

function openIframeModal(title, url) {
  modalTitle.textContent = title;
  modalBody.innerHTML = `<iframe allow="autoplay; fullscreen; microphone" src="${url}"></iframe>`;
  modal.classList.remove('hidden');
}
function closeModal() { modal.classList.add('hidden'); modalBody.innerHTML = ''; }

function createReferral() {
  const title = $('campTitle').value.trim();
  const image = $('campImage').value.trim();
  const link = $('campLink').value.trim();
  if (!title || !link) return alert('Заполните название и ссылку.');

  const refId = crypto.randomUUID();
  state.campaigns.push({ refId, title, image, link, owner: state.profile.id, createdAt: Date.now() });
  saveState();
  const out = `${location.origin}${location.pathname}?ref=${refId}`;
  $('refOut').value = out;
  navigator.clipboard.writeText(out).catch(() => {});
  alert('Реферальная ссылка создана и скопирована.');
}

function handleReferralFromURL() {
  const ref = new URLSearchParams(location.search).get('ref');
  if (!ref || state.claimedRefs[ref]) return;

  state.claimedRefs[ref] = Date.now();
  state.stars += 100;
  const fourteenDays = 14 * 24 * 3600 * 1000;
  state.premiumUntil = Math.max(state.premiumUntil || 0, Date.now()) + fourteenDays;
  saveState();
  hydrateProfile();

  const campaign = state.campaigns.find((c) => c.refId === ref);
  if (campaign) {
    openCampaignSplash(campaign);
  }
}

function openCampaignSplash(campaign) {
  modalTitle.textContent = `${campaign.title} x ProPoisk`;
  modalBody.innerHTML = `
    <div style="padding:20px;display:grid;gap:10px;">
      <h3>${campaign.title} x ProPoisk</h3>
      ${campaign.image ? `<img src="${campaign.image}" style="max-width:240px;border-radius:12px;">` : ''}
      <p>Ссылка активирована один раз. Вам начислено 100 Oink Stars + 14 дней One Premium.</p>
      <button class="btn primary" id="goCampaign">Перейти к проекту</button>
    </div>`;
  modal.classList.remove('hidden');
  document.getElementById('goCampaign').onclick = () => openIframeModal(campaign.title, campaign.link);
}

function claimDailyReward() {
  const now = new Date();
  const mskNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const last = state.lastRewardMs ? new Date(state.lastRewardMs) : null;
  const canClaim = !last || mskNow.getTime() - last.getTime() >= 24 * 3600 * 1000;

  if (!canClaim) return alert('Ежедневная награда уже получена. Повтор через 24 часа по времени МСК.');
  state.lastRewardMs = mskNow.getTime();
  state.stars += 10;
  if (isPremium()) state.stars += 5;
  saveState();
  hydrateProfile();
}

function buySubscription() {
  if (state.stars < 15000) return alert('Недостаточно Oink Stars. Нужно 15000.');
  state.stars -= 15000;
  const month = 30 * 24 * 3600 * 1000;
  state.premiumUntil = Math.max(state.premiumUntil || 0, Date.now()) + month;
  saveState();
  hydrateProfile();
  loadServices();
}

function startVoice() {
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Speech) return alert('В браузере нет поддержки голосового ввода.');
  const rec = new Speech();
  rec.lang = 'ru-RU';
  rec.onresult = (e) => {
    $('searchInput').value = e.results[0][0].transcript;
    runSearch();
  };
  rec.start();
}

function escapeHTML(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
