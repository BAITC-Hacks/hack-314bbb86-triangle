import React,{useEffect,useRef,useState} from 'react';
import {Map as GLMap,NavigationControl,Marker,setWorkerUrl} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import {RotateCw,LocateFixed,Layers3,Map as MapIcon} from 'lucide-react';
import {CityMap} from './CityMap.jsx';
import {useApp} from './context.jsx';
setWorkerUrl(workerUrl);
const CAMERAS={esil:[71.432,51.130],nura:[71.392,51.136],saryarka:[71.408,51.183],baikonur:[71.464,51.181],almaty:[71.482,51.156]};
const HOME={center:[71.433,51.130],zoom:14.2,pitch:60,bearing:-28};
const color=score=>score==null?'#aebdc9':score<52?'#cb8661':score<58?'#cdad68':'#438f9b';
const COPY={kk:{model:'Қаланың 3D макеті',districts:'Аудандар',note:'Таңдалған аудан фрагменті · OSM. Жетпейтін биіктіктер шартты.',loading:'Қала геометриясы жүктелуде…'},ru:{model:'3D-макет города',districts:'Районы',note:'Выбранный фрагмент района · OSM. Недостающие высоты условные.',loading:'Загружается геометрия города…'},en:{model:'3D city model',districts:'Districts',note:'Selected district fragment · OSM. Missing heights are estimated.',loading:'Loading city geometry…'}};
export default function CityScene({districts,selected,onSelect,compact=false}){
 const {locale,office,number,data}=useApp(),c=COPY[locale],host=useRef(),map=useRef(),geometry=useRef(),markers=useRef([]),previousSelected=useRef(selected),latest=useRef({districts,selected,onSelect}),[ready,setReady]=useState(false),[mode,setMode]=useState('3d'),[core,setCore]=useState(true),[area,setArea]=useState('esil'),[fallback,setFallback]=useState(false),[notice,setNotice]=useState('');
 latest.current={districts,selected,onSelect};
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 useEffect(()=>{let alive=true,m,observer;const fail=()=>{if(alive)setFallback(true)};
  try{m=new GLMap({container:host.current,...HOME,attributionControl:{compact:true},minZoom:9,maxZoom:19,maxPitch:70,renderWorldCopies:false,canvasContextAttributes:{antialias:true},style:{version:8,light:{anchor:'viewport',color:'#fff8ec',intensity:.55,position:[1.5,210,35]},sources:{streets:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'}},layers:[{id:'ground',type:'background',paint:{'background-color':'#b9c2bf'}},{id:'streets',type:'raster',source:'streets',paint:{'raster-saturation':-.6,'raster-opacity':0}}]}});map.current=m;
   m.scrollZoom.disable();m.addControl(new NavigationControl({visualizePitch:true}),'bottom-right');
   m.on('webglcontextlost',fail);m.on('error',e=>{if(e.error?.name==='GPUInitializationError')fail();});
   m.on('load',async()=>{try{
    const responses=await Promise.all([fetch('/astana-districts.geojson'),fetch('/astana-urban.geojson')]);if(responses.some(r=>!r.ok))throw Error();const [geo,urban]=await Promise.all(responses.map(r=>r.json()));if(!alive)return;geometry.current=geo;
    m.addSource('districts',{type:'geojson',data:geo});m.addSource('urban',{type:'geojson',data:urban});
    const kind=k=>['==',['get','kind'],k];
    m.addLayer({id:'urban-water',type:'fill',source:'urban',filter:kind('water'),paint:{'fill-color':'#8bb5c0','fill-opacity':1}});
    m.addLayer({id:'urban-park',type:'fill',source:'urban',filter:kind('park'),paint:{'fill-color':['match',['get','landuse'],'forest','#628d65','grass','#91ac78','#83a375']}});
    m.addLayer({id:'urban-waterways',type:'line',source:'urban',filter:kind('waterway'),paint:{'line-color':'#8bb5c0','line-width':3}});
    m.addLayer({id:'urban-road-areas',type:'fill',source:'urban',filter:kind('road_area'),paint:{'fill-color':'#a3ada8'}});
    const width=['interpolate',['linear'],['zoom'],12,['match',['get','highway'],['primary','secondary','trunk'],2,['tertiary','residential'],1.2,.45],16,['match',['get','highway'],['primary','secondary','trunk'],15,['tertiary','residential'],9,['service','unclassified'],5,1.7],19,['match',['get','highway'],['primary','secondary','trunk'],85,['tertiary','residential'],55,['service','unclassified'],30,9]];
    m.addLayer({id:'urban-road-edges',type:'line',source:'urban',filter:kind('road'),layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#e4e5df','line-width':['+',width,1.4]}});
    m.addLayer({id:'urban-roads',type:'line',source:'urban',filter:kind('road'),layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['match',['get','highway'],['footway','path','pedestrian','steps'],'#dddcd2','#858e90'],'line-width':width}});
    m.addLayer({id:'urban-buildings',type:'fill-extrusion',source:'urban',filter:['in',['get','kind'],['literal',['building','building_part']]],paint:{'fill-extrusion-color':['case',['==',['get','kind'],'building_part'],'#f8f7f1','#e8eae6'],'fill-extrusion-height':['get','render_height_m'],'fill-extrusion-base':['get','render_min_height_m'],'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true}});
    for(const f of geo.features){const id=f.properties.id;m.addLayer({id:'district-'+id,type:'fill',source:'districts',filter:['==',['get','id'],id],paint:{'fill-color':color(latest.current.districts.find(d=>d.id===id)?.score),'fill-opacity':0}});m.on('click','district-'+id,()=>{if(f.properties.datasetId)latest.current.onSelect?.(f.properties.datasetId);});}
    m.addLayer({id:'district-outlines',type:'line',source:'districts',paint:{'line-color':'#4f7183','line-width':1.4,'line-opacity':0}});
    setReady(true);
   }catch{if(alive){setNotice('mapUnavailable');m.setPaintProperty('streets','raster-opacity',.8);}}});
   observer=new ResizeObserver(()=>m.resize());observer.observe(host.current);
  }catch{fail();}
  return()=>{alive=false;observer?.disconnect();markers.current.forEach(x=>x.remove());markers.current=[];m?.remove();map.current=null;};
 },[]);
 useEffect(()=>{if(!ready||fallback)return;const m=map.current;m.setPaintProperty('streets','raster-opacity',core?0:.8);m.setPaintProperty('district-outlines','line-opacity',core?0:.6);
  for(const id of ['urban-water','urban-park','urban-waterways','urban-road-areas','urban-road-edges','urban-roads','urban-buildings'])m.setLayoutProperty(id,'visibility',core?'visible':'none');
  m.setPaintProperty('urban-buildings','fill-extrusion-height',mode==='3d'?['get','render_height_m']:0);
  for(const f of geometry.current.features){const id=f.properties.id,d=districts.find(d=>d.id===id);m.setPaintProperty('district-'+id,'fill-opacity',core?0:.25);m.setPaintProperty('district-'+id,'fill-color',id===selected?'#087f87':color(d?.score));}
  markers.current.forEach(x=>x.remove());markers.current=[];
  if(!core)for(const f of geometry.current.features){const p=f.properties,d=districts.find(x=>x.id===p.datasetId),el=document.createElement('button');el.type='button';el.className='scene-label '+(selected===p.datasetId?'active ':'')+(!d?'neutral':'');el.textContent=p['name_'+locale]||p.name_en;const value=document.createElement('b');value.textContent=d?number(d.score):'—';el.append(value);if(d)el.onclick=()=>latest.current.onSelect?.(d.id);else el.disabled=true;markers.current.push(new Marker({element:el,anchor:'center'}).setLngLat(p.center).addTo(m));}
 },[ready,districts,selected,mode,locale,fallback,core]);
 useEffect(()=>{if(ready&&previousSelected.current!==selected){previousSelected.current=selected;focus();}},[selected,ready]);
 function toggle(next){setMode(next);map.current?.easeTo({pitch:next==='3d'?60:0,bearing:next==='3d'?-28:0,duration:reduced()?0:750});}
 function regions(){setCore(false);const boxes=geometry.current?.features.map(f=>f.properties.boundingbox);if(boxes)map.current.fitBounds([[Math.min(...boxes.map(b=>b[2])),Math.min(...boxes.map(b=>b[0]))],[Math.max(...boxes.map(b=>b[3])),Math.max(...boxes.map(b=>b[1]))]],{padding:45,duration:reduced()?0:900,pitch:0,bearing:0,maxZoom:10.4});}
 function focus(){setCore(true);setArea(selected);setMode('3d');map.current?.flyTo({center:CAMERAS[selected]||HOME.center,zoom:selected==='esil'?14.2:15.8,pitch:60,bearing:-28,duration:reduced()?0:900});}
 function city(){setCore(true);setArea('esil');setMode('3d');map.current?.flyTo({...HOME,duration:reduced()?0:900});}
 return <div className={'city-scene '+(compact?'scene-compact':'')}>{fallback?<CityMap districts={districts} selected={selected} onSelect={onSelect}/>:<div ref={host} className="scene-canvas" aria-label={office.map3D} role="region"/>}<div className="scene-toolbar"><span className="scene-location">Astana</span>{!fallback&&<div className="scene-mode"><button aria-pressed={mode==='2d'} onClick={()=>toggle('2d')}><MapIcon size={15}/>2D</button><button aria-pressed={mode==='3d'} onClick={()=>toggle('3d')}><Layers3 size={15}/>3D</button></div>}</div>{!fallback&&<><div className="urban-view-switch"><button aria-pressed={core} onClick={city}>{c.model}</button><button aria-pressed={!core} onClick={regions}>{c.districts}</button></div><div className="scene-camera"><button onClick={()=>map.current?.rotateTo(map.current.getBearing()+45,{duration:reduced()?0:600})} aria-label={office.rotate}><RotateCw size={18}/></button><button onClick={focus} aria-label={office.focusDistrict}><LocateFixed size={18}/></button><button className="scene-reset" onClick={city}>{office.resetCamera}</button></div></>}<div className="urban-map-note">{core?data.districts[area].name+' · '+c.note:'QoL · '+office.fixedConditions}</div>{!ready&&!fallback&&!notice&&<div className="scene-loading"><span className="spinner"/>{c.loading}</div>}{(notice||fallback)&&<div className="scene-notice" role="status">{fallback?office.webglFallback:office[notice]}</div>}</div>;
}

