import React,{useEffect,useRef,useState} from 'react';
import {Map as GLMap,NavigationControl,Marker,setWorkerUrl} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import {RotateCw,LocateFixed,Layers3,Map as MapIcon} from 'lucide-react';
import {CityMap} from './CityMap.jsx';
import {useApp} from './context.jsx';
setWorkerUrl(workerUrl);
const HOME={center:[71.45,51.13],zoom:10.8,pitch:48,bearing:-22};
const color=score=>score==null?'#aebdc9':score<52?'#cb8661':score<58?'#cdad68':'#438f9b';
export default function CityScene({districts,selected,onSelect,compact=false}){
 const {locale,office,number}=useApp(),host=useRef(),map=useRef(),geometry=useRef(),overview=useRef(HOME),markers=useRef([]),latest=useRef({districts,selected,onSelect}),[ready,setReady]=useState(false),[mode,setMode]=useState('3d'),[fallback,setFallback]=useState(false),[notice,setNotice]=useState('');
 latest.current={districts,selected,onSelect};
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 useEffect(()=>{let alive=true,m,observer;const fail=()=>{if(alive)setFallback(true)};
  try{m=new GLMap({container:host.current,...HOME,attributionControl:{compact:true},minZoom:9,maxZoom:16,maxPitch:65,renderWorldCopies:false,canvasContextAttributes:{antialias:true},style:{version:8,sources:{streets:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'}},layers:[{id:'ground',type:'background',paint:{'background-color':'#e4edf2'}},{id:'streets',type:'raster',source:'streets',paint:{'raster-saturation':-.8,'raster-opacity':.72,'raster-contrast':-.12}}]}});map.current=m;
   m.scrollZoom.disable();m.addControl(new NavigationControl({visualizePitch:true}),'bottom-right');
   m.on('webglcontextlost',fail);m.on('error',e=>{if(e.error?.name==='GPUInitializationError')fail();});
   m.on('load',async()=>{try{const res=await fetch('/astana-districts.geojson');if(!res.ok)throw Error();const geo=await res.json();if(!alive)return;geometry.current=geo;
    const boxes=geo.features.map(f=>f.properties.boundingbox);
    m.fitBounds([[Math.min(...boxes.map(b=>b[2])),Math.min(...boxes.map(b=>b[0]))],[Math.max(...boxes.map(b=>b[3])),Math.max(...boxes.map(b=>b[1]))]],{padding:55,duration:0,pitch:48,bearing:-22,maxZoom:10.2});
    overview.current={center:m.getCenter(),zoom:m.getZoom(),pitch:48,bearing:-22};
    m.addSource('districts',{type:'geojson',data:geo});
    for(const f of geo.features){const id=f.properties.id,d=latest.current.districts.find(d=>d.id===id);m.addLayer({id:`volume-${id}`,type:'fill-extrusion',source:'districts',filter:['==',['get','id'],id],paint:{'fill-extrusion-color':color(d?.score),'fill-extrusion-opacity':.68,'fill-extrusion-height':0,'fill-extrusion-base':0,'fill-extrusion-height-transition':{duration:reduced()?0:850,delay:0},'fill-extrusion-color-transition':{duration:reduced()?0:600,delay:0}}});m.on('click',`volume-${id}`,()=>{if(f.properties.datasetId)latest.current.onSelect?.(f.properties.datasetId);});m.on('mouseenter',`volume-${id}`,()=>{m.getCanvas().style.cursor=f.properties.datasetId?'pointer':''});m.on('mouseleave',`volume-${id}`,()=>{m.getCanvas().style.cursor=''});}
    m.addLayer({id:'district-outlines',type:'line',source:'districts',paint:{'line-color':'#4f7183','line-width':1,'line-opacity':.45}});
    setReady(true);
   }catch{if(alive)setNotice('mapUnavailable');}});
   observer=new ResizeObserver(()=>m.resize());observer.observe(host.current);
  }catch{fail();}
  return()=>{alive=false;observer?.disconnect();markers.current.forEach(x=>x.remove());markers.current=[];m?.remove();map.current=null;};
 },[]);
 useEffect(()=>{if(!ready||fallback)return;const m=map.current;for(const f of geometry.current.features){const id=f.properties.id,d=districts.find(d=>d.id===id);m.setPaintProperty(`volume-${id}`,'fill-extrusion-height',mode==='3d'&&d?d.score*16:0);m.setPaintProperty(`volume-${id}`,'fill-extrusion-color',id===selected?'#1f7188':color(d?.score));}
  markers.current.forEach(x=>x.remove());markers.current=[];
  for(const f of geometry.current.features){const p=f.properties,d=districts.find(x=>x.id===p.datasetId),el=document.createElement('button');el.type='button';el.className=`scene-label ${selected===p.datasetId?'active':''} ${!d?'neutral':''}`;el.textContent=p[`name_${locale}`]||p.name_en;const value=document.createElement('b');value.textContent=d?number(d.score):'—';el.append(value);el.setAttribute('aria-label',`${el.textContent}`);if(d)el.onclick=()=>latest.current.onSelect?.(d.id);else el.disabled=true;
   markers.current.push(new Marker({element:el,anchor:'center'}).setLngLat(p.center).addTo(m));}
 },[ready,districts,selected,mode,locale,fallback]);
 function toggle(next){setMode(next);map.current?.easeTo({pitch:next==='3d'?48:0,bearing:next==='3d'?-22:0,duration:reduced()?0:750});}
 function focus(){const feature=geometry.current?.features.find(f=>f.properties.datasetId===selected);map.current?.flyTo(feature?{center:feature.properties.center,zoom:11.4,pitch:mode==='3d'?48:0,duration:reduced()?0:900}:{...HOME,duration:reduced()?0:900});}
 return <div className={`city-scene ${compact?'scene-compact':''}`}>
  {fallback?<CityMap districts={districts} selected={selected} onSelect={onSelect}/>:<div ref={host} className="scene-canvas" aria-label={office.map3D} role="region"/>}
  <div className="scene-toolbar"><span className="scene-location"><span className="live-dot"/>Astana</span>{!fallback&&<div className="scene-mode"><button aria-pressed={mode==='2d'} onClick={()=>toggle('2d')}><MapIcon size={15}/>2D</button><button aria-pressed={mode==='3d'} onClick={()=>toggle('3d')}><Layers3 size={15}/>3D</button></div>}</div>
  {!fallback&&<div className="scene-camera"><button onClick={()=>map.current?.rotateTo(map.current.getBearing()+45,{duration:reduced()?0:600})} title={office.rotate} aria-label={office.rotate}><RotateCw size={18}/></button><button onClick={focus} title={office.focusDistrict} aria-label={office.focusDistrict}><LocateFixed size={18}/></button><button className="scene-reset" onClick={()=>{setMode('3d');map.current?.flyTo({...overview.current,duration:reduced()?0:900});}}>{office.resetCamera}</button></div>}
  <div className="scene-legend"><span><i style={{background:'#cb8661'}}/>&lt;52</span><span><i style={{background:'#cdad68'}}/>52–58</span><span><i style={{background:'#438f9b'}}/>&gt;58</span><small>QoL</small></div>
  {(!ready&&!fallback&&!notice)&&<div className="scene-loading"><span className="spinner"/>{office.loadingCity}</div>}
  {(notice||fallback)&&<div className="scene-notice" role="status">{fallback?office.webglFallback:office[notice]}</div>}
 </div>;
}
