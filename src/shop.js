// The in-game store: catalog, ownership and buying. Prices are in credits.
// `name` is the Dutch reference name; on-screen names come from src/i18n.js.

export const CATEGORIES = ['skins', 'boosts', 'weapons'];

// Skins change the colours of the player's cell.
export const SKINS = [
  { id: 'skin-classic', name: 'Klassiek', price: 0, head: '#ffffff', tail: '#ffffff' },
  { id: 'skin-pink', name: 'Roze', price: 500, head: '#ffc2d6', tail: '#ff9ebd' },
  { id: 'skin-mint', name: 'Mint', price: 1000, head: '#c4f5df', tail: '#8de8c0' },
  { id: 'skin-lemon', name: 'Citroen', price: 2500, head: '#fff3a8', tail: '#ffe066' },
  { id: 'skin-lavender', name: 'Lavendel', price: 5000, head: '#e0d1ff', tail: '#b89cff' },
  { id: 'skin-ocean', name: 'Oceaan', price: 7500, head: '#a8e4ff', tail: '#4fc3f7' },
  { id: 'skin-gold', name: 'Goud', price: 10000, head: '#ffd95e', tail: '#e0a800' },
  { id: 'skin-neon', name: 'Neon', price: 15000, head: '#b6ff3b', tail: '#00e5ff' },
  { id: 'skin-galaxy', name: 'Galaxy', price: 25000, head: '#7c5cff', tail: '#ff6ad5' },
];

// Boosts, weakest to strongest. Their effect starts from a mystery box (ZR-13).
export const BOOSTS = [
  { id: 'boost-heart', name: 'Extra hartje', price: 0 },
  { id: 'boost-shield', name: 'Onkwetsbaar', price: 10000 },
  { id: 'boost-double', name: 'Score x2 (20 s)', price: 20000 },
];

// Weapons, weakest to strongest. Their effect starts from a mystery box (ZR-13).
export const WEAPONS = [
  { id: 'weapon-sword', name: 'Zwaard', price: 0 },
  { id: 'weapon-handgun', name: 'Handwapen', price: 10000 },
  { id: 'weapon-standard', name: 'Shotgun', price: 20000 }, // id kept for owned items (ZR-54)
  { id: 'weapon-minigun', name: 'Minigun', price: 30000 },
  { id: 'weapon-missile', name: 'Raketwapen', price: 30000 },
  { id: 'weapon-laser', name: 'Laser', price: 40000 },
];

export const CATALOG = { skins: SKINS, boosts: BOOSTS, weapons: WEAPONS };

// Owned without buying: the classic skin, a heart and the sword.
export const DEFAULT_OWNED = ['skin-classic', 'boost-heart', 'weapon-sword'];

// Active per category; only active items are used in a run.
export const SLOT_OF = { skins: 'skin', boosts: 'boost', weapons: 'weapon' };
export const DEFAULT_EQUIPPED = { skin: 'skin-classic', boost: 'boost-heart', weapon: 'weapon-sword' };

export function categoryOf(id) {
  return CATEGORIES.find((category) => CATALOG[category].some((i) => i.id === id)) ?? null;
}

export function findItem(id) {
  for (const category of CATEGORIES) {
    const item = CATALOG[category].find((i) => i.id === id);
    if (item) return item;
  }
  return null;
}

// Owned items: the defaults plus every known item that was bought.
export function normalizeOwned(ids) {
  const known = ids.filter((id) => findItem(id));
  return [...new Set([...DEFAULT_OWNED, ...known])];
}

// Active items: a stored choice is kept only when it is owned and fits its
// slot; otherwise the default for that slot.
export function normalizeEquipped(equipped, owned) {
  const result = { ...DEFAULT_EQUIPPED };
  for (const category of CATEGORIES) {
    const slot = SLOT_OF[category];
    const id = equipped?.[slot];
    if (categoryOf(id) === category && owned.includes(id)) result[slot] = id;
  }
  return result;
}

export function isEquipped(s, id) {
  return s.equipped[SLOT_OF[categoryOf(id)]] === id;
}

// Makes an owned item active. Returns 'equipped', 'active' (already) or
// 'not-owned' and only changes the state when it equips.
export function equip(s, id) {
  if (!s.owned.includes(id)) return 'not-owned';
  if (isEquipped(s, id)) return 'active';
  s.equipped = { ...s.equipped, [SLOT_OF[categoryOf(id)]]: id };
  return 'equipped';
}

export function equippedSkin(s) {
  return findItem(s.equipped.skin);
}

// Tries to buy an item. Returns 'bought', 'owned' or 'too-expensive' and only
// changes the state when the item is bought.
export function buy(s, id) {
  const item = findItem(id);
  if (s.owned.includes(id)) return 'owned';
  if (s.credits < item.price) return 'too-expensive';
  s.credits -= item.price;
  s.owned = [...s.owned, id];
  return 'bought';
}
