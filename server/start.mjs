import {configuration,createApp} from './app.mjs';
const app=await createApp(configuration());
const port=Number(process.env.PORT||3000);
const server=app.listen(port,'0.0.0.0',()=>console.log('Specly subscription server listening on port '+port));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
