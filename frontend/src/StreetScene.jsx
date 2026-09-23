import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {MEASURES} from '../../shared/data.mjs';
// An illustrative diorama, never a reconstruction of actual district buildings.
export default function StreetScene({decisions,districtId,quarter,playing,label,trafficChange=0}){
 const host=useRef(),state=useRef({decisions,districtId,quarter,playing,trafficChange}),[failed,setFailed]=useState(false);
 state.current={decisions,districtId,quarter,playing,trafficChange};
 useEffect(()=>{
  let renderer,frame,observer,controls;const geometries=[],materials=[];
  try{
   const scene=new THREE.Scene();scene.background=new THREE.Color('#e8eff3');scene.fog=new THREE.Fog('#e8eff3',35,80);
   const camera=new THREE.OrthographicCamera(-17,17,12,-12,.1,140);camera.position.set(27,25,30);camera.lookAt(0,0,0);
   renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;host.current.appendChild(renderer.domElement);
   controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minPolarAngle=.35;controls.maxPolarAngle=1.3;controls.minZoom=.65;controls.maxZoom=2.3;controls.target.set(0,1,0);
   scene.add(new THREE.HemisphereLight('#ffffff','#a5bac6',2.6));const sun=new THREE.DirectionalLight('#fff2dc',3);sun.position.set(-15,28,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20});sun.shadow.bias=-.001;scene.add(sun);
   const mat=color=>{const m=new THREE.MeshStandardMaterial({color,roughness:.8,metalness:.02});materials.push(m);return m;};
   const palette={cream:mat('#e9dfce'),roof:mat('#c6d5d9'),blue:mat('#81afc0'),dark:mat('#35576c'),road:mat('#738995'),white:mat('#fcfaf2'),green:mat('#5d9c86'),grass:mat('#b9cead'),gold:mat('#d9b56a'),red:mat('#ca816a'),skin:mat('#d2a786')};
   const mesh=(geometry,material,x,y,z,parent=scene)=>{geometries.push(geometry);const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
   const box=(w,h,d,m,x,y,z,p)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z,p);
   const sphere=(r,m,x,y,z,p)=>mesh(new THREE.SphereGeometry(r,10,8),m,x,y,z,p);
   const cylinder=(r,h,m,x,y,z,p)=>mesh(new THREE.CylinderGeometry(r,r,h,8),m,x,y,z,p);
   box(24,.65,21,palette.cream,0,-.5,0);box(23.7,.12,20.7,palette.grass,0,-.1,0);
   box(24,.1,3.1,palette.road,0,.04,3.1);box(3,.1,21,palette.road,4.8,.045,0);
   box(24,.12,.38,palette.white,0,.05,1.3);box(24,.12,.38,palette.white,0,.05,4.95);
   for(let x=-11;x<12;x+=1.5)box(.7,.015,.06,palette.white,x,.11,3.1);
   for(let z=-9;z<10;z+=1.5)box(.06,.015,.7,palette.white,4.8,.11,z);
   for(let x=3.65;x<6.1;x+=.38)box(.2,.02,1.5,palette.white,x,.12,5.4);
   function building(x,z,w,d,h,color,parent=scene){const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);box(w,h,d,color,0,h/2,0,g);box(w+.15,.18,d+.15,palette.roof,0,h+.1,0,g);box(.48,.95,.08,palette.dark,0,.5,d/2+.04,g);for(let y=1.4;y<h-.1;y+=.9)for(let xx=-w/2+.45;xx<w/2;xx+=.7){box(.35,.44,.04,palette.blue,xx,y,d/2+.03,g);box(.04,.44,.35,palette.blue,w/2+.03,y,xx,g);}return g;}
   building(-8,-6,3.1,3,5.3,palette.cream);building(-3.8,-6.8,2.8,2.6,7,palette.white);building(8,-6,3,3,4.4,palette.cream);building(8,-1.3,2.6,2.7,5.8,palette.white);
   building(-10.3,6.8,1.5,2,1.3,palette.gold);
   const additions={};for(const m of MEASURES){const g=new THREE.Group();scene.add(g);g.visible=false;g.scale.y=.001;additions[m.id]=g;}
   function tree(x,z,parent=scene,scale=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);cylinder(.1,1,palette.cream,0,.5,0,g);sphere(.65,palette.green,0,1.55,0,g);sphere(.5,palette.green,.35,1.3,.1,g);return g;}
   [[-10,-1],[-9,8],[10,8],[-1,-9],[2,-7],[9,1]].forEach(([x,z])=>tree(x,z));
   [[-6,-.5],[-4,-.2],[-8,-1],[-5,-2]].forEach(([x,z])=>tree(x,z,additions.M4));
   [[-10,6],[-2,7],[2,8],[8,7],[-9,-9],[10,-9]].forEach(([x,z])=>tree(x,z,additions.M6,.85));
   building(-6.8,7,5,3,1.6,palette.gold,additions.M7);box(3,.12,1.9,palette.green,-7,.12,5.4,additions.M7);
   building(-.4,-3,3.8,2.6,2,palette.white,additions.M8);box(.3,.8,.06,palette.red,-.4,1.4,-1.65,additions.M8);box(.8,.3,.06,palette.red,-.4,1.4,-1.6,additions.M8);
   box(4,.12,3,palette.red,-1,.08,7.5,additions.M9);box(3.4,.025,2.4,palette.green,-1,.16,7.5,additions.M9);for(const x of [-2.5,.5]){cylinder(.05,1.4,palette.white,x,.7,7.5,additions.M9);box(.5,.35,.07,palette.white,x,1.5,7.5,additions.M9);}
   for(let x=-10;x<12;x+=4){cylinder(.055,2.4,palette.dark,x,1.2,1.3,additions.M10);sphere(.15,palette.gold,x,2.4,1.3,additions.M10);}
   for(let x=-1;x<2;x+=.45)box(.22,.025,2.9,palette.gold,x,.14,3.1,additions.M11);
   box(20,.02,.55,palette.green,0,.12,2,additions.M1);
   for(const z of [3.65,4.15])box(24,.03,.065,palette.dark,0,.13,z,additions.M3);
   for(const x of [3,6.8]){cylinder(.065,1.8,palette.dark,x,.9,1.1,additions.M2);box(.3,.65,.25,palette.dark,x,1.7,1.1,additions.M2);sphere(.08,palette.green,x,1.8,1.26,additions.M2);}
   building(1,-.3,1.1,.85,1.1,palette.blue,additions.M12);box(.6,.35,.04,palette.dark,1,.8,.15,additions.M12);
   box(2.5,.08,1.2,palette.blue,-7,.13,-7.3,additions.M5);box(2.2,.06,1.8,palette.gold,-3.8,7.24,-6.8,additions.M14);
   for(let x=-10;x<2;x+=2)box(1.1,.03,.14,palette.blue,x,.13,.8,additions.M13);
   const cars=[];for(let i=0;i<10;i++){const g=new THREE.Group();scene.add(g);box(.95,.3,.5,[palette.white,palette.red,palette.gold][i%3],0,.34,0,g);box(.5,.25,.44,palette.blue,0,.57,0,g);for(const xx of [-.3,.3])for(const zz of [-.26,.26])sphere(.12,palette.dark,xx,.21,zz,g);g.position.z=i%2?2.45:3.9;cars.push({g,offset:i*1.7,direction:i%2?1:-1});}
   const tram=new THREE.Group();scene.add(tram);box(2.4,.62,.55,palette.white,0,.5,0,tram);box(1.9,.25,.58,palette.blue,0,.68,0,tram);tram.visible=false;
   const people=[];for(let i=0;i<7;i++){const g=new THREE.Group();scene.add(g);const child=i<4;const h=child?.38:.55;cylinder(.105,h,[palette.gold,palette.red,palette.blue][i%3],0,h/2+.2,0,g);sphere(.13,palette.skin,0,h+.28,0,g);box(.08,.25,.1,palette.dark,-.065,.14,0,g);box(.08,.25,.1,palette.dark,.065,.14,0,g);people.push({g,phase:i*1.3,child});}
   const resize=()=>{if(!host.current)return;const w=host.current.clientWidth,h=host.current.clientHeight||420;renderer.setSize(w,h);const half=Math.max(11.5,17/(w/h));camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();};observer=new ResizeObserver(resize);observer.observe(host.current);resize();
   let elapsed=0,trafficTime=0,previous=performance.now();const reduced=matchMedia('(prefers-reduced-motion: reduce)');
   function animate(now){frame=requestAnimationFrame(animate);const dt=Math.min((now-previous)/1000,.08);previous=now;const s=state.current;if(s.playing&&!reduced.matches&&!document.hidden)elapsed+=dt;
    const active=s.decisions.filter(d=>!d.districtId||d.districtId===s.districtId);
    for(const m of MEASURES){const target=active.some(d=>d.measureId===m.id)&&s.quarter>m.lag?Math.min(1,.3+.7*(s.quarter-m.lag)/(8-m.lag)):0,g=additions[m.id];g.scale.y=THREE.MathUtils.lerp(g.scale.y,target,reduced.matches?1:.12);g.visible=g.scale.y>.015;}
    if(s.playing&&!reduced.matches&&!document.hidden)trafficTime+=dt*Math.max(.18,.35+s.trafficChange*.23);
    cars.forEach(({g,offset,direction},i)=>{g.visible=i<Math.max(5,10-Math.round(Math.max(0,s.trafficChange)/2));g.position.x=(((trafficTime+offset)%24)-12)*direction;g.rotation.y=direction===1?0:Math.PI;});
    people.forEach(({g,phase,child},i)=>{const school=additions.M7.scale.y;g.position.set(child?THREE.MathUtils.lerp(-9+i*.4,-6+Math.sin(elapsed*.45+phase)*2,Math.min(1,school)):-8+(elapsed*.6+phase)%17,Math.abs(Math.sin(elapsed*5+phase))*.025,child?THREE.MathUtils.lerp(5.4,6.8+Math.cos(elapsed*.45+phase)*.6,Math.min(1,school)):.85);});
    tram.visible=additions.M3.visible;tram.position.set((elapsed*1.4)%26-13,0,3.9);
    controls.update();renderer.render(scene,camera);
   }frame=requestAnimationFrame(animate);
  }catch{setFailed(true);}
  return()=>{cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer?.dispose();renderer?.domElement.remove();};
 },[]);
 return <div className="street-scene" ref={host} role="img" aria-label={label}>{failed&&<img src="/images/astana-concept.jpg" alt={label}/>}</div>;
}
