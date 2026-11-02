# PokeFablemmo online gateway

The gateway adds HTTPS-compatible, same-origin routing without changing the game protocol or save files. It uses Node's built-in HTTP module and the existing web and game processes.

| Public path | Local destination |
|---|---|
| `/` and website assets | `http://127.0.0.1:5300` |
| `/servidor/*` | `http://127.0.0.1:5190/*` (prefix removed) |
| `/servidor` WebSocket | `ws://127.0.0.1:5190/` |

In the existing Cloudflare Tunnel, publish `pokefablemmo.cityofheroesunity.com` with an empty path and service `http://192.168.0.94:5301`. The connector must be running and able to reach this Pi. No additional router port forwarding is needed. Keep tunnel tokens outside this repository.

On the Pi, with its Node installation on PATH, start only the gateway:

```sh
pm2 start deployment/ecosystem.config.cjs --only pokefablemmo-gateway
pm2 save
```

The website and game API must already be running on ports 5300 and 5190. Keep the existing PM2 startup service enabled to restore saved processes after reboot. Restart only `pokefablemmo-gateway` after gateway changes. Stopping this gateway leaves LAN play on port 5300 available.

Checks: public `/` serves the game; `/servidor/saude` returns `ok: true`; `/servidor/save` without a token refuses access; a WebSocket connects to `wss://pokefablemmo.cityofheroesunity.com/servidor`. Account registration and sign-in use the same `/servidor` prefix automatically on HTTPS. Existing accounts and progress remain on the Pi; a new browser origin requires signing in again.

This supplies connectivity for implemented server features. It does not add missing PvP, ranking or Social server endpoints. Original game credits and ownership remain unchanged.
