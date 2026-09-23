import React,{useEffect,useRef,useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {LocateFixed,MapPin} from 'lucide-react';
import {useApp} from './context.jsx';
let geometryPromise;
export function CityMap({districts,selected,onSelect,compact=false}){
 const {locale,t,number}=useApp(),container=useRef(),map=useRef(),layers=useRef(),labels=useRef(),features=useRef(),callback=useRef(onSelect);
 const [ready,setReady]=useState(false),[error,setError]=useState('');callback.current=onSelect;
 useEffect(()=>{
  const m=L.map(container.current,{scrollWheelZoom:false,zoomControl:false,minZoom:9,maxZoom:17,attributionControl:true}).setView([51.14,71.43],10.5);map.current=m;
  L.control.zoom({position:'bottomright'}).addTo(m);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'}).addTo(m);
  let failed=0;tiles.on('tileerror',()=>{if(++failed>4)setError('tilesError');});tiles.on('tileload',()=>setError(''));
  let alive=true;
  geometryPromise??=fetch('/astana-districts.geojson').then(r=>{if(!r.ok)throw Error();return r.json();}).catch(e=>{geometryPromise=null;throw e;});
  geometryPromise.then(g=>{if(!alive)return;features.current=g;layers.current=L.geoJSON(g,{onEachFeature:(f,l)=>{
   l.on('click',()=>{if(f.properties.datasetId)callback.current?.(f.properties.datasetId);});
  }}).addTo(m);labels.current=L.layerGroup().addTo(m);m.fitBounds(layers.current.getBounds(),{padding:[20,20]});setReady(true);}).catch(()=>setError('mapError'));
  const observer=new ResizeObserver(()=>m.invalidateSize());observer.observe(container.current);
  return()=>{alive=false;observer.disconnect();m.remove();};
 },[]);
 useEffect(()=>{
  if(!ready)return;labels.current.clearLayers();
  layers.current.eachLayer(layer=>{
   const p=layer.feature.properties,d=districts.find(x=>x.id===p.datasetId),score=d?.score;
   const color=score==null?'#9da6af':score<52?'#cb773a':score<58?'#c09b3d':'#13816c';
   layer.setStyle({color:p.datasetId===selected?'#075848':color,weight:p.datasetId===selected?3:1.8,fillColor:color,fillOpacity:p.datasetId===selected?0.34:0.15,dashArray:d?null:'6 4'});
   const name=p[`name_${locale}`]||p.name_en;
   layer.unbindTooltip();layer.bindTooltip(`${name} · ${d?number(score):t('noData')}`,{sticky:true,className:'district-tooltip'});
   if(!compact){const point=L.latLng(p.center[1],p.center[0]);const el=document.createElement('button');el.className=`map-label ${p.datasetId===selected?'active':''}`;el.type='button';el.textContent=`${name}  ${d?number(score):'—'}`;el.setAttribute('aria-label',name);if(!d){el.disabled=true;el.title=t('noData');}else el.onclick=()=>callback.current?.(p.datasetId);
    L.marker(point,{icon:L.divIcon({className:'map-label-wrap',html:el,iconSize:[130,35],iconAnchor:[65,17]}),interactive:true}).addTo(labels.current);
   }
  });
 },[ready,districts,selected,locale,compact]);
 return <div className={`map-shell ${compact?'compact':''}`}><div className="leaflet-host" ref={container} role="region" aria-label={t('source')}/><div className="map-tag"><MapPin size={14}/> Astana <span>51.17° N · 71.45° E</span></div><button className="map-fit icon-button" title={t('zoom')} aria-label={t('zoom')} onClick={()=>layers.current&&map.current.fitBounds(layers.current.getBounds(),{padding:[20,20]})}><LocateFixed size={19}/></button>{error&&<div className="map-error" role="status">{t(error)}</div>}</div>;
}

