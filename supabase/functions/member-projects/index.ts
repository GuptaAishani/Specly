import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authorization = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return json({ error: "Please sign in first." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: sub } = await admin.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle();
    if (!sub || !["trialing","active"].includes(sub.status)) return json({ error: "An active membership is required." }, 403);

    return json({ projects: buildProjects() });
  } catch (error) {
    console.error(error);
    return json({ error: "Could not load the project library." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

type Scene = {
  title: string;
  industry: string;
  stakeholder: string;
  problem: string;
  impact: string;
};

const structureScenes: Scene[] = [
  {title:"Wildfire drone thermal-camera boom",industry:"Emergency-response UAS",stakeholder:"Wildfire mapping drone team",problem:"A forward-mounted thermal camera needs an unobstructed view beyond the airframe, but the boom must not add enough mass or flex to degrade flight time and image stability.",impact:"Faster, clearer thermal mapping helps crews identify hotspots while keeping responders farther from hazardous terrain."},
  {title:"Remote weather-station sensor mast",industry:"Environmental monitoring",stakeholder:"Remote sensing field team",problem:"A compact station needs a cantilevered wind and temperature sensor clear of the enclosure so the electronics do not bias measurements.",impact:"A stiff, lightweight mast improves data quality while reducing the load on portable solar-powered stations."},
  {title:"Inspection-drone LiDAR arm",industry:"Infrastructure inspection",stakeholder:"Bridge inspection UAS team",problem:"A LiDAR unit must sit outside propeller and fuselage occlusion while staying light enough for a small multirotor.",impact:"Stable geometry improves point-cloud quality used to identify cracks, corrosion, and deformation."},
  {title:"CubeSat antenna support",industry:"Small satellite communications",stakeholder:"University CubeSat team",problem:"A radio antenna support must provide clearance from the spacecraft body without consuming excessive mass or deflecting under handling loads.",impact:"Maintaining antenna geometry reduces integration risk and protects communication performance during ground handling."},
  {title:"Planetary-rover stereo camera standoff",industry:"Planetary robotics",stakeholder:"Robotic exploration team",problem:"A stereo camera needs elevation above the rover deck for terrain visibility while the support must remain stiff and mass-efficient.",impact:"A stable camera baseline improves navigation imagery and reduces motion-induced pointing error."},
  {title:"Launch-vehicle avionics tray support",industry:"Launch vehicles",stakeholder:"Avionics integration team",problem:"A cantilevered electronics tray bracket must carry harness and box loads while preserving access and minimizing non-propulsive mass.",impact:"Efficient supports preserve vehicle mass margin and reduce risk of connector or electronics motion during integration."},
  {title:"eVTOL battery-monitor bracket",industry:"Electric aviation",stakeholder:"Battery systems team",problem:"A monitoring module must be offset from a battery enclosure for service access without creating a flexible bracket that amplifies vibration.",impact:"A compact stiff support protects sensing hardware while maintaining maintainability in a mass-sensitive aircraft."},
  {title:"Telescope optical-bench mount",industry:"Optical instrumentation",stakeholder:"Imaging payload team",problem:"A small optical element must be positioned away from the main bench while limiting deflection that could shift alignment.",impact:"Higher structural stiffness helps preserve line-of-sight alignment and repeatable imaging performance."},
  {title:"Mars-analog sampling-arm bracket",industry:"Field robotics",stakeholder:"Autonomous sampling team",problem:"A sampling tool needs reach beyond the rover chassis but the support must stay light and resist bending under collection loads.",impact:"More reach expands accessible sample locations without forcing a larger or heavier rover chassis."},
  {title:"Mobile telemetry antenna arm",industry:"Field communications",stakeholder:"Remote communications team",problem:"A directional antenna must clear a vehicle roofline while its support stays light and rigid enough to maintain pointing.",impact:"Stable pointing improves link reliability during mobile field operations."},
  {title:"Lunar surface instrument boom",industry:"Lunar science",stakeholder:"Surface payload integration team",problem:"A science sensor must be moved away from lander-generated thermal and electromagnetic interference while the boom remains mass-efficient.",impact:"Greater sensor separation can improve measurement fidelity without sacrificing scarce payload mass."},
  {title:"High-altitude balloon sensor bracket",industry:"Atmospheric science",stakeholder:"Balloon payload team",problem:"An atmospheric sensor must project into clean airflow outside the gondola while surviving its own static loading with minimal mass.",impact:"Cleaner flow exposure improves measurement quality while preserving balloon payload capacity."},
  {title:"Robotic gripper camera support",industry:"Warehouse robotics",stakeholder:"Autonomous manipulation team",problem:"A wrist camera needs a clear view of the grasp point but its mount cannot add excessive moving mass or flex under acceleration.",impact:"A stiffer, lighter support improves perception consistency and reduces demand on the robot joints."},
  {title:"Flight-test air-data probe mount",industry:"Flight testing",stakeholder:"Experimental aerodynamics team",problem:"A probe must extend into undisturbed flow while the mount limits static deflection and maintains adequate strength margin.",impact:"Stable probe placement supports cleaner air-data measurements and safer envelope expansion testing."},
  {title:"Compact radar antenna standoff",industry:"Autonomous sensing",stakeholder:"Mobile radar integration team",problem:"A compact radar must be offset from nearby structure to reduce blockage while staying within tight mass and packaging limits.",impact:"A structurally efficient standoff improves sensor field of view without a large vehicle-level mass penalty."},
];

const isolationScenes: Scene[] = [
  {title:"Drone navigation IMU isolator",industry:"Autonomous flight",stakeholder:"Flight-controls team",problem:"Motor and propeller vibration contaminates inertial measurements, but an overly soft mount can sag and create alignment error.",impact:"Cleaner IMU data supports more stable attitude estimation and control."},
  {title:"Aerial mapping camera isolator",industry:"Geospatial imaging",stakeholder:"Mapping UAS team",problem:"A survey camera experiences periodic airframe vibration that can blur imagery while the mount must maintain its nominal pointing position.",impact:"Lower transmitted motion improves sharpness and photogrammetry reconstruction quality."},
  {title:"Rover science-payload isolator",industry:"Mobile robotics",stakeholder:"Field science rover team",problem:"Wheel and drivetrain vibration reaches a sensitive payload mounted to the rover deck.",impact:"Passive isolation protects measurement quality without adding active-control complexity."},
  {title:"Optical sensor bench isolator",industry:"Precision instrumentation",stakeholder:"Optics lab team",problem:"A compact optical sensor sits on a base with periodic equipment vibration that must be attenuated without excessive static sag.",impact:"Lower bench motion improves repeatability in image and alignment measurements."},
  {title:"Battery electronics tray isolator",industry:"Electric mobility",stakeholder:"Battery diagnostics team",problem:"A monitoring electronics tray sees repeated motor-induced vibration that can stress connectors and corrupt sensitive signals.",impact:"Reducing transmitted vibration can improve electronics reliability and data integrity."},
  {title:"Drone multispectral camera mount",industry:"Precision agriculture",stakeholder:"Crop-imaging UAS team",problem:"Propulsion vibration degrades multispectral image registration while the payload mass and available suspension travel are limited.",impact:"Sharper aligned imagery improves vegetation-index maps used for field decisions."},
  {title:"Reaction-wheel test-bench isolator",industry:"Spacecraft GNC testing",stakeholder:"Attitude-control test team",problem:"A reaction wheel injects narrow-band vibration into a sensor bench used for pointing experiments.",impact:"Better isolation helps separate wheel disturbances from the behavior of the system under test."},
  {title:"Pump-controller electronics mount",industry:"Fluid systems",stakeholder:"Pump controls team",problem:"A nearby pump drives periodic base motion into sensitive control electronics.",impact:"Reducing transmitted motion helps protect connectors and improves sensor signal quality."},
  {title:"Telemetry receiver cradle",industry:"Remote communications",stakeholder:"Ground-systems team",problem:"A vehicle-mounted receiver experiences engine vibration that can loosen connections and disturb an attached pointing sensor.",impact:"A tuned cradle can improve hardware durability without requiring active isolation."},
  {title:"Navigation computer isolator",industry:"Autonomous vehicles",stakeholder:"Navigation systems team",problem:"A compact computer and sensor assembly must be isolated from chassis vibration while keeping static motion within alignment limits.",impact:"Lower vibration exposure supports more reliable sensing and electronics operation."},
  {title:"LiDAR head vibration mount",industry:"Autonomous perception",stakeholder:"Mobile mapping team",problem:"A rotating LiDAR sees structural vibration at a dominant operating frequency that can introduce point-cloud motion error.",impact:"Reducing transmitted motion improves environmental reconstruction and localization quality."},
  {title:"Portable microscope transport stage",industry:"Field diagnostics",stakeholder:"Mobile laboratory team",problem:"A microscope module must be passively isolated from periodic generator vibration while remaining compact and level.",impact:"Cleaner optical measurements make field microscopy more practical outside a laboratory."},
  {title:"Star-tracker bench isolator",industry:"Spacecraft attitude sensing",stakeholder:"Precision pointing team",problem:"A star-tracker test article is exposed to reaction-wheel-like vibration through its mounting bench.",impact:"Lower line-of-sight disturbance improves the fidelity of pointing and sensor characterization tests."},
  {title:"Payload avionics deck isolator",industry:"Launch payload integration",stakeholder:"Payload avionics team",problem:"A small avionics deck sees a dominant sinusoidal disturbance and needs passive attenuation without excessive mount deflection.",impact:"A balanced stiffness-damping design can reduce electronics vibration while preserving packaging and alignment."},
  {title:"Precision antenna sensor isolator",industry:"RF metrology",stakeholder:"Antenna characterization team",problem:"A precision RF sensor is mounted near rotating equipment that introduces a repeatable vibration tone.",impact:"Reducing motion helps stabilize measurement geometry and improves test repeatability."},
];

const thermalScenes: Scene[] = [
  {title:"Remote wildfire data-logger cooling plate",industry:"Environmental sensing",stakeholder:"Wildfire sensor-network team",problem:"A sealed data logger in a field node must reject electronics heat passively because fans add power draw, dust paths, and maintenance.",impact:"Passive cooling supports longer unattended deployments in remote monitoring networks."},
  {title:"Small-robot motor-controller heat spreader",industry:"Mobile robotics",stakeholder:"Robot power-electronics team",problem:"A motor controller generates steady heat inside a compact chassis with limited airflow and strict mass limits.",impact:"A lightweight passive plate can protect electronics without consuming additional electrical power."},
  {title:"Portable radio electronics cooling plate",industry:"Field communications",stakeholder:"Portable communications team",problem:"A radio module must dissipate heat in a fanless enclosure while staying within a handheld mass budget.",impact:"Lower electronics temperature improves reliability during long field deployments."},
  {title:"Battery-monitor thermal plate",industry:"Energy storage",stakeholder:"Battery management team",problem:"A monitoring module mounted near cells must stay below its temperature limit without introducing a bulky active cooler.",impact:"Passive thermal control reduces parasitic power and integration complexity."},
  {title:"Machine-vision processor cooling plate",industry:"Industrial automation",stakeholder:"Vision-system team",problem:"An embedded camera processor produces continuous heat in a compact inspection head that cannot use a fan.",impact:"Maintaining processor temperature supports continuous inspection uptime and image-processing performance."},
  {title:"Telemetry modem passive cooler",industry:"Remote communications",stakeholder:"Telemetry systems team",problem:"A modem operates continuously in a compact field enclosure where airflow is limited and fan maintenance is undesirable.",impact:"A correctly sized passive plate improves modem reliability and reduces service needs."},
  {title:"LED inspection-module heat spreader",industry:"Industrial inspection",stakeholder:"Machine-vision lighting team",problem:"A high-output LED module must reject heat without a fan while preserving a compact inspection-head envelope.",impact:"Lower LED temperature helps maintain light output, color stability, and service life."},
  {title:"Edge sensor-gateway cooling plate",industry:"Industrial IoT",stakeholder:"Factory sensor-network team",problem:"An edge gateway combines radios and local processing in a sealed cabinet with modest natural convection.",impact:"Passive thermal design supports reliable always-on operation without adding a fan failure mode."},
  {title:"Avionics compute-module cooling plate",industry:"Aerospace electronics",stakeholder:"Flight-computer integration team",problem:"A compact compute board dissipates continuous heat and must remain within temperature limits while meeting a tight mass budget.",impact:"A mass-efficient thermal path protects electronics performance and vehicle-level mass margin."},
  {title:"Power-regulator passive heat spreader",industry:"Power electronics",stakeholder:"Power conversion team",problem:"A DC power regulator produces steady losses in a sealed enclosure and must remain fanless.",impact:"A passive spreader improves component reliability without increasing system power draw."},
  {title:"Embedded AI GPU cooling plate",industry:"Autonomous systems",stakeholder:"Edge-compute team",problem:"A high-load embedded GPU needs passive heat rejection in a compact mobile platform where fan power and dust ingestion are concerns.",impact:"Thermal margin helps sustain compute performance needed for real-time perception."},
  {title:"Compact radar processor cooling plate",industry:"Radar sensing",stakeholder:"Radar electronics team",problem:"A signal processor generates sustained heat in a constrained sensor package with no dedicated fan.",impact:"A thermally efficient plate supports continuous radar processing and electronics longevity."},
  {title:"Robotics controller passive cooler",industry:"Automation",stakeholder:"Robotic controls team",problem:"A controller mounted inside an enclosed robot cell must reject heat through natural convection while staying easy to package.",impact:"Reliable passive cooling reduces downtime and eliminates a common fan maintenance item."},
  {title:"Flight-computer heat spreader",industry:"Experimental aircraft",stakeholder:"Flight-test avionics team",problem:"A compact flight computer operates continuously in an enclosure with limited forced airflow and strict mass limits.",impact:"Maintaining processor temperature protects data acquisition and control availability during test flights."},
  {title:"High-power radio passive cooling plate",industry:"RF communications",stakeholder:"High-data-rate radio team",problem:"A high-power radio dissipates significant steady heat in a package where active cooling is undesirable.",impact:"A low-mass passive thermal path can extend transmit duty cycle while protecting RF electronics."},
];

function goal(label:string, comparator:"≤"|"≥"|"=", value:number, unit:string, why:string){
  return {label, comparator, value, unit, why};
}

function commonDeliverables(type:string){
  const shared=[
    "A requirement-compliance matrix showing every numerical target and your final modeled value.",
    "A short trade study comparing at least three design revisions and explaining the dominant tradeoff.",
    "An assumptions-and-limitations section that identifies what the simplified model leaves out.",
    "A validation plan describing the measurement or test you would run before calling the design flight/field ready.",
  ];
  if(type==="structure") shared.unshift("A final support geometry and material selection with mass, deflection, and strength margin.");
  if(type==="isolation") shared.unshift("A final spring stiffness and damping target with natural frequency, transmissibility, and static sag.");
  if(type==="thermal") shared.unshift("A final cooling-plate geometry and material selection with predicted temperature, mass, and thermal resistance.");
  return shared;
}

function validationPlan(type:string){
  if(type==="structure") return [
    "Measure tip deflection under a known static load and compare it with the analytical prediction.",
    "Inspect the root joint and mounting interface because joint compliance is excluded from the beam model.",
    "If the application is dynamic, add vibration/fatigue checks before claiming hardware readiness.",
  ];
  if(type==="isolation") return [
    "Measure the installed natural frequency with a sweep or ring-down test.",
    "Estimate damping from measured response rather than assuming the nominal damping ratio.",
    "Check startup/shutdown resonance and available travel before using the mount on hardware.",
  ];
  return [
    "Instrument source and plate temperatures at steady state and compare them with the model.",
    "Measure or bound the real convection environment and interface/contact resistance.",
    "Add radiation, local hot spots, and enclosure effects before claiming hardware-ready thermal margin.",
  ];
}

function makeStructure(scene:Scene,i:number,level:string,difficulty:number){
  const requirements={force:12+i*1.7+difficulty*5,maxMass:150-difficulty*15,maxDeflection:1.6-difficulty*.3,minSafety:1.8+difficulty*.35,minReach:105+difficulty*15};
  return {
    id:`STR-${String(i+1).padStart(4,"0")}`, type:"structure", level, title:scene.title,
    description:`${scene.industry}: size a lightweight cantilever support against explicit stiffness, mass, reach, and strength targets.`,
    industry:scene.industry, stakeholder:scene.stakeholder, realWorldProblem:scene.problem, whyItMatters:scene.impact,
    rfp:`Develop a preliminary cantilever support concept for the ${scene.stakeholder.toLowerCase()}. The concept must clear the required reach, carry the specified static tip load, stay within the mass budget, limit elastic tip motion, and retain adequate yield margin. Select the section and material, document tradeoffs, and propose a hardware validation test.`,
    objective:"Choose the section dimensions and material, iterate against the requirement matrix, and justify the final configuration with analytical evidence rather than a single pass/fail run.",
    goals:[
      goal("Static tip load","=",requirements.force,"N","Design load applied at the end of the cantilever."),
      goal("Maximum tip deflection","≤",requirements.maxDeflection,"mm","Protect pointing, alignment, or clearance."),
      goal("Maximum support mass","≤",requirements.maxMass,"g","Preserve vehicle or payload mass margin."),
      goal("Minimum yield safety factor","≥",requirements.minSafety,"","Maintain static strength margin in the simplified model."),
      goal("Minimum usable reach","≥",requirements.minReach,"mm","Place the component outside the required keep-out zone."),
    ],
    deliverables:commonDeliverables("structure"), validationPlan:validationPlan("structure"),
    portfolioAngle:`Frame the project as an industry-inspired ${scene.industry.toLowerCase()} structural trade study. Show the RFP, requirement matrix, 3+ iterations, final margin, and your proposed bench test.`,
    stretchGoal:"After meeting the static RFP, estimate how a root-joint stiffness reduction or a 20% load increase changes your margin.",
    context:`${scene.problem} ${scene.impact}`,
    assumptions:"Uniform rectangular Euler–Bernoulli cantilever; perfectly fixed root; static tip load; isotropic linear-elastic material. No joint compliance, fatigue, torsion, impact, holes, or manufacturing defects.",
    mission:{type:"structure",requirements},
    design:{length:140+difficulty*10,width:32+difficulty*3,thickness:4+difficulty*.5,material:"aluminum"}
  };
}

function makeIsolation(scene:Scene,i:number,level:string,difficulty:number){
  const requirements={frequency:18+i*1.4+difficulty*4,maxTransmission:.34-difficulty*.045,maxSag:12-difficulty*1.5,payload:.8+(i%5)*.3+difficulty*.35};
  return {
    id:`DYN-${String(i+1).padStart(4,"0")}`, type:"isolation", level, title:scene.title,
    description:`${scene.industry}: tune a passive spring-damper mount to reduce vibration without exceeding static sag.`,
    industry:scene.industry, stakeholder:scene.stakeholder, realWorldProblem:scene.problem, whyItMatters:scene.impact,
    rfp:`Develop a passive single-degree-of-freedom isolation concept for the ${scene.stakeholder.toLowerCase()}. The mount must support the payload mass, attenuate the specified operating-frequency base motion, and keep static sag within the packaging/alignment limit. Select stiffness and damping targets, explain resonance risk, and define a test plan for the installed mount.`,
    objective:"Tune stiffness and damping across multiple revisions, use frequency ratio and transmissibility to explain the trade, and document how you would validate the real damping and startup response.",
    goals:[
      goal("Payload mass","=",requirements.payload,"kg","Mass supported by the isolation system."),
      goal("Dominant base-excitation frequency","=",requirements.frequency,"Hz","Frequency where isolation performance is evaluated."),
      goal("Maximum motion transmission","≤",requirements.maxTransmission,"×","Limit vibration that reaches the payload."),
      goal("Maximum static sag","≤",requirements.maxSag,"mm","Protect alignment and available suspension travel."),
    ],
    deliverables:commonDeliverables("isolation"), validationPlan:validationPlan("isolation"),
    portfolioAngle:`Present this as an industry-inspired ${scene.industry.toLowerCase()} vibration-isolation design: define the disturbance, show the stiffness/damping trade space, verify transmission and sag, then outline a sweep or ring-down test.`,
    stretchGoal:"After meeting the RFP, evaluate sensitivity to a ±15% payload-mass change and explain whether the isolation still works.",
    context:`${scene.problem} ${scene.impact}`,
    assumptions:"Linear single-degree-of-freedom vertical mount under steady sinusoidal base excitation. Constant viscous damping; no rotations, nonlinear elastomers, transient shock, or travel-stop impacts.",
    mission:{type:"isolation",requirements},
    design:{stiffness:2200+difficulty*450,damping:.18+difficulty*.03}
  };
}

function makeThermal(scene:Scene,i:number,level:string,difficulty:number){
  const requirements={power:7+i*.8+difficulty*3,maxTemp:64-difficulty*4,ambient:25,h:8+difficulty,maxMass:280-difficulty*25,maxLength:230-difficulty*10};
  return {
    id:`THM-${String(i+1).padStart(4,"0")}`, type:"thermal", level, title:scene.title,
    description:`${scene.industry}: size a passive cooling plate against temperature, mass, and packaging constraints.`,
    industry:scene.industry, stakeholder:scene.stakeholder, realWorldProblem:scene.problem, whyItMatters:scene.impact,
    rfp:`Develop a fanless cooling-plate concept for the ${scene.stakeholder.toLowerCase()}. The plate must reject the specified steady heat load to ambient air, keep the source below its allowable temperature, remain within the mass budget, and fit the packaging-length constraint. Select geometry and material, show requirement margin, and define a temperature-validation test.`,
    objective:"Iterate plate dimensions and material, identify whether area or mass is driving the design, and explain which real thermal effects must be tested before hardware release.",
    goals:[
      goal("Steady heat load","=",requirements.power,"W","Heat that must be rejected by the passive plate."),
      goal("Ambient temperature","=",requirements.ambient,"°C","Reference environment for the simplified model."),
      goal("Maximum source temperature","≤",requirements.maxTemp,"°C","Protect electronics performance and reliability."),
      goal("Maximum plate mass","≤",requirements.maxMass,"g","Preserve system mass margin."),
      goal("Maximum plate length","≤",requirements.maxLength,"mm","Fit the allocated packaging envelope."),
    ],
    deliverables:commonDeliverables("thermal"), validationPlan:validationPlan("thermal"),
    portfolioAngle:`Frame this as an industry-inspired ${scene.industry.toLowerCase()} passive thermal design. Show the heat-load requirement, geometry/material trade study, predicted temperature margin, and a thermocouple-based validation plan.`,
    stretchGoal:"After meeting the RFP, reduce the convection coefficient by 25% and determine whether the design retains temperature margin.",
    context:`${scene.problem} ${scene.impact}`,
    assumptions:"Steady-state lumped isothermal plate with convection from two unobstructed large faces. Constant prescribed convection coefficient; uniform heat input. Radiation, contact resistance, local hot spots, and heat spreading are excluded.",
    mission:{type:"thermal",requirements},
    design:{length:135+difficulty*10,width:115+difficulty*8,thickness:3+difficulty*.5,material:"aluminum"}
  };
}

function buildProjects(){
  const levels=["beginner","intermediate","advanced"];
  const out:any[]=[];
  for(let i=0;i<15;i++){
    const level=levels[Math.floor(i/5)];
    const difficulty=Math.floor(i/5);
    out.push(makeStructure(structureScenes[i],i,level,difficulty));
    out.push(makeIsolation(isolationScenes[i],i,level,difficulty));
    out.push(makeThermal(thermalScenes[i],i,level,difficulty));
  }
  return out;
}
