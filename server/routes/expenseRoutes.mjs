import express from 'express';
import mongoose from 'mongoose';
import { assertCanRecord } from '../access.mjs';
export function expenseRoutes(models,connection){
  const {Trip,PersonalExpense,PurseEntry}=models,router=express.Router();
  router.post('/sync',async(req,res)=>{
    const entries=req.body.offlineExpenses;
    if(!Array.isArray(entries)||!entries.length||entries.length>100)
      return res.status(400).json({error:'Send between 1 and 100 entries.'});
    const savedExpenses=[],errors=[];
    for(const input of entries){
      try{
        if(!input||!mongoose.isObjectIdOrHexString(input.tripId)||!['personal','purse'].includes(input.ledger))
          throw new Error('Invalid trip or ledger.');
        if((input.recordedBy&&String(input.recordedBy)!==String(req.user._id))||input.paidBy)
          throw new Error('You may only record your own payment.');
        const Model=input.ledger==='personal'?PersonalExpense:PurseEntry;
        const entry=new Model({tripId:input.tripId,recordedBy:req.user._id,clientId:input.clientId,
          clientCreatedAt:input.clientCreatedAt,title:input.title,amountPaise:input.amountPaise,
          ...(input.ledger==='personal'?{splitAmong:input.splitAmong}:{kind:input.kind})});
        await entry.validate();
        const trip=await Trip.findById(input.tripId);
        if(!trip)throw new Error('Trip not found.');
        assertCanRecord(trip,req.user._id,entry,input.ledger);
        const identity={tripId:entry.tripId,recordedBy:entry.recordedBy,clientId:entry.clientId};
        let saved=await Model.findOne(identity),inserted=false;
        if(!saved){
          try{
            if(input.ledger==='purse'){
              await connection.transaction(async session=>{
                inserted=false;
                const prior=await Model.findOne(identity).session(session);
                if(prior){saved=prior;return;}
                const delta=entry.kind==='expense'?-entry.amountPaise:entry.amountPaise;
                const updated=await Trip.updateOne({_id:trip._id,purseBalancePaise:delta<0?
                  {$gte:-delta}:{$lte:Number.MAX_SAFE_INTEGER-delta}},{$inc:{purseBalancePaise:delta}},{session});
                if(!updated.modifiedCount)throw new Error('Insufficient purse balance or balance limit reached.');
                [saved]=await Model.create([entry.toObject()],{session});
                inserted=true;
              });
            }else {saved=await entry.save();inserted=true;}
          }catch(error){
            if(error.code!==11000)throw error;
            inserted=false;
            saved=await Model.findOne(identity);
            if(!saved)throw new Error('An opening balance has already been recorded.');
          }
        }
        const comparable=e=>JSON.stringify({title:e.title,amountPaise:e.amountPaise,kind:e.kind,
          splitAmong:e.splitAmong?.map(String),clientCreatedAt:new Date(e.clientCreatedAt).toISOString()});
        if(comparable(saved)!==comparable(entry))throw new Error('This client ID was already used for a different entry.');
        savedExpenses.push(saved);
        if(inserted)req.app.get('live')?.entryChanged(trip,saved,input.ledger);
      }catch(error){
        const safe=error.name==='ValidationError'?'Check the amount, description, beneficiaries, and entry ID.':
          error.name==='MongoServerError'?'Database write failed. Purse writes require a replica set such as Atlas.':
          error.message;
        errors.push({clientId:input?.clientId,error:safe});
      }
    }
    res.json({syncedCount:savedExpenses.length,savedExpenses,errors});
  });
  return router;
}
