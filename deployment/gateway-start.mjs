import {createGateway} from './gateway.mjs';

// A dedicated entry point also works when PM2 imports ES modules in its runner.
const server=createGateway();
server.listen(5301,'0.0.0.0',()=>console.log('PokeFablemmo gateway listening on port 5301'));
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{
  server.close(()=>process.exit(0));
  setTimeout(()=>process.exit(0),5000).unref();
});
