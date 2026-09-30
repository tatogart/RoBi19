import { initPage } from '../layout.js';
import { el } from '../ui.js';

await initPage({ active: 'blog', requireAuth: false });
const app = document.getElementById('app');
const POSTS = [
  ['December 2019', 'Create your own items (BETA)', 'Players with the Item Creator right can now design T-shirts and faces (draw them or upload a picture), shirts, pants, hats and hair. Your creations go on sale in the Catalog and you get 70% of every sale. Find it on the Create page!'],
  ['December 2019', 'Invite friends to your game', 'Open the menu in any game, go to Players and press Invite Friends. Your friends get a popup with a Join button wherever they are on Robis.'],
  ['November 2019', 'Dark Theme and Russian', 'Robis now has a Dark Theme — easy on the eyes at night — and speaks Russian! Change both in Settings.'],
  ['November 2019', 'Chat & Party', 'See which friends are online from any page with the new Chat & Party bar in the bottom right corner. Jump straight into their game with one click.'],
  ['October 2019', 'New places: Minigame Mania, Happy Home and more', 'Survive random minigames, hang out at the classic family home or ride the Ferris wheel at the Robis Theme Park. Freeze Tag, Capture the Flag and King of the Hill are waiting for you and your friends too.'],
  ['December 2019', 'Robis Studio gets a Command Bar', 'Test sessions now come with a Lua command bar. Type any code while your game is running and see the result in the Output window instantly. Happy scripting!'],
  ['November 2019', 'Introducing DataStores', 'Your games can now remember players between sessions. Use DataStoreService:GetDataStore() to save stages, coins, wins — anything JSON-friendly. Mega Fun Obby already uses it to save your progress.'],
  ['October 2019', 'TweenService is here', 'Smoothly animate any property of any part with TweenService:Create(part, TweenInfo.new(...), {Position = ...}):Play(). Moving platforms have never been easier.'],
  ['September 2019', 'The Catalog has Limiteds', 'Collectible items like the Sparkle Time Halo and the Dominator of Robis are now available — but only while supplies last!'],
  ['August 2019', 'Welcome to Robis!', 'Robis is a place to play games made by the community and to build your own. Grab Robis Studio from the Create page and make something amazing.'],
];
app.append(el('h1', { text: 'Robis Blog' }), ...POSTS.map(([date, title, text]) => el('article', { class: 'panel' },
  el('div', { class: 'small muted', text: date }), el('h2', { text: title }), el('p', { text }))));
