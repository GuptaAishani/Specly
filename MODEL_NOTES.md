# Model notes — version 1.0

All inputs are converted to SI internally. Each saved revision stores the input parameters and its timestamp; outputs are recalculated using this engine. If equations or material properties change, bump the export schema or add explicit model-version migrations to preserve historical meaning.

## Structural support

Uniform rectangular, end-loaded, ideally clamped Euler–Bernoulli cantilever. I = b t³ / 12; stress = 6 F L / (b t²); tip deflection = F L³ / (3 E I); displacement at x = F x² (3L−x) / (6EI); mass = rho L b t; yield safety factor = yield / stress.

Thickness is along the bending direction. Force is a prescribed static tip force, not an impact inferred from landing velocity. Small deformation, slender beam, linear elasticity, isotropic materials. The application requires L/t >= 10 as a basic slenderness gate; this is not a substitute for assessing shear deformation in the actual design. Self-weight is excluded. Joint loads, fasteners, holes, local stress concentration, shear deformation, torsion, fatigue, buckling, temperature effects, and manufacturing defects need additional models. A load test of a real bracket must include its actual joint.

Reference: https://ocw.mit.edu/courses/2-080j-structural-mechanics-fall-2013/

## Isolation

Linear SDOF vertical mount under steady sinusoidal base displacement. Natural frequency fn = sqrt(k/m)/(2pi). r = f/fn. Absolute payload/base displacement amplitude ratio T = sqrt[(1+(2 zeta r)²)/((1−r²)²+(2 zeta r)²)]. Static sag = mg/k, with g=9.80665 m/s². Equivalent damping c=2 zeta sqrt(km). Stiffness is the total parallel stiffness. The fixed mission payload is checked independently; changing payload does not bypass requirements.

No transient shock, mount travel collision, friction, nonlinear rubber behavior, rocking, or structural modes. The response plot sweeps excitation frequency, not time. Startup resonance requires separate assessment.

Reference: https://ocw.mit.edu/courses/2-003sc-engineering-dynamics-fall-2011/pages/mechanical-vibration/

## Cooling plate

Steady, isothermal plate with one-dimensional through-thickness conduction and uniform heat input over the full projected face A = Lb. Both large faces are unobstructed: Aconv=2A. R = t/(kA)+1/(h Aconv). Tsource=Tambient+QR. Mass=rho Lbt.

This simple series resistance approximation assumes effective access to both faces despite the heating arrangement. Fixed h=8 W/(m²K) is a scenario assumption, not a universal measured coefficient. No heat spreading, contact resistance, local hot spots, radiation, edge convection, fin efficiency, or enclosure recirculation. The model can underpredict temperature for actual electronics. Thinner is better within this model because mechanical and spreading requirements are deliberately outside its scope. Do not generalize that trend to real heatsinks. No vacuum applications.

Reference: https://ntrs.nasa.gov/citations/20230013900

## Extending the mission library

Add a model only with measurable requirements, consistent units, independent benchmarks, clearly bounded inputs, feasible examples at every difficulty, limitations, and a physical validation plan. Keep solver code separate from narrative generation. Feasibility is checked for all currently supported scenario/difficulty combinations.
