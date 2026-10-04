# Robis Test Cheat

This branch (`claude/robis-test-cheat`) is **only for testing** the anti-cheat
and Robis Overwatch. It is never merged into `main`.

## 1. The injected cheat (any server, any phone - nothing to install)

`cheat/robis-cheat.js` is injected into a game that is already open, so it
works on the real Robis (the VPS) too, and on a phone without a computer.
It changes what your game sends to the server: the anti-cheat sees it and
makes an Overwatch case within a few seconds.

**As a bookmark (phone or computer):**
1. Make a new bookmark of any page (star in the browser).
2. Edit it: name `Robis Cheat`, and as the address paste ALL of
   `cheat/bookmarklet.txt` (it starts with `javascript:`).
3. Open a game on Robis, walk one step, then:
   - phone (Chrome): tap the address bar, type `Robis Cheat`, tap the bookmark
     (the one with the star) in the list;
   - computer: click the bookmark.
4. A red panel appears: ⚡ speed hack (x2 - x6), 🕊 fly (▲ up / ■ stop /
   ▼ down), ⏩ blink 15 studs forward, 🚀 +50 up, ✨ random teleport. Drag it by
   its title, "–" folds it. Tap the bookmark again to hide / show it.

**As a userscript (Tampermonkey / Kiwi browser):** install
`cheat/robis-cheat.user.js` - it starts in every game by itself.

After changing `cheat/robis-cheat.js`: `node cheat/build.mjs` makes the
bookmarklet and the userscript again.


## 2. The built-in cheat (this branch's own server)

Run it on a test server (not the real one), open any game and press **F8**
(or the red "TEST CHEAT" button):

- ⚡ Speed hack (x2 - x6)
- 🕊 Fly hack
- 🧱 Noclip (through walls)
- ✨ Ctrl + click teleport

The server's anti-cheat notices it within a few seconds and makes a real case:
Admin Panel -> Overwatch -> Real cases, and investigators get it in Overwatch.

The cheat is `public/js/game/testcheat.js` (3 lines in `client.js` load it).

## On a phone

Tap the red **🛠 TEST CHEAT** button (top left). Fly: the game's Jump button
goes up, ▼ goes down. Teleport: turn on "Tap teleport", tap **📍 Tap to
teleport**, then tap the spot.

To open it on a phone, run this branch on a computer (`npm start`) and open
`http://<the computer's IP>:3000` on the phone, on the same Wi-Fi.
