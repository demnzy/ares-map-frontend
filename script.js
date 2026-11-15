(() => {
    'use strict';

    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const rand = (a, b) => a + Math.random() * (b - a);
    const ease = (t) => t * t * (3 - 2 * t);

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

    document.documentElement.classList.add('js');

    const mouse = { x: -9999, y: -9999, nx: 0.5, ny: 0.5 };
    const scroll = { y: 0, last: 0, vel: 0, e: 0 };
    const view = { w: innerWidth, h: innerHeight };

    /* =====================================================
       1. SPACE BACKGROUND
       Stars + dust + Mars ridges. The ridges rise from the
       bottom as you scroll, like dropping from orbit.
       ===================================================== */
    const canvas = $('#space');
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0;
    let stars = [], dust = [], trail = [], bursts = [];
    let shooting = null;
    let hoverCard = -1;
    const tintAmt = [0, 0, 0, 0];
    const tintColors = [[95, 212, 232], [232, 183, 85], [255, 107, 114], [237, 230, 221]];

    // diagonal hatching for the slope tint
    const hatch = document.createElement('canvas');
    hatch.width = hatch.height = 14;
    {
        const hx = hatch.getContext('2d');
        hx.strokeStyle = 'rgba(237,230,221,0.9)';
        hx.lineWidth = 1.5;
        hx.beginPath(); hx.moveTo(0, 14); hx.lineTo(14, 0); hx.stroke();
    }
    const hatchPattern = ctx.createPattern(hatch, 'repeat');

    const ridges = [
        { base: 0.70, amp: 34, f1: 0.0030, f2: 0.009, par: 10, color: 'rgba(205,104,62,0.28)' },
        { base: 0.80, amp: 40, f1: 0.0035, f2: 0.010, par: 20, color: 'rgba(158,74,46,0.50)' },
        { base: 0.89, amp: 46, f1: 0.0030, f2: 0.008, par: 36, color: 'rgba(100,47,37,0.72)' },
        { base: 0.97, amp: 40, f1: 0.0025, f2: 0.007, par: 60, color: 'rgba(40,26,28,0.95)' }
    ];

    function resizeSpace() {
        const dpr = Math.min(devicePixelRatio || 1, 2);
        W = view.w = innerWidth;
        H = view.h = innerHeight;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const starCount = Math.min(700, Math.floor((W * H) / 2200));
        stars = Array.from({ length: starCount }, () => ({
            x: rand(0, W), y: rand(0, H), z: rand(0.2, 1), r: rand(0.5, 1.6), ph: rand(0, 6.28)
        }));
        const dustCount = Math.min(130, Math.floor((W * H) / 12000));
        dust = Array.from({ length: dustCount }, () => ({
            x: rand(0, W), y: rand(0, H), r: rand(0.6, 2.2), d: rand(0.3, 1),
            vx: rand(0.15, 0.6), vy: rand(-0.05, 0.05), a: rand(0.15, 0.5)
        }));
    }

    const mix = (a, b, t) => `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;

    function drawSpace(t, step) {
        const e = scroll.e;

        // sky: black space at the top of the page, dusty Mars sky further down
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, mix([6, 9, 16], [30, 26, 36], e));
        g.addColorStop(0.6, mix([6, 9, 16], [58, 46, 52], e));
        g.addColorStop(1, mix([8, 11, 18], [120, 70, 52], e));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // stars drift, twinkle and streak when you scroll
        const starAlpha = 1 - 0.65 * e;
        const streak = clamp(Math.abs(scroll.vel) * 2.2, 0, 46);
        const dir = scroll.vel >= 0 ? 1 : -1;
        ctx.fillStyle = '#ede6dd';
        ctx.strokeStyle = '#ede6dd';
        for (const s of stars) {
            s.x += 0.4 * s.z * step - (mouse.nx - 0.5) * 0.25 * s.z * step;
            s.y += 0.03 * s.z * step;
            s.y -= scroll.dy * s.z * 0.45;
            if (s.x > W + 4) s.x = -4;
            if (s.y < -4) s.y = H + 4;
            if (s.y > H + 4) s.y = -4;
            const tw = 0.55 + 0.45 * Math.sin(t * 0.0025 + s.ph);
            ctx.globalAlpha = starAlpha * tw * (0.35 + 0.65 * s.z);
            if (streak > 3) {
                ctx.lineWidth = s.r;
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(s.x, s.y + dir * streak * s.z);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, 6.283);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;

        // an occasional shooting star while we're still up in space
        if (!shooting && e < 0.35 && Math.random() < 0.0015 * step) {
            const fromLeft = Math.random() < 0.5;
            shooting = { x: fromLeft ? rand(0, W * 0.4) : rand(W * 0.6, W), y: rand(0, H * 0.35), vx: (fromLeft ? 1 : -1) * rand(9, 13), vy: rand(3, 5), life: 1 };
        }
        if (shooting) {
            const s = shooting;
            s.x += s.vx * step; s.y += s.vy * step; s.life -= 0.022 * step;
            if (s.life <= 0) { shooting = null; }
            else {
                const lg = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 9, s.y - s.vy * 9);
                lg.addColorStop(0, `rgba(255,240,225,${s.life})`);
                lg.addColorStop(1, 'rgba(255,240,225,0)');
                ctx.strokeStyle = lg; ctx.lineWidth = 1.6;
                ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 9, s.y - s.vy * 9); ctx.stroke();
            }
        }

        // glow along the horizon once we've dropped into the atmosphere
        if (e > 0.02) {
            const hg = ctx.createRadialGradient(W / 2, H * 0.98, 0, W / 2, H * 0.98, W * 0.75);
            hg.addColorStop(0, `rgba(228,100,53,${0.26 * e})`);
            hg.addColorStop(1, 'rgba(228,100,53,0)');
            ctx.fillStyle = hg;
            ctx.fillRect(0, 0, W, H);
        }

        // hazard tint that follows the Data layers section (or the card you hover)
        const lay = $('#layers').getBoundingClientRect();
        let target = -1;
        if (hoverCard >= 0) target = hoverCard;
        else if (lay.top < H * 0.6 && lay.bottom > H * 0.4) {
            target = Math.min(2, Math.floor(clamp((H * 0.6 - lay.top) / (lay.height + H * 0.2)) * 3));
        }
        for (let i = 0; i < 3; i++) {
            tintAmt[i] = lerp(tintAmt[i], i === target ? 1 : 0, 0.06);
            const a = tintAmt[i];
            if (a < 0.01) continue;
            const c = tintColors[i];
            const spots = [[W * 0.22, H * 0.62, W * 0.5], [W * 0.82, H * 0.32, W * 0.4]];
            for (const [x, y, r] of spots) {
                const tg = ctx.createRadialGradient(x, y, 0, x, y, r);
                tg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.22 * a})`);
                tg.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
                ctx.fillStyle = tg;
                ctx.fillRect(0, 0, W, H);
            }
        }

        // Mars ridges rise from below as you scroll
        const rise = (1 - e) * 0.62;
        ridges.forEach((rg, i) => {
            const off = (mouse.nx - 0.5) * rg.par * 6 + t * 0.004 * (i + 1);
            ctx.beginPath();
            ctx.moveTo(0, H);
            for (let x = 0; x <= W + 8; x += 8) {
                const xx = x + off;
                const y = H * (rg.base + rise) +
                    Math.sin(xx * rg.f1 + i) * rg.amp +
                    Math.sin(xx * rg.f2 + i * 2.3) * rg.amp * 0.45 -
                    (mouse.ny - 0.5) * rg.par * 0.5;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(W, H);
            ctx.closePath();
            ctx.fillStyle = rg.color;
            ctx.fill();
        });

        // dust: blows faster when you scroll fast, parts around the cursor
        const gust = (1 + Math.sin(t * 0.0006) * 0.5 + Math.sin(t * 0.0017) * 0.25) * (1 + Math.abs(scroll.vel) * 0.12);
        const radius = 140;
        ctx.fillStyle = '#f0a37e';
        for (const p of dust) {
            p.x += p.vx * gust * p.d * step;
            p.y += p.vy * step - scroll.dy * p.d * 0.2;
            const dx = p.x - mouse.x, dy = p.y - mouse.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < radius * radius) {
                const d = Math.sqrt(d2) || 1;
                const f = (1 - d / radius) * 3 * p.d;
                p.x += (dx / d) * f * step;
                p.y += (dy / d) * f * step;
            }
            if (p.x > W + 10) p.x = -10;
            if (p.x < -10) p.x = W + 10;
            if (p.y > H + 10) p.y = -10;
            if (p.y < -10) p.y = H + 10;
            ctx.globalAlpha = p.a * (0.4 + 0.6 * e);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, 6.283);
            ctx.fill();
        }

        // trail left by the cursor, and click bursts
        ctx.fillStyle = '#f6b08c';
        for (let i = trail.length - 1; i >= 0; i--) {
            const p = trail[i];
            p.x += p.vx * step; p.y += p.vy * step; p.life -= 0.025 * step;
            if (p.life <= 0) { trail.splice(i, 1); continue; }
            ctx.globalAlpha = p.life * 0.6;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
        }
        for (let i = bursts.length - 1; i >= 0; i--) {
            const b = bursts[i];
            b.x += b.vx * step; b.y += b.vy * step; b.vx *= 0.96; b.vy *= 0.96; b.life -= 0.012 * step;
            if (b.life <= 0) { bursts.splice(i, 1); continue; }
            ctx.globalAlpha = b.life * 0.8;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    /* =====================================================
       2. MARS GLOBE
       Drawn pixel by pixel on a canvas, no 3D library.
       Uses images/mars.jpg if it loads, otherwise a drawn Mars.
       ===================================================== */
    const gCanvas = $('#globe');
    const gctx = gCanvas.getContext('2d');
    const N = gCanvas.width;           // 420
    const R = N / 2;
    const TW = 1024, TH = 512;         // texture size
    const TILT = -0.35;                // tips the north pole toward you
    const cosT = Math.cos(TILT), sinT = Math.sin(TILT);
    const JEZERO = { lat: 18.4 * Math.PI / 180, lon: 77.5 * Math.PI / 180 };

    let texData = null;
    let rot = JEZERO.lon - 0.5;        // centre longitude
    let rotVel = 0;
    const autoSpeed = 0.0016;
    let dragging = false;
    let teaser = 0, startHover = false;

    // precomputed for every pixel on the sphere
    const pix = [];
    const lonBase = new Float32Array(N * N);
    const vRow = new Uint16Array(N * N);
    const shade = new Float32Array(N * N);
    const rimAdd = new Float32Array(N * N);
    const edgeA = new Uint8Array(N * N);
    {
        const L = [-0.55, 0.4, 0.73];
        const ll = Math.hypot(L[0], L[1], L[2]);
        L[0] /= ll; L[1] /= ll; L[2] /= ll;
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                const nx = (x + 0.5 - R) / R, ny = -(y + 0.5 - R) / R;
                const d2 = nx * nx + ny * ny;
                if (d2 > 1) continue;
                const nz = Math.sqrt(1 - d2);
                const yy = ny * cosT - nz * sinT;
                const zz = ny * sinT + nz * cosT;
                const lat = Math.asin(clamp(yy, -1, 1));
                const i = y * N + x;
                lonBase[i] = Math.atan2(nx, zz);
                vRow[i] = clamp(Math.floor((0.5 - lat / Math.PI) * TH), 0, TH - 1);
                const lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
                shade[i] = (0.1 + 0.95 * Math.pow(lam, 0.9)) * (0.55 + 0.45 * Math.sqrt(nz));
                rimAdd[i] = Math.pow(1 - nz, 3) * (0.35 + lam) * 70;
                edgeA[i] = d2 > 0.985 ? Math.round(255 * clamp((1 - d2) / 0.015)) : 255;
                pix.push(i);
            }
        }
    }
    const gImage = gctx.createImageData(N, N);
    const gOut = gImage.data;

    // A drawn Mars so the globe never looks broken
    function makeProcedural() {
        const c = document.createElement('canvas');
        c.width = TW; c.height = TH;
        const x = c.getContext('2d');
        let s = 11;
        const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

        const base = x.createLinearGradient(0, 0, 0, TH);
        base.addColorStop(0, '#b9805e'); base.addColorStop(0.5, '#c8683f'); base.addColorStop(1, '#b4714f');
        x.fillStyle = base; x.fillRect(0, 0, TW, TH);

        const blob = (cx, cy, r, color) => {
            for (const dx of [-TW, 0, TW]) {
                const g = x.createRadialGradient(cx + dx, cy, 0, cx + dx, cy, r);
                g.addColorStop(0, color);
                g.addColorStop(1, color.replace(/,[\d.]+\)$/, ',0)'));
                x.fillStyle = g;
                x.fillRect(cx + dx - r, cy - r, r * 2, r * 2);
            }
        };
        for (let i = 0; i < 8; i++) blob(rnd() * TW, 130 + rnd() * 250, 90 + rnd() * 80, 'rgba(66,26,18,0.42)');
        for (let i = 0; i < 110; i++) blob(rnd() * TW, 50 + rnd() * 410, 25 + rnd() * 90, 'rgba(76,30,20,0.28)');
        for (let i = 0; i < 90; i++) blob(rnd() * TW, 40 + rnd() * 430, 25 + rnd() * 85, 'rgba(236,172,124,0.24)');
        for (let i = 0; i < 170; i++) {
            const cx = rnd() * TW, cy = 40 + rnd() * 430, r = 3 + rnd() * 13;
            x.beginPath(); x.arc(cx, cy, r, 0, 6.283);
            x.fillStyle = 'rgba(60,24,16,0.12)'; x.fill();
            x.strokeStyle = 'rgba(50,20,14,0.3)'; x.lineWidth = 1.4; x.stroke();
            x.beginPath(); x.arc(cx + 1, cy + 1, r, 0.3, 1.9);
            x.strokeStyle = 'rgba(255,214,180,0.22)'; x.stroke();
        }
        const capTop = x.createLinearGradient(0, 0, 0, 34);
        capTop.addColorStop(0, 'rgba(255,255,255,0.92)'); capTop.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = capTop; x.fillRect(0, 0, TW, 34);
        const capBot = x.createLinearGradient(0, TH, 0, TH - 20);
        capBot.addColorStop(0, 'rgba(255,255,255,0.85)'); capBot.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = capBot; x.fillRect(0, TH - 20, TW, 20);
        for (let i = 0; i < 9000; i++) {
            x.fillStyle = rnd() < 0.5 ? 'rgba(30,10,6,0.10)' : 'rgba(255,215,180,0.09)';
            x.fillRect(rnd() * TW, rnd() * TH, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
        }
        return x.getImageData(0, 0, TW, TH).data;
    }
    texData = makeProcedural();

    // If you add images/mars.jpg it replaces the drawn Mars.
    // (Needs Live Server or a real host. Opening the file directly blocks reading the image.)
    {
        const img = new Image();
        img.onload = () => {
            try {
                const c = document.createElement('canvas');
                c.width = TW; c.height = TH;
                const x = c.getContext('2d');
                x.drawImage(img, 0, 0, TW, TH);
                texData = x.getImageData(0, 0, TW, TH).data;
            } catch (err) {
                console.info('mars.jpg could not be read. Open the site with Live Server to use it. Using the drawn Mars for now.');
            }
        };
        img.src = 'images/mars.jpg';
    }

    function renderGlobe() {
        const td = texData;
        const inv = 1 / (Math.PI * 2);
        for (let k = 0; k < pix.length; k++) {
            const p = pix[k];
            let u = (lonBase[p] + rot) * inv + 0.5;
            u -= Math.floor(u);
            const ti = (vRow[p] * TW + ((u * TW) | 0)) * 4;
            const sh = shade[p], rim = rimAdd[p], o = p * 4;
            gOut[o] = td[ti] * sh + rim;
            gOut[o + 1] = td[ti + 1] * sh + rim * 0.4;
            gOut[o + 2] = td[ti + 2] * sh + rim * 0.15;
            gOut[o + 3] = edgeA[p];
        }
        gctx.putImageData(gImage, 0, 0);

        // hovering START lights up the four hazard layers on the surface
        if (teaser > 0.02) {
            gctx.save();
            gctx.globalCompositeOperation = 'source-atop';
            const blobs = [
                [N * 0.30, N * 0.28, N * 0.36, '95,212,232'],
                [N * 0.30, N * 0.74, N * 0.32, '232,183,85'],
                [N * 0.74, N * 0.34, N * 0.34, '255,107,114']
            ];
            for (const [x, y, r, c] of blobs) {
                const g = gctx.createRadialGradient(x, y, 0, x, y, r);
                g.addColorStop(0, `rgba(${c},${0.55 * teaser})`);
                g.addColorStop(1, `rgba(${c},0)`);
                gctx.fillStyle = g;
                gctx.fillRect(0, 0, N, N);
            }
            gctx.restore();
        }
    }

    // Jezero marker follows its spot on the globe
    const jez = $('#jezero');
    const globeWrap = $('#globeWrap');
    function placeJezero() {
        const a = JEZERO.lon - rot;
        const x = Math.cos(JEZERO.lat) * Math.sin(a);
        const z = Math.cos(JEZERO.lat) * Math.cos(a);
        const y = Math.sin(JEZERO.lat);
        const ys = y * cosT + z * sinT;
        const zs = -y * sinT + z * cosT;
        if (zs < 0.12) { jez.style.display = 'none'; return; }
        const size = globeWrap.clientWidth;
        jez.style.display = 'flex';
        jez.style.opacity = clamp((zs - 0.12) / 0.25);
        jez.style.transform = `translate(${(1 + x) / 2 * size}px, ${(1 - ys) / 2 * size}px)`;
    }

    // drag to spin
    let lastX = 0;
    globeWrap.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.start')) return;
        dragging = true;
        lastX = e.clientX;
        globeWrap.setPointerCapture(e.pointerId);
    });
    globeWrap.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        lastX = e.clientX;
        rot -= dx * 0.007;
        rotVel = -dx * 0.007;
    });
    const endDrag = () => { dragging = false; };
    globeWrap.addEventListener('pointerup', endDrag);
    globeWrap.addEventListener('pointercancel', endDrag);

    const startBtn = $('#start');
    startBtn.addEventListener('pointerenter', () => { startHover = true; });
    startBtn.addEventListener('pointerleave', () => { startHover = false; });
    startBtn.addEventListener('focus', () => { startHover = true; });
    startBtn.addEventListener('blur', () => { startHover = false; });

    /* =====================================================
       3. POINTER INTERACTION (NATIVE CURSOR + DUST/BURSTS)
       ===================================================== */
    let lastTrail = { x: 0, y: 0 };

    window.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        mouse.x = e.clientX; mouse.y = e.clientY;
        mouse.nx = e.clientX / view.w; mouse.ny = e.clientY / view.h;

        if (!reduce && Math.hypot(e.clientX - lastTrail.x, e.clientY - lastTrail.y) > 9) {
            lastTrail = { x: e.clientX, y: e.clientY };
            trail.push({ x: e.clientX, y: e.clientY, vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3), r: rand(0.8, 1.8), life: 1 });
            if (trail.length > 60) trail.shift();
        }
    }, { passive: true });

    document.documentElement.addEventListener('mouseleave', () => {
        mouse.x = mouse.y = -9999;
        mouse.nx = mouse.ny = 0.5;
    });

    window.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        const ping = document.createElement('div');
        ping.className = 'ping';
        ping.style.left = e.clientX + 'px';
        ping.style.top = e.clientY + 'px';
        ping.addEventListener('animationend', () => ping.remove());
        document.body.appendChild(ping);
        if (reduce) return;
        for (let i = 0; i < 20; i++) {
            const a = Math.random() * 6.283, sp = rand(1.5, 5);
            bursts.push({ x: e.clientX, y: e.clientY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, r: rand(0.8, 2.4) });
        }
        if (bursts.length > 300) bursts.splice(0, bursts.length - 300);
    });


    const heroHead = $('#heroHead');
    const heroStage = $('#heroStage');
    const nav = $('#nav');
    const routeLine = $('#routeLine');
    const routeDot = $('#routeDot');
    const routePath = routeLine;
    let routeLen = 0;
    try { routeLen = routePath.getTotalLength(); } catch (err) { routeLen = 0; }

    function updateScroll() {
        const y = window.scrollY;
        scroll.dy = y - scroll.last;
        scroll.last = y;
        scroll.vel = lerp(scroll.vel, scroll.dy, 0.2);
        scroll.y = y;
        scroll.e = ease(clamp(y / (view.h * 1.1)));

        // the globe shrinks away as you drop toward the surface
        const h1 = clamp(y / (view.h * 0.8));
        heroStage.style.transform = `translateY(${-h1 * 70}px) scale(${1 - h1 * 0.3})`;
        heroStage.style.opacity = String(clamp(1 - h1 * 1.2));
        heroHead.style.transform = `translateY(${-h1 * 50}px)`;
        heroHead.style.opacity = String(clamp(1 - h1 * 1.4));
        scroll.hero = h1;

        nav.classList.toggle('solid', y > view.h * 0.6);

        // route line fills as you read down the page
        const max = Math.max(1, document.documentElement.scrollHeight - view.h);
        const p = clamp(y / max);
        routeLine.style.strokeDashoffset = String(1 - p);
        if (routeLen) {
            const pt = routePath.getPointAtLength(p * routeLen);
            routeDot.style.left = pt.x + 'px';
            routeDot.style.top = (pt.y / 1000 * view.h) + 'px';
        } else {
            routeDot.style.top = (p * 100) + '%';
        }
    }

    let lastT = performance.now();
    let canvasesPaused = false;
    let rafId = 0;

    function frame(t) {
        if (canvasesPaused) {
            rafId = 0;
            return;
        }
        const step = clamp((t - lastT) / 16.67, 0, 3);
        lastT = t;
        updateScroll();

        if (!reduce) {
            if (!dragging) rotVel = lerp(rotVel, -autoSpeed, 0.03);
            rot += dragging ? 0 : rotVel;
        }
        teaser = lerp(teaser, startHover ? 1 : 0, 0.08);

        drawSpace(t, step);
        if (scroll.hero < 0.98) { renderGlobe(); placeJezero(); }
        if (!reduce) rafId = requestAnimationFrame(frame);
    }

    window.setAresCanvasesPaused = (paused) => {
        canvasesPaused = Boolean(paused);
        if (canvasesPaused) {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = 0;
            }
        } else if (!reduce && !rafId) {
            lastT = performance.now();
            rafId = requestAnimationFrame(frame);
        }
    };

    function resize() {
        resizeSpace();
        if (reduce) frame(performance.now());
    }
    window.addEventListener('resize', resize);
    resize();

    if (reduce) {
        window.addEventListener('scroll', () => { if (!canvasesPaused) requestAnimationFrame(frame); }, { passive: true });
        frame(performance.now());
    } else {
        rafId = requestAnimationFrame(frame);
    }


    // fade sections in as they come into view
    const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
            if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
    }, { threshold: 0.12 });
    $$('.reveal').forEach((el) => io.observe(el));

    // hovering a layer card changes the sky tint
    $$('.card[data-tint]').forEach((card) => {
        const i = Number(card.dataset.tint);
        card.addEventListener('pointerenter', () => { hoverCard = i; });
        card.addEventListener('pointerleave', () => { hoverCard = -1; });
    });

    // simulator image tabs
    const tabs = $$('.sim-tab');
    const slides = $$('.slide');
    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            tabs.forEach((t) => {
                const on = t === tab;
                t.classList.toggle('is-active', on);
                t.setAttribute('aria-pressed', String(on));
            });
            slides.forEach((s) => s.classList.toggle('is-active', s.dataset.slide === tab.dataset.slide));
        });
    });
    // show a dashed placeholder until the image file is found
    slides.forEach((slide) => {
        const img = $('img', slide);
        if (!img) return;
        const ok = () => slide.classList.add('has-img');
        img.addEventListener('load', ok);
        img.addEventListener('error', () => slide.classList.remove('has-img'));
        if (img.complete && img.naturalWidth > 0) ok();
    });

    // three-spots meters, built from each card's data-v (R, G, B x100)
    const rows = [
        ['R', 'Thermal', '#7fdcec'],
        ['G', 'Dust', '#e8b755'],
        ['B', 'Radiation', '#ff8a90']
    ];
    $$('.spot').forEach((spot) => {
        if (!spot.dataset.v) return;
        const vals = spot.dataset.v.split(',').map(Number);
        const list = $('.meters', spot);
        rows.forEach(([letter, name, color], i) => {
            const v = vals[i];
            const level = v >= 70 ? 'High' : v >= 40 ? 'Medium' : 'Low';
            const li = document.createElement('li');
            li.style.setProperty('--c', color);
            li.innerHTML = `<b>${letter}</b><span>${name}</span><span class="bar"><i style="width:${v}%"></i></span><span class="lvl${v >= 70 ? ' high' : ''}">${level}</span>`;
            list.appendChild(li);
        });
    });
})();