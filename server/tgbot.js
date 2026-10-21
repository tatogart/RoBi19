// The Robis Telegram bot (@Robisgame_bot): it runs inside the Robis server
// (long polling, no webhook, no other hosting).
//   - linking: Settings -> Telegram on the site gives a one-time link
//     t.me/<bot>?start=link_<code>; the bot ties the Telegram account to it
//   - a daily reward for being subscribed to the Telegram channel and the VK
//     group (Admin Panel -> Social links); VK needs a VK access key to check
//   - invites: t.me/<bot>?start=ref_<user id>; when the friend links a new
//     account, both get Robits (not for alt accounts of the inviter)
//   - Premium for Robits, and Premium for Telegram Stars (real money)
// The bot token and the VK key are set in Control Center -> Telegram Bot and
// never sent to any page.
//   GET  /me/telegram             linked or not, the invite link
//   POST /me/telegram/link        a one-time link to open in Telegram
//   POST /me/telegram/unlink
//   GET/POST /admin/tgbot         the settings, stats, payments
//   POST /admin/tgbot/test        checks the token (getMe)

import { DEFAULT_SOCIALS } from './adminplus.js';

const DAY = 86400e3;
const TIERS = ['BuildersClub', 'TurboBuildersClub', 'OutrageousBuildersClub'];
const PREMIUM_DAYS = 30;
const MENU = { balance: '💰 Баланс', daily: '🎁 Награда дня', premium: '⭐ Premium', invite: '👥 Пригласить друга', vk: '🔵 Мой VK', help: 'ℹ️ Помощь' };
const fmt = (n) => Math.trunc(n).toLocaleString('ru-RU');

export function installTgBot(api, { db, requireUser, requireAdmin, bad, log, hooks, MEMBERSHIPS, MEMBERSHIP_COST }) {
  const D = db.data;
  if (!D.settings) D.settings = {};
  const S = D.settings.tgbot || (D.settings.tgbot = {});
  const defaults = { on: false, token: '', username: 'Robisgame_bot', daily: 25, refInviter: 100, refInvitee: 50, refDayCap: 20, vkToken: '',
    stars: { BuildersClub: 100, TurboBuildersClub: 200, OutrageousBuildersClub: 400 } };
  for (const [k, v] of Object.entries(defaults)) if (S[k] === undefined) S[k] = v;
  const T = D.tg || (D.tg = {});
  for (const k of ['codes', 'refs', 'linked']) if (!T[k]) T[k] = {};
  if (!T.payments) T.payments = [];
  if (!T.offset) T.offset = 0;
  const testing = !!process.env.NODE_TEST_CONTEXT;
  const state = { running: false, gen: 0, lastError: '', lastOk: 0 };
  const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

  // ---------------------------------------------------------------- Telegram & VK
  let call = async (method, params = {}) => {
    const r = await fetch(`https://api.telegram.org/bot${S.token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
    const j = await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }));
    if (!j.ok) { const e = new Error(j.description || 'Telegram error'); e.code = j.error_code; throw e; }
    return j.result;
  };
  let vkCall = async (method, params) => {
    const q = new URLSearchParams({ ...params, access_token: S.vkToken, v: '5.199' });
    const r = await fetch(`https://api.vk.com/method/${method}?${q}`);
    const j = await r.json();
    if (j.error) throw new Error(j.error.error_msg || 'VK error');
    return j.response;
  };
  const send = (chatId, text, extra = {}) => call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }).catch((e) => { state.lastError = e.message; });
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

  // the channel and the group from Admin Panel -> Settings -> Social links
  const findSocial = (type) => { const x = (D.settings.socials || DEFAULT_SOCIALS).find((y) => y.type === type && y.url); return x ? x.url : ''; };
  const channel = () => { const m = findSocial('telegram').match(/t\.me\/([A-Za-z0-9_]{4,32})/); return m ? '@' + m[1] : ''; };
  const vkGroup = () => { const url = findSocial('vk'); const m = url.match(/vk\.(?:com|ru)\/(?:club|public)?(\d+)\/?$/) || url.match(/vk\.(?:com|ru)\/([A-Za-z0-9_.]+)\/?$/); return { url, id: m ? m[1] : '' }; };

  // the site's address: remembered from the admin who set the bot up
  const site = () => S.siteUrl || '';
  const userOf = (tgId) => { const u = D.users[T.linked[tgId]]; return u && u.telegram && u.telegram.id === tgId ? u : null; };
  const menu = () => ({ reply_markup: { keyboard: [[{ text: MENU.balance }, { text: MENU.daily }], [{ text: MENU.premium }, { text: MENU.invite }], [{ text: MENU.vk }, { text: MENU.help }]], resize_keyboard: true } });
  const needLink = (chatId) => send(chatId, `Сначала привяжи аккаунт Robis 🔗\n\nНа сайте открой <b>Настройки → Telegram</b> и нажми «Привязать Telegram». Бот сам всё сделает.${site() ? `\n\n${site()}/settings` : ''}`);
  const premiumName = (tier) => (MEMBERSHIPS[tier] ? MEMBERSHIPS[tier].name : tier);
  const until = (u) => (u.membershipUntil ? new Date(u.membershipUntil).toLocaleDateString('ru-RU') : 'навсегда');

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
    const bonus = referral(u, tg.id);
    db.save();
    return send(chatId, `✅ Готово! Telegram привязан к <b>${esc(u.username)}</b>.\n\n💰 Баланс: R$ ${fmt(u.robits)}${bonus ? `\n🎉 За приглашение друга: +R$ ${fmt(bonus)}` : ''}\n\nКаждый день жми «${MENU.daily}» — Robits за подписку на наш канал и группу VK.`, menu());
  }

  // the friend who invited this Telegram account gets Robits (once, new accounts, no alts)
  function referral(u, tgId) {
    const ref = T.refs[tgId];
    if (!ref || u.refBy || u.refChecked) return 0;
    u.refChecked = true;
    const inviter = D.users[ref.uid];
    if (!inviter || inviter.id === u.id || inviter.guest || inviter.bot) return 0;
    if (Date.now() - (u.created || 0) > 7 * DAY) return 0; // only accounts made for the invite
    const shared = (a, b) => (a || []).some((x) => (b || []).includes(x));
    if (shared(u.devices, inviter.devices) || shared(u.ips, inviter.ips)) return 0; // an alt of the inviter
    const today = dayKey();
    if (inviter.refDay !== today) { inviter.refDay = today; inviter.refToday = 0; }
    if (inviter.refToday >= S.refDayCap) return 0;
    inviter.refToday++;
    inviter.refCount = (inviter.refCount || 0) + 1;
    u.refBy = inviter.id;
    if (S.refInviter) { inviter.robits += S.refInviter; log(inviter.id, S.refInviter, `Invited ${u.username} (Telegram bot)`); }
    if (S.refInvitee) { u.robits += S.refInvitee; log(u.id, S.refInvitee, `Invited by ${inviter.username} (Telegram bot)`); }
    if (inviter.telegram) send(inviter.telegram.chat, `🎉 Твой друг <b>${esc(u.username)}</b> пришёл по приглашению! +R$ ${fmt(S.refInviter)}`);
    return S.refInvitee;
  }

  // ---------------------------------------------------------------- daily reward
  async function subscribedTg(tgId) {
    const ch = channel();
    if (!ch) return { ok: true };
    try {
      const m = await call('getChatMember', { chat_id: ch, user_id: tgId });
      return { ok: ['creator', 'administrator', 'member'].includes(m.status) || (m.status === 'restricted' && m.is_member), ch };
    } catch (e) { return { ok: false, ch, error: 'Бот не может проверить канал: добавь его администратором канала ' + ch }; }
  }
  async function subscribedVk(u) {
    const g = vkGroup();
    if (!g.id || !S.vkToken) return { ok: true, skip: true, url: g.url };
    if (!u.vkId) return { ok: false, url: g.url, needId: true };
    try { const r = await vkCall('groups.isMember', { group_id: g.id, user_id: u.vkId }); return { ok: r === 1 || r?.member === 1, url: g.url }; } catch (e) { return { ok: false, url: g.url, error: 'VK: ' + e.message }; }
  }
  async function daily(chatId, tgId) {
    const u = userOf(tgId);
    if (!u) return needLink(chatId);
    if (u.tgDaily === dayKey()) {
      const left = new Date(dayKey() + 'T00:00:00Z').getTime() + DAY - Date.now();
      return send(chatId, `Сегодня награда уже получена ✅\nСледующая через ${Math.floor(left / 3600e3)} ч ${Math.floor((left % 3600e3) / 60e3)} мин.`);
    }
    const [tg, vk] = await Promise.all([subscribedTg(tgId), subscribedVk(u)]);
    if (!tg.ok || !vk.ok) {
      const rows = [];
      if (!tg.ok && tg.ch) rows.push([{ text: '📢 Канал в Telegram', url: `https://t.me/${tg.ch.slice(1)}` }]);
      if (!vk.ok && vk.url) rows.push([{ text: '🔵 Группа VK', url: vk.url }]);
      rows.push([{ text: '✅ Я подписался — проверить', callback_data: 'daily' }]);
      const why = [tg.error, vk.error, vk.needId ? `Чтобы проверить VK, пришли ссылку на свою страницу: <code>/vk https://vk.com/id123</code>` : ''].filter(Boolean).join('\n');
      return send(chatId, `Награда дня — R$ ${fmt(S.daily)} за подписку 🎁\n\nПодпишись:${!tg.ok ? '\n• на наш Telegram-канал' : ''}${!vk.ok ? '\n• на группу VK' : ''}\nи нажми «Проверить».${why ? '\n\n' + why : ''}`, { reply_markup: { inline_keyboard: rows } });
    }
    u.tgDaily = dayKey();
    u.robits += S.daily;
    log(u.id, S.daily, 'Daily reward (Telegram bot)');
    db.save();
    return send(chatId, `🎁 +R$ ${fmt(S.daily)}! Спасибо за подписку.\n💰 Баланс: R$ ${fmt(u.robits)}\n\nПриходи завтра за новой наградой.`);
  }

  // ---------------------------------------------------------------- Premium
  function premiumMenu(chatId, tgId) {
    const u = userOf(tgId);
    if (!u) return needLink(chatId);
    const cur = u.membership && u.membership !== 'None' ? `Сейчас у тебя: <b>${premiumName(u.membership)}</b> (до ${until(u)})\n\n` : '';
    const lines = TIERS.map((t) => `<b>${premiumName(t)}</b>: +R$ ${MEMBERSHIPS[t].stipend} каждый день — R$ ${fmt(MEMBERSHIP_COST[t])} или ⭐ ${S.stars[t]}`).join('\n');
    const rows = TIERS.map((t) => [{ text: `${premiumName(t)} · R$ ${fmt(MEMBERSHIP_COST[t])}`, callback_data: 'pr:' + t }, { text: `⭐ ${S.stars[t]}`, callback_data: 'ps:' + t }]);
    return send(chatId, `⭐ <b>Robis Premium</b> на ${PREMIUM_DAYS} дней\n\n${cur}${lines}\n\nЗа Robits — сразу с баланса. За ⭐ Telegram Stars — оплата прямо в Telegram.`, { reply_markup: { inline_keyboard: rows } });
  }
  function buyForRobits(chatId, tgId, tier, sure) {
    const u = userOf(tgId);
    if (!u) return needLink(chatId);
    if (!TIERS.includes(tier)) return null;
    if (!sure) return send(chatId, `Купить <b>${premiumName(tier)}</b> на ${PREMIUM_DAYS} дней за R$ ${fmt(MEMBERSHIP_COST[tier])}?\nУ тебя R$ ${fmt(u.robits)}.`, { reply_markup: { inline_keyboard: [[{ text: '✅ Купить', callback_data: 'prok:' + tier }, { text: 'Отмена', callback_data: 'no' }]] } });
    const r = hooks.buyMembership(u, tier);
    if (r.error) return send(chatId, '❌ ' + r.error);
    return send(chatId, `🎉 <b>${premiumName(tier)}</b> твой до ${until(u)}!\n💰 Осталось: R$ ${fmt(u.robits)}`);
  }
  function invoice(chatId, tgId, tier) {
    const u = userOf(tgId);
    if (!u) return needLink(chatId);
    if (!TIERS.includes(tier) || !(S.stars[tier] > 0)) return send(chatId, 'Этот Premium сейчас нельзя купить за Stars.');
    const order = Object.keys(MEMBERSHIPS);
    if (order.indexOf(u.membership || 'None') > order.indexOf(tier)) return send(chatId, `У тебя уже ${premiumName(u.membership)} — это лучше.`);
    return call('sendInvoice', {
      chat_id: chatId, title: `${premiumName(tier)} · ${PREMIUM_DAYS} дней`,
      description: `Robis Premium для ${u.username}: +R$ ${MEMBERSHIPS[tier].stipend} каждый день, значок Premium.`,
      payload: `prem:${tier}:${u.id}`, currency: 'XTR', prices: [{ label: premiumName(tier), amount: S.stars[tier] }],
    }).catch((e) => send(chatId, 'Не получилось выставить счёт: ' + esc(e.message)));
  }
  function checkout(q) {
    const [kind, tier, uid] = String(q.invoice_payload || '').split(':');
    const u = D.users[+uid];
    const ok = kind === 'prem' && TIERS.includes(tier) && u && q.currency === 'XTR' && q.total_amount === S.stars[tier];
    return call('answerPreCheckoutQuery', ok ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: 'Цена изменилась, открой Premium ещё раз.' }).catch(() => {});
  }
  function paid(msg) {
    const p = msg.successful_payment;
    if (T.payments.some((x) => x.charge === p.telegram_payment_charge_id)) return null; // twice? once
    const [, tier, uid] = String(p.invoice_payload || '').split(':');
    const u = D.users[+uid];
    T.payments.push({ uid: +uid, username: u ? u.username : '?', tier, stars: p.total_amount, charge: p.telegram_payment_charge_id, tgId: msg.from.id, at: Date.now() });
    if (!u || !TIERS.includes(tier)) { db.save(); return send(msg.chat.id, 'Оплата получена, но аккаунт не найден — напиши в поддержку.'); }
    hooks.giveMembership(u, tier, PREMIUM_DAYS);
    log(u.id, 0, `${premiumName(tier)} (${PREMIUM_DAYS} days) for ${p.total_amount} Telegram Stars`);
    db.save();
    return send(msg.chat.id, `🎉 Спасибо! <b>${premiumName(tier)}</b> твой до ${until(u)}.`);
  }

  // ---------------------------------------------------------------- updates
  async function setVk(chatId, tgId, arg) {
    const u = userOf(tgId);
    if (!u) return needLink(chatId);
    const m = String(arg || '').trim().match(/(?:vk\.(?:com|ru)\/)?(id\d+|[A-Za-z0-9_.]{2,32})\/?$/);
    if (!m) return send(chatId, `Пришли ссылку на свою страницу VK, например:\n<code>/vk https://vk.com/id123</code>${u.vkId ? `\n\nСейчас: vk.com/id${u.vkId}` : ''}`);
    let id = /^id\d+$/.test(m[1]) ? +m[1].slice(2) : null;
    if (!id && S.vkToken) {
      try { const r = await vkCall('utils.resolveScreenName', { screen_name: m[1] }); if (r && r.type === 'user') id = r.object_id; } catch { /* checked below */ }
    }
    if (!id) return send(chatId, 'Не нашёл такую страницу VK. Пришли ссылку вида https://vk.com/id123.');
    u.vkId = id;
    db.save();
    return send(chatId, `✅ VK привязан: vk.com/id${id}`);
  }
  function balance(chatId, tgId) {
    const u = userOf(tgId);
    if (!u) return needLink(chatId);
    return send(chatId, `👤 <b>${esc(u.username)}</b>\n💰 R$ ${fmt(u.robits)}\n⭐ ${u.membership && u.membership !== 'None' ? `${premiumName(u.membership)} (до ${until(u)})` : 'Без Premium'}\n👥 Приглашено друзей: ${u.refCount || 0}`);
  }
  function invite(chatId, tgId) {
    const u = userOf(tgId);
    if (!u) return needLink(chatId);
    const url = `https://t.me/${S.username}?start=ref_${u.id}`;
    return send(chatId, `👥 Зови друзей в Robis!\n\nТвоя ссылка:\n${url}\n\nКогда друг создаст аккаунт и привяжет его в боте: тебе +R$ ${fmt(S.refInviter)}, другу +R$ ${fmt(S.refInvitee)}.`, { reply_markup: { inline_keyboard: [[{ text: '📤 Поделиться', url: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Играй со мной в Robis!')}` }]] } });
  }
  const help = (chatId) => send(chatId, `🤖 <b>Бот Robis</b>\n\n${MENU.balance} — Robits и Premium\n${MENU.daily} — R$ ${fmt(S.daily)} в день за подписку на канал и VK\n${MENU.premium} — Premium за Robits или ⭐ Stars\n${MENU.invite} — Robits за друзей\n${MENU.vk} — привязать VK для награды\n\n/unlink — отвязать аккаунт`, menu());

  async function handle(up) {
    if (up.pre_checkout_query) return checkout(up.pre_checkout_query);
    if (up.callback_query) {
      const q = up.callback_query;
      call('answerCallbackQuery', { callback_query_id: q.id }).catch(() => {});
      const chatId = q.message ? q.message.chat.id : q.from.id;
      const [act, arg] = String(q.data || '').split(':');
      if (act === 'daily') return daily(chatId, q.from.id);
      if (act === 'pr') return buyForRobits(chatId, q.from.id, arg, false);
      if (act === 'prok') return buyForRobits(chatId, q.from.id, arg, true);
      if (act === 'ps') return invoice(chatId, q.from.id, arg);
      return null;
    }
    const msg = up.message;
    if (!msg || !msg.from || msg.chat.type !== 'private') return null;
    if (msg.successful_payment) return paid(msg);
    const text = String(msg.text || '').trim();
    const tgId = msg.from.id, chatId = msg.chat.id;
    const u = userOf(tgId);
    if (u && u.telegram.chat !== chatId) u.telegram.chat = chatId;
    const [cmd, ...rest] = text.split(/\s+/);
    const arg = rest.join(' ');
    if (cmd === '/start') {
      if (arg.startsWith('link_')) return link(msg.from, chatId, arg.slice(5));
      if (arg.startsWith('ref_') && !u && !T.refs[tgId] && D.users[+arg.slice(4)]) { T.refs[tgId] = { uid: +arg.slice(4), at: Date.now() }; db.save(); }
      if (u && arg === 'premium') return premiumMenu(chatId, tgId);
      if (u) return help(chatId);
      const inviter = T.refs[tgId] && D.users[T.refs[tgId].uid];
      return send(chatId, `👋 Привет! Это бот <b>Robis</b>.${inviter ? `\n\nТебя пригласил <b>${esc(inviter.username)}</b> — после привязки получишь +R$ ${fmt(S.refInvitee)}!` : ''}\n\n1. Зарегистрируйся на сайте${site() ? `: ${site()}` : ''}\n2. Открой Настройки → Telegram → «Привязать Telegram»\n\nПосле этого: награда каждый день, Premium и Robits за друзей.`, menu());
    }
    if (cmd === '/balance' || text === MENU.balance) return balance(chatId, tgId);
    if (cmd === '/daily' || text === MENU.daily) return daily(chatId, tgId);
    if (cmd === '/premium' || text === MENU.premium) return premiumMenu(chatId, tgId);
    if (cmd === '/invite' || text === MENU.invite) return invite(chatId, tgId);
    if (cmd === '/vk') return setVk(chatId, tgId, arg);
    if (text === MENU.vk) return setVk(chatId, tgId, '');
    if (cmd === '/unlink') {
      if (!u) return needLink(chatId);
      delete u.telegram; delete T.linked[tgId]; db.save();
      return send(chatId, 'Аккаунт отвязан. Привязать снова можно на сайте: Настройки → Telegram.', { reply_markup: { remove_keyboard: true } });
    }
    return help(chatId);
  }

  // long polling: one loop at a time (a new token starts a new one)
  async function loop(gen) {
    state.running = true;
    try { await call('deleteWebhook', {}); } catch (e) { state.lastError = e.message; }
    try { const me = await call('getMe'); if (me.username) S.username = me.username; } catch (e) { state.lastError = e.message; }
    while (gen === state.gen && S.on && S.token) {
      try {
        const ups = await call('getUpdates', { offset: T.offset, timeout: 25, allowed_updates: ['message', 'callback_query', 'pre_checkout_query'] });
        state.lastOk = Date.now();
        for (const up of ups) {
          T.offset = up.update_id + 1;
          try { await handle(up); } catch (e) { state.lastError = e.message; }
        }
        if (ups.length) db.save();
      } catch (e) {
        state.lastError = e.message;
        await new Promise((r) => setTimeout(r, e.code === 401 || e.code === 404 ? 60000 : 5000));
      }
    }
    if (gen === state.gen) state.running = false;
  }
  const restart = () => { state.gen++; state.running = false; if (S.on && S.token && !testing) loop(state.gen); };
  restart();

  hooks.tgbot = {
    handle,
    // tests: talk to a fake Telegram / VK
    setApi: (tg, vk) => { if (tg) call = tg; if (vk) vkCall = vk; },
    notify: (uid, text) => { const u = D.users[uid]; if (u && u.telegram && S.on) send(u.telegram.chat, text); },
  };

  // ---------------------------------------------------------------- site
  const view = (u) => ({
    on: !!(S.on && S.token), bot: S.username,
    linked: u.telegram ? { username: u.telegram.username, name: u.telegram.name, at: u.telegram.linkedAt } : null,
    invite: `https://t.me/${S.username}?start=ref_${u.id}`, refCount: u.refCount || 0,
    daily: S.daily, refInviter: S.refInviter, refInvitee: S.refInvitee,
  });
  api.get('/me/telegram', requireUser, (req, res) => res.json(view(req.user)));
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
    settings: { ...S, token: undefined, vkToken: undefined, hasToken: !!S.token, hasVkToken: !!S.vkToken },
    channel: channel(), vkGroup: vkGroup().url, running: state.running, lastError: state.lastError, lastOk: state.lastOk,
    stats: {
      linked: Object.values(D.users).filter((u) => u.telegram).length,
      invited: Object.values(D.users).filter((u) => u.refBy).length,
      dailyToday: Object.values(D.users).filter((u) => u.tgDaily === dayKey()).length,
      stars: T.payments.reduce((a, p) => a + (p.stars || 0), 0),
    },
    payments: T.payments.slice(-30).reverse(),
    tiers: TIERS.map((t) => ({ id: t, name: premiumName(t), robits: MEMBERSHIP_COST[t] })),
  });
  api.get('/admin/tgbot', requireAdmin, (req, res) => res.json(adminView()));
  api.post('/admin/tgbot', requireAdmin, (req, res) => {
    const b = req.body || {};
    const host = req.get('host');
    if (host && !/^(localhost|127\.|\[::1\])/.test(host)) S.siteUrl = 'https://' + host;
    const num = (v, max) => Math.max(0, Math.min(max, Math.trunc(+v || 0)));
    if (b.token !== undefined && String(b.token).trim()) {
      const t = String(b.token).trim();
      if (!/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(t)) return bad(res, 'That doesn\'t look like a bot token (from @BotFather: 123456:ABC...).');
      S.token = t;
    }
    if (b.clearToken) S.token = '';
    if (b.vkToken !== undefined && String(b.vkToken).trim()) S.vkToken = String(b.vkToken).trim().slice(0, 300);
    if (b.clearVkToken) S.vkToken = '';
    if (b.on !== undefined) S.on = !!b.on;
    if (b.daily !== undefined) S.daily = num(b.daily, 100000);
    if (b.refInviter !== undefined) S.refInviter = num(b.refInviter, 100000);
    if (b.refInvitee !== undefined) S.refInvitee = num(b.refInvitee, 100000);
    if (b.refDayCap !== undefined) S.refDayCap = num(b.refDayCap, 1000);
    if (b.stars) for (const t of TIERS) if (b.stars[t] !== undefined) S.stars[t] = num(b.stars[t], 100000);
    db.save();
    restart();
    res.json(adminView());
  });
  api.post('/admin/tgbot/test', requireAdmin, async (req, res) => {
    if (!S.token) return bad(res, 'Save the bot token first.');
    try { const me = await call('getMe'); S.username = me.username; db.save(); res.json({ ok: true, username: me.username }); } catch (e) { bad(res, 'Telegram: ' + e.message); }
  });
}
