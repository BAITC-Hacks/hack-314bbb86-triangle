import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {MEASURES} from '../../shared/data.mjs';
import {BASELINE} from '../../shared/engine.mjs';
// Distinct illustrative districts; these buildings are not geolocated reconstructions.
export const SCENE_PROFILES={
 esil:{sky:'#dceaf0',ground:'#bdd5ca',facade:'#c0d3dc',accent:'#6698ab',water:true,housing:[[-8,-6,2.4,2.4,8.4],[-4.6,-7,2.6,2.6,11.2],[.1,-8,2.2,2.4,7.6],[8.5,-6.5,3,3,8],[8.8,-1,2.4,2.6,6.3]],trees:[[-10,-1],[-9,8],[10,8],[1,-5],[10,1]],camera:[29,24,31]},
 almaty:{sky:'#e4e9ef',ground:'#c8cfbc',facade:'#bc9784',accent:'#9f6d57',housing:[[-8.5,-6.3,4,2.5,5],[-3.7,-7.6,4,2.2,5.7],[-8.5,-2.6,4,2.2,4.4],[1,-8,2.2,2.4,6],[8,-6.8,3.6,3,6.2],[8.6,-1.4,3.2,3,5.4]],trees:[[-10,8],[-6,-4.2],[-3,-4],[1,-5],[10,8],[9,1]],camera:[29,25,31]},
 saryarka:{sky:'#e9ece7',ground:'#b8cfb4',facade:'#d9be92',accent:'#997351',housing:[[-9,-7.3,3.5,2.6,3],[-4.2,-7,3.2,2.6,3.6],[.1,-8,2.3,2.3,2.8],[-9.2,-3,2.6,2,2.2],[8,-6.5,3.6,3,4],[8.5,-1.5,2.7,2.6,3]],trees:[[-10,8],[-7,-4.3],[-3,-3.8],[1,-5],[10,8],[9,1],[-1,-9],[10,-9]],camera:[27,23,31]},
 baikonur:{sky:'#e1e8ed',ground:'#c2ccc5',facade:'#bac3c6',accent:'#718c9b',rail:true,housing:[[-8,-6,4.2,3,2.2],[-3.6,-7,3.2,2.8,3.5],[.8,-8,2.5,2.5,4.5],[8.5,-6,3.2,3,5],[8.5,-1.2,3,2.8,4]],trees:[[-10,8],[-9,-1],[10,8],[1,-5],[10,1]],camera:[28,24,31]},
 nura:{sky:'#e6eef4',ground:'#d0d5c4',facade:'#e8e1d3',accent:'#9eaec0',construction:true,housing:[[-8.6,-7,2.6,2.8,7.4],[-4.7,-7.2,2.6,2.8,8.8],[8.7,-7,2.7,3,7.5],[8.9,-1.4,2.8,3,6]],trees:[[-10,8],[-9,-1],[10,8],[1,-5],[9,1]],camera:[29,25,32]}
};
export default function StreetScene({decisions,districtId,quarter,playing,label,trafficChange=0,onSnapshot}){
 const host=useRef(),state=useRef({decisions,districtId,quarter,playing,trafficChange}),[failed,setFailed]=useState(false);
 state.current={decisions,districtId,quarter,playing,trafficChange};
 useEffect(()=>{
  let renderer,frame,observer,controls;const geometries=[],materials=[],profile=SCENE_PROFILES[districtId]||SCENE_PROFILES.nura;
  try{
   const scene=new THREE.Scene();scene.background=new THREE.Color(profile.sky);scene.fog=new THREE.Fog(profile.sky,55,100);
   const camera=new THREE.OrthographicCamera(-17,17,12,-12,.1,150);camera.position.set(...profile.camera);camera.lookAt(0,1,0);
   renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:!!onSnapshot});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.65));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;host.current.appendChild(renderer.domElement);
   controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minPolarAngle=.35;controls.maxPolarAngle=1.25;controls.minZoom=.7;controls.maxZoom=2.5;controls.target.set(0,1,0);
   scene.add(new THREE.HemisphereLight('#edf7ff','#9eaa99',2.2));const sun=new THREE.DirectionalLight('#fff2d9',3.1);sun.position.set(-12,28,16);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-22,right:22,top:24,bottom:-22});sun.shadow.bias=-.0007;sun.shadow.normalBias=.04;scene.add(sun);
   const mat=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.72,metalness:.04,...extra});materials.push(m);return m;};
   const p={base:mat('#c4c9cb'),facade:mat(profile.facade),accent:mat(profile.accent),roof:mat('#bdc8cc'),glass:mat('#5e8d9c',{roughness:.2,metalness:.5}),dark:mat('#314752'),road:mat('#52626c'),sidewalk:mat('#dce1dc'),white:mat('#f5f1e7'),green:mat('#528575'),leaf:mat('#72a38b'),grass:mat(profile.ground),gold:mat('#d9ae5f'),red:mat('#b76f58'),skin:mat('#c6a48d'),water:mat('#559ea9',{roughness:.2,metalness:.25}),lamp:mat('#fff0c4',{emissive:'#eac879',emissiveIntensity:.7})};
   const mesh=(geo,material,x,y,z,parent=scene)=>{geometries.push(geo);const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
   const box=(w,h,d,m,x,y,z,parent)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent);
   const ball=(r,m,x,y,z,parent)=>mesh(new THREE.IcosahedronGeometry(r,1),m,x,y,z,parent);
   const cyl=(r,h,m,x,y,z,parent)=>mesh(new THREE.CylinderGeometry(r,r,h,10),m,x,y,z,parent);
   box(26,.7,23,p.base,0,-.6,0);box(25.8,.14,22.8,p.grass,0,-.18,0);
   box(26,.1,3.2,p.road,0,.01,3.3);box(3,.1,23,p.road,4.8,.015,0);
   for(const z of [1.3,5.3])box(26,.14,.65,p.sidewalk,0,.02,z);
   for(const x of [2.8,6.8])box(.65,.14,23,p.sidewalk,x,.02,0);
   for(let x=-12;x<13;x+=1.5)box(.7,.018,.05,p.white,x,.08,3.3);
   for(let z=-10;z<12;z+=1.5)box(.05,.018,.7,p.white,4.8,.085,z);
   for(let x=3.65;x<6.1;x+=.35)box(.17,.018,1.3,p.white,x,.09,5.4);
   for(let z=2;z<4.8;z+=.35)box(1.1,.018,.17,p.white,2.95,.09,z);
   function windows(w,d,h,parent){const locations=[];for(let y=1.3;y<h-.25;y+=.82){for(let x=-w/2+.4;x<w/2-.1;x+=.68){locations.push([x,y,d/2+.025,0],[x,y,-d/2-.025,0]);}for(let z=-d/2+.4;z<d/2-.1;z+=.68)locations.push([w/2+.025,y,z,Math.PI/2],[-w/2-.025,y,z,Math.PI/2]);}if(!locations.length)return;const geo=new THREE.BoxGeometry(.32,.46,.045);geometries.push(geo);const batch=new THREE.InstancedMesh(geo,p.glass,locations.length),dummy=new THREE.Object3D();locations.forEach(([x,y,z,r],i)=>{dummy.position.set(x,y,z);dummy.rotation.y=r;dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});parent.add(batch);}
   function building(x,z,w,d,h,color=p.facade,parent=scene){const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);box(w,h,d,color,0,h/2,0,g);box(w+.14,.2,d+.14,p.roof,0,h+.1,0,g);box(w*.45,.3,d*.42,p.dark,0,h+.3,0,g);box(.6,.94,.07,p.glass,0,.48,d/2+.05,g);box(.95,.1,.6,p.roof,0,1.03,d/2+.2,g);windows(w,d,h,g);for(let yy=1;yy<h;yy+=1.64)box(w+.03,.07,d+.03,p.accent,0,yy,0,g);return g;}
   profile.housing.forEach((b,i)=>building(...b,i%2?p.white:p.facade));
   // Courtyard paving, benches and parking details make silhouettes legible.
   box(12,.05,2,p.sidewalk,-5,.03,-4.1);
   for(let i=0;i<4;i++){box(.95,.12,.32,p.accent,-9+i*2.2,.42,-3.9);box(.08,.42,.3,p.dark,-9.35+i*2.2,.2,-3.9);box(.08,.42,.3,p.dark,-8.65+i*2.2,.2,-3.9);}
   for(let x=-10;x<-4;x+=1.2){box(.035,.025,1.6,p.white,x,.05,-.1);}
   function tree(x,z,parent=scene,scale=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);cyl(.08,1.2,p.accent,0,.6,0,g);ball(.58,p.green,0,1.6,0,g);ball(.46,p.leaf,.3,1.4,.12,g);return g;}
   profile.trees.forEach(([x,z],i)=>tree(x,z,scene,.8+(i%3)*.12));
   const waterLines=[];
   if(profile.water){box(2.4,.08,23,p.water,-11.7,-.015,0);box(.55,.1,23,p.sidewalk,-10.2,.035,0);for(let z=-10;z<12;z+=2){const wave=box(.7,.012,.025,p.white,-11.7,.04,z);waterLines.push(wave);}for(let z=-9;z<10;z+=3){cyl(.04,.6,p.dark,-10.65,.32,z);box(.05,.04,3,p.dark,-10.65,.62,z+1.4);}}
   if(profile.rail){for(const z of [-10.4,-9.85])box(25,.04,.05,p.dark,0,.02,z);for(let x=-12;x<13;x+=.55)box(.15,.025,1,p.accent,x,-.015,-10.1);building(-5,-8.9,5,1.1,1.1,p.accent);for(let x=7;x<12;x+=1.5)box(1.2,.65,1.1,p.accent,x,.33,-9.3);}
   if(profile.construction){box(3.2,.09,3.5,p.sidewalk,-.2,.05,-8);for(let x=-1.6;x<1.2;x+=.6)box(.06,.6,3.5,p.accent,x,.3,-8);cyl(.07,5,p.gold,.8,2.5,-7.8);box(4,.08,.12,p.gold,-.8,5,-7.8);cyl(.02,2,p.dark,-2.7,4,-7.8);}
   const baseline=BASELINE.districts.find(d=>d.id===districtId),schoolWidth=baseline.metrics.S1>=60?3:1.7;
   building(-10,7.4,schoolWidth,2.3,1.35,p.gold);
   const additions={};for(const m of MEASURES){const g=new THREE.Group();scene.add(g);g.visible=false;g.scale.y=.001;additions[m.id]=g;}
   [[-6,-.4],[-4,-.3],[-8,-.5],[-5,-1.8]].forEach(([x,z])=>tree(x,z,additions.M4));
   [[-10,6],[-2,8],[1,9],[9,8],[-9,-9],[10,-9]].forEach(([x,z])=>tree(x,z,additions.M6,.9));
   building(-6.3,8,4.7,3.2,2.2,p.gold,additions.M7);box(3.9,.08,1.9,p.green,-6.3,.04,5.6,additions.M7);
   for(let x=-8.1;x<-4.5;x+=.7)box(.08,.6,.08,p.white,x,.3,6.3,additions.M7);
   building(-.2,-2,3.8,2.7,2.5,p.white,additions.M8);box(.28,.78,.06,p.red,-.2,1.7,-.59,additions.M8);box(.78,.28,.06,p.red,-.2,1.7,-.55,additions.M8);
   box(4,.1,3.4,p.red,-.8,.04,8,additions.M9);box(3.6,.02,3,p.green,-.8,.1,8,additions.M9);for(const x of [-2.4,.8]){cyl(.04,1.5,p.white,x,.75,8,additions.M9);box(.55,.35,.06,p.white,x,1.6,8,additions.M9);}
   for(let x=-9;x<12;x+=4){cyl(.05,2.6,p.dark,x,1.3,1.3,additions.M10);box(.6,.06,.1,p.dark,x+.25,2.6,1.3,additions.M10);ball(.12,p.lamp,x+.5,2.57,1.3,additions.M10);}
   for(let x=-1;x<2;x+=.38)box(.2,.03,3,p.gold,x,.1,3.3,additions.M11);
   box(25,.018,.62,p.green,0,.085,2.2,additions.M1);
   for(const z of [3.85,4.38])box(26,.022,.045,p.dark,0,.09,z,additions.M3);
   box(2,.13,.6,p.sidewalk,-4,.2,4.85,additions.M3);box(2,.08,.7,p.glass,-4,1.6,4.85,additions.M3);for(const x of [-4.8,-3.2])cyl(.025,1.4,p.dark,x,.85,4.85,additions.M3);
   for(const x of [3,6.8]){cyl(.055,1.8,p.dark,x,.9,1.2,additions.M2);box(.28,.62,.24,p.dark,x,1.8,1.2,additions.M2);ball(.065,p.green,x,1.88,1.35,additions.M2);}
   building(1,.2,1,.7,1.2,p.glass,additions.M12);
   building(-7,-1.2,1.8,1.2,1.1,p.white,additions.M5);for(let i=0;i<2;i++)cyl(.18,.8,p.accent,-7.4+i*.7,1.4,-1.2,additions.M5);
   building(8.7,8,2.5,2.2,1.3,p.accent,additions.M14);box(1,.4,.5,p.gold,8.5,.3,6.3,additions.M14);box(.3,.22,.45,p.glass,8.85,.6,6.3,additions.M14);cyl(.02,.8,p.dark,9.3,1.9,8,additions.M14);
   for(let x=-10;x<2;x+=2)cyl(.15,.035,p.glass,x,.08,.8,additions.M13);
   function vehicle(color,long=false){const g=new THREE.Group();scene.add(g);const len=long?2.1:.85;box(len,.28,.46,color,0,.3,0,g);box(len*.65,.24,.42,p.glass,0,.55,0,g);for(const xx of [-len*.32,len*.32])for(const zz of [-.25,.25])cyl(.105,.08,p.dark,xx,.17,zz,g).rotation.x=Math.PI/2;box(.03,.07,.11,p.lamp,len/2+.015,.32,.14,g);box(.03,.07,.11,p.lamp,len/2+.015,.32,-.14,g);return g;}
   const cars=Array.from({length:18},(_,i)=>({g:vehicle([p.white,p.red,p.accent,p.dark][i%4]),offset:i*1.8,direction:i%2?1:-1}));
   const tram=vehicle(p.white,true),bus=vehicle(p.gold,true);tram.visible=false;bus.visible=false;
   const people=Array.from({length:12},(_,i)=>{const g=new THREE.Group(),child=i<6;scene.add(g);const h=child?.32:.47;cyl(.09,h,[p.gold,p.red,p.accent][i%3],0,h/2+.2,0,g);ball(.12,p.skin,0,h+.29,0,g);const legs=[box(.065,.23,.09,p.dark,-.065,.13,0,g),box(.065,.23,.09,p.dark,.065,.13,0,g)];return {g,legs,child,phase:i*1.2};});
   const resize=()=>{if(!host.current)return;const w=host.current.clientWidth,h=host.current.clientHeight||480,half=Math.max(12.5,18/(w/h));renderer.setSize(w,h);camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();};observer=new ResizeObserver(resize);observer.observe(host.current);resize();
   let elapsed=0,trafficTime=0,snapshotFrames=0,snapshotDone=false,previous=performance.now();const reduced=matchMedia('(prefers-reduced-motion: reduce)');
   function animate(now){frame=requestAnimationFrame(animate);const dt=Math.min((now-previous)/1000,.07);previous=now;const s=state.current,move=s.playing&&!reduced.matches&&!document.hidden;if(move)elapsed+=dt;
    const active=s.decisions.filter(d=>!d.districtId||d.districtId===s.districtId);
    for(const m of MEASURES){const target=active.some(d=>d.measureId===m.id)&&s.quarter>m.lag?Math.min(1,.35+.65*(s.quarter-m.lag)/(8-m.lag)):0,g=additions[m.id];g.scale.y=THREE.MathUtils.lerp(g.scale.y,target,reduced.matches?1:1-Math.exp(-dt*7));g.visible=g.scale.y>.015;}
    const congestion=(100-baseline.metrics.T1)/100,improvement=s.trafficChange;
    if(move)trafficTime+=dt*Math.max(.12,.48-congestion*.3+improvement*.16);
    cars.forEach(({g,offset,direction},i)=>{g.visible=i<Math.max(6,Math.min(18,Math.round(10+congestion*6-improvement*.45)));g.position.set((((trafficTime+offset)%26)-13)*direction,0,i%2?2.5:4.2);g.rotation.y=direction===1?0:Math.PI;});
    people.forEach(({g,legs,child,phase},i)=>{const school=additions.M7.scale.y;g.position.set(child?THREE.MathUtils.lerp(-10+i*.32,-6.3+Math.sin(elapsed*.45+phase)*1.5,Math.min(1,school)):-10+(elapsed*.48+phase)%20,0,child?THREE.MathUtils.lerp(6.1,5.7+Math.cos(elapsed*.4+phase)*.25,Math.min(1,school)):1.25);legs.forEach((leg,j)=>leg.rotation.x=Math.sin(elapsed*5+phase+j*Math.PI)*.35);});
    tram.visible=additions.M3.visible;tram.position.set((elapsed*1.3)%28-14,0,4.1);bus.visible=additions.M1.visible;bus.position.set((elapsed*.95)%28-14,0,2.2);
    waterLines.forEach((w,i)=>w.position.x=-11.8+Math.sin(elapsed*.7+i)*.2);
    controls.update();renderer.render(scene,camera);if(onSnapshot&&!snapshotDone&&++snapshotFrames>45){snapshotDone=true;onSnapshot(renderer.domElement.toDataURL('image/jpeg',.85));}
   }frame=requestAnimationFrame(animate);
  }catch{setFailed(true);onSnapshot?.(null);}
  return()=>{cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer?.dispose();renderer?.domElement.remove();};
 },[districtId]);
 return <div className="street-render" ref={host} role="img" aria-label={label}>{failed&&<div className="street-fallback"><img src="/images/astana-concept.jpg" alt={label}/><span>3D / WebGL</span></div>}</div>;
}

