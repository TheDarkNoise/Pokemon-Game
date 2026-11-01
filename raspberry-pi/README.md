# Raspberry Pi OS 64-bit + PM2

This runs the Pokémon game from a Raspberry Pi 4 with 64-bit Raspberry Pi OS (ARM64). The Pi hosts the built web app and the Node.js HTTP/WebSocket game server. Players open the game in a browser on another computer on the same network.

## Requirements

- Raspberry Pi 4 with Raspberry Pi OS 64-bit (`aarch64`)
- Node.js 20.19+ (Node.js 22 LTS recommended)
- npm
- Git
- PM2

Check the architecture and runtime:

```bash
uname -m
node --version
npm --version
```

The architecture should print `aarch64`. Node.js must be at least 20.19.0.

## 1. Install system tools

```bash
sudo apt update
sudo apt install -y git curl
```

If Node.js is not installed, install Node.js 22 LTS using your preferred ARM64-compatible Node.js installer, then open a new terminal and verify `node --version`.

## 2. Download the correct branch

```bash
git clone --branch translation/english-default --single-branch https://github.com/TheDarkNoise/Pokemon-Game.git
cd Pokemon-Game
```

If the repository is already cloned, update it instead:

```bash
git switch translation/english-default
git pull
```

## 3. Install dependencies and build

Run these commands from the repository root:

```bash
npm ci
npm run build
```

The build creates the `dist/` directory. PM2 serves this production build; it does not run Vite's development server.

## 4. Install PM2 and start both services

```bash
sudo npm install --global pm2
pm2 start raspberry-pi/ecosystem.config.cjs
pm2 status
```

Two processes should appear:

- `pokemon-game-server` — HTTP API + WebSocket on port 5190
- `pokemon-game-web` — production web preview on port 5300

## 5. Open the game

Find the Pi's LAN IP:

```bash
hostname -I
```

On another computer connected to the same network, open:

```text
http://PI_IP_ADDRESS:5300
```

Replace `PI_IP_ADDRESS` with the address printed by `hostname -I`.

The client connects to the game server on port 5190 on the same host automatically. If the page loads but multiplayer/account functions cannot connect, check that both ports 5300 and 5190 are reachable on your LAN.

## PM2 commands

```bash
pm2 status
pm2 logs
pm2 logs pokemon-game-server
pm2 logs pokemon-game-web
pm2 restart all
pm2 stop all
pm2 start raspberry-pi/ecosystem.config.cjs
```

## Start automatically after reboot

After both processes are running correctly:

```bash
pm2 startup
```

PM2 prints one command beginning with `sudo`. Copy and run that exact command. Then save the process list:

```bash
pm2 save
```

## Updating the game

From the repository root:

```bash
git pull
npm ci
npm run build
pm2 restart all
```

Back up `servidor/dados/contas.json` before updating. This file contains local account/save data.

## Stop / remove the PM2 test

```bash
pm2 stop all
pm2 delete all
```

## Network and safety notes

- Port 5300 serves the browser game.
- Port 5190 serves the game's HTTP API and WebSocket connection.
- Keep this initial test on your private LAN. Do not port-forward these development services to the public internet.
- The Pi is the host; 3D rendering happens in each player's browser, not on the Pi.
- The Windows launcher `Ligar jogo.bat` remains available and is not replaced by this PM2 setup.
