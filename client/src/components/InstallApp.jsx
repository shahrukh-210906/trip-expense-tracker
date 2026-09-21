import { useEffect, useState } from 'react';
import { InstallationGuide } from './Tutorial.jsx';

export default function InstallApp(){
  const [prompt,setPrompt]=useState(null),[installed,setInstalled]=useState(()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true);
  const [help,setHelp]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{
    const media=matchMedia('(display-mode: standalone)');
    const available=event=>{event.preventDefault();setPrompt(event);};
    const done=()=>{setInstalled(true);setPrompt(null);};
    const changed=()=>setInstalled(media.matches||navigator.standalone===true);
    window.addEventListener('beforeinstallprompt',available);window.addEventListener('appinstalled',done);media.addEventListener('change',changed);
    return()=>{window.removeEventListener('beforeinstallprompt',available);window.removeEventListener('appinstalled',done);media.removeEventListener('change',changed);};
  },[]);
  async function install(){
    if(!prompt){setHelp(!help);return;}
    setBusy(true);setMessage('');
    try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='dismissed')setMessage('You can install later from your browser menu.');}
    catch{setMessage('Use your browser menu to install Triproam.');}
    finally{setPrompt(null);setBusy(false);}
  }
  if(installed)return null;
  return <div className="install-app"><button className="text-button" disabled={busy} aria-expanded={help} onClick={install}>{prompt?'Install Triproam':'How to install Triproam'}</button>{help&&<InstallationGuide/>}{message&&<p role="status">{message}</p>}</div>;
}
