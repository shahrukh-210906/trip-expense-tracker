const KEY='trip-traveler-session';
export function getSession(){try{return JSON.parse(localStorage.getItem(KEY))}catch{return null}}
export function saveSession(session){localStorage.setItem(KEY,JSON.stringify(session))}
export async function api(path,body,options={}){
  const token=options.token??getSession()?.token;
  let response;
  try {
    response=await fetch('/api'+path,{method:body===undefined?'GET':'POST',signal:AbortSignal.timeout(10000),
      headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
  } catch { throw Object.assign(new Error('Unable to reach the server. Try again when connected.'),{retryable:true}); }
  const data=await response.json().catch(()=>{throw Object.assign(new Error('The server response was incomplete. Try again.'),{retryable:true});});
  if(!response.ok)throw Object.assign(new Error(data.error||'Request failed.'),{status:response.status,retryable:response.status>=500||response.status===429});
  return data;
}
