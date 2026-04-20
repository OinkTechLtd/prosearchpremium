const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;
const STORE_PATH = process.env.STORE_PATH || (process.env.VERCEL ? '/tmp/propoisk-store.json' : path.join(__dirname, 'data', 'store.json'));
const memoryStore = { users: {}, campaigns: {}, referrals: [] };

app.set('trust proxy', true);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function cloneStore(store) {
  return JSON.parse(JSON.stringify(store));
}

function ensureStore() {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(STORE_PATH)) {
      fs.writeFileSync(STORE_PATH, JSON.stringify(memoryStore, null, 2));
    }
    return true;
  } catch (error) {
    return false;
  }
}

function readStore() {
  if (!ensureStore()) return cloneStore(memoryStore);

  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  } catch (error) {
    return cloneStore(memoryStore);
  }
}

function saveStore(store) {
  memoryStore.users = store.users || {};
  memoryStore.campaigns = store.campaigns || {};
  memoryStore.referrals = store.referrals || [];

  if (!ensureStore()) return;

  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  } catch (error) {
    // На serverless-платформах файловая система может быть только для чтения.
  }
}

function mskDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function mskDateTime(date = new Date()) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(date);
}

function extractInstantResults(payload) {
  const results = [];

  if (payload.AbstractURL) {
    results.push({
      title: payload.Heading || 'Официальный ответ',
      url: payload.AbstractURL,
      snippet: payload.AbstractText || 'Краткая справка.'
    });
  }

  const flatten = (topics = []) => {
    topics.forEach((item) => {
      if (item.Topics) {
        flatten(item.Topics);
      } else if (item.FirstURL) {
        results.push({
          title: item.Text?.split(' - ')[0] || 'Результат DuckDuckGo',
          url: item.FirstURL,
          snippet: item.Text || 'Результат из DuckDuckGo Instant Answer'
        });
      }
    });
  };

  flatten(payload.RelatedTopics || []);
  return results.slice(0, 30);
}

async function getDuckVqd(query) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    }
  });
  const html = await response.text();
  const match = html.match(/vqd='([^']+)'/);
  return match ? match[1] : null;
}

function normalizeVideoEmbed(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace('www.', '');

    if (host.includes('youtube.com')) {
      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }

    if (host.includes('youtu.be')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }

    if (host.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : url;
    }

    if (host.includes('dailymotion.com')) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      const idx = parts.indexOf('video');
      const id = idx >= 0 ? parts[idx + 1] : null;
      return id ? `https://www.dailymotion.com/embed/video/${id}` : url;
    }

    if (host.includes('rutube.ru')) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      const idx = parts.indexOf('video');
      const id = idx >= 0 ? parts[idx + 1] : null;
      return id ? `https://rutube.ru/play/embed/${id}` : url;
    }
  } catch (error) {
    return url;
  }

  return url;
}

app.get('/api/search/web', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Введите поисковый запрос.' });

  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&no_redirect=1`;
    const response = await fetch(url);
    const data = await response.json();
    const results = extractInstantResults(data);
    return res.json({ results, source: 'DuckDuckGo Instant Answer API' });
  } catch (error) {
    return res.status(500).json({ error: 'Ошибка при обращении к DuckDuckGo API.' });
  }
});

app.get('/api/search/images', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Введите поисковый запрос.' });

  try {
    const vqd = await getDuckVqd(q);
    if (!vqd) throw new Error('vqd not found');
    const url = `https://duckduckgo.com/i.js?l=ru-ru&o=json&q=${encodeURIComponent(q)}&vqd=${encodeURIComponent(vqd)}&p=1&s=0`;
    const response = await fetch(url, {
      headers: {
        referer: 'https://duckduckgo.com/',
        'x-requested-with': 'XMLHttpRequest',
        'user-agent': 'Mozilla/5.0'
      }
    });
    const data = await response.json();
    const results = (data.results || []).slice(0, 50).map((item) => ({
      image: item.image,
      thumbnail: item.thumbnail,
      title: item.title,
      source: item.url,
      host: item.source
    }));
    return res.json({ results, source: 'DuckDuckGo Images API (i.js)' });
  } catch (error) {
    return res.status(500).json({ error: 'Не удалось получить изображения из DuckDuckGo API.' });
  }
});

app.get('/api/search/videos', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Введите поисковый запрос.' });

  try {
    const vqd = await getDuckVqd(q);
    if (!vqd) throw new Error('vqd not found');
    const url = `https://duckduckgo.com/v.js?l=ru-ru&o=json&q=${encodeURIComponent(q)}&vqd=${encodeURIComponent(vqd)}&p=1&s=0`;
    const response = await fetch(url, {
      headers: {
        referer: 'https://duckduckgo.com/',
        'x-requested-with': 'XMLHttpRequest',
        'user-agent': 'Mozilla/5.0'
      }
    });
    const data = await response.json();
    const results = (data.results || []).slice(0, 50).map((item) => ({
      title: item.title,
      description: item.description,
      duration: item.duration,
      published: item.published,
      content: item.content,
      embed: normalizeVideoEmbed(item.content),
      image: item.images?.small || item.images?.medium || '',
      provider: item.provider
    }));
    return res.json({ results, source: 'DuckDuckGo Videos API (v.js)' });
  } catch (error) {
    return res.status(500).json({ error: 'Не удалось получить видео из DuckDuckGo API.' });
  }
});

app.post('/api/profile/init', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId обязателен' });

  const store = readStore();
  if (!store.users[userId]) {
    store.users[userId] = {
      userId,
      displayName: 'Пользователь ProPoisk',
      avatar: '',
      pinHash: '',
      stars: 0,
      premiumUntil: null,
      history: [],
      incognito: false,
      dailyClaimAt: null,
      createdAt: new Date().toISOString()
    };
    saveStore(store);
  }

  return res.json({ profile: store.users[userId], mskNow: mskDateTime() });
});

app.post('/api/profile/update', (req, res) => {
  const { userId, patch } = req.body;
  if (!userId || !patch) return res.status(400).json({ error: 'userId и patch обязательны' });

  const store = readStore();
  const profile = store.users[userId];
  if (!profile) return res.status(404).json({ error: 'Профиль не найден' });

  const allowed = ['displayName', 'avatar', 'pinHash', 'incognito'];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      profile[key] = patch[key];
    }
  }

  saveStore(store);
  return res.json({ profile });
});

app.post('/api/profile/history', (req, res) => {
  const { userId, query } = req.body;
  const store = readStore();
  const profile = store.users[userId];
  if (!profile) return res.status(404).json({ error: 'Профиль не найден' });
  if (!profile.incognito && query) {
    profile.history.unshift({ query, at: new Date().toISOString() });
    profile.history = profile.history.slice(0, 100);
    saveStore(store);
  }
  return res.json({ history: profile.history });
});

app.post('/api/stars/daily', (req, res) => {
  const { userId } = req.body;
  const store = readStore();
  const profile = store.users[userId];
  if (!profile) return res.status(404).json({ error: 'Профиль не найден' });

  const todayMsk = mskDateKey();
  const lastMsk = profile.dailyClaimAt ? mskDateKey(new Date(profile.dailyClaimAt)) : null;

  if (todayMsk === lastMsk) {
    return res.status(400).json({ error: 'Сегодня бонус уже получен. Возвращайтесь завтра в это же время по МСК.' });
  }

  profile.stars += 10;
  profile.dailyClaimAt = new Date().toISOString();
  saveStore(store);
  return res.json({ profile, message: 'Вы получили 10 Oink Stars.' });
});

app.post('/api/premium/buy', (req, res) => {
  const { userId } = req.body;
  const store = readStore();
  const profile = store.users[userId];
  if (!profile) return res.status(404).json({ error: 'Профиль не найден' });

  const price = 15000;
  if (profile.stars < price) {
    return res.status(400).json({ error: `Нужно ${price} Oink Stars.` });
  }

  profile.stars -= price;
  const now = new Date();
  const base = profile.premiumUntil && new Date(profile.premiumUntil) > now ? new Date(profile.premiumUntil) : now;
  base.setDate(base.getDate() + 30);
  profile.premiumUntil = base.toISOString();
  saveStore(store);
  return res.json({ profile, message: 'Подписка One Premium активирована на 30 дней.' });
});

app.post('/api/referrals/campaign', (req, res) => {
  const { userId, title, type, image, link } = req.body;
  if (!userId || !title || !type || !link) {
    return res.status(400).json({ error: 'userId, title, type и link обязательны' });
  }

  const store = readStore();
  if (!store.users[userId]) return res.status(404).json({ error: 'Профиль не найден' });

  const code = nanoid(10);
  store.campaigns[code] = {
    code,
    owner: userId,
    title,
    type,
    image: image || '',
    link,
    used: false,
    usedBy: null,
    createdAt: new Date().toISOString()
  };

  saveStore(store);
  return res.json({
    campaign: store.campaigns[code],
    referralUrl: `${req.protocol}://${req.get('host')}/r/${code}`
  });
});

app.post('/api/referrals/redeem', (req, res) => {
  const { userId, code } = req.body;
  const store = readStore();
  const campaign = store.campaigns[code];
  const user = store.users[userId];

  if (!campaign) return res.status(404).json({ error: 'Реферальная ссылка не найдена' });
  if (!user) return res.status(404).json({ error: 'Профиль не найден' });
  if (campaign.owner === userId) return res.status(400).json({ error: 'Нельзя активировать свою ссылку' });
  if (campaign.used) return res.status(400).json({ error: 'Реферальная ссылка уже использована' });

  campaign.used = true;
  campaign.usedBy = userId;

  const owner = store.users[campaign.owner];
  if (owner) owner.stars += 500;

  user.stars += 250;
  const now = new Date();
  now.setDate(now.getDate() + 14);
  user.premiumUntil = now.toISOString();

  store.referrals.push({
    code,
    owner: campaign.owner,
    usedBy: userId,
    usedAt: new Date().toISOString()
  });

  saveStore(store);

  return res.json({
    message: `${campaign.title} x ProPoisk активировано. +14 дней One Premium начислено.`,
    profile: user,
    ownerStarsAwarded: 500,
    userStarsAwarded: 250
  });
});

app.get('/api/referrals/:code', (req, res) => {
  const { code } = req.params;
  const store = readStore();
  const campaign = store.campaigns[code];
  if (!campaign) return res.status(404).json({ error: 'Ссылка не найдена' });
  return res.json({ campaign });
});

app.get('/r/:code', (req, res) => {
  const code = req.params.code;
  return res.redirect(`/?ref=${encodeURIComponent(code)}`);
});

app.get('/health', (_, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    ensureStore();
    console.log(`ProPoisk Premium запущен: http://localhost:${PORT}`);
  });
}

module.exports = app;
