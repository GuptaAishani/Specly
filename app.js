import { families, materials, evaluateMission, missionDiagram, missionChart, fmt } from './member-engine.js';

const app=document.querySelector('#app');
const supabase=globalThis.SPECLY_SUPABASE;
const userId=globalThis.SPECLY_USER_ID;
const STORAGE_KEY=`specly-member-work-v1:${userId}`;
let projects=[];
let active=null;
let design={};
let tested=false;
let notes='';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=s=>s.charAt(0).toUpperCase()+s.slice(1);
const saved=()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{return {}}};
function writeSaved(data){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}
function saveCurrent(){
  if(!active)return;
  const all=saved();
  all[active.id]={design,notes,tested,updatedAt:new Date().toISOString()};
  writeSaved(all);
  toast('Project saved on this device.');
}
function toast(text){const node=document.querySelector('#toast');if(!node)return;node.textContent=text;node.classList.add('visible');setTimeout(()=>node.classList.remove('visible'),1800)}

async function fetchProjects(){
  const { data, error } = await supabase.functions.invoke('member-projects');
  if(error) throw error;
  projects=data?.projects||[];
}

function header(){return `<header class="topbar"><button class="brand" data-home>specly<small>Engineering for your portfolio</small></button><div class="topright"><span class="storage">Member studio · local saves</span><a class="button small" href="./commerce.html">Account & billing</a></div></header>`}

function catalog(){
  const groups=['beginner','intermediate','advanced'];
  return `<main id="main" class="sample-main"><section class="intro"><div><div class="eyebrow">Member studio</div><h1>Choose a project.<br><em>Engineer your evidence.</em></h1><p>45 guided projects across structures, vibration, and thermal design. Tune the design, run the model, save revisions, and export a portfolio report.</p><div class="library-growth"><strong>Always growing.</strong> New projects are added consistently, and personalized project briefs are coming soon.</div></div></section>${groups.map(level=>`<div class="sectionbar"><strong>${title(level)}</strong><span class="count">${projects.filter(p=>p.level===level).length} projects</span></div><div class="cards">${projects.filter(p=>p.level===level).map(p=>`<article class="missioncard" style="--accent:${families[p.type].color}"><div class="cardtop"><span>${families[p.type].name}</span><span>${p.id}</span></div><div class="diagram sample-card-diagram">${missionDiagram(p.type,p.design)}</div><div class="cardbody"><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p></div><div class="cardfoot"><span>${title(p.level)}</span><button class="circlebutton" data-project="${p.id}">Open project →</button></div></article>`).join('')}</div>`).join('')}<footer><span>Specly · Your work. Your decisions.</span><span><a href="./terms.html">Terms</a> · <a href="./privacy.html">Privacy</a> · <a href="./refund.html">Refunds</a> · <a href="./faq.html">FAQ</a> · <a href="./contact.html">Contact</a></span></footer></main>`;
}

function metrics(result){
  const m=result.metrics;
  if(active.type==='structure') return [['Tip deflection',m.deflection,'mm'],['Support mass',m.mass,'g'],['Safety factor',m.safety,'']];
  if(active.type==='isolation') return [['Natural frequency',m.fn,'Hz'],['Motion transmission',m.T,'×'],['Static sag',m.sag,'mm']];
  return [['Source temperature',m.temp,'°C'],['Plate mass',m.mass,'g'],['Thermal resistance',m.R,'K/W']];
}

function visual(){
  const r=evaluateMission(active.mission,design);
  return `<div class="viewport"><div class="viewtoolbar"><span>${families[active.type].name}</span><span>Live analytical preview</span></div><div class="diagram">${missionDiagram(active.type,design)}</div><div class="readouts">${metrics(r).map(([l,v,u])=>`<div class="readout"><span>${l}</span><strong>${fmt(v)} <small>${u}</small></strong></div>`).join('')}</div></div><section class="panel sample-response"><h3>Response</h3>${missionChart(active.mission,design,r)}<p class="note">Use the model to compare design choices, then document the assumptions you would validate on real hardware.</p></section>`;
}

function results(){
  if(!tested)return '<p>Change the design, then run a test to check this configuration.</p>';
  const r=evaluateMission(active.mission,design);
  return `<p class="eyebrow">Analytical check</p><h2>${r.pass?'Modeled requirements met.':'Revise the design.'}</h2><div class="checks">${r.checks.map(c=>`<div class="req"><span>${esc(c.label)}<small class="sample-limit">Required ${c.minimum?'≥':'≤'} ${fmt(c.limit,3)} ${c.unit}</small></span><strong>${fmt(c.value,3)} ${c.unit} · ${c.pass?'Pass':'Revise'}</strong></div>`).join('')}</div><p>${esc(r.advice)}</p>`;
}

function controls(){
  const params=families[active.type].params;
  const materialSelect=active.type==='isolation'?'':`<div class="field"><label for="material">Material</label><select id="material" data-material>${Object.entries(materials).map(([k,v])=>`<option value="${k}" ${design.material===k?'selected':''}>${v.name}</option>`).join('')}</select></div>`;
  return `${params.map(([key,label,min,max,step,unit])=>`<div class="field"><label for="member-${key}">${label}<span><output id="value-${key}">${design[key]}</output> ${unit}</span></label><input class="sample-slider" id="member-${key}" type="range" data-param="${key}" min="${min}" max="${max}" step="${step}" value="${design[key]}"><small>${min}–${max} ${unit}</small></div>`).join('')}${materialSelect}`;
}

function workspace(){
  return `<main id="main" class="sample-main"><div class="workspacehead"><div><p class="eyebrow">${title(active.level)} · ${families[active.type].name}</p><h1>${esc(active.title)}</h1><p>${esc(active.description)}</p></div><button class="button ghost" data-home>All projects</button></div><div class="workgrid"><section class="panel controls"><p class="eyebrow">The brief</p><h2>${esc(active.context)}</h2><p>${esc(active.objective)}</p>${controls()}<div class="field"><label for="project-notes">Engineering notes</label><textarea id="project-notes" rows="5" placeholder="Record tradeoffs, assumptions, and what you would test next…">${esc(notes)}</textarea></div><div class="actions"><button class="button primary" data-test>Run analytical test →</button><button class="button ghost" data-save>Save revision</button><button class="button ghost" data-export>Export report</button></div><p class="note">Saved locally in this browser. Export reports to keep a portable copy.</p></section><div id="member-visual">${visual()}</div></div><section class="panel" id="member-results" aria-live="polite">${results()}</section><details class="panel"><summary>Model assumptions and limitations</summary><p>${esc(active.assumptions)}</p></details><footer><span>Specly · ${esc(active.id)}</span><span><a href="./terms.html">Terms</a> · <a href="./privacy.html">Privacy</a> · <a href="./refund.html">Refunds</a> · <a href="./faq.html">FAQ</a> · <a href="./contact.html">Contact</a></span></footer></main>`;
}

function render(){app.innerHTML=header()+(active?workspace():catalog());}
function openProject(id){
  active=projects.find(p=>p.id===id);
  if(!active)return;
  const state=saved()[id];
  design=state?.design?{...active.design,...state.design}:{...active.design};
  notes=state?.notes||'';
  tested=Boolean(state?.tested);
  render();window.scrollTo(0,0);
}

function exportReport(){
  const r=evaluateMission(active.mission,design);
  const lines=[`# ${active.title}`,``,`**Project ID:** ${active.id}`,`**Level:** ${title(active.level)}`,`**Category:** ${families[active.type].name}`,``,`## Brief`,active.context,``,active.objective,``,`## Final design`,...Object.entries(design).map(([k,v])=>`- ${k}: ${v}`),``,`## Analytical results`,...r.checks.map(c=>`- ${c.label}: ${fmt(c.value,3)} ${c.unit} — ${c.pass?'PASS':'REVISE'} (requirement ${c.minimum?'≥':'≤'} ${fmt(c.limit,3)} ${c.unit})`),``,`**Overall:** ${r.pass?'Modeled requirements met':'Revision required'}`,``,`## Engineering notes`,notes||'No notes entered.',``,`## Assumptions`,active.assumptions,``,`> Educational model only; not an engineering certification or substitute for hardware validation.`];
  const blob=new Blob([lines.join('\n')],{type:'text/markdown'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`${active.id}-${active.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.md`;a.click();URL.revokeObjectURL(url);toast('Report exported.');
}

document.addEventListener('click',e=>{
  const p=e.target.closest('[data-project]');if(p)openProject(p.dataset.project);
  if(e.target.closest('[data-home]')){active=null;render();window.scrollTo(0,0)}
  if(e.target.closest('[data-test]')){tested=true;document.querySelector('#member-results').innerHTML=results();saveCurrent()}
  if(e.target.closest('[data-save]'))saveCurrent();
  if(e.target.closest('[data-export]')){notes=document.querySelector('#project-notes')?.value||notes;saveCurrent();exportReport()}
});

document.addEventListener('input',e=>{
  if(!active)return;
  if(e.target.id==='project-notes'){notes=e.target.value;return}
  const key=e.target.dataset.param;if(!key)return;
  design={...design,[key]:Number(e.target.value)};tested=false;
  document.querySelector('#value-'+key).textContent=design[key];
  document.querySelector('#member-visual').innerHTML=visual();
  document.querySelector('#member-results').innerHTML='<p>Design changed. Run the analytical test to check this revision.</p>';
});

document.addEventListener('change',e=>{
  if(!active||!e.target.matches('[data-material]'))return;
  design={...design,material:e.target.value};tested=false;
  document.querySelector('#member-visual').innerHTML=visual();
  document.querySelector('#member-results').innerHTML='<p>Material changed. Run the analytical test to check this revision.</p>';
});

(async()=>{
  app.innerHTML='<main style="max-width:680px;margin:12vh auto;padding:24px"><p class="eyebrow">Member studio</p><h1>Loading your project library…</h1></main>';
  try{await fetchProjects();render()}catch(error){console.error(error);app.innerHTML='<main style="max-width:680px;margin:12vh auto;padding:24px"><h1>We couldn’t load the member library.</h1><p>Your membership is active, but the project service did not respond. Refresh, or open Account & billing.</p><a href="./commerce.html">Account & billing</a></main>'}
})();
