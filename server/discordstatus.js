// "Playing Robis" in the player's Discord profile (Rich Presence).
//
// A web page can't talk to the Discord app on the computer, so the player runs
// a tiny helper: RobisDiscordStatus.bat (Windows, nothing to install). It talks
// to Discord through its local pipe and asks this server every 15 seconds what
// the player is doing (by a private key in the file).
//
// Needs only the Application ID of a Discord application (Admin Panel ->
// Settings -> Discord) and, for the picture, an art asset named "robis".

const newKey = () => Array.from({ length: 32 }, () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)]).join('');

export function installDiscordStatus(api, { db, manager, requireUser, bad, presence, siteSettings }) {
  const D = db.data;
  const S = () => siteSettings(D).discord;
  const enabled = () => !!(S().status && S().appId);
  const keyOf = (u) => u.discordKey || (u.discordKey = newKey());
  const origin = (req) => {
    const host = req.get('host') || 'localhost';
    const proto = req.headers['x-forwarded-proto'] || (/^(localhost|127\.|192\.168\.|10\.)/.test(host) ? 'http' : 'https');
    return `${String(proto).split(',')[0]}://${host}`;
  };

  // What the helper shows. Times are in milliseconds (Discord's local API).
  const statusOf = (u, site) => {
    const p = presence(u);
    if (p.status === 'ingame') {
      const f = manager.findUser(u.id);
      const g = D.games[p.gameId];
      if (!f || !g) return { clear: true };
      const others = f.server.playerCount - 1;
      return {
        details: `Playing ${g.name}`.slice(0, 120),
        state: f.server.privateId ? 'In a private server' : others > 0 ? `With ${others} other player${others === 1 ? '' : 's'}` : 'Playing solo',
        start: f.session.joinedAt || Date.now(),
        buttons: [{ label: 'Play this game', url: `${site}/game?id=${g.id}` }, { label: 'Robis', url: site }],
      };
    }
    if (p.status === 'studio') return { details: 'Building in Robis Studio', state: 'Making a game', start: u.lastOnline || Date.now(), buttons: [{ label: 'Robis', url: site }] };
    if (p.status === 'online') return { details: 'Browsing Robis', state: 'On the website', buttons: [{ label: 'Robis', url: site }] };
    return { clear: true };
  };

  api.get('/me/discord-status', requireUser, (req, res) => {
    const key = keyOf(req.user);
    db.save();
    res.json({ enabled: enabled(), key, now: statusOf(req.user, origin(req)) });
  });
  // a new key: the old file stops working (if it was shared by mistake)
  api.post('/me/discord-status/reset', requireUser, (req, res) => {
    req.user.discordKey = newKey();
    db.save();
    res.json({ ok: true });
  });

  // Asked by the helper every 15 seconds.
  api.get('/presence/discord/:key', (req, res) => {
    if (!enabled()) return res.json({ clear: true, off: true });
    const key = String(req.params.key || '');
    const u = /^[0-9a-z]{32}$/.test(key) && Object.values(D.users).find((x) => x.discordKey === key);
    if (!u) return bad(res, 'Unknown key. Download the Discord status app again from Robis -> Settings.', 404);
    res.json(statusOf(u, origin(req)));
  });

  // The helper itself, made for this player.
  api.get('/me/discord-status/RobisDiscordStatus.bat', requireUser, (req, res) => {
    if (!enabled()) return bad(res, 'The Discord status is not turned on on this Robis.', 404);
    const file = helperBat({ key: keyOf(req.user), appId: S().appId, site: origin(req) });
    db.save();
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="RobisDiscordStatus.bat"');
    res.send(file);
  });
}

// A .bat that runs the PowerShell code written after the #PSBEGIN# line
// (Windows 10/11 have PowerShell, so there's nothing to install).
export function helperBat({ key, appId, site }) {
  const safe = (v) => String(v).replace(/[^0-9A-Za-z:/._-]/g, '');
  const ps = `
$ErrorActionPreference = 'Stop'
$key = '${safe(key)}'
$app = '${safe(appId)}'
$site = '${safe(site)}'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$host.UI.RawUI.WindowTitle = 'Robis - Discord status'

function Send-Frame($pipe, [int]$op, $obj) {
  $body = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Depth 10 -Compress))
  $head = [byte[]]([BitConverter]::GetBytes($op) + [BitConverter]::GetBytes([int]$body.Length))
  $pipe.Write($head, 0, 8)
  $pipe.Write($body, 0, $body.Length)
  $pipe.Flush()
}
function Read-Exact($pipe, [int]$n) {
  $buf = New-Object byte[] $n
  $got = 0
  while ($got -lt $n) { $r = $pipe.Read($buf, $got, $n - $got); if ($r -le 0) { throw 'Discord closed the connection' }; $got += $r }
  return ,$buf
}
function Read-Frame($pipe) {
  $head = Read-Exact $pipe 8
  $len = [BitConverter]::ToInt32($head, 4)
  return [Text.Encoding]::UTF8.GetString((Read-Exact $pipe $len))
}
function Connect-Discord {
  for ($i = 0; $i -lt 10; $i++) {
    try {
      $p = New-Object IO.Pipes.NamedPipeClientStream('.', "discord-ipc-$i", [IO.Pipes.PipeDirection]::InOut)
      $p.Connect(500)
      Send-Frame $p 0 @{ v = 1; client_id = $app }
      [void](Read-Frame $p)
      return $p
    } catch { if ($p) { $p.Dispose() } }
  }
  return $null
}

Write-Host ''
Write-Host '  Robis - Discord status' -ForegroundColor Cyan
Write-Host '  Shows what you play on Robis in your Discord profile.'
Write-Host '  Keep this window open (you can minimize it). Close it to stop.'
Write-Host ''
$pipe = $null
$last = ''
while ($true) {
  try {
    if (-not $pipe) {
      $pipe = Connect-Discord
      if (-not $pipe) { Write-Host '  Waiting for Discord (open the Discord app)...'; Start-Sleep 15; continue }
      Write-Host '  Connected to Discord.' -ForegroundColor Green
      $last = ''
    }
    $st = Invoke-RestMethod -Uri "$site/api/presence/discord/$key" -TimeoutSec 10 -UseBasicParsing
    $activity = $null
    if (-not $st.clear) {
      $activity = @{ details = $st.details; assets = @{ large_image = 'robis'; large_text = 'Robis' } }
      if ($st.state) { $activity.state = $st.state }
      if ($st.start) { $activity.timestamps = @{ start = [int64]$st.start } }
      if ($st.buttons) { $activity.buttons = @($st.buttons | ForEach-Object { @{ label = $_.label; url = $_.url } }) }
    }
    $now = if ($activity) { $activity | ConvertTo-Json -Depth 6 -Compress } else { 'none' }
    if ($now -ne $last) {
      Send-Frame $pipe 1 @{ cmd = 'SET_ACTIVITY'; args = @{ pid = $PID; activity = $activity }; nonce = [guid]::NewGuid().ToString() }
      [void](Read-Frame $pipe)
      $last = $now
      $time = Get-Date -Format 'HH:mm'
      if ($activity) { Write-Host "  [$time] $($st.details)" } else { Write-Host "  [$time] Not on Robis right now" }
    }
  } catch {
    Write-Host ('  ' + $_.Exception.Message) -ForegroundColor Yellow
    if ($_.Exception.Message -match '404') { Write-Host '  Download the file again: Robis -> Settings -> Discord.' -ForegroundColor Yellow; Start-Sleep 60 }
    if ($pipe) { try { $pipe.Dispose() } catch {} }
    $pipe = $null
  }
  Start-Sleep 15
}
`;
  const bat = [
    '@echo off',
    'title Robis - Discord status',
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Get-Content -Raw -LiteralPath \'%~f0\') -split (\'#PS\'+\'BEGIN#\'),2)[1]"',
    'exit /b',
    '#PSBEGIN#',
    ps.trim(),
    '',
  ].join('\r\n');
  return bat.replace(/\r?\n/g, '\r\n');
}
