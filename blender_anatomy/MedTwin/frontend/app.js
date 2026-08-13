import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const $ = (id) => document.getElementById(id);
const container = $('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07111f);
scene.fog = new THREE.FogExp2(0x07111f, .055);
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, .01, 100);
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12; container.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.minDistance = 2; controls.maxDistance = 9;
scene.add(new THREE.HemisphereLight(0xc4e4ff, 0x08101e, 2.2));
const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(4,5,5); scene.add(key);
const rim = new THREE.DirectionalLight(0x38bdf8, 2.1); rim.position.set(-5,2,-4); scene.add(rim);
const fill = new THREE.PointLight(0x14b8a6, 8, 12); fill.position.set(0,-1,3); scene.add(fill);

let anatomy, baseScale = 1, target = new THREE.Vector3(), tracking = true, annotationMode = false, annotations = [], lastRisk = 18;
const markers = new THREE.Group(); scene.add(markers);
const detection = new THREE.Mesh(new THREE.SphereGeometry(.09, 24, 16), new THREE.MeshBasicMaterial({color:0xfb7185, transparent:true, opacity:.9})); detection.visible = false; scene.add(detection);
const detectionRing = new THREE.Mesh(new THREE.TorusGeometry(.16,.015,8,32), new THREE.MeshBasicMaterial({color:0xfb7185})); detectionRing.visible=false; scene.add(detectionRing);
const loader = new GLTFLoader(); const draco = new DRACOLoader(); draco.setDecoderPath('https://unpkg.com/three@0.158.0/examples/jsm/libs/draco/'); loader.setDRACOLoader(draco);

function framedCamera(box) { const size = box.getSize(new THREE.Vector3()).length(); target.copy(box.getCenter(new THREE.Vector3())); camera.position.copy(target).add(new THREE.Vector3(size*.62, size*.18, size*1.05)); controls.target.copy(target); controls.update(); }
function removeCurrent() { if (!anatomy) return; scene.remove(anatomy); anatomy.traverse(o=>{ if(o.isMesh){ o.geometry?.dispose(); if(Array.isArray(o.material)) o.material.forEach(m=>m.dispose()); else o.material?.dispose(); }}); anatomy=null; }
function loadModel(file) { removeCurrent(); detection.visible = detectionRing.visible = false; $('workspace-result').textContent = 'Loading anatomical GLB…'; loader.load(`assets/${file}`, gltf => {
  anatomy = gltf.scene; anatomy.traverse(child => { if (!child.isMesh) return; child.castShadow = child.receiveShadow = true; if (child.geometry) { child.geometry.computeVertexNormals(); if (child.geometry.attributes.uv) child.geometry.computeTangents(); } const mats = Array.isArray(child.material) ? child.material : [child.material]; mats.forEach(material => { if (material) { material.metalness = Math.min(material.metalness || 0, .18); material.roughness = Math.max(material.roughness || .45, .38); material.needsUpdate = true; }}); });
  const box = new THREE.Box3().setFromObject(anatomy); anatomy.position.sub(box.getCenter(new THREE.Vector3())); const normalized = new THREE.Box3().setFromObject(anatomy); const size = normalized.getSize(new THREE.Vector3()); baseScale = 3.9 / Math.max(size.x,size.y,size.z); anatomy.scale.setScalar(baseScale); scene.add(anatomy); const finalBox = new THREE.Box3().setFromObject(anatomy); framedCamera(finalBox); setDetection(finalBox); $('workspace-result').textContent = 'GLB loaded. Drag to orbit, scroll to zoom, or enable annotation and click a surface.';
}, undefined, () => { $('workspace-result').textContent = 'Model failed to load. Check that the GLB is present in frontend/assets.'; }); }
function setDetection(box) { const c=box.getCenter(new THREE.Vector3()), s=box.getSize(new THREE.Vector3()); detection.position.copy(c).add(new THREE.Vector3(s.x*.13,s.y*.08,s.z*.5)); detectionRing.position.copy(detection.position); detection.visible=detectionRing.visible=false; }
loadModel('Heart.glb');

function drawECG(samples) { const values = samples?.length ? samples : Array.from({length:64},(_,i)=>Math.sin(i*.37)*.12 + (i%20===9? .85:0)); const max=Math.max(...values.map(Math.abs), 1); $('ecg-path').setAttribute('points',values.map((v,i)=>`${i/(values.length-1)*300},${27-(v/max)*22}`).join(' ')); }
function updateDashboard(msg) { 
  window.currentHR = msg.heart_rate ?? 82;
  $('hr-display').textContent = Math.round(window.currentHR); 
  lastRisk=Math.round((msg.risk_score ?? .18)*100); 
  $('risk-display').innerHTML=`${lastRisk}<small class="text-sm">%</small>`; 
  $('ecg-pred').textContent=msg.ecg_prediction || 'Normal'; 
  $('vis-pred').textContent=msg.vision_prediction || 'No finding'; 
  $('fusion-score').textContent = `${Math.round((msg.agreement_score ?? .85)*100)}%`; 
  $('sample-age').textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}); drawECG(msg.ecg_trace);
  const visionFinding = msg.vision_prediction || ''; detection.visible = detectionRing.visible = Boolean(visionFinding) && !/^(No finding|No tumor-positive image pattern)$/i.test(visionFinding);
  const badge=$('agreement-badge'); const conflict=Boolean(msg.conflict); badge.textContent=conflict?'Conflict detected':'Concordant'; badge.className=`${conflict?'chip-warn':'chip'} rounded-full px-2 py-1 text-[10px]`;
  if (msg.patient_demographics) $('patient-demographics').textContent = `${msg.patient_id} · ${msg.patient_demographics.age}${msg.patient_demographics.sex} · Baseline: ${msg.patient_demographics.baseline_risk}`;
  if (msg.sensor_metadata) $('sensor-metadata').textContent = `Sensor: ${msg.sensor_metadata.device_id} · SQI: ${msg.sensor_metadata.signal_quality}%`;
  if (msg.cardio_ultra_report) {
    const report = msg.cardio_ultra_report;
    $('arrhythmia-forecast').textContent = `Risk: ${report.real_time_forecast?.arrhythmia_risk_24h || '--'}`;
    const alertsBox = $('anomaly-alerts'); alertsBox.innerHTML = '';
    (report.real_time_forecast?.anomaly_alerts || []).forEach(a => { const li = document.createElement('li'); li.innerHTML = `⚠️ ${a}`; alertsBox.appendChild(li); });
    const intBox = $('recommended-interventions'); intBox.innerHTML = '';
    (report.recommended_interventions || []).forEach(i => { const li = document.createElement('li'); li.textContent = i; intBox.appendChild(li); });
  }
}
function setConnection(connected) { const status=$('connection-status'); status.textContent=connected?'● LIVE':'○ RECONNECTING'; status.className=`${connected?'chip':'chip-warn'} rounded-full px-2 py-1 text-[10px] ${connected?'pulse':''}`; }
const PATIENT_ID = 'PT-001';
function connectWebSocket() { const protocol=location.protocol==='https:'?'wss:':'ws:'; const ws=new WebSocket(`${protocol}//${location.host}/ws/patient/${PATIENT_ID}`); ws.onopen=()=>setConnection(true); ws.onmessage=e=>{const msg=JSON.parse(e.data); if(msg.type==='fusion_update')updateDashboard(msg)}; ws.onclose=()=>{setConnection(false);setTimeout(connectWebSocket,3000)}; ws.onerror=()=>ws.close(); }
connectWebSocket(); drawECG();

$('organ-selector').addEventListener('change',e=>loadModel(e.target.value));
$('reset-view').onclick=()=> anatomy && framedCamera(new THREE.Box3().setFromObject(anatomy));
$('focus-detection').onclick=()=>{ if(detection.visible){ controls.target.copy(detection.position); camera.position.copy(detection.position).add(new THREE.Vector3(1.3,.6,2.6)); }};
$('tracking-toggle').onclick=e=>{ tracking=!tracking; e.target.textContent=`Tracking: ${tracking?'on':'off'}`; e.target.classList.toggle('tool-active',tracking); };
$('annotation-toggle').onclick=e=>{ annotationMode=!annotationMode; e.target.textContent=annotationMode?'Click a surface to place annotation':'Add clinical annotation'; e.target.classList.toggle('tool-active',annotationMode); renderer.domElement.style.cursor=annotationMode?'crosshair':'grab'; };
$('forecast-slider').addEventListener('input',e=>{const day=+e.target.value; $('forecast-day').textContent=`Day ${day}`; $('forecast-caption').textContent=day?`Forecasted morphology · projected risk ${Math.min(99,lastRisk+day*2)}%`:'Current morphology · baseline risk'; });
$('run-inference').onclick=async()=>{ const model=$('model-selector').value; const result=$('workspace-result'); result.textContent='Running model endpoint…'; try { const response=await fetch('/api/v1/inference/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patient_id:PATIENT_ID,model})}); if(!response.ok)throw Error(); const data=await response.json(); result.textContent=`${data.model_name}: ${data.summary} (${Math.round(data.confidence*100)}% confidence).`; updateDashboard({...data.fusion_update, type:'fusion_update'}); } catch { result.textContent=`${model} is ready for a model service. Start the FastAPI hub to execute the demo endpoint.`; }};
$('submit-report').onclick=async()=>{ const result=$('workspace-result'); const report=$('clinical-report').value.trim(); if(report.length<3){result.textContent='Enter at least a short clinical note before submitting.';return;} result.textContent='Parsing clinical report and recomputing fusion…'; try { const response=await fetch('/api/v1/intake/document',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patient_id:PATIENT_ID,report_text:report,source:'dashboard-manual'})}); if(!response.ok)throw Error(); const data=await response.json(); const findings=data.entities.diagnoses.map(x=>`${x.entity}: ${x.assertion}`).join(', ')||'no structured diagnosis'; result.textContent=`Report parsed (${findings}); fusion score ${Math.round(data.fusion_update.agreement_score*100)}%.`; updateDashboard(data.fusion_update); } catch {result.textContent='Document intake is unavailable. Verify that the MedTwin hub is running.';} };
const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2(); renderer.domElement.addEventListener('click',event=>{ if(!annotationMode||!anatomy)return; const rect=renderer.domElement.getBoundingClientRect(); pointer.x=(event.clientX-rect.left)/rect.width*2-1; pointer.y=-(event.clientY-rect.top)/rect.height*2+1; raycaster.setFromCamera(pointer,camera); const hit=raycaster.intersectObject(anatomy,true)[0]; if(!hit)return; const marker=new THREE.Mesh(new THREE.SphereGeometry(.045,16,12),new THREE.MeshBasicMaterial({color:0x2dd4bf})); marker.position.copy(hit.point); markers.add(marker); annotations.push(hit.point); $('annotation-count').textContent=`${annotations.length} annotation${annotations.length===1?'':'s'}`; $('workspace-result').textContent=`Annotation ${annotations.length} placed on ${hit.object.name || 'anatomy surface'}.`; });
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
const floatingLabel = document.createElement('div');
floatingLabel.className = 'absolute bg-slate-900/90 text-teal-300 text-[10px] px-2 py-1 rounded border border-teal-700/50 pointer-events-none opacity-0 transition-opacity';
floatingLabel.style.transform = 'translate(-50%, -100%)';
$('canvas-container').appendChild(floatingLabel);
$('canvas-container').style.position = 'relative';

function animate(t=0){ 
    requestAnimationFrame(animate); 
    controls.update(); 
    if(anatomy){
        const day=+$('forecast-slider').value; 
        const swell=1+day*.012; 
        
        anatomy.scale.set(
            baseScale * swell,
            baseScale * (1 + day * 0.003),
            baseScale * swell
        ); 
    } 
    if(tracking&&detection.visible){
        detectionRing.rotation.z=t*.002; 
        detectionRing.scale.setScalar(1+Math.sin(t*.006)*.16);
        
        // Update floating label position
        const vector = detection.position.clone();
        vector.project(camera);
        const rect = $('canvas-container').getBoundingClientRect();
        const x = (vector.x * .5 + .5) * rect.width;
        const y = (-(vector.y * .5) + .5) * rect.height;
        floatingLabel.style.left = `${x}px`;
        floatingLabel.style.top = `${y - 15}px`;
        floatingLabel.style.opacity = '1';
        floatingLabel.textContent = $('vis-pred').textContent || 'Detected Anomaly';
    } else {
        floatingLabel.style.opacity = '0';
    }
    renderer.render(scene,camera); 
} 
animate();
