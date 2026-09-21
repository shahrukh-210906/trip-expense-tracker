import express from 'express';
import mongoose from 'mongoose';
import {isMember} from './access.mjs';
import {loadPaymentBalances} from './utils/paymentBalances.mjs';
import {pushNotification} from './push.mjs';
export const UPI_PATTERN=/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9.-]{2,35}$/;
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const due=(view,ledger,from,to)=>(ledger==='personal'?view.transactions:view.kittySettlement.transactions).find(t=>t.from===String(from)&&t.to===String(to))?.amountPaise||0;
export function paymentRoutes(models,connection){
 const router=express.Router(),{Trip,User,SettlementPayment,Notification}=models;
 router.get('/profile',async(req,res)=>{const user=await User.findById(req.user._id).select('+upiId');res.set('Cache-Control','no-store').json({upiId:user.upiId||''});});
 router.post('/profile',async(req,res)=>{
   const upiId=typeof req.body.upiId==='string'?req.body.upiId.trim():null;
   if(upiId===null||(upiId!==''&&!UPI_PATTERN.test(upiId)))return res.status(400).json({error:'Enter a valid UPI ID such as name@bank, or leave it blank to remove it.'});
   await User.updateOne({_id:req.user._id},{$set:{upiId}});res.json({upiId});
 });
 router.use('/trips/:tripId',async(req,res,next)=>{
   if(!mongoose.isObjectIdOrHexString(req.params.tripId))return res.status(404).json({error:'Trip not found.'});
   req.trip=await Trip.findById(req.params.tripId);
   if(!req.trip||!isMember(req.trip,req.user._id))return res.status(404).json({error:'Trip not found.'});next();
 });
 router.get('/trips/:tripId/recipient/:userId',async(req,res)=>{
   const view=await loadPaymentBalances(models,req.trip),to=req.params.userId;
   if(!due(view,'personal',req.user._id,to)&&!due(view,'kitty',req.user._id,to))return res.status(403).json({error:'No outstanding payment to this traveler.'});
   const recipient=await User.findById(to).select('displayName +upiId');
   res.set('Cache-Control','no-store').json({displayName:recipient.displayName,upiId:recipient.upiId||''});
 });
 router.post('/trips/:tripId/requests',async(req,res,next)=>{
  try{
   const {to,ledger,amountPaise,clientId}=req.body,from=String(req.user._id);
   if(!mongoose.isObjectIdOrHexString(to)||to===from||!['personal','kitty'].includes(ledger)||!Number.isSafeInteger(amountPaise)||amountPaise<=0||amountPaise>1e9||typeof clientId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId))fail('Invalid settlement request.');
   let payment,notification;
   await connection.transaction(async session=>{
    notification=null;
    const trip=await Trip.findOneAndUpdate({_id:req.trip._id,participants:from},{$inc:{ledgerVersion:1}},{session,returnDocument:'after'});
    if(!trip||!isMember(trip,to))fail('Traveler is not in this trip.');
    payment=await SettlementPayment.findOne({tripId:trip._id,from,clientId}).session(session);
    if(payment){if(String(payment.to)!==to||payment.ledger!==ledger||payment.amountPaise!==amountPaise)fail('Request ID already used for another payment.',409);return;}
    const view=await loadPaymentBalances(models,trip,session);
    if(amountPaise>due(view,ledger,from,to))fail('The balance changed. Refresh before requesting settlement.',409);
    if(view.payments.some(p=>p.state==='pending'&&String(p.from)===from&&String(p.to)===to&&p.ledger===ledger))fail('A payment is already waiting for this person’s approval.',409);
    [payment]=await SettlementPayment.create([{tripId:trip._id,from,to,ledger,amountPaise,clientId}],{session});
    [notification]=await Notification.create([{userId:to,actorId:from,tripId:trip._id,kind:'request',ledger,amountPaise,paymentId:payment._id}],{session});
   });
   req.app.get('live')?.membersChanged(req.trip);
   if(notification)void pushNotification(models,notification).catch(()=>{});
   res.json({payment});
  }catch(e){if(e.code===11000)return res.status(409).json({error:'A request already exists. Refresh to see its status.'});if(e.status)return res.status(e.status).json({error:e.message});next(e);}
 });
 router.post('/trips/:tripId/requests/:paymentId/:action',async(req,res,next)=>{
  try{
   const {paymentId,action}=req.params;
   if(!mongoose.isObjectIdOrHexString(paymentId)||!['accept','reject','cancel'].includes(action))fail('Invalid settlement action.');
   let payment,notification;
   await connection.transaction(async session=>{
    notification=null;
    await Trip.updateOne({_id:req.trip._id},{$inc:{ledgerVersion:1}},{session});
    payment=await SettlementPayment.findOne({_id:paymentId,tripId:req.trip._id}).session(session);
    if(!payment)fail('Request not found.',404);
    if(String(action==='cancel'?payment.from:payment.to)!==String(req.user._id))fail('Only the recipient can approve or reject; only the sender can cancel.',403);
    const state={accept:'accepted',reject:'rejected',cancel:'cancelled'}[action];
    if(payment.state===state)return;
    if(payment.state!=='pending')fail('This request has already been resolved.',409);
    payment.state=state;payment.resolvedAt=new Date();await payment.save({session});
    if(action!=='cancel')[notification]=await Notification.create([{userId:payment.from,actorId:req.user._id,tripId:req.trip._id,kind:state,ledger:payment.ledger,amountPaise:payment.amountPaise,paymentId:payment._id}],{session});
   });
   req.app.get('live')?.membersChanged(req.trip);
   if(notification)void pushNotification(models,notification).catch(()=>{});
   res.json({payment});
  }catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e);}
 });
 router.post('/trips/:tripId/remind',async(req,res,next)=>{
  try{
   const {to,ledger}=req.body;
   if(!mongoose.isObjectIdOrHexString(to)||!['personal','kitty'].includes(ledger))fail('Invalid reminder.');
   let notification;
   await connection.transaction(async session=>{
    await Trip.updateOne({_id:req.trip._id},{$inc:{ledgerVersion:1}},{session});
    const view=await loadPaymentBalances(models,req.trip,session);
    const amountPaise=due(view,ledger,to,req.user._id);
    if(!amountPaise)fail('This person does not owe you a payment in this ledger.');
    if(view.payments.some(p=>p.state==='pending'&&String(p.from)===to&&String(p.to)===String(req.user._id)&&p.ledger===ledger))fail('Review their pending payment before sending a reminder.',409);
    const recent=await Notification.findOne({tripId:req.trip._id,actorId:req.user._id,userId:to,kind:'reminder',createdAt:{$gt:new Date(Date.now()-24*60*60*1000)}}).session(session);
    if(recent)fail('You can remind this person again after 24 hours.',429);
    [notification]=await Notification.create([{actorId:req.user._id,userId:to,tripId:req.trip._id,kind:'reminder',ledger,amountPaise}],{session});
   });
   void pushNotification(models,notification).catch(()=>{});res.json({sent:true});
  }catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e);}
 });
 return router;
}
