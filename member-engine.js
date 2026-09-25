export const families = {
  structure: {
    name: 'Structural supports',
    color: '#176c58',
    params: [
      ['length','Reach',80,220,5,'mm'],
      ['width','Section width',15,65,1,'mm'],
      ['thickness','Section thickness',2,12,0.5,'mm'],
    ],
  },
  isolation: {
    name: 'Vibration isolation',
    color: '#7855a6',
    params: [
      ['stiffness','Total spring stiffness',200,6000,50,'N/m'],
      ['damping','Damping ratio',0.03,0.6,0.01,''],
    ],
  },
  thermal: {
    name: 'Passive cooling',
    color: '#a95625',
    params: [
      ['length','Plate length',60,260,5,'mm'],
      ['width','Plate width',60,220,5,'mm'],
      ['thickness','Plate thickness',1,8,0.5,'mm'],
    ],
  },
};

export const materials = {
  aluminum: { name:'6061-T6 aluminum', E:69e9, yield:276e6, rho:2700, k:167 },
  steel: { name:'Mild steel', E:200e9, yield:250e6, rho:7850, k:50 },
  titanium: { name:'Ti-6Al-4V', E:114e9, yield:880e6, rho:4430, k:6.7 },
};

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt = (x,d=2) => Number.isFinite(x) ? Number(x.toFixed(d)).toLocaleString('en-US',{maximumFractionDigits:d}) : '—';
const check = (label,value,limit,unit,minimum=false) => ({label,value,limit,unit,minimum,pass:minimum?value>=limit:value<=limit});
const transmissibility = (r,z) => Math.sqrt((1+(2*z*r)**2)/((1-r*r)**2+(2*z*r)**2));

function validateDesign(type,p){
  const f=families[type];
  if(!f) throw Error('Unknown category');
  for(const [key,,min,max] of f.params){
    if(typeof p[key] !== 'number' || !Number.isFinite(p[key]) || p[key] < min || p[key] > max) throw Error(`Invalid ${key}`);
  }
  if(type !== 'isolation' && !materials[p.material]) throw Error('Choose a valid material');
}

export function evaluateMission(m,p){
  validateDesign(m.type,p);
  const q=m.requirements;
  let metrics,checks,curve,advice;

  if(m.type==='structure'){
    const a=materials[p.material],L=p.length/1000,b=p.width/1000,t=p.thickness/1000,I=b*t**3/12;
    const stress=6*q.force*L/(b*t*t),deflection=q.force*L**3/(3*a.E*I)*1000,mass=a.rho*L*b*t*1000,safety=a.yield/stress;
    metrics={stress:stress/1e6,deflection,mass,safety};
    checks=[
      check('Tip deflection',deflection,q.maxDeflection,'mm'),
      check('Support mass',mass,q.maxMass,'g'),
      check('Yield safety factor',safety,q.minSafety,'',true),
      check('Required reach',p.length,q.minReach,'mm',true),
      check('Beam slenderness (L/t)',p.length/p.thickness,10,'',true),
    ];
    curve=Array.from({length:41},(_,i)=>{const x=L*i/40;return[x*1000,q.force*x*x*(3*L-x)/(6*a.E*I)*1000]});
    advice=deflection>q.maxDeflection?'The support is too flexible. Try increasing thickness before adding width.':mass>q.maxMass?'Mass is driving this design. Try a lighter material or reduce width while checking stiffness.':'Review the remaining requirements and document the tradeoffs behind your section choice.';
  } else if(m.type==='isolation'){
    const mass=q.payload,fn=Math.sqrt(p.stiffness/mass)/(2*Math.PI),ratio=q.frequency/fn,T=transmissibility(ratio,p.damping),sag=mass*9.80665/p.stiffness*1000;
    metrics={fn,ratio,T,sag,c:2*p.damping*Math.sqrt(p.stiffness*mass)};
    checks=[check('Motion transmission',T,q.maxTransmission,'×'),check('Static sag',sag,q.maxSag,'mm')];
    curve=Array.from({length:81},(_,i)=>{const f=i*.75;return[f,transmissibility(f/fn,p.damping)]});
    advice=T>q.maxTransmission?'Too much vibration reaches the payload. Reduce stiffness to move the natural frequency below the operating frequency.':sag>q.maxSag?'The mount sags too far. Increase stiffness, then recheck motion transmission.':'Document how you would measure damping and handle resonance during startup.';
  } else {
    const a=materials[p.material],L=p.length/1000,b=p.width/1000,t=p.thickness/1000,A=L*b,R=t/(a.k*A)+1/(q.h*2*A),temp=q.ambient+q.power*R,mass=a.rho*L*b*t*1000;
    metrics={temp,mass,R,area:2*A*1e4};
    checks=[check('Source temperature',temp,q.maxTemp,'°C'),check('Plate mass',mass,q.maxMass,'g'),check('Packaging length',p.length,q.maxLength,'mm')];
    curve=Array.from({length:41},(_,i)=>{const power=q.power*1.5*i/40;return[power,q.ambient+power*R]});
    advice=temp>q.maxTemp?'Increase exposed area to reduce convection resistance. Confirm that both faces will actually see air.':mass>q.maxMass?'Reduce thickness or select a lower-density material; then rerun the temperature check.':'Plan a physical temperature test: real convection and contact resistance may change the result.';
  }

  return {metrics,checks,curve,advice,pass:checks.every(c=>c.pass),passed:checks.filter(c=>c.pass).length};
}

export function missionDiagram(type,p){
  const color=families[type].color;
  let body='';
  if(type==='structure'){
    const L=p.length||140,t=p.thickness||3,w=p.width||30,x=85+L*1.4,th=8+t*1.8;
    body=`<defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7 7 0" stroke="#718678" stroke-width="1"/></pattern></defs><rect x="57" y="83" width="28" height="107" fill="url(#hatch)"/><path d="M85 82V191" stroke="#758e85" stroke-width="2"/><path d="M85 123H${x}V${123+th}H85" fill="${color}12" stroke="${color}" stroke-width="2"/><path d="M${x} 53V106m-6-9 6 9 6-9" fill="none" stroke="#a95625" stroke-width="2"/><text x="${x+12}" y="71" fill="#a95625">F</text><text x="${(85+x)/2}" y="235" text-anchor="middle" fill="#556578">L = ${L} mm</text><text x="103" y="172" fill="#556578">${w} × ${t} mm section</text>`;
  } else if(type==='isolation'){
    body=`<rect x="133" y="68" width="174" height="58" rx="3" stroke="${color}" fill="${color}0c" stroke-width="2"/><text x="220" y="102" text-anchor="middle" fill="${color}">payload</text><path d="M172 126v10l-12 8 24 12-24 12 24 12-12 8v22M265 126v29m-15 0h30v31h-30v-31m15 31v24M250 170h30" stroke="${color}" fill="none" stroke-width="2"/><path d="M101 212H339" stroke="#819585"/><text x="131" y="170" fill="#556578">k</text><text x="291" y="173" fill="#556578">c</text><text x="220" y="253" text-anchor="middle" fill="#556578">Base excitation</text>`;
  } else {
    const w=100+(p.width||100)*.5,l=70+(p.length||120)*.45,x=220-w/2,y=150-l/2;
    body=`<path d="M${x} ${y}h${w}v${l}h-${w}Z" fill="${color}09" stroke="${color}" stroke-width="2"/><rect x="183" y="123" width="74" height="45" rx="2" fill="${color}30" stroke="${color}"/><text x="220" y="150" text-anchor="middle" fill="${color}">Q̇ in</text><path d="M173 90V59m-5 6 5-6 5 6m42 25V59m-5 6 5-6 5 6m42 25V59m-5 6 5-6 5 6" stroke="#176c58" fill="none"/><text x="220" y="244" text-anchor="middle" fill="#556578">${p.length||120} × ${p.width||100} × ${p.thickness||3} mm</text>`;
  }
  return `<svg role="img" aria-label="${esc(families[type].name)} schematic" viewBox="0 0 440 280" style="font-family:ui-monospace,monospace;font-size:13px">${body}</svg>`;
}

export function missionChart(mission,design,result){
  const t=mission.type,curve=result.curve,xmax=Math.max(...curve.map(a=>a[0])),ymax=Math.max(...curve.map(a=>a[1]))*1.12,ymin=t==='thermal'?Math.max(0,mission.requirements.ambient-5):0;
  const X=x=>48+x/xmax*380,Y=y=>190-(y-ymin)/(ymax-ymin)*158;
  let labels='';
  for(let i=0;i<=4;i++){
    const y=ymin+(ymax-ymin)*i/4,x=xmax*i/4;
    labels+=`<path d="M48 ${Y(y)}H428" stroke="#dce5e9"/><text x="39" y="${Y(y)+4}" text-anchor="end">${fmt(y,1)}</text><text x="${X(x)}" y="211" text-anchor="middle">${fmt(x,0)}</text>`;
  }
  const q=mission.requirements,px=t==='structure'?design.length:t==='isolation'?q.frequency:q.power,py=t==='structure'?result.metrics.deflection:t==='isolation'?result.metrics.T:result.metrics.temp;
  return `<svg class="chart" viewBox="0 0 460 242" role="img"><text x="48" y="15">${t==='structure'?'Deflection (mm)':t==='isolation'?'Amplitude ratio':'Temperature (°C)'}</text>${labels}<path d="${curve.map(([x,y],i)=>`${i?'L':'M'}${X(x).toFixed(2)} ${Y(y).toFixed(2)}`).join(' ')}" fill="none" stroke="${families[t].color}" stroke-width="2.5"/><circle cx="${X(px)}" cy="${Y(py)}" r="4" fill="${families[t].color}"/><text x="240" y="236" text-anchor="middle">${t==='structure'?'Distance from fixed end (mm)':t==='isolation'?'Excitation frequency (Hz)':'Heat input (W)'}</text></svg>`;
}
