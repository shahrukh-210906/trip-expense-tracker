import { resolve } from 'node:path';
import express from 'express';
import { createServer } from 'node:http';
import { attachRealtime } from './realtime.mjs';
import { connectDatabase,disconnectDatabase } from './database.mjs';
import { createModels } from './models.mjs';
import { createApp } from './app.mjs';
try{
  const connection=await connectDatabase(),models=createModels(connection);
  for(const model of Object.values(models))await model.createIndexes();
  const app=createApp(models,connection);
  app.use(express.static(resolve('client/dist')));
  app.get('/{*path}',(req,res)=>res.sendFile(resolve('client/dist/index.html')));
  const server=createServer(app),live=attachRealtime(server,models);
  app.set('live',live);
  const port=process.env.PORT||5000;
  const host=process.env.HOST||(process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1');
  server.listen(port,host,()=>console.log('Trip app listening on '+host+':'+port));
  const stop=()=>live.io.close(async()=>{await disconnectDatabase();process.exit(0);});
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
}catch{
  console.error('Startup failed. Check MongoDB configuration with npm run db:check.');
  await disconnectDatabase();process.exitCode=1;
}
