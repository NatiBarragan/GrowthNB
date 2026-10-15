# US Robotics Ecosystem Atlas — data schema (v1)

All research files are JSON arrays or objects written to `atlas/data/research/`.
Verification date for everything gathered in this pass: "2026-10-15".

## IDs
`id` = lowercase slug of the common organization name, words joined by hyphens, no legal suffixes.
Canonical IDs for frequently referenced entities (USE THESE EXACTLY):
nvidia, google-deepmind, google, alphabet, openai, microsoft, amazon, meta, tesla, intel, qualcomm, physical-intelligence,
skild-ai, field-ai, intrinsic, hugging-face, toyota-research-institute, boston-dynamics, hyundai, figure-ai, agility-robotics,
apptronik, 1x-technologies, sanctuary-ai, robot-com, serve-robotics, starship-technologies, coco-robotics, nuro, cartken,
locus-robotics, symbotic, berkshire-grey, dexterity, ambi-robotics, covariant, abb, fanuc, universal-robots, teradyne, kuka,
yaskawa, mit, stanford, carnegie-mellon-university, uc-berkeley, georgia-tech, university-of-michigan, university-of-pennsylvania,
university-of-washington, caltech, andreessen-horowitz, sequoia-capital, khosla-ventures, eclipse-ventures, dcvc, lux-capital,
thrive-capital, softbank, bezos-expeditions, parkway-venture-capital, intel-capital, nvidia-nventures (use `nvidia` for NVIDIA's investments),
amazon-industrial-innovation-fund, samsung, lg, uber, doordash, walmart, ford, gm, harmonic-drive, maxon, ati-industrial-automation,
ouster, velodyne (merged into ouster), luminar, hesai, intel-realsense, orbbec, stereolabs, sony, ambarella, texas-instruments, nxp,
analog-devices, infineon, foxconn, jabil, zebra-technologies, schunk, robotiq, onrobot, mass-robotics, a3 (Association for Advancing Automation).

## Organization record
{
  "id": "figure-ai",
  "name": "Figure AI",
  "kind": "robotics" | "ai" | "supplier" | "research" | "investor" | "enabler",
  "website": "https://...",
  "hq_city": "San Jose", "hq_state": "CA",            // US HQ or main US office; for non-US HQ give US office and set "hq_country"
  "hq_country": "US",
  "lat": 37.34, "lon": -121.89,                        // city-level centroid of hq_city (approximate city coordinates, NOT street-level)
  "founded": 2022,                                     // number or null
  "segment": "Humanoid",                               // see segment list
  "subsegment": "General-purpose humanoid",
  "product": "Figure 03",
  "robot_type": "Humanoid" | "AMR" | "Sidewalk delivery robot" | "Quadruped" | "Industrial arm" | "Cobot" | "Drone" | "Surgical system" | ... | null,
  "ai_approach": "VLA (Helix)" | "Classical autonomy" | ... | null,
  "models": ["helix"],                                 // model ids, only when verified
  "stage": "Startup" | "Growth" | "Public" | "Acquired" | "Subsidiary" | "Corporate" | "Nonprofit" | "Academic" | "Government",
  "ticker": null,
  "funding_usd": 1900000000,                           // total publicly disclosed funding in USD or null
  "funding_note": "Series C $1B+ at $39B post (Sep 2025), company-reported",
  "investors": ["parkway-venture-capital", "nvidia"],  // IDs, only publicly disclosed
  "customers": ["BMW Manufacturing"],                  // publicly disclosed customers / pilots (strings)
  "deployment": "Commercial" | "Pilot" | "Prototype" | "Research" | "N/A" | "Unknown",
  "deployment_note": "Pilot at BMW Spartanburg (company-reported)",
  "suppliers": [],                                     // IDs, only confirmed
  "tags": ["startup", "physical-ai"],
  "summary": "One factual sentence.",
  "sources": [{"url": "https://...", "label": "Company site"}],   // >=1 required
  "confidence": "verified" | "company-reported" | "third-party-estimate" | "analyst",
  "verified": "2026-10-15"
}
Segments (use exactly): Humanoid, Delivery & Last-Mile, Warehouse & Logistics, Industrial, Physical AI & General-Purpose,
Healthcare & Medical, Agriculture, Construction & Infrastructure, Service & Commercial, Drones & Autonomous Systems,
Quadrupeds & Mobile Platforms, Robotics Software & Tools, Components & Hardware, Compute & Semiconductors,
Research, Investor, Accelerator & Enabler, Defense & Security.

## Relationship record (file key "relationships")
{ "from": "parkway-venture-capital", "to": "figure-ai",
  "type": "invests" | "supplies" | "uses_model" | "develops" | "spinout" | "partnership" | "acquisition" | "customer" | "exhibits" | "speaks" | "research_collab",
  "note": "Led Series C (Sep 2025)", "source": "https://...", "confidence": "verified" | "company-reported" }

## Model record
{ "id": "pi0", "name": "π0", "developer": "physical-intelligence", "released": "2024-10",
  "category": "VLA" | "VLM" | "World model" | "Robot foundation model" | "Simulation" | "Navigation" | "RL framework" | "Dataset" | "OS/Middleware" | "Fleet mgmt" | "Teleoperation" | "Benchmark",
  "embodiments": ["single-arm", "bimanual", "mobile manipulator"], "license": "open-weights" | "open-source" | "proprietary",
  "docs": "https://...", "integrations": ["..."], "capabilities": "short factual text",
  "availability": "Research" | "Open release" | "Commercial" | "Internal", "sources": [{"url":..., "label":...}], "verified": "2026-10-15" }

## Funding round record
{ "org": "figure-ai", "date": "2025-09", "round": "Series C", "amount_usd": 1000000000, "lead": "parkway-venture-capital",
  "investors": ["nvidia"], "note": "", "source": "https://...", "confidence": "company-reported" }

## Event record
{ "id": "automate-2026", "name": "Automate 2026", "organizer": "A3", "website": "https://...",
  "start": "2026-06-22", "end": "2026-06-25", "city": "Detroit", "state": "MI", "venue": "Huntington Place",
  "lat": 42.33, "lon": -83.05, "category": "Trade show" | "Conference" | "Academic" | "Summit" | "Investor/Startup" | "Developer",
  "topics": ["industrial automation", "humanoids"], "audience": "...", "exhibit": "Yes – exhibitor booking via ..." | null,
  "sponsorship": "Yes" | null, "registration": "https://...", "speakers_sponsors": "notable confirmed names (orgs) or null",
  "status": "Confirmed" | "Tentative" | "Historical" | "Date TBA",
  "scores": { "bizdev": 1-5, "partnership": 1-5, "investor": 1-5, "technical": 1-5, "brand": 1-5, "competitive": 1-5, "customer": 1-5 },
  "source": "https://...", "verified": "2026-10-15" }
