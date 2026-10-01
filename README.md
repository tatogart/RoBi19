<p align="center">
  <img src="public/img/icon.svg" width="96" alt="Robis logo">
</p>

<h1 align="center">ROBIS</h1>

<p align="center">
  <b>A 2019-era Roblox-style game platform, in one Node.js app.</b><br>
  Website, multiplayer 3D client, Lua scripting and <b>Robis Studio</b>, all running in the browser.
</p>

<p align="center">
  🇬🇧 English · <a href="README.ru.md">🇷🇺 Русский</a>
</p>

![Robis landing page](docs/screenshots/landing.jpg)

> **Disclaimer:** Robis is an open-source, non-commercial fan tribute to the 2019 era of user-generated
> game platforms. It isn't affiliated with, endorsed by, or connected to Roblox Corporation. All art
> (logo, textures, avatars, hats, faces, sounds) is generated procedurally in code. The project ships no copyrighted assets.

---

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Install on your phone](#install-on-your-phone)
- [Online server: play with friends](#online-server-play-with-friends)
- [Screenshots](#screenshots)
- [Controls](#controls)
- [Robis Studio](#robis-studio)
- [Lua scripting API](#lua-scripting-api)
- [Architecture](#architecture)
- [REST API](#rest-api)
- [Configuration](#configuration)
- [Tests](#tests)
- [Limitations and roadmap](#limitations-and-roadmap)

## Features

### 🌐 Website (the 2019 look)
- Blue top bar, left navigation, `Source Sans Pro` typeface, game cards with like ratio and player counts.
- **Landing page** with login/sign-up, drawn over a live 3D scene of the *Crossroads* map.
- **Home**: greeting with your headshot, friends row with presence (Online, In Game, In Studio), *Continue Playing*, recommendations and favorites.
- **Games**: Popular, Top Rated, Featured, Recently Updated and Most Visited, genre filter and search.
- **Game page**: big green ▶ button, the 2019 *"Robis is now loading. Get ready to play!"* dialog, likes and dislikes, favorites, stats, and a live **server list** you can join.
- **Catalog**: 48 items (hats, hair, faces, shirts, pants, T-shirts, gear) and **Limiteds** with stock. Buy them with **Robits (R$)**, the fictional currency.
- **Avatar editor** with a live, rotatable 3D R6 preview, body colours and a wear/unwear grid.
- **Profile** with status, blurb, *Currently Wearing*, friends, favorite games, **player badges** earned in games, and creations.
- **Friends** with requests and player search, **Messages** (inbox, sent, compose, reply), **Inventory**, **Robits** (daily stipend and transaction history), **Create** page, a blog, help and a 404 page (*"Oof!"*).
- All thumbnails (headshots, full-body renders, items, game icons) are rendered in the browser with Three.js. Game thumbnails are cached on the server.
- **Settings**: **Dark Theme** (like 2019's) and **English / Русский**, change your **username for R$1,000** (old names stay on the profile), change your password.
- **Chat & Party** bar (bottom right, like 2016–2019): friends online, one click to join their game.
- **Game invites**: Esc menu → Players → *Invite Friends*; the friend gets a popup with **Join** on any page or in their game.
- **Create Item (BETA)**: draw a T-shirt or face in the pixel editor (or upload a picture), or make shirts, pants, hats and hair from patterns, models and colours. Items go on sale in the Catalog; the creator gets 70%. Needs the *Item Creator* right.
- **Rights from the Admin Panel**: admins give players *Moderator* (ban, kick, mute), *Economy* (Robits, items, Builders Club), *Item Creator (BETA)* and *Game Curator* (choose Featured games).
- **Name badges** like on Roblox: a blue **verified check**, the **Robis icon** (official / staff) and a **Star Creator** star, shown next to the name on profiles, game and item pages, in chat and on the in-game player list. Nobody gets them automatically (only the official *Robis* account has the check and icon) — admins hand them out in **Admin Panel → Badges**.
- **Trading** like in 2019: open a player's profile → **Trade Items**, pick up to 4 items and some Robits on each side and send the offer. Trades live in **Trade** (Inbound / Outbound / Completed / Inactive); nothing changes hands until the other player accepts. Only paid or Limited items can be traded, Robits received in a trade have a 30% fee, and *Settings → Trading* chooses who may send you trades.
- **Taking items away**: in the Admin Panel, **Take items** shows a player's inventory — click an item to remove it (it's also taken off their avatar), or take everything at once.
- **Limiteds**: the *Limited Creator* right (Admin Panel → Permissions) lets a player tick **Make it a Limited** on the Create page and set a stock, or press **Make Limited** on any item page. When the stock sells out, the item can only be had through trades. A Limited that players already own can't be deleted by its creator.

### 🎮 Game client
- Multiplayer over WebSocket with a server-authoritative world and client-side character movement.
- Classic **R6 avatar** with walk, jump, fall, idle and tool-hold animations, emotes (`/e dance`, `/e dance2`, `/e dance3`, `/e wave`, `/e point`, `/e cheer`, `/e laugh`), and the **fall-apart death** with an *oof* sound synthesized with WebAudio.
- Follow camera: orbit with the right mouse button, zoom, **first person**, **Shift Lock**, and pull-in when walls block the view.
- Physics: capsule-vs-OBB collision with blocks, spheres, cylinders and wedges. You can climb steps, walk up ramps and **ride moving platforms**.
- The 2019 HUD: chat with the name-colour hash and **bubble chat**, a **leaderboard** built from `leaderstats`, a health bar, `Hint` and `Message` objects, and the escape menu (Players / Settings / Help, plus *Reset Character* and *Leave Game*). It also has the loading screen, disconnect dialogs, a **developer console (F9)** and **touch controls** for phones.
- Materials: Plastic with **studs and inlets**, Wood, WoodPlanks, Brick, Slate, Concrete, Marble, Granite, Metal, DiamondPlate, CorrodedMetal, Grass, Sand, Ice, Fabric, Glass, **Neon** and ForceField, all generated procedurally.
- A sky with procedural clouds, sun, moon and stars, a day/night cycle driven by `Lighting.ClockTime`, fog and shadows.
- Effects: `Fire`, `Sparkles`, `Smoke`, `PointLight`, `SpotLight`, `Explosion` (with knock-back), `BillboardText`, `ForceField` and `ClickDetector` (with a hover cursor).

### 🛠️ Robis Studio
- The 2019 layout: a **FILE** menu and HOME / MODEL / TEST / VIEW ribbon tabs, with Toolbox, Explorer, Properties, Output and a Command Bar.
- A 3D viewport with a fly camera (right mouse button + WASD/QE, wheel, middle-button pan, `F` to focus) and **Select / Move / Scale / Rotate** gizmos with grid and rotation snapping in world or local space.
- **Explorer**: tree view, multi-select, drag-and-drop reparenting, rename (F2), filter, context menu and *Insert Object*.
- **Properties**: typed editors (Vector3, Color3 with picker, BrickColor, enums, booleans, numbers) grouped by category.
- **Script editor** (CodeMirror) with Lua highlighting and tabs.
- **Play (F5)**: runs your unsaved place on a private test server inside the viewport. Server `print`/`warn`/errors (with stack traces) go to Output, and the Explorer shows the live game.
- Undo and redo, clipboard, duplicate, group and ungroup, Anchor, Lock, colour and material pickers, 90° rotate and tilt.
- A **Toolbox** of ready-made scripted models: Kill Brick, Checkpoint, Coin, Spinner, Moving Platform, Disappearing Brick, Speed and Jump Pads, Teleporter, Push Button, Lamp Post, Tree, Campfire, Brick House, a leaderboard script and a day/night script.
- Templates (Baseplate, Classic, Flat Terrain, Obby), **Publish to Robis** (it renders a thumbnail too), game settings, and save/open `.robis.json` files.

### 📜 Lua 5.3 scripting (server-side)
- Runs on [fengari](https://github.com/fengari-lua/fengari). Every `Script` is its own coroutine, and `wait()`, `spawn`, `delay`, `:Wait()` and `WaitForChild` really yield.
- Roblox-like API: `game`, `workspace`, `script`, `Instance.new`, `Vector3`, `CFrame`, `Color3`, `BrickColor`, `Enum`, `TweenInfo`, `UDim2`, `Random` and events (`Touched`, `Changed`, `PlayerAdded`, `Died`, …).
- Services: Players, Lighting, **TweenService**, **DataStoreService** (persistent), RunService (Heartbeat/Stepped), Debris, HttpService (JSON/GUID), **BadgeService** (badges show up on profiles), ReplicatedStorage, ServerStorage and ServerScriptService. `ModuleScript` works with `require`.
- Sandboxed: no `io`, `os.execute`, `require` of files or bytecode loading. A 10-second **script timeout** stops runaway loops.

### 🎲 Seventeen showcase games
| Game | What it shows |
|---|---|
| **Crossroads** | The classic hangout map with a tower, houses, a fountain and a day/night cycle |
| **Mega Fun Obby** | 8 stages, checkpoints, `leaderstats`, **DataStore** save, moving and fading platforms, a spinner, speed and jump pads, a badge |
| **Coin Rush** | Spinning coins (`RunService.Heartbeat`), leaderstats and a saved best score |
| **Lava Rising** | A round-based game loop with `Hint` timers, a rising lava tween and Wins |
| **Button Mania** | `ClickDetector` buttons, raining unanchored bricks, explosions and a party mode |
| **Disaster Island** | Rounds with random disasters: a flash flood, a meteor shower (tweens + `Explosion`) and an earthquake that unanchors buildings; the map is restored with `Clone()` |
| **Tower of Robis** | A spiral tower obby with lava, **truss climbing**, checkpoints, Wins and a badge |
| **Speed Run** | A neon course with a timer (`tick()`), speed pads and a best time saved in a DataStore |
| **Brick Tycoon** | Claim a plot, droppers send bricks down a conveyor for Cash, buy upgrades with buttons |
| **Robis Café** | A hangout: bake pizzas and grab sodas (`ClickDetector`), a jukebox dance party with lights |
| **Sprint Race** | Six lanes, a countdown, gates that open on GO, hurdles and places at the finish line |
| **Capture the Flag** | **Teams** (Red vs Blue, team spawns, team leaderboard): steal the flag, tag enemies on your half |
| **Freeze Tag** | Taggers freeze runners with a touch, runners unfreeze each other; 2+ players |
| **King of the Hill** | Hold the golden crown to score (double when alone), dodge the shockwave |
| **Happy Home in Robisia** | The classic family house: TV channels, fridge snacks, light switch, doorbell, pool, trampoline, the family car |
| **Minigame Mania** | A random minigame each round: Spleef, Color Crazy, Hot Floor, Shrinking Floor |
| **Robis Theme Park** | Ferris wheel, carousel and Drop Tower that carry you along, ice cream stand, balloons |

## Quick start

Requirements: **Node.js 18+** (tested on Node 22) and a browser with WebGL.

```bash
git clone <this repo> robis && cd robis
npm install
npm start
```

Open **http://localhost:3000** and press **Sign Up** to create your own account.

### Accounts

There are no ready-made accounts with passwords: every player signs up on the landing page (username 3–20 characters, password at least 6).

- **The first account created on a server becomes its admin.** It gets 1,000,000 R$, Outrageous Builders Club and every catalog item, can edit and delete any game, and can open the **Admin Panel** (⚙ menu or More). The panel can give players Robits and all items, change membership, make admins and ban.
- **Bans** (Admin Panel → Ban) log the player out and kick them from games. Choose the type: **Account only** (a normal ban) or **Account + device and IP** (they can't make a new account either; the admins' own devices and IPs are never blocked), and the length: 1 hour, 1/3/7/30 days or forever. Temporary bans lift themselves.
- **Chat commands** in any game (admins; a game's creator can use the fun ones in their own game). Targets: a name (or its start), `me`, `all`, `others`. Type `:cmds` for the list. They also work in the **F9 developer console**, which admins and game owners can open in any game to run server Lua (e.g. `workspace.Gravity = 50`).

  | Command | Does |
  |---|---|
  | `:kill` `:respawn` `:heal` | Kill, respawn or heal |
  | `:god` / `:ungod`, `:ff` / `:unff` | Can't be hurt / force field |
  | `:speed name 50`, `:jump name 120` | Walk speed and jump power |
  | `:freeze` / `:thaw` | Stop and release |
  | `:explode` `:fire` `:sparkles` `:clean` | Effects (and remove them) |
  | `:invisible` / `:visible` | Hide the character |
  | `:tp a b`, `:bring name`, `:to name` | Teleports |
  | `:mute` / `:unmute`, `:kick name reason` | Moderation |
  | `:announce text`, `:hint text`, `:time 0-24` | Big message, top bar, time of day |
  | `:ban name [1h\|1d\|7d\|30d] reason`, `:hardban …`, `:unban name` | Account ban, account + device ban, unban (admins) |
- **Admin code.** Start the server with `ROBIS_ADMIN_CODE=your-code npm start` and any account can become an admin via ⚙ → **Enter Admin Code**. In the phone version (GitHub Pages) there is no "first account" rule: admin is given **only** by the secret admin code, which only the owner of the repository knows (the app stores just its SHA-256 hash, `standalone/admin-code.sha256`). To use your own code, build with `ROBIS_ADMIN_CODE=your-code npm run build:standalone`.
- **Robits and Builders Club can't be bought.** Players earn Robits with the daily stipend (25 R$, or 40 / 60 / 85 R$ with BC / TBC / OBC). Only admins give out Robits and memberships, in the Admin Panel. The currency is fictional and no real money is ever charged.
- Every new player gets **100 R$** and the starter items: Bacon Hair, Pal Hair, Smile, Man Face, Woman Face, Blue Hoodie, Jeans, Robis Logo T-Shirt and Classic Robis Cap. Another 25 R$ can be collected every day.
- `Robis` is a built-in "official" system account that owns the catalog and the showcase games. It has no password: nobody can log into it, message it or send it friend requests.
- Forgot a password? Stop the server and run `npm run reset-password YourName` to print a new one, or `npm run reset-password YourName new-password` to choose it.

Useful commands:

```bash
npm run dev     # restart automatically on server changes (node --watch)
npm run seed    # WIPE ./data and recreate the default world
npm run reset-password <user> [password]   # reset a player's password (server stopped)
npm test        # run the test suite
npm run build:standalone   # build the phone (standalone) app into dist/
```

Docker:

```bash
docker build -t robis .
docker run -p 3000:3000 -v robis-data:/data robis
```

## Install on your phone

Robis has a **standalone version** that runs entirely on the phone, with no computer needed. The server, Lua scripts, accounts and games run inside the phone's browser, and the data is stored on the phone. After the first visit it works **even without internet**.

### Install (1 minute)

1. **Open** **https://tatogart.github.io/RoBi19/** on your phone. The first visit needs internet to download the app (about 3 MB).
2. **Create an account:** tap **Sign Up** and choose a username and password. Accounts are regular players; the owner gets admin via ⚙ → **Enter Admin Code**.
3. **Add it to the home screen:**
   - **Android (Chrome):** the **⋮** menu → **Install app** (or **Add to Home screen**) → **Install**.
   - **iPhone / iPad (Safari):** the **Share** button (square with an up arrow) → **Add to Home Screen** → **Add**.
4. **Done.** Open Robis from the blue icon like any other app. You can even turn on airplane mode: games, the avatar editor, the catalog and Studio keep working.

To play: pick a game → green ▶ button → turn the phone sideways → fullscreen button. Thumbstick on the left, jump on the right, swipe to turn the camera, pinch to zoom.

### Good to know

- **Everything lives on the phone.** Accounts, items, games and DataStore saves are kept in the browser's storage. Clearing the site's data, or removing the app together with its data, starts a new world.
- **On iPhone, add the icon to the home screen.** Safari may delete data of sites you haven't opened for 7 days, but home-screen apps are exempt.
- **Each phone has its own world**, but you can still play together: see [Play with friends in the app](#play-with-friends-in-the-app). For one shared world with shared accounts, use the [online server](#online-server-play-with-friends).
- **Updates install themselves.** The app checks for a new version when you open it (and every 30 minutes) and reloads with it; during a game it waits until you leave.
- Use Robis in one tab: two open tabs can overwrite each other's data.

### Play with friends in the app

1. **The host** opens a game and taps **Play with friends**. A **room code** (like `K7QM4X`) appears in the game; tap **Share** to send it.
2. **Friends** tap **Join a friend** (on Home, on any game page, or in the ⚙ menu) and enter the code.
3. Everyone plays in the host's game: multiplayer, chat, team games and the host's admin commands and bans all work. Friends appear in the host's world with their own name and avatar.

Both devices need internet (Wi-Fi or mobile data). The public PeerJS server only introduces the devices; the game itself goes directly between them. The room lives as long as the host stays in the game.

### Install on a PC or Mac

The same app installs on a computer as easily as on a phone:

1. Open **https://tatogart.github.io/RoBi19/** in **Chrome** or **Edge** (Windows, macOS, Linux, ChromeOS).
2. Press **Install Robis** (on the start page or in the ⚙ menu) and confirm. Or click the install icon at the right end of the address bar.
3. Robis gets its own window and an icon on the desktop / Start menu / Dock, works offline and updates itself.

On a Mac with **Safari**: File → **Add to Dock**. Firefox can't install web apps; use Chrome or Edge.

### For the repository owner: publishing the link

The link above works after the first deployment:

1. Merge the branch into `main`.
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The `.github/workflows/pages.yml` workflow builds the standalone app (`npm run build:standalone`) and publishes it. Every push to `main` updates the app, and phones pick up the update the next time they open it online.

To build by hand, run `npm run build:standalone`. It produces a `dist/` folder you can put on any static host. If the site isn't served from the domain root, set the path: `ROBIS_BASE=/folder-name npm run build:standalone`.

### Playing together over Wi-Fi (server version)

To share one world, run `npm start` on a computer. The console prints an address like `http://192.168.1.23:3000`; open it on phones on the same Wi-Fi. On Windows, allow Node.js through the firewall for private networks if it doesn't load. To play over the internet, use a tunnel (`npx cloudflared tunnel --url http://localhost:3000`) or deploy with the `Dockerfile`.

## Online server: play with friends

For real multiplayer everyone plays on **one server**: one world, shared accounts, friends, chat, team games, bans. The phone/PC app then simply opens that server.

### Option 1: your own server (recommended)

Rent a small **VPS** (virtual server). What to pick: **Ubuntu 24.04** (or 22.04), **1 CPU, 1–2 GB RAM**, a public IPv4 address. That is enough for dozens of players. Any provider works; for example Timeweb Cloud, Beget, REG.RU or Selectel (roughly 200–400 ₽ a month), or Hetzner abroad (about €4 a month). Prices change, so check on the provider's site.

1. Buy the VPS with **Ubuntu**. The provider gives you its **IP address** and the **root password**.
2. Connect to it:
   - Windows / Mac / Linux: open a terminal (on Windows: PowerShell) and type `ssh root@YOUR_IP`, then the password.
   - Phone: install the **Termius** app → New host → IP, user `root`, password.
3. Paste this **one command** and press Enter:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/tatogart/RoBi19/main/scripts/install-server.sh | sudo bash
   ```

   It asks two questions; just press Enter to accept the defaults (a free address like `1-2-3-4.sslip.io` and a random admin code). In 2–3 minutes it prints your **link** and **admin code**.
4. Open the link, sign up, then ⚙ → **Enter Admin Code** to become the admin. Send the link to your friends.

What the installer sets up: Node.js, Robis as a service that restarts itself, **HTTPS** through Caddy, and **automatic updates**: every 10 minutes the server checks this GitHub repository and updates itself (open pages reload on their own). Data is kept in `/var/lib/robis`.

Your own domain (optional): point its **A record** to the server IP, then run the command again with `ROBIS_DOMAIN=play.example.com` in front of `sudo bash`. Useful commands: `journalctl -u robis -f` (logs), `systemctl restart robis`, settings in `/etc/robis.env`.

### Send the app to your server

Tell the phone/PC app where the server is, and everyone who opens **https://tatogart.github.io/RoBi19/** (or the installed app) lands on your server automatically: add the link in *GitHub → Settings → Secrets and variables → Actions → Variables* as `ROBIS_SERVER_URL` (or put it in `standalone/server-url.txt`) and push to `main`. The server's own site can be installed as an app too (**Install Robis** in the ⚙ menu). With no internet the app can still open the on-device world: add `?offline=1` to the address.

### Option 2: free server on Render

Free, but it falls asleep without players and wipes its disk on restarts (the server keeps an encrypted backup on GitHub to survive that).

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/tatogart/RoBi19)

1. **Make a GitHub token** so accounts survive restarts: [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) → *Repository access: Only select repositories* → `RoBi19` → *Permissions → Contents: Read and write* → **Generate token**. Copy it.
2. Tap **Deploy to Render** above and sign in with GitHub.
3. Fill in `ROBIS_ADMIN_CODE` (your secret admin code) and `ROBIS_BACKUP_TOKEN` (the token from step 1).
4. Tap **Deploy Blueprint** and wait 2–3 minutes. You get a link like `https://robis-xxxx.onrender.com`.

Good to know:
- The free server **falls asleep after 15 minutes** without players. The first visit after that takes about a minute to load. Paid Render plans don't sleep.
- The encrypted backup lives on the `robis-data` branch, updated every minute while something changes. The encryption key is your admin code (or `ROBIS_BACKUP_KEY`). If you change the code, set `ROBIS_BACKUP_KEY` to the old code, or the old data can't be read.
- Every push to `main` redeploys the server automatically.

## Screenshots

| | |
|---|---|
| ![Home](docs/screenshots/home.jpg) | ![Games](docs/screenshots/games.jpg) |
| ![Catalog](docs/screenshots/catalog.jpg) | ![Avatar editor](docs/screenshots/avatar.jpg) |
| ![In game](docs/screenshots/ingame.jpg) | ![Lava Rising](docs/screenshots/lava.jpg) |
| ![Robis Studio](docs/screenshots/studio.jpg) | ![Script editor](docs/screenshots/studio-script.jpg) |

## Controls

On phones and tablets the game shows the 2019-style **dynamic thumbstick**: touch anywhere in the lower-left area to move, drag elsewhere to turn the camera, pinch to zoom, and use the round **jump** button. The top bar also gets a **fullscreen** button, which locks landscape where the browser allows it. You can also add Robis to your home screen as an app (PWA).


| Action | Keys |
|---|---|
| Move | `W A S D` / arrow keys (touch: left thumbstick) |
| Jump | `Space` (touch: JUMP button) |
| Rotate camera | hold the right mouse button (touch: drag) |
| Zoom / first person | mouse wheel, `I` / `O` |
| Shift Lock | `Shift` |
| Chat / emotes | `/` then e.g. `/e dance` |
| Player list | `Tab` |
| Menu | `Esc` (then `R` to reset, `L` to leave) |
| Developer console | `F9` (game owners can run server Lua here) |

## Robis Studio

Open it from **Create → Open Robis Studio**, or from **Edit in Studio** on your game's page.

| Shortcut | Action |
|---|---|
| `F5` / `Shift+F5` | Play / Stop |
| `Ctrl+1..4` | Select / Move / Scale / Rotate |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+C / X / V`, `Ctrl+Shift+V` | Copy / Cut / Paste, Paste Into |
| `Ctrl+D` | Duplicate |
| `Ctrl+G` / `Ctrl+U` | Group / Ungroup |
| `Ctrl+R` / `Ctrl+T` | Rotate 90° / Tilt 90° |
| `Ctrl+L` | Toggle world or local transform space |
| `Delete`, `F2`, `F` | Delete, Rename, Focus the selection |
| `Ctrl+S` | Publish to Robis |
| Right mouse + `W A S D Q E` | Fly the camera (`Shift` = slow) |

Workflow: pick a template, build with parts and the Toolbox, add a `Script` to **ServerScriptService**, press **F5** to test, then **Publish**. New games start **private**. Open *Game Settings* to make yours public, and it shows up on the Games page.

## Lua scripting API

```lua
-- ServerScriptService/Leaderboard
local Players = game:GetService("Players")
local store = game:GetService("DataStoreService"):GetDataStore("Coins")

Players.PlayerAdded:Connect(function(player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	stats.Parent = player

	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Value = store:GetAsync(player.UserId) or 0
	coins.Parent = stats
end)

Players.PlayerRemoving:Connect(function(player)
	store:SetAsync(player.UserId, player.leaderstats.Coins.Value)
end)

-- A kill brick
workspace.Lava.Touched:Connect(function(hit)
	local humanoid = hit.Parent:FindFirstChild("Humanoid")
	if humanoid then humanoid.Health = 0 end
end)

-- A moving platform
local TweenService = game:GetService("TweenService")
local info = TweenInfo.new(3, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true)
TweenService:Create(workspace.Platform, info, {Position = Vector3.new(0, 10, -40)}):Play()
```

<details>
<summary><b>Full API reference</b></summary>

**Globals:** `game`, `workspace`, `script`, `print`, `warn`, `error`, `wait(t)`, `spawn(fn)`, `delay(t, fn)`, `tick()`, `time()`, `typeof(v)`, `require(module)`, `shared`, `Instance.new(class, parent?)`, `Vector3.new/zero/one`, `CFrame.new/Angles/fromOrientation/fromAxisAngle/lookAt`, `Color3.new/fromRGB/fromHSV/fromHex`, `BrickColor.new/random/Red()…`, `UDim2.new`, `TweenInfo.new`, `Random.new`, `Enum.*`. It also adds Lua 5.1 helpers: `unpack`, `loadstring`, `table.getn`, `math.pow`, `math.clamp`, `math.round`, `math.sign` and `string.split`.

**Instance:** `Name`, `Parent`, `ClassName`, `Archivable`, `FindFirstChild(name, recursive)`, `FindFirstChildOfClass`, `FindFirstChildWhichIsA`, `FindFirstAncestor…`, `WaitForChild(name, timeout)`, `GetChildren`, `GetDescendants`, `IsA`, `IsDescendantOf`, `IsAncestorOf`, `GetFullName`, `Clone`, `Destroy`, `ClearAllChildren`, `GetPropertyChangedSignal`. Events: `Changed`, `ChildAdded`, `ChildRemoved`, `DescendantAdded`, `DescendantRemoving` and `AncestryChanged`. You can also reach children as `parent.ChildName` or `parent["Child Name"]`.

**Classes:** `Part` (`Shape` Block/Ball/Cylinder), `WedgePart`, `CornerWedgePart`, `TrussPart`, `SpawnLocation` (`Enabled`, `Duration` = forcefield time), `Seat`, `Model` (`PrimaryPart`, `MoveTo`, `GetBoundingBox`, `SetPrimaryPartCFrame`, `PivotTo`, `TranslateBy`), `Folder`, `Configuration`, `Script`, `ModuleScript`, `BindableEvent`, `IntValue`, `NumberValue`, `StringValue`, `BoolValue`, `ObjectValue`, `Vector3Value`, `Color3Value`, `Humanoid` (`Health`, `MaxHealth`, `WalkSpeed`, `JumpPower`, `TakeDamage`, `Died`, `HealthChanged`), `Player` (`UserId`, `Character`, `RespawnLocation`, `LoadCharacter`, `Kick`, `CharacterAdded`, `Chatted`), `PointLight`, `SpotLight`, `Fire`, `Sparkles`, `Smoke`, `Explosion` (`BlastRadius`, `BlastPressure`, `Hit`), `ClickDetector` (`MouseClick(player)`), `BillboardText`, `Hint`, `Message`, `ForceField`, `Team` and `Decal`.

**BasePart:** `Position`, `Orientation`, `CFrame`, `Size`, `Color`, `BrickColor`, `Material`, `Transparency`, `Reflectance`, `Anchored`, `CanCollide`, `Locked`, `TopSurface` and `BottomSurface`. Its events are `Touched` and `TouchEnded`. Unanchored parts fall and stack with simple physics.

**Services:** `Players` (`PlayerAdded`, `PlayerRemoving`, `GetPlayers`, `GetPlayerFromCharacter`, `GetPlayerByUserId`, `RespawnTime`, `CharacterAutoLoads`), `Lighting` (`ClockTime`, `TimeOfDay`, `Brightness`, `Ambient`, `OutdoorAmbient`, `FogStart`, `FogEnd`, `FogColor`, `SkyColor`, `SetMinutesAfterMidnight`), `TweenService` (`Create`; each tween has `Play/Pause/Cancel` and `Completed`, with every easing style and direction, repeats, reverses and delay), `DataStoreService` (`GetDataStore(name, scope)`, then `GetAsync`, `SetAsync`, `UpdateAsync`, `IncrementAsync` and `RemoveAsync`), `RunService` (`Heartbeat`, `Stepped`), `Debris` (`AddItem`), `HttpService` (`JSONEncode`, `JSONDecode`, `GenerateGUID`), `BadgeService` (`AwardBadge(userId, name)`) and `Chat` (`Chat(part, text)` for a bubble).

**Datatypes:** `Vector3` supports `+ - * /`, `Magnitude`, `Unit`, `Dot`, `Cross` and `Lerp`. `CFrame` supports `*` with a CFrame or Vector3, `+/-` with a Vector3, `Position`, `LookVector`, `RightVector`, `UpVector`, `Inverse`, `Lerp`, `ToWorldSpace`, `ToObjectSpace` and `ToEulerAnglesXYZ`. `Color3` has `R/G/B`, `Lerp` and `ToHex`. `BrickColor` has `Name`, `Number` and `Color`.

</details>

## Architecture

```
robis/
├── server/                 Node.js (Express 5 + ws)
│   ├── index.js            HTTP server, static files, WebSocket entry
│   ├── api.js              REST API (auth, users, friends, messages, catalog, avatar, games, studio)
│   ├── auth.js / db.js     scrypt passwords + cookie sessions, JSON-file database (./data)
│   ├── game/
│   │   ├── GameServer.js   one running server: DataModel, players, characters, touches,
│   │   │                   unanchored physics, explosions, replication @30 Hz
│   │   ├── lua.js          fengari bridge: userdata ↔ instances, coroutine scheduler, sandbox
│   │   ├── services.js     TweenService, DataStore, Debris, HttpService, BadgeService…
│   │   ├── manager.js      finds or creates servers per game, Studio test servers
│   │   └── chatfilter.js   2019-style "####" filter
│   ├── local/              standalone build: the same server running in the browser (IndexedDB, in-page socket)
│   └── seed/               seed accounts, catalog, 5 games, Studio templates
├── shared/                 runs on both server and browser (ES modules)
│   ├── engine/types.js     Vector3, CFrame, Color3, BrickColor, Enum, TweenInfo
│   ├── engine/instances.js Instance tree, class schemas, signals, services
│   ├── engine/serialize.js place files and the replication format
│   ├── engine/physics.js   OBB/sphere collision, SAT, spatial grid, character controller
│   └── avatar.js           catalog definitions and the avatar model
├── public/                 static front-end (no build step, import maps)
│   ├── js/site/            website pages
│   ├── js/render/          Three.js: parts, materials, sky, avatars, thumbnails
│   ├── js/game/            game client: net mirror, camera, input, HUD, characters, sounds
│   └── js/studio/          Robis Studio: viewport, explorer, properties, editor, toolbox
└── test/                   node:test suites (engine, Lua runtime, server + WebSocket)
```

**How a game session works**

1. The browser opens `/play?placeId=N`, connects to `/ws` (authenticated by the session cookie) and sends `join`.
2. `GameManager` puts the player in a non-full server or starts a new one. The server loads the place, starts its Scripts, creates a `Player`, fires `PlayerAdded` and spawns the character at a `SpawnLocation`.
3. The server replicates `Workspace`, `Players`, `Lighting`, `ReplicatedStorage`, `StarterGui` and `Teams` as a snapshot. After that it sends batched `add`, `rem` and `set` operations at 30 Hz. `ServerScriptService`, `ServerStorage` and script sources never leave the server.
4. Each client simulates its own character (as with Roblox network ownership) and streams its position at 20 Hz. The server poses the character model, detects `Touched` with an OBB separating-axis test, and runs scripts, tweens and physics.

## REST API

All endpoints live under `/api` and use JSON. Authentication goes through the `robis_session` HttpOnly cookie.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Users | `GET /users?q=`, `GET /users/:id`, `PATCH /users/me`, `GET /users/:id/{friends,games,favorites,inventory}` |
| Friends | `GET /friends/requests`, `POST /friends/:id/{request,accept,decline}`, `DELETE /friends/:id` |
| Messages | `GET /messages?box=inbox\|sent`, `POST /messages`, `POST /messages/:id/read` |
| Avatar | `GET /avatar`, `PUT /avatar` |
| Catalog | `GET /catalog?type=&q=&sort=`, `GET /catalog/:id`, `POST /catalog/:id/buy` |
| Economy | `POST /economy/stipend`, `GET /economy/transactions` |
| Games | `GET /games?sort=&q=&genre=`, `GET /games/recent`, `GET/PATCH/DELETE /games/:id`, `POST /games`, `GET/PUT /games/:id/place`, `GET/PUT /games/:id/thumbnail`, `GET /games/:id/preview`, `GET /games/:id/servers`, `POST /games/:id/{vote,favorite}` |
| Studio | `GET /templates`, `GET /templates/:key` |
| Misc | `GET /stats` |

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `ROBIS_DATA` | `./data` | Folder for `db.json`, place files and thumbnails |
| `ROBIS_LOG_SCRIPTS` | unset | Set it to `1` to also print game output in the server console |
| `ROBIS_ADMIN_CODE` | unset | Secret admin code (⚙ → Enter Admin Code). When set, the first account is no longer made admin automatically |
| `ROBIS_BACKUP_TOKEN` | unset | GitHub token (Contents: read and write) for encrypted backups to a branch; see [Online server](#online-server-play-with-friends) |
| `ROBIS_BACKUP_REPO` | `RENDER_GIT_REPO_SLUG` | `owner/repo` for backups |
| `ROBIS_BACKUP_BRANCH` | `robis-data` | Branch that holds the backup |
| `ROBIS_BACKUP_KEY` | `ROBIS_ADMIN_CODE` | Password the backup is encrypted with |

## Tests

```bash
npm test
```

There are 22 tests. They cover the math types, the instance tree, serialization, collision and the character controller. The Lua runtime tests cover yields, events, errors, timeouts, the sandbox, TweenService, DataStore and modules. The integration tests cover sign-up and login, purchases, avatar rules, publishing a place, joining over WebSocket, replication, the chat filter, private games and Studio test sessions.

## Limitations and roadmap

- Only server `Script`s run. `LocalScript`s and GUI objects (`ScreenGui`) are stored but don't execute on the client yet.
- The physics is intentionally simple. Unanchored parts fall and stack, but there is no rotation, joints or welds.
- No real Terrain, meshes, audio assets or image uploads. Everything is procedural.
- In the standalone (phone/PC) app every device has its own world; multiplayer works through [rooms](#play-with-friends-in-the-app) hosted by one player, or the [online server](#online-server-play-with-friends).
- Ideas: LocalScripts running in the browser, Tools with `Activated`, ScreenGui, teams, Team Create in Studio and trading.

## License

[MIT](LICENSE). Made with nostalgia for the Tix, the oofs and the bacon hair.
