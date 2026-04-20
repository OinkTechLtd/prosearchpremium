const state = {
  tab: 'web',
  userId: localStorage.getItem('propoisk.userId') || crypto.randomUUID(),
  profile: null,
  services: [],
  activeQuery: ''
};

localStorage.setItem('propoisk.userId', state.userId);

const el = {
  query: document.getElementById('query'),
  searchBtn: document.getElementById('searchBtn'),
  voiceBtn: document.getElementById('voiceBtn'),
  tabs: [...document.querySelectorAll('.tab')],
  results: document.getElementById('results'),
  menu: document.getElementById('servicesMenu'),
  overlay: document.getElementById('overlay'),
  modalTitle: document.getElementById('modalTitle'),
  modalContent: document.getElementById('modalContent'),
  closeModal: document.getElementById('closeModal'),
  openProfile: document.getElementById('openProfile'),
  toggleIncognito: document.getElementById('toggleIncognito'),
  cookieBanner: document.getElementById('cookieBanner'),
  acceptCookies: document.getElementById('acceptCookies')
};

const isPremiumActive = () => {
  if (!state.profile?.premiumUntil) return false;
  return new Date(state.profile.premiumUntil) > new Date();
};

function askPin(message = 'Введите PIN-код') {
  return prompt(message) || '';
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Ошибка API');
  return data;
}

function showCookiesBanner() {
  const accepted = localStorage.getItem('propoisk.cookiesAccepted');
  if (!accepted) el.cookieBanner.classList.remove('hidden');
}

function setIncognitoLabel() {
  el.toggleIncognito.textContent = state.profile?.incognito ? 'Выйти из инкогнито' : 'Инкогнито';
}

function openModal(title, htmlOrNode) {
  el.modalTitle.textContent = title;
  el.modalContent.innerHTML = '';
  if (typeof htmlOrNode === 'string') {
    el.modalContent.innerHTML = htmlOrNode;
  } else {
    el.modalContent.appendChild(htmlOrNode);
  }
  el.overlay.classList.remove('hidden');
}

function openFrame(title, url) {
  const frame = document.createElement('iframe');
  frame.src = url;
  frame.loading = 'lazy';
  openModal(title, frame);
}

async function loadProfile() {
  const data = await api('/api/profile/init', {
    method: 'POST',
    body: JSON.stringify({ userId: state.userId })
  });
  state.profile = data.profile;
  setIncognitoLabel();

  if (!state.profile.pinHash) {
    const pin = askPin('Создайте PIN-код для входа в ProPoisk (4+ символа)');
    if (pin.length >= 4) {
      state.profile = (await api('/api/profile/update', {
        method: 'POST',
        body: JSON.stringify({ userId: state.userId, patch: { pinHash: btoa(pin) } })
      })).profile;
      alert('PIN сохранён.');
    }
  } else {
    const pin = askPin('Введите PIN-код для входа');
    if (btoa(pin) !== state.profile.pinHash) {
      alert('Неверный PIN-код. Доступ ограничен.');
      document.body.innerHTML = '<h1 style="padding:40px">Доступ запрещён.</h1>';
    }
  }
}

async function loadServices() {
  state.services = await fetch('/services.json').then((r) => r.json());
  el.menu.innerHTML = '';

  state.services.forEach((service) => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = service.title;
    btn.onclick = () => {
      if (service.premium && !isPremiumActive()) {
        alert('Сервис защищен One Premium. Оформите подписку.');
        return;
      }
      openFrame(service.title, service.url);
    };
    el.menu.appendChild(btn);
  });
}

function renderWeb(results) {
  if (!results.length) {
    el.results.innerHTML = '<div class="card">Ничего не найдено.</div>';
    return;
  }

  el.results.innerHTML = results.map((r) => `
      <article class="card">
        <h4>${r.title || 'Без названия'}</h4>
        <p>${r.snippet || ''}</p>
        <a href="${r.url}" target="_blank" rel="noopener">${r.url}</a>
        <div style="margin-top:8px">
          <button class="btn" data-open="${encodeURIComponent(r.url)}" data-title="${encodeURIComponent(r.title || 'Сайт')}">
            Открыть в mini-app
          </button>
        </div>
      </article>
    `).join('');
}

function renderImages(results) {
  el.results.innerHTML = `
    <div class="grid">
      ${results.map((r) => `
      <article class="card img-card">
        <img src="${r.thumbnail || r.image}" alt="${r.title || ''}" loading="lazy" />
        <h4>${r.title || 'Изображение'}</h4>
        <button class="btn" data-open="${encodeURIComponent(r.image)}" data-title="${encodeURIComponent('Изображение')}">
          Открыть
        </button>
      </article>`).join('')}
    </div>
  `;
}

function renderVideos(results) {
  if (!results.length) {
    el.results.innerHTML = '<div class="card">Видео не найдено.</div>';
    return;
  }

  el.results.innerHTML = results.map((r) => `
    <article class="card">
      <h4>${r.title || 'Видео'}</h4>
      <p>${r.description || ''}</p>
      <small>${r.provider || ''} • ${r.duration || ''}</small>
      <div style="margin-top:8px">
        <button class="btn" data-open-video="${encodeURIComponent(r.embed || r.content)}" data-title="${encodeURIComponent(r.title || 'Видео')}">
          Смотреть внутри ProPoisk
        </button>
      </div>
    </article>
  `).join('');
}

async function runSearch() {
  const q = el.query.value.trim();
  if (!q) return;
  state.activeQuery = q;

  if (!state.profile.incognito) {
    await api('/api/profile/history', {
      method: 'POST',
      body: JSON.stringify({ userId: state.userId, query: q })
    });
  }

  el.results.innerHTML = '<div class="card">Ищем...</div>';
  try {
    const data = await api(`/api/search/${state.tab}?q=${encodeURIComponent(q)}`);
    if (state.tab === 'web') renderWeb(data.results);
    if (state.tab === 'images') renderImages(data.results);
    if (state.tab === 'videos') renderVideos(data.results);
  } catch (error) {
    el.results.innerHTML = `<div class="card">${error.message}</div>`;
  }
}

function handleVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert('Голосовой ввод не поддерживается браузером.');
    return;
  }

  const rec = new SR();
  rec.lang = 'ru-RU';
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    el.query.value = text;
    runSearch();
  };

  rec.onerror = () => alert('Ошибка голосового ввода.');
  rec.start();
}

function renderProfile() {
  const premium = isPremiumActive()
    ? `Активна до ${new Date(state.profile.premiumUntil).toLocaleString('ru-RU')}`
    : 'Не активна';

  const history = (state.profile.history || []).slice(0, 10).map((i) => `<li>${i.query}</li>`).join('');

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div style="padding: 12px; display: grid; gap: 10px;">
      <strong>OINK ID: ${state.userId}</strong>
      <label>Имя <input id="pName" value="${state.profile.displayName || ''}" /></label>
      <label>Фото URL <input id="pAvatar" value="${state.profile.avatar || ''}" /></label>
      <button class="btn" id="saveProfile">Сохранить профиль</button>
      <div>One Premium: ${premium}</div>
      <div>Oink Stars: <b>${state.profile.stars}</b></div>
      <button class="btn" id="dailyStars">Забрать +10 ежедневно</button>
      <button class="btn" id="buyPremium">Купить 30 дней за 15000</button>
      <hr />
      <h4>Реферальная программа</h4>
      <input id="cTitle" placeholder="Название компании/игры/приложения" />
      <input id="cType" placeholder="Тип" />
      <input id="cImage" placeholder="Фото URL" />
      <input id="cLink" placeholder="Ссылка" />
      <button class="btn" id="createReferral">Создать реферальную ссылку</button>
      <div id="refLink"></div>
      <hr />
      <h4>История запросов</h4>
      <ul>${history || '<li>Пусто</li>'}</ul>
    </div>
  `;

  openModal('Профиль ProPoisk Premium', wrap);

  wrap.querySelector('#saveProfile').onclick = async () => {
    const patch = {
      displayName: wrap.querySelector('#pName').value,
      avatar: wrap.querySelector('#pAvatar').value
    };
    state.profile = (await api('/api/profile/update', {
      method: 'POST', body: JSON.stringify({ userId: state.userId, patch })
    })).profile;
    alert('Сохранено.');
  };

  wrap.querySelector('#dailyStars').onclick = async () => {
    try {
      state.profile = (await api('/api/stars/daily', {
        method: 'POST', body: JSON.stringify({ userId: state.userId })
      })).profile;
      alert('Получено +10 Oink Stars.');
      renderProfile();
    } catch (error) {
      alert(error.message);
    }
  };

  wrap.querySelector('#buyPremium').onclick = async () => {
    try {
      state.profile = (await api('/api/premium/buy', {
        method: 'POST', body: JSON.stringify({ userId: state.userId })
      })).profile;
      alert('One Premium активирована.');
      renderProfile();
    } catch (error) {
      alert(error.message);
    }
  };

  wrap.querySelector('#createReferral').onclick = async () => {
    try {
      const body = {
        userId: state.userId,
        title: wrap.querySelector('#cTitle').value,
        type: wrap.querySelector('#cType').value,
        image: wrap.querySelector('#cImage').value,
        link: wrap.querySelector('#cLink').value
      };
      const data = await api('/api/referrals/campaign', {
        method: 'POST', body: JSON.stringify(body)
      });
      wrap.querySelector('#refLink').innerHTML = `
        <div class="gate">
          Ссылка: <code>${data.referralUrl}</code>
          <button class="btn" id="copyRef">Копировать</button>
        </div>
      `;
      wrap.querySelector('#copyRef').onclick = async () => {
        await navigator.clipboard.writeText(data.referralUrl);
        alert('Скопировано.');
      };
    } catch (error) {
      alert(error.message);
    }
  };
}

async function handleReferralFromUrl() {
  const params = new URLSearchParams(location.search);
  const code = params.get('ref');
  if (!code) return;

  try {
    const campaignData = await api(`/api/referrals/${code}`);
    const yes = confirm(`Активировать ${campaignData.campaign.title} x ProPoisk? (доступен 1 раз)`);
    if (!yes) return;
    const data = await api('/api/referrals/redeem', {
      method: 'POST',
      body: JSON.stringify({ userId: state.userId, code })
    });
    state.profile = data.profile;
    alert(data.message);
    history.replaceState({}, '', '/');
  } catch (error) {
    alert(error.message);
  }
}

function bindEvents() {
  el.searchBtn.onclick = runSearch;
  el.voiceBtn.onclick = handleVoice;
  el.closeModal.onclick = () => el.overlay.classList.add('hidden');
  el.openProfile.onclick = renderProfile;

  el.acceptCookies.onclick = () => {
    localStorage.setItem('propoisk.cookiesAccepted', '1');
    el.cookieBanner.classList.add('hidden');
  };

  el.tabs.forEach((tab) => {
    tab.onclick = () => {
      state.tab = tab.dataset.tab;
      el.tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      if (state.activeQuery) runSearch();
    };
  });

  el.results.addEventListener('click', (event) => {
    const openBtn = event.target.closest('[data-open]');
    if (openBtn) {
      const url = decodeURIComponent(openBtn.dataset.open);
      const title = decodeURIComponent(openBtn.dataset.title || 'Мини-приложение');
      openFrame(title, url);
      return;
    }

    const openVideoBtn = event.target.closest('[data-open-video]');
    if (openVideoBtn) {
      const url = decodeURIComponent(openVideoBtn.dataset.openVideo);
      const title = decodeURIComponent(openVideoBtn.dataset.title || 'Видео');
      openFrame(title, url);
    }
  });

  el.toggleIncognito.onclick = async () => {
    const pin = askPin('Подтвердите PIN-код для переключения инкогнито');
    if (btoa(pin) !== state.profile.pinHash) {
      alert('Неверный PIN.');
      return;
    }

    state.profile = (await api('/api/profile/update', {
      method: 'POST',
      body: JSON.stringify({
        userId: state.userId,
        patch: { incognito: !state.profile.incognito }
      })
    })).profile;

    setIncognitoLabel();
    alert(state.profile.incognito ? 'Инкогнито включено.' : 'Инкогнито выключено.');
  };
}

(async function bootstrap() {
  showCookiesBanner();
  await loadProfile();
  await loadServices();
  bindEvents();
  await handleReferralFromUrl();
})();
