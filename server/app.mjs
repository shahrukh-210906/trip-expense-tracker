import express from 'express';
import { authenticate,newToken,newRecoveryCode,tokenHash } from './auth.mjs';
import { tripRoutes } from './routes/tripRoutes.mjs';
import { expenseRoutes } from './routes/expenseRoutes.mjs';
import { publicFirebaseConfig, verifyGoogleToken } from './firebase.mjs';
import { paymentRoutes } from './payments.mjs';
import { notificationRoutes } from './notifications.mjs';
export function createApp(models,connection,{allowLegacyLogin=false,verifyToken=verifyGoogleToken}={}){
  const app=express();
  app.disable('x-powered-by');
  app.use(express.json({limit:'128kb'}));
  app.get('/api/health',(req,res)=>res.json({status:'ok'}));
  app.get('/api/auth/config',(req,res)=>res.json(publicFirebaseConfig()));
  app.post('/api/session/google',async(req,res,next)=>{
    if(typeof req.body.idToken!=='string'||req.body.idToken.length>10000)return res.status(400).json({error:'A Google sign-in token is required.'});
    let identity;
    try { identity=await verifyToken(req.body.idToken); }
    catch { return res.status(401).json({error:'Google sign-in expired or is invalid. Please try again.'}); }
    if(!identity.uid||identity.firebase?.sign_in_provider!=='google.com'||identity.email_verified!==true)
      return res.status(401).json({error:'Please sign in with a verified Google account.'});
    try {
      const token=newToken(), now=new Date();
      const fields={tokenHash:tokenHash(token),tokenCreatedAt:now};
      let user;
      if(req.body.link===true){
        const bearer=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
        if(!bearer)return res.status(401).json({error:'Sign in to your existing traveler first.'});
        user=await models.User.findOneAndUpdate({tokenHash:tokenHash(bearer),firebaseUid:{$exists:false},tokenRevokedAt:{$exists:false},tokenCreatedAt:{$gt:new Date(Date.now()-30*86400000)}},{$set:{...fields,firebaseUid:identity.uid},$unset:{recoveryCodeHash:1}},{new:true});
        if(!user)return res.status(409).json({error:'This traveler cannot be linked. Sign in with Google instead.'});
      }else{
        user=await models.User.findOneAndUpdate({firebaseUid:identity.uid},{$set:fields,$setOnInsert:{displayName:(identity.name||'Traveler').slice(0,60)},$unset:{tokenRevokedAt:1,recoveryCodeHash:1}},{upsert:true,new:true,runValidators:true});
      }
      req.app.get('live')?.disconnectUser(user._id);
      res.json({token,user:{_id:user._id,displayName:user.displayName,googleLinked:true}});
    }catch(error){if(error.code===11000)return res.status(409).json({error:'This Google account is already linked. Sign out and sign in with Google.'});next(error);}
  });
  app.post(['/api/session','/api/session/recover','/api/session/recovery-code'],(req,res,next)=>{
    if(!allowLegacyLogin)return res.status(403).json({error:'Please continue with Google.'});
    next();
  });
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
  app.use('/api/payments',paymentRoutes(models,connection));
  app.use('/api/notifications',notificationRoutes(models));
  app.get('/api/session',(req,res)=>res.json({user:req.user}));
  app.post('/api/session/recovery-code',async(req,res,next)=>{
    try { const code=newRecoveryCode(); await models.User.updateOne({_id:req.user._id},{$set:{recoveryCodeHash:tokenHash(code)}}); res.json({code}); }
    catch(error){ next(error); }
  });
  app.delete('/api/session',async(req,res,next)=>{
    try { await models.User.updateOne({_id:req.user._id},{$set:{tokenRevokedAt:new Date()}}); await models.PushSubscription.deleteMany({userId:req.user._id}); req.app.get('live')?.disconnectUser(req.user._id); res.status(204).end(); }
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
