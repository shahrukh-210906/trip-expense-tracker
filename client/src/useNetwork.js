import { useEffect, useState } from 'react';
export function useNetwork(){
  const [offline,setOffline]=useState(()=>!navigator.onLine);
  useEffect(()=>{
    const down=()=>setOffline(true),up=()=>setOffline(false);
    const message=event=>{if(event.data?.type==='network-unavailable')down();};
    window.addEventListener('offline',down);window.addEventListener('online',up);window.addEventListener('trip:connected',up);
    navigator.serviceWorker?.addEventListener('message',message);
    return()=>{window.removeEventListener('offline',down);window.removeEventListener('online',up);window.removeEventListener('trip:connected',up);navigator.serviceWorker?.removeEventListener('message',message);};
  },[]);
  return offline;
}
