import http from 'node:http';
import {pathToFileURL} from 'node:url';

// One origin for the website, account API and multiplayer WebSocket.
// Destinations are fixed locally: incoming URLs never select an upstream host.
export function createGateway({webPort=5300, gamePort=5190}={}) {
  function route(raw='/', upgrade=false) {
    if (!raw.startsWith('/') || raw.startsWith('//')) return null;
    const path=raw.split('?')[0];
    const game=path==='/servidor' || path.startsWith('/servidor/');
    if (upgrade && !game) return null;
    return {port:game?gamePort:webPort, path:game?(raw.slice('/servidor'.length)||'/').replace(/^\?/, '/?'):raw, game};
  }
  function headers(req, port) {
    const h={...req.headers, host:`127.0.0.1:${port}`};
    // Do not forward credentials in intermediary proxy headers supplied by clients.
    delete h['proxy-authorization']; delete h['proxy-connection'];
    return h;
  }
  const server=http.createServer((req,res)=>{
    const target=route(req.url);
    if (!target) {res.writeHead(400);res.end('Invalid request');return;}
    const upstream=http.request({hostname:'127.0.0.1',port:target.port,path:target.path,method:req.method,headers:headers(req,target.port)}, reply=>{
      const h={...reply.headers,'x-content-type-options':'nosniff'};
      if (target.game) h['cache-control']='no-store';
      res.writeHead(reply.statusCode,h);reply.pipe(res);
      reply.on('error',()=>res.destroy());
    });
    upstream.setTimeout(120000,()=>upstream.destroy(new Error('Upstream timeout')));
    upstream.on('error',()=>{if(!res.headersSent){res.writeHead(502,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('PokeFablemmo is temporarily unavailable. Please try again.');}else res.destroy();});
    req.on('aborted',()=>upstream.destroy());
    res.on('close',()=>{if(!res.writableFinished)upstream.destroy();});
    req.pipe(upstream);
  });
  server.on('upgrade',(req,socket,head)=>{
    const target=route(req.url,true);
    if (!target) {socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');return;}
    const upstream=http.request({hostname:'127.0.0.1',port:target.port,path:target.path,method:'GET',headers:headers(req,target.port)});
    let peer;
    const timer=setTimeout(()=>upstream.destroy(),10000);
    upstream.on('upgrade',(reply,remote,remoteHead)=>{
      clearTimeout(timer);peer=remote;
      const response=[`HTTP/1.1 ${reply.statusCode} ${reply.statusMessage}`];
      for(let i=0;i<reply.rawHeaders.length;i+=2)response.push(`${reply.rawHeaders[i]}: ${reply.rawHeaders[i+1]}`);
      socket.write(response.join('\r\n')+'\r\n\r\n');
      if(remoteHead.length)socket.write(remoteHead);
      if(head.length)remote.write(head);
      remote.pipe(socket);socket.pipe(remote);
      remote.on('error',()=>socket.destroy());remote.on('close',()=>socket.destroy());
    });
    upstream.on('response',reply=>{clearTimeout(timer);reply.resume();socket.end(`HTTP/1.1 ${reply.statusCode} Upstream response\r\nConnection: close\r\n\r\n`);});
    upstream.on('error',()=>{clearTimeout(timer);if(!peer)socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');});
    socket.on('error',()=>{upstream.destroy();peer?.destroy();});
    socket.on('close',()=>{clearTimeout(timer);upstream.destroy();peer?.destroy();});
    upstream.end();
  });
  return server;
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const server=createGateway();
  server.listen(5301,'0.0.0.0',()=>console.log('PokeFablemmo gateway listening on port 5301'));
  server.on('error',error=>{console.error(error.message);process.exitCode=1;});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();});
}
