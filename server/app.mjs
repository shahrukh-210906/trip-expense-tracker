import express from 'express';
import { authenticate,newToken,tokenHash } from './auth.mjs';
import { tripRoutes } from './routes/tripRoutes.mjs';
import { expenseRoutes } from './routes/expenseRoutes.mjs';
export function createApp(models,connection){
  const app=express();
  app.disable('x-powered-by');
  app.use(express.json({limit:'128kb'}));
  app.get('/api/health',(req,res)=>res.json({status:'ok'}));
  app.post('/api/session',async(req,res)=>{
    const displayName=typeof req.body.displayName==='string'?req.body.displayName.trim():'';
    if(!displayName||displayName.length>60)return res.status(400).json({error:'Enter your name (up to 60 characters).'});
    const token=newToken(),user=await models.User.create({displayName,tokenHash:tokenHash(token)});
    res.status(201).json({token,user:{_id:user._id,displayName:user.displayName}});
  });
  app.use('/api',authenticate(models.User));
  app.get('/api/session',(req,res)=>res.json({user:req.user}));
  app.use('/api/trips',tripRoutes(models));
  app.use('/api/expenses',expenseRoutes(models,connection));
  app.use('/api',(req,res)=>res.status(404).json({error:'API route not found.'}));
  app.use((error,req,res,next)=>{
    if(error instanceof SyntaxError||error.name==='ValidationError'||error.name==='CastError')
      return res.status(400).json({error:'Invalid request. Check your input.'});
    res.status(500).json({error:'Request failed. Please try again.'});
  });
  return app;
}
