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

function buildProjects(){
  const levels=["beginner","intermediate","advanced"];
  const structureScenes=[
    "Camera boom bracket","Weather sensor mast","Drone payload arm","CubeSat antenna support","Rover camera standoff",
    "Avionics tray support","Battery pack cantilever","Optical bench mount","Sampling arm bracket","Telemetry antenna arm",
    "Lunar instrument boom","High-altitude sensor bracket","Robotic gripper support","Flight-test probe mount","Compact radar standoff"
  ];
  const isolationScenes=[
    "IMU vibration mount","Camera gimbal isolator","Rover science payload","Optical sensor platform","Battery electronics tray",
    "Drone mapping camera","Reaction-wheel bench","Pump electronics mount","Telemetry receiver cradle","Navigation computer isolator",
    "Lidar head mount","Microscope transport stage","Star-tracker bench","Payload avionics deck","Precision antenna sensor"
  ];
  const thermalScenes=[
    "Outdoor data logger","Motor controller plate","Radio electronics plate","Battery monitor enclosure","Camera processor plate",
    "Telemetry modem sink","LED inspection module","Sensor gateway plate","Avionics compute plate","Power regulator plate",
    "Embedded GPU cooler","Radar processor plate","Robotics controller plate","Flight computer plate","High-power radio plate"
  ];
  const out:any[]=[];
  for(let i=0;i<15;i++){
    const level=levels[Math.floor(i/5)];
    const difficulty=Math.floor(i/5);
    out.push({
      id:`STR-${String(i+1).padStart(4,"0")}`,type:"structure",level,title:structureScenes[i],
      description:"Balance stiffness, strength, reach, and mass for a lightweight cantilevered support.",
      context:`A ${structureScenes[i].toLowerCase()} must hold a component clear of the main chassis while staying lightweight and sufficiently stiff.`,
      objective:"Choose the section dimensions and material, run the analytical model, and document the tradeoffs that drive your final configuration.",
      assumptions:"Uniform rectangular Euler–Bernoulli cantilever; perfectly fixed root; static tip load; isotropic linear-elastic material. No joint compliance, fatigue, torsion, impact, holes, or manufacturing defects.",
      mission:{type:"structure",requirements:{force:12+i*1.7+difficulty*5,maxMass:150-difficulty*15,maxDeflection:1.6-difficulty*.3,minSafety:1.8+difficulty*.35,minReach:105+difficulty*15}},
      design:{length:140+difficulty*10,width:32+difficulty*3,thickness:4+difficulty*.5,material:"aluminum"}
    });
    out.push({
      id:`DYN-${String(i+1).padStart(4,"0")}`,type:"isolation",level,title:isolationScenes[i],
      description:"Tune a spring–damper mount to reduce transmitted vibration while controlling static sag.",
      context:`The ${isolationScenes[i].toLowerCase()} sits on a vibrating base and needs passive isolation at its operating frequency.`,
      objective:"Select total stiffness and damping, check transmissibility and sag, then explain how you would validate damping and startup resonance experimentally.",
      assumptions:"Linear single-degree-of-freedom vertical mount under steady sinusoidal base excitation. Constant viscous damping; no rotations, nonlinear elastomers, transient shock, or travel-stop impacts.",
      mission:{type:"isolation",requirements:{frequency:18+i*1.4+difficulty*4,maxTransmission:.34-difficulty*.045,maxSag:12-difficulty*1.5,payload:.8+(i%5)*.3+difficulty*.35}},
      design:{stiffness:2200+difficulty*450,damping:.18+difficulty*.03}
    });
    out.push({
      id:`THM-${String(i+1).padStart(4,"0")}`,type:"thermal",level,title:thermalScenes[i],
      description:"Size a passive cooling plate that meets temperature, mass, and packaging constraints.",
      context:`The ${thermalScenes[i].toLowerCase()} rejects heat to ambient air without a fan and must remain below its allowable source temperature.`,
      objective:"Tune plate dimensions and material, compare temperature and mass, and identify which real-world thermal effects would need test validation.",
      assumptions:"Steady-state lumped isothermal plate with convection from two unobstructed large faces. Constant prescribed convection coefficient; uniform heat input. Radiation, contact resistance, local hot spots, and heat spreading are excluded.",
      mission:{type:"thermal",requirements:{power:7+i*.8+difficulty*3,maxTemp:64-difficulty*4,ambient:25,h:8+difficulty,maxMass:280-difficulty*25,maxLength:230-difficulty*10}},
      design:{length:135+difficulty*10,width:115+difficulty*8,thickness:3+difficulty*.5,material:"aluminum"}
    });
  }
  return out;
}
