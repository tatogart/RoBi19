// The Robis Telegram bot: the only shop for now.
//   - linking: Settings -> Telegram on the site gives a one-time link
//     t.me/<bot>?start=link_<code>; the bot ties the Telegram account to it
//   - Premium (30 days) for Robits or for Telegram Stars
//   - Robits for Telegram Stars
// It runs inside the Robis server (long polling, no webhook). The token is
// set in Control Center -> Economy -> Telegram Bot and never sent to a page.
// Every handler is guarded: a bad update can't stop the bot.
//   GET  /me/telegram             linked or not, the shop prices
//   POST /me/telegram/link        a one-time link to open in Telegram
//   POST /me/telegram/unlink
//   GET/POST /admin/tgbot         settings, stats, payments
//   POST /admin/tgbot/test        checks the token (getMe)

const TIERS = ['BuildersClub', 'TurboBuildersClub', 'OutrageousBuildersClub'];
const PREMIUM_DAYS = 30;
const MENU = { balance: '💰 Баланс', premium: '⭐ Premium', robits: '💎 Купить Robits', help: 'ℹ️ Помощь' };
const fmt = (n) => Math.trunc(+n || 0).toLocaleString('ru-RU');

export function installTgBot(api, { db, requireUser, requireAdmin, bad, log, hooks, MEMBERSHIPS, MEMBERSHIP_COST, DONATE_PACKS }) {
  const D = db.data;
  if (!D.settings) D.settings = {};
  const S = D.settings.tgbot || (D.settings.tgbot = {});
  const defaults = { on: false, token: '', username: '',
    stars: { BuildersClub: 100, TurboBuildersClub: 200, OutrageousBuildersClub: 400 },
    robitsStars: { r400: 50, r1000: 100, r2500: 230, r5000: 450, r10000: 850 } };
  for (const [k, v] of Object.entries(defaults)) if (S[k] === undefined) S[k] = v;
  // older worlds: the daily reward / invite settings are gone
  for (const k of ['daily', 'refInviter', 'refInvitee', 'refDayCap', 'vkToken']) delete S[k];
  const T = D.tg || (D.tg = {});
  for (const k of ['codes', 'linked']) if (!T[k]) T[k] = {};
  if (!T.payments) T.payments = [];
  if (!T.offset) T.offset = 0;
  const testing = !!process.env.NODE_TEST_CONTEXT;
  const state = { running: false, gen: 0, lastError: '', lastOk: 0 };
  const packs = () => DONATE_PACKS.filter((r) => S.robitsStars['r' + r] > 0);

  // ---------------------------------------------------------------- Telegram
  let call = async (method, params = {}) => {
    const r = await fetch(`https://api.telegram.org/bot${S.token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
    const j = await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }));
    if (!j.ok) { const e = new Error(j.description || 'Telegram error'); e.code = j.error_code; throw e; }
    return j.result;
  };
  const send = (chatId, text, extra = {}) => Promise.resolve().then(() => call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra })).catch((e) => { state.lastError = e.message; });
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const site = () => S.siteUrl || '';
  const userOf = (tgId) => { const u = D.users[T.linked[tgId]]; return u && u.telegram && u.telegram.id === tgId ? u : null; };
  const menu = () => ({ reply_markup: { keyboard: [[{ text: MENU.balance }, { text: MENU.premium }], [{ text: MENU.robits }, { text: MENU.help }]], resize_keyboard: true } });
  const needLink = (chatId) => send(chatId, `Сначала привяжи аккаунт Robis 🔗\n\nНа сайте открой <b>Настройки → Telegram</b> и нажми «Привязать Telegram».${site() ? `\n\n${site()}/settings` : ''}`);
  const premiumName = (tier) => (MEMBERSHIPS[tier] ? MEMBERSHIPS[tier].name : tier);
  const until = (u) => (u.membershipUntil ? new Date(u.membershipUntil).toISOString().slice(0, 10).split('-').reverse().join('.') : 'навсегда');

  // ---------------------------------------------------------------- linking
  function link(tg, chatId, code) {
    const c = T.codes[code];
    if (!c || c.exp < Date.now()) return send(chatId, 'Эта ссылка устарела. Возьми новую на сайте: Настройки → Telegram.');
    delete T.codes[code];
    const u = D.users[c.uid];
    if (!u || u.guest) return send(chatId, 'Аккаунт не найден.');
    // one Telegram per account, one account per Telegram
    const old = userOf(tg.id);
    if (old && old !== u) delete old.telegram;
    if (u.telegram && u.telegram.id !== tg.id) delete T.linked[u.telegram.id];
    u.telegram = { id: tg.id, username: tg.username || '', name: tg.first_name || '', chat: chatId, linkedAt: Date.now() };
    T.linked[tg.id] = u.id;
    db.save();
    return send(chatId, `✅ Готово! Telegram привязан к <b>${esc(u.username)}</b>.\n💰 Баланс: R$ ${fmt(u.robits)}\n\nЗдесь можно купить ${MENU.premium} и ${MENU.robits}.`, menu());
  }

  // ---------------------------------------------------------------- the shop
  function premiumMenu(chatId, tgId) {
    const u = userOf(tgId);
    if (!u) return needLink(chatId);
    const cur = u.membership && u.membership !== 'None' ? `Сейчас: <b>${premiumName(u.membership)}</b> (до ${until(u)})\n\n` : '';
    const lines = TIERS.map((t) => `<b>${premiumName(t)}</b>: +R$ ${MEMBERSHIPS[t].stipend} в день — R$ ${fmt(MEMBERSHIP_COST[t])}${S.stars[t] > 0 ? ` или ⭐ ${S.stars[t]}` : ''}`).join('\n');
    const rows = TIERS.map((t) => [{ text: `${premiumName(t)} · R$ ${fmt(MEMBERSHIP_COST[t])}`, callback_data: 'pr:' + t }, ...(S.stars[t] > 0 ? [{ text: `⭐ ${S.stars[t]}`, callback_data: 'ps:' + t }] : [])]);
    return send(chatId, `⭐ <b>Robis Premium</b> на ${PREMIUM_DAYS} дней\n\n${cur}${lines}\n\n💰 У тебя: R$ ${fmt(u.robits)}`, { reply_markup: { inline_keyboard: rows } });
  }
  function robitsMenu(chatId, tgId) {
    const u = userOf(tgId);
    if (!u) return needLink(chatId);
    const list = packs();
    if (!list.length) return send(chatId, 'Robits сейчас не продаются.');
    const rows = list.map((r) => [{ text: `R$ ${fmt(r)} · ⭐ ${S.robitsStars['r' + r]}`, callback_data: 'rs:' + r }]);
    return send(chatId, `💎 <b>Robits за Telegram Stars</b>\nЗачисляются сразу после оплаты на аккаунт <b>${esc(u.username)}</b>.`, { reply_markup: { inline_keyboard: rows } });
  }
  function buyForRobits(chatId, tgId, tier, sure) {
    const u = userOf(tgId);
    if (!u) return needLink(chatId);
    if (!TIERS.includes(tier)) return send(chatId, 'Такого Premium нет.');
    if (!sure) return send(chatId, `Купить <b>${premiumName(tier)}</b> на ${PREMIUM_DAYS} дней за R$ ${fmt(MEMBERSHIP_COST[tier])}?\nУ тебя R$ ${fmt(u.robits)}.`, { reply_markup: { inline_keyboard: [[{ text: '✅ Купить', callback_data: 'prok:' + tier }, { text: 'Отмена', callback_data: 'no' }]] } });
    const r = hooks.buyMembership(u, tier);
    if (!r || r.error) return send(chatId, '❌ ' + esc((r && r.error) || 'Не получилось.'));
    return send(chatId, `🎉 <b>${premiumName(tier)}</b> твой до ${until(u)}!\n💰 Осталось: R$ ${fmt(u.robits)}`);
  }
  // a Stars invoice: "prem:<tier>:<uid>" or "rob:<amount>:<uid>"
  function invoice(chatId, tgId, kind, what) {
    const u = userOf(tgId);
    if (!u) return needLink(chatId);
    let title, description, stars;
    if (kind === 'prem') {
      if (!TIERS.includes(what) || !(S.stars[what] > 0)) return send(chatId, 'Этот Premium сейчас нельзя купить за Stars.');
      const order = Object.keys(MEMBERSHIPS);
      if (order.indexOf(u.membership || 'None') > order.indexOf(what)) return send(chatId, `У тебя уже ${premiumName(u.membership)} — это лучше.`);
      title = `${premiumName(what)} · ${PREMIUM_DAYS} дней`;
      description = `Robis Premium для ${u.username}: +R$ ${MEMBERSHIPS[what].stipend} каждый день.`;
      stars = S.stars[what];
    } else {
      const amount = +what;
      if (!DONATE_PACKS.includes(amount) || !(S.robitsStars['r' + amount] > 0)) return send(chatId, 'Этот пак сейчас не продаётся.');
      title = `R$ ${fmt(amount)}`;
      description = `${fmt(amount)} Robits на аккаунт ${u.username}.`;
      stars = S.robitsStars['r' + amount];
    }
    return Promise.resolve().then(() => call('sendInvoice', { chat_id: chatId, title, description, payload: `${kind}:${what}:${u.id}`, currency: 'XTR', prices: [{ label: title, amount: stars }] }))
      .catch((e) => send(chatId, 'Не получилось выставить счёт: ' + esc(e.message)));
  }
  const priceOf = (kind, what) => (kind === 'prem' ? S.stars[what] : S.robitsStars['r' + what]);
  function checkout(q) {
    const [kind, what, uid] = String(q.invoice_payload || '').split(':');
    const ok = (kind === 'prem' ? TIERS.includes(what) : kind === 'rob' && DONATE_PACKS.includes(+what))
      && D.users[+uid] && q.currency === 'XTR' && q.total_amount === priceOf(kind, what);
    return call('answerPreCheckoutQuery', ok ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: 'Цена изменилась, открой магазин ещё раз.' }).catch((e) => { state.lastError = e.message; });
  }
  function paid(msg) {
    const p = msg.successful_payment;
    if (T.payments.some((x) => x.charge === p.telegram_payment_charge_id)) return null; // twice? once
    const [kind, what, uid] = String(p.invoice_payload || '').split(':');
    const u = D.users[+uid];
    T.payments.push({ uid: +uid, username: u ? u.username : '?', kind, what, stars: p.total_amount, charge: p.telegram_payment_charge_id, tgId: msg.from.id, at: Date.now() });
    if (!u) { db.save(); return send(msg.chat.id, 'Оплата получена, но аккаунт не найден — напиши в поддержку.'); }
    if (kind === 'prem' && TIERS.includes(what)) {
      hooks.giveMembership(u, what, PREMIUM_DAYS);
      log(u.id, 0, `${premiumName(what)} (${PREMIUM_DAYS} days) for ${p.total_amount} Telegram Stars`);
      db.save();
      return send(msg.chat.id, `🎉 Спасибо! <b>${premiumName(what)}</b> твой до ${until(u)}.`);
    }
    if (kind === 'rob' && DONATE_PACKS.includes(+what)) {
      u.robits += +what;
      log(u.id, +what, `Robits for ${p.total_amount} Telegram Stars`);
      db.save();
      return send(msg.chat.id, `🎉 Спасибо! +R$ ${fmt(what)}\n💰 Баланс: R$ ${fmt(u.robits)}`);
    }
    db.save();
    return send(msg.chat.id, 'Оплата получена, но товар не найден — напиши в поддержку.');
  }

  // ---------------------------------------------------------------- updates
  function balance(chatId, tgId) {
    const u = userOf(tgId);
    if (!u) return needLink(chatId);
    return send(chatId, `👤 <b>${esc(u.username)}</b>\n💰 R$ ${fmt(u.robits)}\n⭐ ${u.membership && u.membership !== 'None' ? `${premiumName(u.membership)} (до ${until(u)})` : 'Без Premium'}`);
  }
  const help = (chatId) => send(chatId, `🤖 <b>Магазин Robis</b>\n\n${MENU.balance} — Robits и Premium\n${MENU.premium} — за Robits или ⭐ Stars\n${MENU.robits} — за ⭐ Stars\n\n/unlink — отвязать аккаунт`, menu());

  async function handle(up) {
    if (up.pre_checkout_query) return checkout(up.pre_checkout_query);
    if (up.callback_query) {
      const q = up.callback_query;
      call('answerCallbackQuery', { callback_query_id: q.id }).catch(() => {});
      const chatId = q.message ? q.message.chat.id : q.from.id;
      const [act, arg] = String(q.data || '').split(':');
      if (act === 'pr') return buyForRobits(chatId, q.from.id, arg, false);
      if (act === 'prok') return buyForRobits(chatId, q.from.id, arg, true);
      if (act === 'ps') return invoice(chatId, q.from.id, 'prem', arg);
      if (act === 'rs') return invoice(chatId, q.from.id, 'rob', arg);
      return null;
    }
    const msg = up.message;
    if (!msg || !msg.from || !msg.chat || msg.chat.type !== 'private') return null;
    if (msg.successful_payment) return paid(msg);
    const text = String(msg.text || '').trim();
    const tgId = msg.from.id, chatId = msg.chat.id;
    const u = userOf(tgId);
    if (u && u.telegram.chat !== chatId) u.telegram.chat = chatId;
    const [cmd, ...rest] = text.split(/\s+/);
    const arg = rest.join(' ');
    if (cmd === '/start') {
      if (arg.startsWith('link_')) return link(msg.from, chatId, arg.slice(5));
      if (u && arg === 'premium') return premiumMenu(chatId, tgId);
      if (u && arg === 'robits') return robitsMenu(chatId, tgId);
      if (u) return help(chatId);
      return send(chatId, `👋 Привет! Это магазин <b>Robis</b>: Premium и Robits.\n\n1. Зарегистрируйся на сайте${site() ? `: ${site()}` : ''}\n2. Открой Настройки → Telegram → «Привязать Telegram»`, menu());
    }
    if (cmd === '/balance' || text === MENU.balance) return balance(chatId, tgId);
    if (cmd === '/premium' || text === MENU.premium) return premiumMenu(chatId, tgId);
    if (cmd === '/robits' || text === MENU.robits) return robitsMenu(chatId, tgId);
    if (cmd === '/unlink') {
      if (!u) return needLink(chatId);
      delete u.telegram; delete T.linked[tgId]; db.save();
      return send(chatId, 'Аккаунт отвязан. Привязать снова можно на сайте: Настройки → Telegram.', { reply_markup: { remove_keyboard: true } });
    }
    return help(chatId);
  }
  // one bad update never stops the bot
  const safeHandle = async (up) => { try { return await handle(up); } catch (e) { state.lastError = e.message; return null; } };

  // long polling: one loop at a time (a new token starts a new one)
  async function loop(gen) {
    state.running = true;
    try { await call('deleteWebhook', {}); } catch (e) { state.lastError = e.message; }
    try { const me = await call('getMe'); if (me.username) S.username = me.username; } catch (e) { state.lastError = e.message; }
    while (gen === state.gen && S.on && S.token) {
      try {
        const ups = await call('getUpdates', { offset: T.offset, timeout: 25, allowed_updates: ['message', 'callback_query', 'pre_checkout_query'] });
        state.lastOk = Date.now();
        for (const up of ups) { T.offset = up.update_id + 1; await safeHandle(up); }
        if (ups.length) db.save();
      } catch (e) {
        state.lastError = e.message;
        await new Promise((r) => setTimeout(r, e.code === 401 || e.code === 404 ? 60000 : 5000));
      }
    }
    if (gen === state.gen) state.running = false;
  }
  const restart = () => { state.gen++; state.running = false; if (S.on && S.token && !testing) loop(state.gen).catch((e) => { state.running = false; state.lastError = e.message; }); };
  restart();
  hooks.tgbot = { handle: safeHandle, setApi: (fn) => { call = fn; } };

  // ---------------------------------------------------------------- site
  const shop = () => ({
    premium: Object.fromEntries(TIERS.map((t) => [t, { robits: MEMBERSHIP_COST[t], stars: S.stars[t] || 0 }])),
    robits: packs().map((r) => ({ robits: r, stars: S.robitsStars['r' + r] })),
  });
  const view = (u) => ({
    on: !!(S.on && S.token && S.username), bot: S.username,
    linked: u && u.telegram ? { username: u.telegram.username, name: u.telegram.name, at: u.telegram.linkedAt } : null,
    shop: shop(),
  });
  api.get('/me/telegram', (req, res) => res.json(view(req.user)));
  api.post('/me/telegram/link', requireUser, (req, res) => {
    if (req.user.guest) return bad(res, 'Guests can\'t link Telegram. Sign up first!');
    if (!S.on || !S.token) return bad(res, 'The Telegram bot is off right now.');
    for (const [c, x] of Object.entries(T.codes)) if (x.exp < Date.now() || x.uid === req.user.id) delete T.codes[c];
    const code = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
    T.codes[code] = { uid: req.user.id, exp: Date.now() + 15 * 60e3 };
    db.save();
    res.json({ url: `https://t.me/${S.username}?start=link_${code}`, expires: T.codes[code].exp });
  });
  api.post('/me/telegram/unlink', requireUser, (req, res) => {
    const u = req.user;
    if (u.telegram) { delete T.linked[u.telegram.id]; delete u.telegram; db.save(); }
    res.json(view(u));
  });

  // ---------------------------------------------------------------- admin
  const adminView = () => ({
    settings: { on: !!S.on, hasToken: !!S.token, username: S.username, stars: S.stars, robitsStars: S.robitsStars },
    running: state.running, lastError: state.lastError, lastOk: state.lastOk,
    stats: { linked: Object.values(D.users).filter((u) => u.telegram).length, stars: T.payments.reduce((a, p) => a + (p.stars || 0), 0), payments: T.payments.length },
    payments: T.payments.slice(-30).reverse(),
    tiers: TIERS.map((t) => ({ id: t, name: premiumName(t), robits: MEMBERSHIP_COST[t] })), packs: DONATE_PACKS,
  });
  api.get('/admin/tgbot', requireAdmin, (req, res) => res.json(adminView()));
  api.post('/admin/tgbot', requireAdmin, (req, res) => {
    const b = req.body || {};
    const num = (v) => Math.max(0, Math.min(100000, Math.trunc(+v || 0)));
    const host = req.get('host');
    if (host && !/^(localhost|127\.|\[::1\])/.test(host)) S.siteUrl = 'https://' + host;
    if (b.token !== undefined && String(b.token).trim()) {
      const t = String(b.token).trim();
      if (!/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(t)) return bad(res, 'That doesn\'t look like a bot token (from @BotFather: 123456:ABC...).');
      if (t !== S.token) { S.token = t; T.offset = 0; S.username = ''; }
    }
    if (b.clearToken) { S.token = ''; S.username = ''; }
    if (b.on !== undefined) S.on = !!b.on;
    if (b.stars) for (const t of TIERS) if (b.stars[t] !== undefined) S.stars[t] = num(b.stars[t]);
    if (b.robitsStars) for (const r of DONATE_PACKS) if (b.robitsStars['r' + r] !== undefined) S.robitsStars['r' + r] = num(b.robitsStars['r' + r]);
    db.save();
    restart();
    res.json(adminView());
  });
  api.post('/admin/tgbot/test', requireAdmin, async (req, res) => {
    if (!S.token) return bad(res, 'Save the bot token first.');
    try { const me = await call('getMe'); S.username = me.username; db.save(); res.json({ ok: true, username: me.username }); } catch (e) { bad(res, 'Telegram: ' + e.message); }
  });
}
