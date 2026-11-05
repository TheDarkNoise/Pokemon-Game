# Pokémon 3D Web Game

A browser-based 3D Pokémon adventure built with Three.js, Vite, Node.js and WebSocket multiplayer.

## Supported platforms

- **Windows 10/11 (x64):** use `Ligar jogo.bat` for the local development setup.
- **Raspberry Pi OS 64-bit (ARM64):** use the PM2 setup in [raspberry-pi/README.md](raspberry-pi/README.md).
- **Node.js:** 20.19.0 or newer (Node.js 22 LTS recommended).

Both platforms use the same game source and dependencies. Platform-specific startup configuration is kept separate.

## Windows quick start

1. Install Node.js 22 LTS.
2. Run `Ligar jogo.bat` from the project folder.
3. Open [http://localhost:5300](http://localhost:5300).

The batch file starts the local HTTP/WebSocket game server on port 5190 and Vite on port 5300.

## Raspberry Pi quick start

See [Raspberry Pi OS + PM2 setup](raspberry-pi/README.md) for installation, production build, PM2 startup and LAN access instructions.

## Development

```bash
npm install
npm run dev
npm run start:server
```

Build and preview:

```bash
npm run build
npm run start:preview
```

## Network ports

| Port | Service |
|---|---|
| 5300 | Vite development / production preview (HTTP) |
| 5190 | Game HTTP API and WebSocket server |

The game client automatically connects to port 5190 on the same host as the page unless a `?servidor=ws://host:port` override is supplied. Use `?rede=0` to disable the network connection.

## Language support

English is the default language for new players and first-time visits. Portuguese and Spanish remain available in the in-game language selector. A player's saved language preference is preserved.

## Controls

- **WASD / Arrow keys:** Move
- **Mouse:** Rotate the camera
- **Click the ground:** Move to that location
- **Tab:** Switch target
- **1 / 2:** Use moves
- **M:** Mount or dismount
- **B:** Call the boss

## Notes

- The Raspberry Pi hosts the web files and game API; players use a modern browser on their own computer.
- This setup is intended for a private LAN test. Do not expose the development game server directly to the public internet.
- Back up `servidor/dados/contas.json` before replacing or updating the project.
