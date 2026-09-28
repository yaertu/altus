"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "altus-teslimat:theme:v12";

function applyTheme(theme: Theme){
  const root=document.documentElement;
  root.dataset.theme=theme;
  root.classList.toggle("dark",theme==="dark");
  root.style.colorScheme=theme;
  let meta=document.querySelector('meta[name="theme-color"][data-yaa-theme]') as HTMLMetaElement|null;
  if(!meta){
    meta=document.createElement("meta");
    meta.name="theme-color";
    meta.dataset.yaaTheme="true";
    document.head.appendChild(meta);
  }
  meta.content=theme==="dark"?"#1e2e3f":"#ec008c";
}

export default function ThemeToggle(){
  const [theme,setTheme]=useState<Theme>("light");

  useEffect(()=>{
    const stored=localStorage.getItem(KEY) as Theme|null;
    const initial:Theme = stored==="dark"||stored==="light"
      ? stored : "light";
    setTheme(initial);
    applyTheme(initial);

    const sync=(event:StorageEvent)=>{
      if(event.key!==KEY)return;
      const next:Theme=event.newValue==="dark"?"dark":"light";
      setTheme(next);
      applyTheme(next);
    };
    window.addEventListener("storage",sync);
    return()=>window.removeEventListener("storage",sync);
  },[]);

  function change(next:Theme){
    setTheme(next);
    localStorage.setItem(KEY,next);
    applyTheme(next);
  }

  return <div className="themeToggle" role="group" aria-label="Görünüm teması">
    <button className={theme==="light"?"on":""} aria-pressed={theme==="light"} onClick={()=>change("light")} title="Gündüz teması"><Sun/><span>Gündüz</span></button>
    <button className={theme==="dark"?"on":""} aria-pressed={theme==="dark"} onClick={()=>change("dark")} title="Gece teması"><Moon/><span>Gece</span></button>
  </div>;
}
