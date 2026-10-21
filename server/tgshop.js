// The Telegram shop: Robits, Premium and gift cards are paid in a private chat
// with the seller (D.donate.telegram), and a bot connected to the seller's
// account (Telegram Business -> Chat automation) answers there for them:
//   1. "Buy" on the Robits page makes an order (RB-12345) and opens the
//      seller's chat with a ready message that has the order number
//   2. the bot sees the number and answers, as the seller: the order, the
//      price, how to pay (Control Center -> Telegram Shop)
//   3. the seller checks the payment and writes "+" in that chat: the bot
//      gives the order (Robits / Premium / a gift card code) and says so;
//      "-" cancels it
// The bot only answers messages with an order number; every other chat of
// the seller is left alone. Orders can also be given from Control Center
// (without the bot).
//   POST /economy/order          { key } -> the order and its message
//   GET  /economy/orders         my orders
//   GET/POST /admin/tgshop       settings (the token is never sent back), orders
//   POST /admin/tgshop/orders/:code   { op: 'give' | 'cancel' }

const ORDER_DAYS = 3;
const PREMIUM_DAYS = 30;
const CODE_RE = /RB-?(\d{5})/i;
const fmt = (n) => Math.trunc(n).toLocaleString('ru-RU');

export function installTgShop(api, { db, requireUser, requireAdmin, bad, log, hooks, MEMBERSHIPS, DONATE_PACKS, GIFT_CARDS }) {
  const D = db.data;
  if (!D.settings) D.settings = {};
  const S = D.settings.tgshop || (D.settings.tgshop = {});
  if (S.on === undefined) S.on = false;
  if (!S.payText) S.payText = 'Оплата переводом на карту: 0000 0000 0000 0000 (Иван И.). В комментарии к переводу укажи номер заказа.';
  if (!D.orders) D.orders = {};
  if (!S.offset) S.offset = 0;
  const testing = !!process.env.NODE_TEST_CONTEXT;
  const state = { gen: 0, running: false, lastError: '' };
  const prices = () => (D.donate && D.donate.prices) || {};

  // what can be ordered
  const catalog = () => {
    const out = {};
    for (const r of DONATE_PACKS) out['r' + r] = { name: `${fmt(r)} Robits`, robits: r, price: prices()['r' + r] || '' };
    for (const id of Object.keys(MEMBERSHIPS)) if (id !== 'None') out[id] = { name: `${MEMBERSHIPS[id].name} (${PREMIUM_DAYS} дней)`, membership: id, price: prices()[id] || '' };
    for (const g of GIFT_CARDS) out[g.key] = { name: `Подарочная карта: ${g.name}`, gift: true, robits: g.robits || 0, membership: g.membership || '', days: g.days || 0, price: prices()[g.key] || '' };
    return out;
  };
  const open = (o) => o.status === 'new' || o.status === 'waiting' || o.status === 'check';
  const expire = () => {
    const now = Date.now();
    for (const o of Object.values(D.orders)) if (open(o) && now - o.created > ORDER_DAYS * 86400e3) o.status = 'expired';
  };
  const newCode = () => { for (;;) { const c = 'RB-' + String(10000 + Math.floor(Math.random() * 90000)); if (!D.orders[c]) return c; } };

  // ---------------------------------------------------------------- Telegram
  let call = async (method, params = {}) => {
    const r = await fetch(`https://api.telegram.org/bot${S.token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
    const j = await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }));
    if (!j.ok) { const e = new Error(j.description || 'Telegram error'); e.code = j.error_code; throw e; }
    return j.result;
  };
  // a message in a chat of the seller, sent as the seller
  const say = (o, text) => {
    if (!o.chatId || !S.conn || !S.conn.id) return null;
    return call('sendMessage', { business_connection_id: S.conn.id, chat_id: o.chatId, text }).catch((e) => { state.lastError = e.message; });
  };

  // ---------------------------------------------------------------- orders
  function give(o, by) {
    if (!open(o)) return { error: `The order is ${o.status}.` };
    const u = D.users[o.uid];
    if (!u) { o.status = 'cancelled'; return { error: 'The account is gone.' }; }
    const it = catalog()[o.key];
    if (!it) return { error: 'This product is no longer sold.' };
    let done = '';
    if (it.gift) {
      o.giftCode = hooks.makePromo({ robits: it.robits, membership: it.membership, memberDays: it.membership ? it.days || PREMIUM_DAYS : 0, note: `Gift card ${o.code}` });
      done = `Код подарочной карты: ${o.giftCode}\nЕго вводят на сайте: Промокоды.`;
    } else if (it.membership) {
      hooks.giveMembership(u, it.membership, PREMIUM_DAYS);
      log(u.id, 0, `${MEMBERSHIPS[it.membership].name} (${PREMIUM_DAYS} days) bought in Telegram (${o.code})`);
      done = `${MEMBERSHIPS[it.membership].name} включён на аккаунте ${u.username}.`;
    } else {
      u.robits += it.robits;
      log(u.id, it.robits, `Bought in Telegram (${o.code})`);
      done = `R$ ${fmt(it.robits)} зачислено на аккаунт ${u.username}.`;
    }
    o.status = 'done';
    o.doneAt = Date.now();
    o.by = by;
    if (hooks.inbox) hooks.inbox(u.id, `Order ${o.code}: done!`, `Thank you! ${o.item}${o.giftCode ? `\n\nGift card code: ${o.giftCode} (redeem it on the Promo Codes page)` : ' is on your account.'}`);
    db.save();
    say(o, `✅ Заказ ${o.code} выполнен!\n${done}\n\nСпасибо за покупку!`);
    return { ok: true };
  }
  function cancel(o, by) {
    if (!open(o)) return { error: `The order is ${o.status}.` };
    o.status = 'cancelled';
    o.by = by;
    db.save();
    say(o, `Заказ ${o.code} отменён. Если это ошибка — напиши сюда.`);
    return { ok: true };
  }

  // ---------------------------------------------------------------- the bot
  // the seller's account connected the bot (or turned it off)
  function connection(c) {
    S.conn = { id: c.id, ownerId: c.user.id, username: c.user.username || '', name: c.user.first_name || '', enabled: c.is_enabled !== false,
      canReply: c.rights ? !!c.rights.can_reply : c.can_reply !== false, at: Date.now() };
    db.save();
  }
  function message(m) {
    if (!S.conn || m.business_connection_id !== S.conn.id) return null;
    const chatId = m.chat.id;
    const text = String(m.text || m.caption || '').trim();
    // the seller writes in a buyer's chat: "+" gives the order, "-" cancels it
    if (m.from && m.from.id === S.conn.ownerId) {
      const o = Object.values(D.orders).filter((x) => x.chatId === chatId && open(x)).sort((a, b) => b.created - a.created)[0];
      if (!o) return null;
      if (/^(\+|\/ok|ок|ok|выдать)$/i.test(text)) return give(o, 'telegram');
      if (/^(-|\/no|отмена)$/i.test(text)) return cancel(o, 'telegram');
      return null;
    }
    // a buyer writes the order number
    const mm = text.match(CODE_RE);
    if (mm) {
      const o = D.orders['RB-' + mm[1]];
      if (!o) return say({ chatId }, `Заказ RB-${mm[1]} не найден. Нажми «Купить» на сайте ещё раз.`);
      if (!open(o)) return say({ chatId }, o.status === 'done' ? `Заказ ${o.code} уже выполнен ✅` : `Заказ ${o.code} ${o.status === 'expired' ? 'устарел' : 'отменён'}. Сделай новый на сайте.`);
      o.chatId = chatId;
      o.tgUser = m.from ? (m.from.username ? '@' + m.from.username : m.from.first_name || '') : '';
      if (o.status === 'new') o.status = 'waiting';
      db.save();
      return say(o, `Заказ ${o.code} принят ✅\nТовар: ${o.item}\nАккаунт: ${o.username}${o.price ? `\nЦена: ${o.price}` : ''}\n\n${S.payText}\n\nПосле оплаты пришли сюда скриншот чека — выдам сразу после проверки.`);
    }
    // a receipt (a photo or a file) in a chat with an open order
    if (m.photo || m.document) {
      const o = Object.values(D.orders).filter((x) => x.chatId === chatId && x.status === 'waiting').sort((a, b) => b.created - a.created)[0];
      if (!o) return null;
      o.status = 'check';
      o.receiptAt = Date.now();
      db.save();
      return say(o, `Спасибо! Проверяю оплату по заказу ${o.code}, это займёт немного времени ⏳`);
    }
    return null;
  }
  async function handle(up) {
    if (up.business_connection) return connection(up.business_connection);
    if (up.business_message) return message(up.business_message);
    return null;
  }
  async function loop(gen) {
    state.running = true;
    try { await call('deleteWebhook', {}); } catch (e) { state.lastError = e.message; }
    try { const me = await call('getMe'); S.botName = me.username; } catch (e) { state.lastError = e.message; }
    while (gen === state.gen && S.on && S.token) {
      try {
        const ups = await call('getUpdates', { offset: S.offset, timeout: 25, allowed_updates: ['business_connection', 'business_message'] });
        for (const up of ups) {
          S.offset = up.update_id + 1;
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
  hooks.tgshop = { handle, setApi: (fn) => { call = fn; } };

  // ---------------------------------------------------------------- site
  const view = (o) => ({ code: o.code, item: o.item, price: o.price, status: o.status, created: o.created, giftCode: o.giftCode || '' });
  api.post('/economy/order', requireUser, (req, res) => {
    const u = req.user;
    if (u.guest) return bad(res, 'Guests can\'t buy. Sign up first!');
    expire();
    const it = catalog()[String(req.body?.key || '')];
    if (!it) return bad(res, 'Unknown product.');
    const mine = Object.values(D.orders).filter((o) => o.uid === u.id && open(o));
    // the same product again: the open order
    let o = mine.find((x) => x.key === req.body.key);
    if (!o) {
      if (mine.length >= 5) return bad(res, 'You have 5 open orders. Finish or wait for them first.');
      const code = newCode();
      o = D.orders[code] = { code, uid: u.id, username: u.username, key: req.body.key, item: it.name, price: it.price, status: 'new', created: Date.now() };
      db.save();
    }
    const seller = (D.donate && D.donate.telegram) || 'Robis_support';
    const text = `Привет! Хочу купить: ${o.item}. Мой ник в Robis: ${u.username}. Заказ ${o.code}`;
    res.json({ order: view(o), text, url: `https://t.me/${seller}?text=${encodeURIComponent(text)}`, seller });
  });
  api.get('/economy/orders', requireUser, (req, res) => {
    expire();
    res.json({ orders: Object.values(D.orders).filter((o) => o.uid === req.user.id).sort((a, b) => b.created - a.created).slice(0, 20).map(view) });
  });

  // ---------------------------------------------------------------- admin
  const adminView = () => {
    expire();
    return {
      settings: { on: !!S.on, hasToken: !!S.token, payText: S.payText, botName: S.botName || '', seller: (D.donate && D.donate.telegram) || 'Robis_support' },
      connection: S.conn || null, running: state.running, lastError: state.lastError,
      orders: Object.values(D.orders).sort((a, b) => b.created - a.created).slice(0, 100),
    };
  };
  api.get('/admin/tgshop', requireAdmin, (req, res) => res.json(adminView()));
  api.post('/admin/tgshop', requireAdmin, (req, res) => {
    const b = req.body || {};
    if (b.token !== undefined && String(b.token).trim()) {
      const t = String(b.token).trim();
      if (!/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(t)) return bad(res, 'That doesn\'t look like a bot token (from @BotFather: 123456:ABC...).');
      if (t !== S.token) { S.token = t; S.offset = 0; S.conn = null; }
    }
    if (b.clearToken) { S.token = ''; S.conn = null; }
    if (b.on !== undefined) S.on = !!b.on;
    if (b.payText !== undefined) S.payText = String(b.payText).trim().slice(0, 800) || S.payText;
    db.save();
    restart();
    res.json(adminView());
  });
  api.post('/admin/tgshop/orders/:code', requireAdmin, (req, res) => {
    const o = D.orders[String(req.params.code).toUpperCase()];
    if (!o) return bad(res, 'Order not found.', 404);
    const r = req.body?.op === 'cancel' ? cancel(o, req.user.username) : req.body?.op === 'give' ? give(o, req.user.username) : { error: 'Unknown action.' };
    if (r.error) return bad(res, r.error);
    res.json(adminView());
  });
}
