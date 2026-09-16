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
        const trip=await Trip.findById(input.tripId);
        if(!trip)throw new Error('Trip not found.');
        const Model=input.ledger==='personal'?PersonalExpense:PurseEntry;
        const entry=new Model({tripId:input.tripId,recordedBy:req.user._id,clientId:input.clientId,
          clientCreatedAt:input.clientCreatedAt,title:input.title,amountPaise:input.amountPaise,
          ...(input.ledger==='personal'?{splitAmong:input.splitAmong}:{kind:input.kind,...(input.kind==='expense'?{splitAmong:input.splitAmong||trip.participants}:{})})});
        await entry.validate();
        assertCanRecord(trip,req.user._id,entry,input.ledger);
        const identity={tripId:entry.tripId,recordedBy:entry.recordedBy,clientId:entry.clientId};
        let saved=await Model.findOne(identity),inserted=false;
        if(!saved){
          try{
            await connection.transaction(async session=>{
              inserted=false;
              const prior=await Model.findOne(identity).session(session);
              if(prior){saved=prior;return;}
              const delta=input.ledger==='purse'?(entry.kind==='expense'?-entry.amountPaise:entry.amountPaise):0;
              const bounds=delta<0?{$gte:-Number.MAX_SAFE_INTEGER-delta}:{$lte:Number.MAX_SAFE_INTEGER-delta};
              const updated=await Trip.updateOne({_id:trip._id,status:{$ne:'ended'},purseBalancePaise:bounds},{$inc:{purseBalancePaise:delta,ledgerVersion:1}},{session});
              if(!updated.modifiedCount)throw new Error('This trip has ended or the balance limit was reached.');
              [saved]=await Model.create([entry.toObject()],{session});
              inserted=true;
            });
          }catch(error){
            if(error.code!==11000)throw error;
            inserted=false;
            saved=await Model.findOne(identity);
            if(!saved)throw new Error('An opening balance has already been recorded.');
          }
        }
        const comparable=e=>JSON.stringify({title:e.title,amountPaise:e.amountPaise,kind:e.kind,
          splitAmong:(e.splitAmong||(e.kind==='expense'?trip.participants:undefined))?.map(String),clientCreatedAt:new Date(e.clientCreatedAt).toISOString()});
        if(comparable(saved)!==comparable(entry))throw new Error('This client ID was already used for a different entry.');
        savedExpenses.push(saved);
        if(inserted)req.app.get('live')?.entryChanged(trip,saved,input.ledger);
      }catch(error){
        const safe=error.name==='ValidationError'?'Check the amount, description, beneficiaries, and entry ID.':
          error.name==='MongoServerError'?'Database write failed. Purse writes require a replica set such as Atlas.':
          error.message;
        const retryable=['MongoNetworkError','MongoNetworkTimeoutError','MongoServerSelectionError','MongoServerError'].includes(error.name);
        errors.push({clientId:input?.clientId,error:safe,retryable});
      }
    }
    res.json({syncedCount:savedExpenses.length,savedExpenses,errors});
  });
  return router;
}
