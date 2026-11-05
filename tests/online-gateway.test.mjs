import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import test from 'node:test';
import WebSocket,{WebSocketServer} from 'ws';
import {createGateway} from '../deployment/gateway.mjs';

const listen=async server=>{server.listen(0,'127.0.0.1');await once(server,'listening');return server.address().port;};
const close=server=>new Promise(resolve=>{server.closeAllConnections?.();server.close(resolve);});

test('gateway routes public site and account requests while preserving payloads and asset ranges',async()=>{
 const seen=[];
 const web=http.createServer((req,res)=>{seen.push({web:true,url:req.url,host:req.headers.host,range:req.headers.range});res.writeHead(req.headers.range?206:200,{'Content-Type':'text/plain'});res.end('website');});
 const game=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;seen.push({url:req.url,method:req.method,authorization:req.headers.authorization,body});res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'public,max-age=999'});res.end(JSON.stringify({ok:true}));});
 const webPort=await listen(web),gamePort=await listen(game),gateway=createGateway({webPort,gamePort}),port=await listen(gateway),base=`http://127.0.0.1:${port}`;
 try{
  let r=await fetch(base+'/cenario/kanto.glb',{headers:{Host:'pokefablemmo.cityofheroesunity.com',Range:'bytes=0-7'}});assert.equal(r.status,206);assert.equal(await r.text(),'website');assert.deepEqual(seen.shift(),{web:true,url:'/cenario/kanto.glb',host:`127.0.0.1:${webPort}`,range:'bytes=0-7'});
  r=await fetch(base+'/servidor/conta/entrar?check=1',{method:'POST',headers:{Authorization:'Bearer test-only','Content-Type':'application/json'},body:'{"usuario":"test","senha":"example"}'});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(await r.json(),{ok:true});assert.deepEqual(seen.shift(),{url:'/conta/entrar?check=1',method:'POST',authorization:'Bearer test-only',body:'{"usuario":"test","senha":"example"}'});
  await fetch(base+'/servidor?check=1');assert.equal(seen.shift().url,'/?check=1');
  await fetch(base+'/servidor-files');assert.equal(seen.shift().web,true);
 }finally{await Promise.all([close(gateway),close(web),close(game)]);}
});

test('gateway carries multiplayer frames in both directions and rejects website upgrades',async()=>{
 const game=http.createServer(),wss=new WebSocketServer({server:game});
 let path;wss.on('connection',(ws,req)=>{path=req.url;ws.send('welcome');ws.on('message',data=>ws.send(data));});
 const gamePort=await listen(game),gateway=createGateway({gamePort}),port=await listen(gateway);
 try{
  const ws=new WebSocket(`ws://127.0.0.1:${port}/servidor?network=15`);const welcome=once(ws,'message');await once(ws,'open');assert.equal((await welcome)[0].toString(),'welcome');assert.equal(path,'/?network=15');
  const answer=once(ws,'message');ws.send(JSON.stringify({t:'ping',n:17}));assert.equal((await answer)[0].toString(),'{"t":"ping","n":17}');ws.close();await once(ws,'close');
  const refused=new WebSocket(`ws://127.0.0.1:${port}/`);const [error]=await once(refused,'error');assert.match(error.message,/404/);
 }finally{await Promise.all([close(gateway),close(game)]);wss.close();}
});

test('gateway returns a bounded unavailable response when an upstream is offline',async()=>{
 const unused=http.createServer(),deadPort=await listen(unused);await close(unused);
 const gateway=createGateway({webPort:deadPort,gamePort:deadPort}),port=await listen(gateway);
 try{const response=await fetch(`http://127.0.0.1:${port}/servidor/saude`);assert.equal(response.status,502);assert.equal(response.headers.get('cache-control'),'no-store');assert.match(await response.text(),/PokeFablemmo/);}finally{await close(gateway);}
});
