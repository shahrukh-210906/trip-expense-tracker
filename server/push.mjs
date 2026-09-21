import webpush from 'web-push';
export function pushReady(){return Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);}
export function validSubscription(subscription){
 try{
  const url=new URL(subscription.endpoint);
  const allowed=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'];
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&allowed.includes(url.hostname)&&subscription.endpoint.length<2048&&
   /^[A-Za-z0-9_-]{22}$/.test(subscription.keys?.auth)&&/^[A-Za-z0-9_-]{87}$/.test(subscription.keys?.p256dh);
 }catch{return false;}
}
export async function pushNotification(models,notification){
 if(!pushReady())return;
 const subscriptions=await models.PushSubscription.find({userId:notification.userId}).limit(10);
 await Promise.allSettled(subscriptions.map(async subscription=>{
  if(!validSubscription(subscription))return;
  try{await webpush.sendNotification({endpoint:subscription.endpoint,keys:{auth:subscription.keys.auth,p256dh:subscription.keys.p256dh}},JSON.stringify({title:'TripRoam',body:'You have a new settlement update. Open TripRoam to review it.'}),{
   vapidDetails:{subject:process.env.VAPID_SUBJECT,publicKey:process.env.VAPID_PUBLIC_KEY,privateKey:process.env.VAPID_PRIVATE_KEY},TTL:86400,timeout:5000,
  });}catch(error){if([404,410].includes(error.statusCode))await models.PushSubscription.deleteOne({_id:subscription._id});}
 }));
}
