import express from 'express';
import { authenticate,newToken,newRecoveryCode,tokenHash } from './auth.mjs';
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
    const token=newToken(),user=await models.User.create({displayName,tokenHash:tokenHash(token),tokenCreatedAt:new Date()});
    res.status(201).json({token,user:{_id:user._id,displayName:user.displayName}});
  });
  app.post('/api/session/recover',async(req,res,next)=>{
    try {
      const code=typeof req.body.code==='string'?req.body.code.trim().toUpperCase():'';
      if(!/^[A-F0-9]{16}$/.test(code)) return res.status(400).json({error:'Enter a valid recovery code.'});
      const user=await models.User.findOne({recoveryCodeHash:tokenHash(code)}).select('+recoveryCodeHash');
      if(!user) return res.status(401).json({error:'Recovery code is invalid or has already been used.'});
      const token=newToken();
      await models.User.updateOne({_id:user._id},{$set:{tokenHash:tokenHash(token),tokenCreatedAt:new Date()},$unset:{recoveryCodeHash:1}});
      res.json({token,user:{_id:user._id,displayName:user.displayName}});
    } catch(error){ next(error); }
  });
  app.use('/api',authenticate(models.User));
  app.get('/api/session',(req,res)=>res.json({user:req.user}));
  app.post('/api/session/recovery-code',async(req,res,next)=>{
    try { const code=newRecoveryCode(); await models.User.updateOne({_id:req.user._id},{$set:{recoveryCodeHash:tokenHash(code)}}); res.json({code}); }
    catch(error){ next(error); }
  });
  app.delete('/api/session',async(req,res,next)=>{
    try { await models.User.updateOne({_id:req.user._id},{$set:{tokenRevokedAt:new Date()}}); res.status(204).end(); }
    catch(error){ next(error); }
  });
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
