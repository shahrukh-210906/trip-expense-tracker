const KEY='trip-traveler-session';
export function getSession(){try{return JSON.parse(localStorage.getItem(KEY))}catch{return null}}
export function saveSession(session){localStorage.setItem(KEY,JSON.stringify(session))}
export async function api(path,body){
  const response=await fetch('/api'+path,{method:body===undefined?'GET':'POST',
    headers:{'Content-Type':'application/json',...(getSession()?.token?{Authorization:'Bearer '+getSession().token}:{})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json().catch(()=>({error:'The API is unavailable. Start the backend and try again.'}));
  if(!response.ok)throw new Error(data.error||'Request failed.');
  return data;
}
