import express from 'express';
import { randomInt } from 'node:crypto';
import mongoose from 'mongoose';
import { isMember,isLead,canReadPersonalExpense,canReadPurseEntry } from '../access.mjs';
import { calculateSettlement } from '../utils/settlement.mjs';
export function tripRoutes(models) {
  const {Trip,User,PersonalExpense,PurseEntry}=models, router=express.Router();
  const publicTrip=(trip,userId)=>{
    const result=trip.toObject();
    if (!isLead(trip,userId)) delete result.purseBalancePaise;
    return result;
  };
  router.get('/',async(req,res)=>{
    const trips=await Trip.find({participants:req.user._id});
    res.json({trips:trips.map(t=>publicTrip(t,req.user._id))});
  });
  router.post('/create',async(req,res)=>{
    const name=typeof req.body.name==='string'?req.body.name.trim():'';
    if (!name || name.length>100) return res.status(400).json({error:'Enter a trip name up to 100 characters.'});
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for(let attempt=0;attempt<5;attempt++){
      const joinCode=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');
      try {
        const trip=await Trip.create({name,joinCode,createdBy:req.user._id,participants:[req.user._id],groupLeads:[req.user._id]});
        return res.status(201).json({trip:publicTrip(trip,req.user._id)});
      } catch(error){if(error.code!==11000)throw error;}
    }
    res.status(503).json({error:'Could not allocate a join code. Try again.'});
  });
  router.post('/join',async(req,res)=>{
    const joinCode=typeof req.body.joinCode==='string'?req.body.joinCode.trim().toUpperCase():'';
    if(!/^[A-Z0-9]{6}$/.test(joinCode))return res.status(400).json({error:'Enter the six-character trip code.'});
    const trip=await Trip.findOneAndUpdate({joinCode,$or:[{participants:req.user._id},{'participants.99':{$exists:false}}]},
      {$addToSet:{participants:req.user._id}},{returnDocument:'after'});
    if(!trip)return res.status(404).json({error:'Trip code not found or trip is full.'});
    res.json({trip:publicTrip(trip,req.user._id)});
  });
  router.use('/:tripId',async(req,res,next)=>{
    if(!mongoose.isObjectIdOrHexString(req.params.tripId))return res.status(400).json({error:'Invalid trip ID.'});
    req.trip=await Trip.findById(req.params.tripId);
    if(!req.trip || !isMember(req.trip,req.user._id))return res.status(404).json({error:'Trip not found.'});
    next();
  });
  router.get('/:tripId',async(req,res)=>{
    const trip=req.trip;
    const [members,expenses,purseEntries]=await Promise.all([
      User.find({_id:{$in:trip.participants}}).select('displayName'),
      PersonalExpense.find({tripId:trip._id}).sort({clientCreatedAt:-1}),
      PurseEntry.find({tripId:trip._id}).sort({clientCreatedAt:-1})
    ]);
    res.json({trip:publicTrip(trip,req.user._id),members,
      expenses:expenses.filter(e=>canReadPersonalExpense(trip,req.user._id,e)),
      purseEntries:purseEntries.filter(e=>canReadPurseEntry(trip,req.user._id,e)),
      transactions:calculateSettlement(expenses,trip.participants)});
  });
  router.get('/:tripId/settlement',async(req,res)=>{
    const expenses=await PersonalExpense.find({tripId:req.trip._id});
    res.json({transactions:calculateSettlement(expenses,req.trip.participants)});
  });
  return router;
}
