// Special items: made by an admin in the Control Center and only given out by
// an admin (never for sale, can't be traded or gifted). Every one has a
// plate on its card: EXCLUSIVE, CUSTOM, FOR PLAYER... or the admin's own word.
//   GET    /admin/special           the special items + what they can look like
//   POST   /admin/special           make one (and give it right away: giveTo)
//   PATCH  /admin/special/:id       change its name, text, colors, plate
//   DELETE /admin/special/:id       delete it (everyone who has it loses it)
import { officialAccount } from './seed/seed.js';

export const SPECIAL_TYPES = ['Hat', 'Hair', 'Accessory', 'Face', 'Shirt', 'Pants', 'Gear', 'Pet', 'Emote'];
export const SPECIAL_LABELS = ['EXCLUSIVE', 'CUSTOM', 'FOR PLAYER', 'ONE OF A KIND', 'STAFF GIFT', 'LEGENDARY'];
const HEX = /^#[0-9a-f]{6}$/i;
const clean = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);

export function installSpecial(api, { db, requireAdmin, bad, giveSerial, hooks }) {
  const D = db.data;
  // the looks: every built-in item of a type is a template (its model, slot, pattern...)
  const looks = () => {
    const out = {};
    for (const it of Object.values(D.items)) {
      if (it.custom || it.special || !SPECIAL_TYPES.includes(it.type) || !it.data) continue;
      const key = it.data.model || it.data.face || it.data.emote || it.data.pattern;
      if (!key) continue;
      const list = out[it.type] || (out[it.type] = []);
      if (!list.some((x) => x.key === key)) list.push({ key, id: it.id, name: it.name, data: it.data });
    }
    for (const list of Object.values(out)) list.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  };
  const row = (it) => ({
    id: it.id, name: it.name, type: it.type, data: it.data, description: it.description, special: it.special, created: it.created, offsale: true, price: 0,
    owners: Object.entries(D.inventory).filter(([, l]) => l.includes(it.id)).map(([uid]) => D.users[uid]?.username).filter(Boolean),
  });
  const plate = (b, old = {}) => ({
    label: clean(b.label, 18).toUpperCase() || old.label || 'EXCLUSIVE',
    color: HEX.test(b.labelColor) ? b.labelColor : old.color || '#8e44ff',
  });
  // the look of the item: the template's data with the admin's colors
  const lookData = (type, templateId, b, old) => {
    const t = D.items[+templateId];
    const base = t && t.type === type && !t.custom && !t.special ? t.data : old;
    if (!base) throw new Error('Pick what it looks like.');
    const data = JSON.parse(JSON.stringify(base));
    if (HEX.test(b.color) && type !== 'Face') data.color = b.color;
    if (HEX.test(b.accent) && data.accent !== undefined) data.accent = b.accent;
    if (type === 'Emote' && b.icon) data.icon = clean(b.icon, 4) || data.icon;
    return data;
  };
  const give = (it, names, by) => {
    const given = [];
    for (const n of names) {
      const u = Object.values(D.users).find((x) => !x.system && x.username.toLowerCase() === String(n).trim().toLowerCase());
      if (!u) continue;
      const inv = D.inventory[u.id] || (D.inventory[u.id] = []);
      if (inv.includes(it.id)) continue;
      inv.push(it.id);
      giveSerial(it, u.id);
      given.push(u.username);
      if (hooks.inbox) hooks.inbox(u.id, `You got a special item: ${it.name}!`, `${by} gave you ${it.name} (${it.special.label}). It's one of a kind: nobody can buy it.`);
    }
    return given;
  };

  api.get('/admin/special', requireAdmin, (req, res) => {
    const items = Object.values(D.items).filter((i) => i.special).sort((a, b) => b.created - a.created).map(row);
    res.json({ items, looks: looks(), types: SPECIAL_TYPES, labels: SPECIAL_LABELS });
  });
  api.post('/admin/special', requireAdmin, (req, res) => {
    const b = req.body || {};
    const name = clean(b.name, 50);
    if (name.length < 3) return bad(res, 'Give it a name (3 letters or more).');
    const type = SPECIAL_TYPES.includes(b.type) ? b.type : null;
    if (!type) return bad(res, 'Pick the kind of item.');
    let data;
    try { data = lookData(type, b.templateId, b); } catch (e) { return bad(res, e.message); }
    const id = db.nextId('item');
    const it = D.items[id] = {
      id, name, type, price: 0, data, creatorId: officialAccount(D)?.id || req.user.id, created: Date.now(), sales: 0, offsale: true, limited: false,
      description: clean(b.description, 300) || `A special item from the Robis team.`, special: plate(b),
    };
    const names = Array.isArray(b.giveTo) ? b.giveTo : String(b.giveTo || '').split(',');
    const given = give(it, names.filter((x) => String(x).trim()).slice(0, 50), req.user.username);
    db.save();
    res.json({ item: row(it), given });
  });
  api.patch('/admin/special/:id', requireAdmin, (req, res) => {
    const it = D.items[+req.params.id];
    if (!it || !it.special) return bad(res, 'Special item not found.', 404);
    const b = req.body || {};
    if (b.name !== undefined) { const n = clean(b.name, 50); if (n.length < 3) return bad(res, 'Give it a name (3 letters or more).'); it.name = n; }
    if (b.description !== undefined) it.description = clean(b.description, 300) || it.description;
    if (b.label !== undefined || b.labelColor !== undefined) it.special = plate(b, it.special);
    if (b.color !== undefined || b.accent !== undefined || b.templateId) {
      try { it.data = lookData(it.type, b.templateId, b, it.data); } catch (e) { return bad(res, e.message); }
    }
    db.save();
    res.json({ item: row(it) });
  });
  api.delete('/admin/special/:id', requireAdmin, (req, res) => {
    const it = D.items[+req.params.id];
    if (!it || !it.special) return bad(res, 'Special item not found.', 404);
    hooks.removeItem(it);
    db.save();
    res.json({ ok: true });
  });
}
