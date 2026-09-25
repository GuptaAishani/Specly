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
let selectedDifficulty='beginner';
let progressCache={};
let autoSaveTimer=null;

const difficultyLabels={beginner:'Easy',intermediate:'Medium',advanced:'Hard'};

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const saved=()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{return {}}};
function writeSaved(data){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}

function normalizeProgress(row={}){
  return {
    design:row.design||{},
    notes:row.notes||'',
    tested:Boolean(row.tested),
    startedAt:row.started_at||row.startedAt||row.updated_at||row.updatedAt||new Date().toISOString(),
    updatedAt:row.updated_at||row.updatedAt||new Date().toISOString()
  };
}

async function loadProjectProgress(){
  const local=saved();
  progressCache={...local};

  const {data,error}=await supabase
    .from('project_progress')
    .select('project_id,design,notes,tested,started_at,updated_at')
    .order('updated_at',{ascending:false});

  if(error){
    console.warn('Could not load cloud project progress. Using local fallback.',error);
    return;
  }

  const cloudIds=new Set();
  for(const row of data||[]){
    cloudIds.add(row.project_id);
    progressCache[row.project_id]=normalizeProgress(row);
  }

  // Quietly migrate any older browser-only saves into the signed-in account.
  const legacyRows=Object.entries(local)
    .filter(([projectId])=>!cloudIds.has(projectId))
    .map(([projectId,state])=>{
      const normalized=normalizeProgress(state);
      return {
        user_id:userId,
        project_id:projectId,
        design:normalized.design,
        notes:normalized.notes,
        tested:normalized.tested,
        started_at:normalized.startedAt,
        updated_at:normalized.updatedAt
      };
    });

  if(legacyRows.length){
    const {error:migrationError}=await supabase
      .from('project_progress')
      .upsert(legacyRows,{onConflict:'user_id,project_id'});
    if(migrationError)console.warn('Could not migrate older local saves.',migrationError);
  }

  writeSaved(progressCache);
}

async function saveCurrent({notify=true}={}){
  if(!active)return;
  const textarea=document.querySelector('#project-notes');
  if(textarea)notes=textarea.value;

  const previous=progressCache[active.id]||{};
  const state={
    design:{...design},
    notes,
    tested,
    startedAt:previous.startedAt||new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };

  progressCache[active.id]=state;
  const all=saved();
  all[active.id]=state;
  writeSaved(all);

  const {error}=await supabase.from('project_progress').upsert({
    user_id:userId,
    project_id:active.id,
    design:state.design,
    notes:state.notes,
    tested:state.tested,
    started_at:state.startedAt,
    updated_at:state.updatedAt
  },{onConflict:'user_id,project_id'});

  if(error){
    console.error('Cloud save failed.',error);
    if(notify)toast('Saved on this device, but account sync failed.');
    return;
  }
  if(notify)toast('Project saved to your account.');
}

function queueAutoSave(){
  clearTimeout(autoSaveTimer);
  autoSaveTimer=setTimeout(()=>saveCurrent({notify:false}),650);
}

async function deleteProjectProgress(id){
  const project=projects.find(p=>p.id===id);
  const name=project?.title||id;
  const ok=window.confirm(`Remove "${name}" from My Projects?\n\nThis deletes your saved design and notes, but the project will stay in the project library.`);
  if(!ok)return;

  const {error}=await supabase
    .from('project_progress')
    .delete()
    .eq('user_id',userId)
    .eq('project_id',id);

  if(error){
    console.error('Could not delete project progress.',error);
    toast('Could not remove this project. Try again.');
    return;
  }

  delete progressCache[id];
  const all=saved();
  delete all[id];
  writeSaved(all);
  render();
  toast('Removed from My Projects.');
}
function toast(text){const node=document.querySelector('#toast');if(!node)return;node.textContent=text;node.classList.add('visible');setTimeout(()=>node.classList.remove('visible'),1800)}
function showTestPopup(result){
  document.querySelector('.test-score-popup')?.remove();
  const total=result.checks.length;
  const passed=result.checks.filter(c=>c.pass).length;
  const complete=total>0&&passed===total;
  const zero=passed===0;
  const node=document.createElement('div');
  node.className=`test-score-popup ${complete?'all-pass':zero?'none-pass':'partial-pass'}`;
  node.setAttribute('role','status');
  node.setAttribute('aria-live','polite');
  node.innerHTML=`<div class="test-score-icon">${complete?'✓':passed}</div><div class="test-score-copy"><span>RFP CHECK COMPLETE</span><strong><b>${passed}</b> out of <b>${total}</b> tests passed</strong><small>${complete?'All modeled requirements are satisfied.':'Revise the design and run the check again.'}</small></div><button class="test-score-close" type="button" aria-label="Close test result">×</button><div class="test-score-progress"><i style="--score:${total?passed/total:0}"></i></div>`;
  document.body.appendChild(node);
  requestAnimationFrame(()=>node.classList.add('show'));
  node.querySelector('.test-score-close')?.addEventListener('click',()=>node.remove());
  clearTimeout(showTestPopup.timer);
  showTestPopup.timer=setTimeout(()=>{node.classList.remove('show');setTimeout(()=>node.remove(),260)},5200);
}

async function fetchProjects(){
  const { data, error } = await supabase.functions.invoke('member-projects');
  if(error) throw error;
  projects=data?.projects||[];
}

function header(){
  const email=globalThis.SPECLY_USER_EMAIL||'';
  return `<header class="topbar"><button class="brand" data-home>specly<small>Engineering for your portfolio</small></button><div class="topright"><span class="storage">${email?`Signed in · ${esc(email)}`:'Member studio · local saves'}</span><a class="button small" href="./commerce.html">Account & billing</a></div></header>`
}


function progressStatus(project,state){
  if(!state?.tested)return {label:'Started',className:'started'};
  try{
    const merged={...project.design,...(state.design||{})};
    const r=evaluateMission(project.mission,merged);
    const passed=r.checks.filter(c=>c.pass).length;
    const total=r.checks.length;
    return r.pass
      ? {label:`${passed}/${total} tests passed`,className:'passed'}
      : {label:`${passed}/${total} tests passed`,className:'revise'};
  }catch{
    return {label:'In progress',className:'started'};
  }
}

function updatedLabel(value){
  if(!value)return 'Recently';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return 'Recently';
  return `Updated ${d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}`;
}

function myProjectsBar(){
  const entries=Object.entries(progressCache)
    .map(([id,state])=>({project:projects.find(p=>p.id===id),state}))
    .filter(x=>x.project)
    .sort((a,b)=>new Date(b.state.updatedAt||0)-new Date(a.state.updatedAt||0));

  if(!entries.length){
    return `<section class="my-projects empty-projects" aria-labelledby="my-projects-heading">
      <div class="my-projects-head">
        <div>
          <p class="eyebrow" id="my-projects-heading">My Projects</p>
          <h2>Your attempted projects will live here.</h2>
          <p>Open any RFP to start it. Specly will save your design, notes, and latest test state to your account automatically.</p>
        </div>
        <span class="my-project-count">0 saved</span>
      </div>
    </section>`;
  }

  return `<section class="my-projects" aria-labelledby="my-projects-heading">
    <div class="my-projects-head">
      <div>
        <p class="eyebrow" id="my-projects-heading">My Projects</p>
        <h2>Pick up where you left off.</h2>
        <p>Your attempted projects are saved to your account across sessions.</p>
      </div>
      <span class="my-project-count">${entries.length} saved</span>
    </div>
    <div class="my-projects-track">
      ${entries.map(({project,state})=>{
        const status=progressStatus(project,state);
        return `<article class="my-project-card">
          <div class="my-project-top">
            <span>${esc(project.id)}</span>
            <button class="my-project-delete" type="button" data-delete-project="${esc(project.id)}" aria-label="Remove ${esc(project.title)} from My Projects">×</button>
          </div>
          <button class="my-project-open" type="button" data-project="${esc(project.id)}">
            <span class="my-project-type">${esc(families[project.type].name)} · ${difficultyLabels[project.level]}</span>
            <strong>${esc(project.title)}</strong>
            <span class="my-project-meta"><i class="${status.className}">${esc(status.label)}</i><small>${esc(updatedLabel(state.updatedAt))}</small></span>
          </button>
        </article>`;
      }).join('')}
    </div>
  </section>`;
}

function catalog(){
  const visible=projects.filter(p=>p.level===selectedDifficulty);
  const difficultyName=difficultyLabels[selectedDifficulty];
  return `<main id="main" class="sample-main"><section class="intro"><div><div class="eyebrow">Member studio</div><h1>Choose a problem.<br><em>Build engineering evidence.</em></h1><p>Every project starts with an industry-inspired RFP, numerical requirements, a real-world engineering need, analytical verification, required deliverables, and a portfolio-ready story. Pick a difficulty and solve one like an engineer—not just a calculator.</p><div class="library-growth"><strong>45 guided projects.</strong> Each one gives you a problem statement, success criteria, trade study, validation plan, and report you can turn into portfolio material.</div></div></section>${myProjectsBar()}<section class="library-filter" aria-labelledby="difficulty-heading"><div><p class="eyebrow" id="difficulty-heading">Project library</p><h2>${difficultyName} projects</h2><p>Showing ${visible.length} of ${projects.length} member projects.</p></div><div class="difficulty-select"><label for="difficulty-filter">Difficulty</label><select id="difficulty-filter" data-difficulty><option value="beginner" ${selectedDifficulty==='beginner'?'selected':''}>Easy</option><option value="intermediate" ${selectedDifficulty==='intermediate'?'selected':''}>Medium</option><option value="advanced" ${selectedDifficulty==='advanced'?'selected':''}>Hard</option></select></div></section><div class="sectionbar"><strong>${difficultyName}</strong><span class="count">${visible.length} projects</span></div><div class="cards">${visible.map(p=>`<article class="missioncard" style="--accent:${families[p.type].color}"><div class="cardtop"><span>${families[p.type].name}</span><span>${p.id}</span></div><div class="diagram sample-card-diagram">${missionDiagram(p.type,p.design)}</div><div class="cardbody"><span class="industry-chip">${esc(p.industry)}</span><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p></div><div class="cardfoot"><span>${difficultyLabels[p.level]}</span><button class="circlebutton" data-project="${p.id}">Open RFP →</button></div></article>`).join('')}</div><footer><span>Specly · Your work. Your decisions.</span><span><a href="./terms.html">Terms</a> · <a href="./privacy.html">Privacy</a> · <a href="./refund.html">Refunds</a> · <a href="./faq.html">FAQ</a> · <a href="./contact.html">Contact</a></span></footer></main>`;
}

function metrics(result){
  const m=result.metrics;
  if(active.type==='structure') return [['Tip deflection',m.deflection,'mm'],['Support mass',m.mass,'g'],['Safety factor',m.safety,'']];
  if(active.type==='isolation') return [['Natural frequency',m.fn,'Hz'],['Motion transmission',m.T,'×'],['Static sag',m.sag,'mm']];
  return [['Source temperature',m.temp,'°C'],['Plate mass',m.mass,'g'],['Thermal resistance',m.R,'K/W']];
}

function visual(){
  const r=evaluateMission(active.mission,design);
  return `<div class="viewport"><div class="viewtoolbar"><span>${families[active.type].name}</span><span>Live analytical preview</span></div><div class="diagram">${missionDiagram(active.type,design)}</div><div class="readouts">${metrics(r).map(([l,v,u])=>`<div class="readout"><span>${l}</span><strong>${fmt(v)} <small>${u}</small></strong></div>`).join('')}</div></div><section class="panel sample-response"><h3>Model response</h3>${missionChart(active.mission,design,r)}<p class="note">Use the model for design iteration. Your validation plan should explain what would still need to be measured on real hardware.</p></section>`;
}

function results(){
  if(!tested)return '<p>Change the design, then run the analytical test to check this configuration against the RFP.</p>';
  const r=evaluateMission(active.mission,design);
  const passed=r.checks.filter(c=>c.pass).length,total=r.checks.length,complete=total>0&&passed===total;
  return `<div class="results-summary ${complete?'all-pass':'needs-work'}"><div><p class="eyebrow">RFP compliance check</p><h2>${r.pass?'Modeled requirements met.':'Revision required.'}</h2></div><div class="inline-test-score"><strong>${passed} <span>out of</span> ${total}</strong><small>tests passed</small></div></div><div class="inline-score-track"><i style="--score:${total?passed/total:0}"></i></div><div class="checks">${r.checks.map(c=>`<div class="req ${c.pass?'req-pass':'req-revise'}"><span>${esc(c.label)}<small class="sample-limit">Required ${c.minimum?'≥':'≤'} ${fmt(c.limit,3)} ${c.unit}</small></span><strong>${fmt(c.value,3)} ${c.unit} · ${c.pass?'Pass':'Revise'}</strong></div>`).join('')}</div><p>${esc(r.advice)}</p>`;
}

function controls(){
  const params=families[active.type].params;
  const materialSelect=active.type==='isolation'?'':`<div class="field"><label for="material">Material</label><select id="material" data-material>${Object.entries(materials).map(([k,v])=>`<option value="${k}" ${design.material===k?'selected':''}>${v.name}</option>`).join('')}</select></div>`;
  return `${params.map(([key,label,min,max,step,unit])=>`<div class="field"><label for="member-${key}">${label}<span><output id="value-${key}">${design[key]}</output> ${unit}</span></label><input class="sample-slider" id="member-${key}" type="range" data-param="${key}" min="${min}" max="${max}" step="${step}" value="${design[key]}"><small>${min}–${max} ${unit}</small></div>`).join('')}${materialSelect}`;
}

function goalsTable(){
  return `<div class="goal-table" role="table" aria-label="RFP numerical success criteria">${active.goals.map(g=>`<div class="goal-row" role="row"><div role="cell"><strong>${esc(g.label)}</strong><small>${esc(g.why)}</small></div><div role="cell" class="goal-target">${esc(g.comparator)} ${fmt(g.value,3)} ${esc(g.unit)}</div></div>`).join('')}</div>`;
}

function bulletList(items){return `<ul class="deliverable-list">${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`}

function rfpSection(){
  return `<section class="rfp-sheet"><div class="rfp-banner"><span>REQUEST FOR PROPOSAL · ${esc(active.id)}</span><span>Industry-inspired engineering challenge</span></div><div class="rfp-grid"><div><p class="eyebrow">Real-world application</p><h2>${esc(active.title)}</h2><p class="rfp-problem">${esc(active.realWorldProblem)}</p><div class="rfp-meta"><div><span>Stakeholder</span><strong>${esc(active.stakeholder)}</strong></div><div><span>Sector</span><strong>${esc(active.industry)}</strong></div></div><div class="impact-callout"><strong>Why this matters</strong><p>${esc(active.whyItMatters)}</p></div></div><div><p class="eyebrow">RFP scope</p><p>${esc(active.rfp)}</p><p class="eyebrow rfp-goals-label">Numerical success criteria</p>${goalsTable()}</div></div><div class="rfp-bottom"><div><p class="eyebrow">Required work products</p>${bulletList(active.deliverables)}</div><div><p class="eyebrow">Hardware validation plan</p>${bulletList(active.validationPlan)}</div></div><div class="stretch"><strong>Stretch analysis</strong><span>${esc(active.stretchGoal)}</span></div></section>`;
}

function portfolioSummary(result){
  const m=result.metrics;
  if(active.type==='structure'){
    const mat=materials[design.material]?.name||design.material;
    return `Analytically designed a ${mat} ${active.title.toLowerCase()} for a ${active.industry.toLowerCase()} application, carrying ${fmt(active.mission.requirements.force,2)} N over ${fmt(design.length,1)} mm while limiting modeled tip deflection to ${fmt(m.deflection,2)} mm at ${fmt(m.mass,1)} g and maintaining a ${fmt(m.safety,2)} yield safety factor.`;
  }
  if(active.type==='isolation'){
    return `Developed a passive vibration-isolation concept for a ${active.title.toLowerCase()}, tuning stiffness and damping to achieve ${fmt(m.T,3)}× modeled motion transmission at ${fmt(active.mission.requirements.frequency,1)} Hz while limiting static sag to ${fmt(m.sag,2)} mm.`;
  }
  const mat=materials[design.material]?.name||design.material;
  return `Sized a passive ${mat} cooling plate for a ${active.title.toLowerCase()} dissipating ${fmt(active.mission.requirements.power,1)} W, predicting a ${fmt(m.temp,1)} °C source temperature at ${fmt(m.mass,1)} g within the project packaging constraint.`;
}

function portfolioPanel(){
  if(!tested)return `<section class="panel portfolio-panel"><p class="eyebrow">Portfolio + interview framing</p><h2>Earn the story with your engineering work.</h2><p>${esc(active.portfolioAngle)}</p><div class="portfolio-steps"><div><span>1</span><p><strong>Problem</strong> Explain the stakeholder need and why the requirement matters.</p></div><div><span>2</span><p><strong>Trade</strong> Show at least three revisions—not just your final slider values.</p></div><div><span>3</span><p><strong>Evidence</strong> Use the compliance matrix and margins to defend your design.</p></div><div><span>4</span><p><strong>Validation</strong> State what you would test before calling it hardware-ready.</p></div></div></section>`;
  const r=evaluateMission(active.mission,design);
  const summary=portfolioSummary(r);
  return `<section class="panel portfolio-panel"><p class="eyebrow">Portfolio + interview framing</p><h2>${r.pass?'Turn this into portfolio evidence.':'Revise first, then tell the story.'}</h2><p>${esc(active.portfolioAngle)}</p><div class="portfolio-copy"><span>Suggested honest portfolio summary</span><p>${esc(summary)}</p><button class="button ghost" data-copy-portfolio>Copy summary</button></div><p class="portfolio-honesty"><strong>Keep it accurate:</strong> say “analytically designed,” “modeled,” or “developed a concept” unless you actually fabricated and tested hardware.</p></section>`;
}

function workspace(){
  return `<main id="main" class="sample-main"><div class="workspacehead"><div><p class="eyebrow">${difficultyLabels[active.level]} · ${families[active.type].name}</p><h1>${esc(active.title)}</h1><p>${esc(active.description)}</p></div><button class="button ghost" data-home>All projects</button></div>${rfpSection()}<section class="design-stage"><div class="design-stage-head"><div><p class="eyebrow">Design + analysis</p><h2>Develop your response to the RFP.</h2><p>${esc(active.objective)}</p></div></div><div class="workgrid"><section class="panel controls"><p class="eyebrow">Design variables</p><h3>Build a configuration</h3>${controls()}<div class="field"><label for="project-notes">Engineering notes</label><textarea id="project-notes" rows="7" placeholder="Record each revision, the requirement driving the change, assumptions, margins, and what you would test next…">${esc(notes)}</textarea></div><div class="actions"><button class="button primary" data-test>Run RFP check →</button><button class="button ghost" data-save>Save revision</button><button class="button ghost" data-export>Export report</button></div><p class="note">Progress is saved automatically to your Specly account. Export the report anytime for a portable copy of the RFP, requirements, design, results, and validation plan.</p></section><div id="member-visual">${visual()}</div></div></section><section class="panel" id="member-results" aria-live="polite">${results()}</section>${portfolioPanel()}<details class="panel"><summary>Model assumptions and limitations</summary><p>${esc(active.assumptions)}</p></details><footer><span>Specly · ${esc(active.id)}</span><span><a href="./terms.html">Terms</a> · <a href="./privacy.html">Privacy</a> · <a href="./refund.html">Refunds</a> · <a href="./faq.html">FAQ</a> · <a href="./contact.html">Contact</a></span></footer></main>`;
}

function render(){app.innerHTML=header()+(active?workspace():catalog());}
function openProject(id){
  active=projects.find(p=>p.id===id);
  if(!active)return;
  const state=progressCache[id]||saved()[id];
  design=state?.design?{...active.design,...state.design}:{...active.design};
  notes=state?.notes||'';
  tested=Boolean(state?.tested);
  render();
  window.scrollTo(0,0);

  // Opening a project counts as starting it, so it appears in My Projects.
  if(!state)saveCurrent({notify:false});
}

function exportReport(){
  const r=evaluateMission(active.mission,design);
  const summary=portfolioSummary(r);
  const lines=[
    `# ${active.title}`,'',
    `**Project ID:** ${active.id}`,
    `**Difficulty:** ${difficultyLabels[active.level]}`,
    `**Category:** ${families[active.type].name}`,
    `**Industry:** ${active.industry}`,
    `**Stakeholder:** ${active.stakeholder}`,'',
    `## Request for Proposal`,active.rfp,'',
    `## Real-world problem`,active.realWorldProblem,'',
    `**Why it matters:** ${active.whyItMatters}`,'',
    `## Numerical success criteria`,
    ...active.goals.map(g=>`- ${g.label}: ${g.comparator} ${fmt(g.value,3)} ${g.unit} — ${g.why}`),'',
    `## Required work products`,...active.deliverables.map(x=>`- ${x}`),'',
    `## Final design`,...Object.entries(design).map(([k,v])=>`- ${k}: ${v}`),'',
    `## Analytical compliance`,...r.checks.map(c=>`- ${c.label}: ${fmt(c.value,3)} ${c.unit} — ${c.pass?'PASS':'REVISE'} (requirement ${c.minimum?'≥':'≤'} ${fmt(c.limit,3)} ${c.unit})`),'',
    `**Overall:** ${r.pass?'Modeled requirements met':'Revision required'}`,'',
    `## Engineering notes`,notes||'No notes entered.','',
    `## Proposed hardware validation`,...active.validationPlan.map(x=>`- ${x}`),'',
    `## Stretch analysis`,active.stretchGoal,'',
    `## Portfolio framing`,active.portfolioAngle,'',
    `**Suggested summary:** ${summary}`,'',
    `## Assumptions and limitations`,active.assumptions,'',
    `> Educational, industry-inspired project. This is not a commissioned company project, engineering certification, or substitute for hardware validation.`
  ];
  const blob=new Blob([lines.join('\n')],{type:'text/markdown'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`${active.id}-${active.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.md`;a.click();URL.revokeObjectURL(url);toast('RFP report exported.');
}

async function copyPortfolio(){
  if(!active||!tested)return;
  const text=portfolioSummary(evaluateMission(active.mission,design));
  try{await navigator.clipboard.writeText(text);toast('Portfolio summary copied.')}catch{toast('Could not copy automatically. Select the summary text instead.')}
}

document.addEventListener('click',e=>{
  const del=e.target.closest('[data-delete-project]');
  if(del){
    e.preventDefault();
    e.stopPropagation();
    deleteProjectProgress(del.dataset.deleteProject);
    return;
  }

  const p=e.target.closest('[data-project]');if(p)openProject(p.dataset.project);
  if(e.target.closest('[data-home]')){active=null;render();window.scrollTo(0,0)}
  if(e.target.closest('[data-test]')){const r=evaluateMission(active.mission,design);tested=true;saveCurrent({notify:false});render();showTestPopup(r);document.querySelector('#member-results')?.scrollIntoView({behavior:'smooth',block:'center'})}
  if(e.target.closest('[data-save]'))saveCurrent();
  if(e.target.closest('[data-export]')){notes=document.querySelector('#project-notes')?.value||notes;saveCurrent({notify:false});exportReport()}
  if(e.target.closest('[data-copy-portfolio]'))copyPortfolio();
});

document.addEventListener('input',e=>{
  if(!active)return;
  if(e.target.id==='project-notes'){notes=e.target.value;queueAutoSave();return}
  const key=e.target.dataset.param;if(!key)return;
  design={...design,[key]:Number(e.target.value)};tested=false;
  document.querySelector('#value-'+key).textContent=design[key];
  document.querySelector('#member-visual').innerHTML=visual();
  document.querySelector('#member-results').innerHTML='<p>Design changed. Run the RFP check to verify this revision.</p>';
  const pp=document.querySelector('.portfolio-panel');if(pp)pp.outerHTML=portfolioPanel();
  queueAutoSave();
});

document.addEventListener('change',e=>{
  if(e.target.matches('[data-difficulty]')){
    selectedDifficulty=e.target.value;
    render();
    window.scrollTo({top:Math.max(0,document.querySelector('.library-filter')?.offsetTop-90||0),behavior:'smooth'});
    return;
  }
  if(!active||!e.target.matches('[data-material]'))return;
  design={...design,material:e.target.value};tested=false;
  document.querySelector('#member-visual').innerHTML=visual();
  document.querySelector('#member-results').innerHTML='<p>Material changed. Run the RFP check to verify this revision.</p>';
  const pp=document.querySelector('.portfolio-panel');if(pp)pp.outerHTML=portfolioPanel();
  queueAutoSave();
});

(async()=>{
  app.innerHTML='<main style="max-width:680px;margin:12vh auto;padding:24px"><p class="eyebrow">Member studio</p><h1>Loading your project library…</h1></main>';
  try{await fetchProjects();await loadProjectProgress();render()}catch(error){console.error(error);app.innerHTML='<main style="max-width:680px;margin:12vh auto;padding:24px"><h1>We couldn’t load the member library.</h1><p>Your membership is active, but the project service did not respond. Refresh, or open Account & billing.</p><a href="./commerce.html">Account & billing</a></main>'}
})();
