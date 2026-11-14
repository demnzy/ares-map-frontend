# ARES-MAP Frontend (`sol-searchers-website`)

Technical overview, specification documentation, and rendered Jezero Crater terrain/RGBA hazard layer showcase for **ARES-MAP (Autonomous Reconnaissance & EVA Surface Mapping)** by **Team Sol Searchers**.

## Contents

- `index.html` — Technical documentation and showcase covering:
  - Jezero Crater Western Delta target site (`18.38°N, 77.58°E`) & HiRISE DTM (`DTEEC_045994_1985_046060_1985_U01`, `4,135.6 × 4,135.6 m`) + `45 × 45 km` regional DEM
  - 4-stage pipeline architecture (`Keplerian Ephemeris` → `PyTorch MarsEnvMLP` → `FastAPI + JezeroHazardSynthesizer` → `Godot 4 WebGL 2 Shader`)
  - `POST /api/forecast` REST contract & CPU latency benchmarks
  - `MarsEnvMLP` held-out validation metrics (mean primary `R² = 0.9088` across `503` NASA PDS validation bins) and NASA PDS Perseverance MEDA + Curiosity RAD corpus breakdown (`2,511` rows)
  - Packed 32-bit RGBA intermediary channel formulations (`R`: Thermal Cold Stress, `G`: Atmospheric Dust & Drift, `B`: Ionizing Radiation & SVF, `A`: Slope `>= 15°`) and observed Jezero landform pixel evaluations
  - 3D asset pipeline (`4096×4096` 16-bit heightmaps, `9×9` lossless ortho chunks, `.glb`/`.obj` meshes, Godot 4 `ares_terrain.gdshader` + `COOP`/`COEP` headers)
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
