import express from 'express';
import mongoose from 'mongoose';
import {pushReady,validSubscription} from './push.mjs';
export function notificationRoutes(models){
 const router=express.Router(),{Notification,PushSubscription,User,Trip}=models;
 router.get('/',async(req,res)=>{
  const items=await Notification.find({userId:req.user._id}).sort({createdAt:-1}).limit(50).lean();
  const [users,trips]=await Promise.all([User.find({_id:{$in:items.map(n=>n.actorId)}}).select('displayName'),Trip.find({_id:{$in:items.map(n=>n.tripId)},participants:req.user._id}).select('name')]);
  res.set('Cache-Control','no-store').json({items:items.filter(n=>trips.some(t=>String(t._id)===String(n.tripId))).map(n=>({...n,actorName:users.find(u=>String(u._id)===String(n.actorId))?.displayName||'Traveler',tripName:trips.find(t=>String(t._id)===String(n.tripId))?.name})),unread:await Notification.countDocuments({userId:req.user._id,readAt:{$exists:false}})});
 });
 router.post('/:id/read',async(req,res)=>{
  if(!mongoose.isObjectIdOrHexString(req.params.id))return res.status(400).json({error:'Invalid notification.'});
  await Notification.updateOne({_id:req.params.id,userId:req.user._id},{$set:{readAt:new Date()}});res.json({ok:true});
 });
 router.get('/push/config',(req,res)=>res.json({enabled:pushReady(),publicKey:pushReady()?process.env.VAPID_PUBLIC_KEY:null}));
 router.post('/push/status',async(req,res)=>res.json({subscribed:typeof req.body.endpoint==='string'&&Boolean(await PushSubscription.exists({userId:req.user._id,endpoint:req.body.endpoint}))}));
 router.post('/push/subscribe',async(req,res)=>{
  const subscription=req.body;
  if(!pushReady())return res.status(503).json({error:'Phone notifications are not configured yet. Your inbox still works.'});
  if(!validSubscription(subscription))return res.status(400).json({error:'This browser’s push service is not supported. Try Chrome, Firefox, or Safari.'});
  const existing=await PushSubscription.findOne({endpoint:subscription.endpoint});
  if(existing&&String(existing.userId)!==String(req.user._id))return res.status(409).json({error:'Turn notifications off on this device before enabling them for another account.'});
  if(!existing&&await PushSubscription.countDocuments({userId:req.user._id})>=10)return res.status(400).json({error:'Notification device limit reached.'});
  await PushSubscription.updateOne({endpoint:subscription.endpoint,userId:req.user._id},{$set:{keys:{auth:subscription.keys.auth,p256dh:subscription.keys.p256dh}}},{upsert:true});res.json({ok:true});
 });
 router.post('/push/unsubscribe',async(req,res)=>{
  if(typeof req.body.endpoint!=='string')return res.status(400).json({error:'Invalid subscription.'});
  await PushSubscription.deleteOne({endpoint:req.body.endpoint,userId:req.user._id});res.json({ok:true});
 });
 return router;
}
