import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import {DownloadSimple, Export, PlusSquare, X} from '@phosphor-icons/react';
const InstallContext = createContext(null);
const dismissedKey = 'out-install-dismissed-v1';
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export function InstallProvider({children}) {
  const [installed, setInstalled] = useState(standalone);
  const [dismissed, setDismissed] = useState(()=>{try{return localStorage.getItem(dismissedKey)==='yes';}catch{return false;}});
  const [promptEvent, setPromptEvent] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialog = useRef(null);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const [platform, setPlatform] = useState(ios ? 'ios' : 'android');
  useEffect(()=>{
    const media = window.matchMedia('(display-mode: standalone)');
    const update = ()=>setInstalled(standalone());
    const capture = e=>{e.preventDefault();setPromptEvent(e);};
    const done = ()=>{setInstalled(true);setPromptEvent(null);setOpen(false);};
    window.addEventListener('beforeinstallprompt',capture);
    window.addEventListener('appinstalled',done);
    media.addEventListener('change',update);
    return ()=>{window.removeEventListener('beforeinstallprompt',capture);window.removeEventListener('appinstalled',done);media.removeEventListener('change',update);};
  },[]);
  useEffect(()=>{
    const el=dialog.current;
    if(open && !el.open) el.showModal();
    if(!open && el.open) el.close();
    if(!open) return;
    const scroller=document.getElementById('club-scroll') || document.querySelector('.login-page');
    const previous=scroller?.style.overflow;
    if(scroller) scroller.style.overflow='hidden';
    return ()=>{if(scroller) scroller.style.overflow=previous;};
  },[open]);
  const dismiss=()=>{setDismissed(true);try{localStorage.setItem(dismissedKey,'yes');}catch{}};
  async function install() {
    if(!promptEvent){setOpen(true);return;}
    setBusy(true);
    try {
      await promptEvent.prompt();
      const choice=await promptEvent.userChoice;
      if(choice.outcome==='accepted') {setInstalled(true);setOpen(false);}
      else dismiss();
    } catch {setOpen(true);} finally {setPromptEvent(null);setBusy(false);}
  }
  return <InstallContext.Provider value={{installed,dismissed,dismiss,install,busy}}>
    {children}
    <dialog ref={dialog} className="install-sheet" aria-labelledby="install-title" onCancel={()=>setOpen(false)} onClick={e=>{if(e.target===dialog.current)setOpen(false);}}>
      <div className="install-sheet-content">
        <button className="install-close" aria-label="Закрыть инструкцию" onClick={()=>setOpen(false)}><X size={22}/></button>
        <img className="install-app-icon" src="/icons/icon-192.png" alt="" width="64" height="64"/>
        <p className="eyebrow">OUT TENNIS CLUB</p>
        <h2 id="install-title">Клуб — на экране домой</h2>
        <p>Открывай рейтинг и турниры одним касанием.</p>
        <div className="install-platform" role="group" aria-label="Инструкция для телефона">
          <button aria-pressed={platform === "ios"} onClick={()=>setPlatform("ios")}>iPhone / iPad</button>
          <button aria-pressed={platform === "android"} onClick={()=>setPlatform("android")}>Android</button>
        </div>
        <ol className="install-steps">
          {platform === "ios" ? <>
            <li><Export size={25}/><span>Нажми <strong>«Поделиться»</strong> в меню браузера.</span></li>
            <li><PlusSquare size={25}/><span>Выбери <strong>«На экран “Домой”»</strong>. Если пункта нет, открой сайт в Safari.</span></li>
            <li><DownloadSimple size={25}/><span>Оставь имя <strong>OUT Club</strong> и нажми <strong>«Добавить»</strong>. Если есть переключатель «Открывать как веб-приложение», включи его.</span></li>
          </> : <>
            <li><span className="install-menu-dots" aria-hidden="true">⋮</span><span>Открой <strong>меню браузера</strong>.</span></li>
            <li><PlusSquare size={25}/><span>Выбери <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong>.</span></li>
            <li><DownloadSimple size={25}/><span>Подтверди установку <strong>OUT Club</strong>. Если пункта нет, открой сайт в Chrome или Safari.</span></li>
          </>}
        </ol>
        <button className="button primary" onClick={()=>setOpen(false)}>Понятно</button>
      </div>
    </dialog>
  </InstallContext.Provider>;
}
export function InstallBanner() {
  const state=useContext(InstallContext);
  if(state.installed || state.dismissed) return null;
  return <aside className="install-banner" aria-label="Добавить приложение">
    <img src="/icons/icon-192.png" alt="" width="44" height="44"/>
    <div><strong>OUT — всегда под рукой</strong><span>Добавь клуб на экран домой</span></div>
    <button className="install-action" onClick={state.install} disabled={state.busy}>Добавить</button>
    <button className="install-close" aria-label="Скрыть подсказку установки" onClick={state.dismiss}><X size={18}/></button>
  </aside>;
}
export function InstallMenuButton() {
  const state=useContext(InstallContext);
  if(state.installed) return null;
  return <button onClick={state.install} disabled={state.busy}><DownloadSimple size={22}/>Добавить на экран домой</button>;
}
