# Robis Test Cheat

This branch (`claude/robis-test-cheat`) is **only for testing** the anti-cheat
and Robis Overwatch. It is never merged into `main`.

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
