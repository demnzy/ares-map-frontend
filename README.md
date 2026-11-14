# ARES-MAP Frontend (`sol-searchers-website`)

Mission briefing, data references, technical specifications, and rendered Jezero Crater terrain/RGBA hazard layer showcase for **ARES-MAP (Autonomous Reconnaissance & EVA Surface Mapping)** by **Team Sol Searchers** for the 2026 NASA Space Apps Challenge (*"Interplanetary Survival Guide: Martian Map"*).

## Contents

- `index.html` — Progressive-disclosure site pairing a plain-English Marswalk entry flow with complete engineering specs:
  - 5 layered NASA data types (**Optical**, **Topographic**, **Thermal**, **Atmospheric/Wind/Dust**, **Radiation**) focused on Jezero Crater's western delta (`18.38°N, 77.58°E`, `4,135.6 × 4,135.6 m`) plus a `45 × 45 km` procedural crater context model
  - Science objectives & 3D crew interfaces (habitat briefing console, field tablet, visor HUD) with 15° spacesuit slope limits and obstacle-avoidance path planning
  - 4-stage pipeline architecture (`Keplerian Ephemeris` -> `PyTorch MarsEnvMLP` -> `FastAPI + JezeroHazardSynthesizer` -> `3D Terrain Shaders & Route Planner`)
  - Clear references and external links to NASA sources: MRO HiRISE stereo DTM `DTEEC_045994_1985_046060_1985_U01.IMG` & orthoimage `ESP_046060_1985_RED_C_01_ORTHO.JP2`, Perseverance MEDA PDS4 (`CAL_TIRS`, `DER_PS`, `DER_WS`), Curiosity RAD PDS3 (`MSL-M-RAD-3-RDR-V1.0`), JPL Mars Trek, and the USGS-NASA Planetary Geologic Mapping Program
  - `POST /api/forecast` REST contract, CPU latency benchmarks, and `MarsEnvMLP` held-out validation metrics (mean primary `R² = 0.9088` across `503` test samples; `2,511` aligned training rows)
  - Packed 32-bit RGBA channel descriptions (`R`: Cold, `G`: Dust, `B`: Radiation, `A`: Slope >= 15°) and three real Jezero Crater site evaluations
  - 3D asset pipeline (`4096×4096` 16-bit heightmaps, `9×9` lossless ortho chunks, `.glb`/`.obj` meshes, WebGL 2 shader integration)
- `style.css` & `script.js` — Dark Martian HUD theme, animated ridgeline/dust canvas, custom desktop cursor, and interactive layer viewer tabs.
- `images/` — Real `1600×900` rendered visualizations generated directly from the backend HiRISE DTM, `MarsWeatherPredictor`, `JezeroHazardSynthesizer`, and held-out validation plot:
  - `terrain.png`
  - `thermal.png`
  - `dust.png`
  - `radiation.png`
  - `slope.png`
  - `ml_validation.png`

## Local Preview

```bash
python -m http.server 8090
```

Then open `http://localhost:8090` in a browser.
