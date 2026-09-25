# Specly

A guided engineering project studio for portfolio work, internship applications and job interviews. Choose a category and difficulty, receive a bounded project brief, tune a design, run analytical verification, keep revisions, and export a project report.

## Demo on GitHub Pages

1. Create a GitHub repository and upload the contents of this project, including `dist/` and `.github/workflows/deploy.yml`.
2. Use `main` as the default branch.
3. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
4. Push a commit or run **Actions → Deploy Specly demo to GitHub Pages → Run workflow**.
5. The workflow shows the public site URL after deployment. Relative asset URLs support a repository subpath.

The `.openai/hosting.json` file is specific to the provided preview and is omitted from the portable ZIP. You do not need it on GitHub.

## Launch the subscription version

The commercial implementation is in `server/`, with its Supabase schema in `migrations/` and account screens in `dist/commerce.html`. It uses verified email and phone, one account per claimed phone, a 3-day card-required trial, and Stripe US$15/month billing. It is **not activated**: accounts, credentials, policies, and provider-backed acceptance tests are still required.

Read [the complete launch guide](docs/SUBSCRIPTION_LAUNCH.md). Copy `.env.example` to `.env`, configure the providers and apply the migration, then run `npm start`. An included Dockerfile supports a Node/container host connected to your GitHub repository. Do not put secrets in the frontend or GitHub Pages.

## Run locally

Use Node 22.13 or newer. `npm ci` installs the optional development server. `npm run dev` starts it. Alternatively, `python3 -m http.server 8000 --directory dist` serves the production files without installing anything. Open the printed localhost URL. Do not open index.html directly with file:// because ES modules need HTTP.

`npm test` runs independent calculation benchmarks, physical trends, feasibility checks for all 27 variants, and invalid-input tests. `npm run check` checks JavaScript syntax. The GitHub workflow installs dependencies to run both model and subscription boundary tests. Pages hosts only the demo.

## Included

- Three genuine calculation families: rectangular cantilever supports, linear base-excited spring–damper isolation, and two-face convection from a flat plate.
- 45 member project briefs: 15 beginner, 15 intermediate, and 15 advanced. Each level contains five structural, five vibration, and five thermal studies with distinct application briefs and numerical requirements. Legacy saved missions remain compatible.
- Parameter inputs, live estimates, engineering schematics, response plots, pass/fail checks, guidance, equations, and limitations.
- Test revision history, restoration, device-local projects, JSON export/import, and an HTML report with browser print-to-PDF.
- Optional measured-versus-predicted comparison and user-authored engineering rationale.
- Responsive layouts, semantic controls, keyboard focus, reduced-motion support, and progressive WebMCP integration where supported.

## Honest boundaries

This is a functional static first release, not a full commercial SaaS backend. Mission generation is template-based and does not call an LLM. The public demo offers exactly three fixed samples (structures/beginner, vibration/intermediate, thermal/advanced), each with three preset choices. It has no saving, persistence, import, export, test history, or report generation. The full studio is outside the public directory and requires an entitled account on the Node server. The static demo has no sign-in or payment processing. The separate Node server includes subscription/authentication integration code, awaiting provider setup and end-to-end testing. There is no cloud project synchronization, CAD upload/FEA, or certified design approval. Browser storage can be cleared; export project files for backups. No secret API keys belong in this frontend.

For subscriptions, deploy the included Node server; follow docs/SUBSCRIPTION_LAUNCH.md. GitHub Pages alone cannot run it. To add AI, use a server-side endpoint with a secret API key; constrain generated briefs to supported model schemas, check feasibility, and keep numerical evaluation deterministic. Do not describe template generation as AI in product marketing.

A model pass is a pass only under the explicit assumptions. Static beam checks exclude joints, self-weight, fatigue, impact, torsion, and buckling. The mount model excludes nonlinear behavior and shocks. The cooling model assumes uniform heat input and two unobstructed faces with a fixed convection coefficient; it does not resolve hot spots, radiation, or spreading. Material values are typical educational values, not certified allowables.

## Project structure

- `dist/index.html`: app entry and metadata.
- `dist/style.css`: shared visual design and responsive rules.
- `studio/engine.js`: mission templates, material properties, input validation, deterministic calculations.
- `studio/app.js`: interface, persistence, plots, reports, imports and exports.
- `tests/engine.test.mjs`: independent model tests.
- `.github/workflows/deploy.yml`: GitHub Pages deployment.
- `MODEL_NOTES.md`: equations, assumptions, extension requirements.

## Privacy

Projects remain in this browser unless the user downloads or imports a file. The application makes no AI requests and has no analytics. Google Fonts is an external font dependency; system fallbacks are supplied. Before a commercial launch, publish terms and a privacy policy appropriate to your actual hosting and billing setup.

## Verification status

See `docs/VERIFICATION.md` for completed checks and the remaining browser download, mobile, and WebMCP verification limits. The verification notes distinguish local tests from uncompleted provider-backed acceptance testing.
