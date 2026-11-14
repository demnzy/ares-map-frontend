(() => {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const pointer = { x: 0.5, y: 0.5, px: -9999, py: -9999 };
    const smooth = { x: 0.5, y: 0.5 };
    const rand = (a, b) => a + Math.random() * (b - a);

    /* ================= Background: dust + ridgelines ================= */
    const canvas = document.getElementById('bg');
    const ctx = canvas.getContext('2d');

    let w = 0, h = 0, dpr = 1;
    let particles = [];
    let bursts = [];
    let last = performance.now();

    function makeParticle() {
        return {
            x: rand(0, w),
            y: rand(0, h),
            r: rand(0.6, 2.2),
            depth: rand(0.3, 1),
            vx: rand(0.15, 0.6),
            vy: rand(-0.05, 0.05),
            a: rand(0.15, 0.55)
        };
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const count = Math.min(220, Math.floor((w * h) / 9000));
        particles = Array.from({ length: count }, makeParticle);
        if (reduceMotion) draw(0);
    }

    const ridges = [
        { base: 0.60, amp: 34, f1: 0.0030, f2: 0.009, par: 10, color: 'rgba(205, 104, 62, 0.28)' },
        { base: 0.70, amp: 40, f1: 0.0035, f2: 0.010, par: 20, color: 'rgba(158, 74, 46, 0.50)' },
        { base: 0.81, amp: 46, f1: 0.0030, f2: 0.008, par: 36, color: 'rgba(100, 47, 37, 0.72)' },
        { base: 0.92, amp: 40, f1: 0.0025, f2: 0.007, par: 60, color: 'rgba(40, 26, 28, 0.95)' }
    ];

    function drawRidges(t) {
        ridges.forEach((rg, i) => {
            const off = (smooth.x - 0.5) * rg.par * 6 + t * 0.004 * (i + 1);
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let x = 0; x <= w + 8; x += 8) {
                const xx = x + off;
                const y =
                    h * rg.base +
                    Math.sin(xx * rg.f1 + i) * rg.amp +
                    Math.sin(xx * rg.f2 + i * 2.3) * rg.amp * 0.45 -
                    (smooth.y - 0.5) * rg.par * 0.5;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fillStyle = rg.color;
            ctx.fill();
        });
    }

    function drawDust(step, t) {
        const gust = 1 + Math.sin(t * 0.0006) * 0.5 + Math.sin(t * 0.0017) * 0.25;
        const radius = 140;
        ctx.fillStyle = '#f0a37e';

        for (const p of particles) {
            p.x += p.vx * gust * p.depth * step;
            p.y += p.vy * step;

            const dx = p.x - pointer.px;
            const dy = p.y - pointer.py;
            const d2 = dx * dx + dy * dy;
            if (d2 < radius * radius) {
                const d = Math.sqrt(d2) || 1;
                const f = (1 - d / radius) * 3 * p.depth;
                p.x += (dx / d) * f * step;
                p.y += (dy / d) * f * step;
            }

            if (p.x > w + 10) p.x = -10;
            if (p.x < -10) p.x = w + 10;
            if (p.y > h + 10) p.y = -10;
            if (p.y < -10) p.y = h + 10;

            ctx.globalAlpha = p.a;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawBursts(step) {
        ctx.fillStyle = '#f6b08c';
        for (let i = bursts.length - 1; i >= 0; i--) {
            const b = bursts[i];
            b.x += b.vx * step;
            b.y += b.vy * step;
            b.vx *= 0.96;
            b.vy *= 0.96;
            b.life -= 0.012 * step;
            if (b.life <= 0) { bursts.splice(i, 1); continue; }
            ctx.globalAlpha = b.life * 0.8;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function draw(t) {
        const dt = Math.min(Math.max(t - last, 0), 50);
        last = t;
        const step = dt / 16.67;

        smooth.x += (pointer.x - smooth.x) * 0.05;
        smooth.y += (pointer.y - smooth.y) * 0.05;

        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#27313b');
        g.addColorStop(0.5, '#343a42');
        g.addColorStop(0.72, '#6a4234');
        g.addColorStop(1, '#2a1b1c');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        drawRidges(t);
        drawDust(step, t);
        drawBursts(step);
    }

    /* ================= Custom cursor + sun parallax ================= */
    const ring = document.getElementById('cursorRing');
    const dot = document.getElementById('cursorDot');
    const sun = document.getElementById('sun');

    const ringPos = { x: -100, y: -100 };
    const sunPos = { x: 0, y: 0 };

    function updateUI() {
        // Cursor ring trails the real pointer slightly
        ringPos.x += (pointer.px - ringPos.x) * 0.22;
        ringPos.y += (pointer.py - ringPos.y) * 0.22;
        if (ring) ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
        if (dot) dot.style.transform = `translate3d(${pointer.px}px, ${pointer.py}px, 0)`;

        // The whole sun drifts toward the cursor. Nothing inside it animates.
        if (sun && !reduceMotion) {
            const tx = pointer.px < 0 ? 0 : (pointer.x - 0.5) * 48;
            const ty = pointer.py < 0 ? 0 : (pointer.y - 0.5) * 36;
            sunPos.x += (tx - sunPos.x) * 0.06;
            sunPos.y += (ty - sunPos.y) * 0.06;
            sun.style.transform = `translate3d(${sunPos.x.toFixed(2)}px, ${sunPos.y.toFixed(2)}px, 0)`;
        }
    }

    function loop(t) {
        draw(t);
        updateUI();
        requestAnimationFrame(loop);
    }

    window.addEventListener('resize', resize);
    resize();

    if (finePointer) {
        document.documentElement.classList.add('has-cursor');
    }

    window.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        pointer.x = e.clientX / w;
        pointer.y = e.clientY / h;
        pointer.px = e.clientX;
        pointer.py = e.clientY;
        if (ring && dot) {
            ring.classList.add('is-visible');
            dot.classList.add('is-visible');
        }
        const onLink = e.target.closest && e.target.closest('a, button');
        if (ring) ring.classList.toggle('is-hover', !!onLink);
    }, { passive: true });

    document.documentElement.addEventListener('mouseleave', () => {
        pointer.px = -9999;
        pointer.py = -9999;
        pointer.x = 0.5;
        pointer.y = 0.5;
        if (ring && dot) {
            ring.classList.remove('is-visible');
            dot.classList.remove('is-visible');
        }
    });

    window.addEventListener('pointerdown', (e) => {
        if (ring) ring.classList.add('is-down');
        if (reduceMotion) return;
        for (let i = 0; i < 22; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = rand(1.5, 5);
            bursts.push({
                x: e.clientX, y: e.clientY,
                vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                life: 1, r: rand(0.8, 2.4)
            });
        }
        if (bursts.length > 400) bursts.splice(0, bursts.length - 400);
    });
    window.addEventListener('pointerup', () => {
        if (ring) ring.classList.remove('is-down');
    });

    if (!reduceMotion) {
        requestAnimationFrame(loop);
    } else {
        requestAnimationFrame(updateUI);
        window.addEventListener('pointermove', updateUI, { passive: true });
    }

    /* ================= Simulator image tabs ================= */
    const tabs = document.querySelectorAll('.sim-tab');
    const slides = document.querySelectorAll('.slide');

    function showSlide(name) {
        tabs.forEach((tab) => {
            const on = tab.dataset.slide === name;
            tab.classList.toggle('is-active', on);
            tab.setAttribute('aria-pressed', String(on));
        });
        slides.forEach((slide) => {
            slide.classList.toggle('is-active', slide.dataset.slide === name);
        });
    }

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => showSlide(tab.dataset.slide));
    });

    // Show the placeholder until the image file actually loads
    slides.forEach((slide) => {
        const img = slide.querySelector('img');
        if (!img) return;
        const ok = () => slide.classList.add('has-img');
        const fail = () => slide.classList.remove('has-img');
        img.addEventListener('load', ok);
        img.addEventListener('error', fail);
        if (img.complete && img.naturalWidth > 0) ok();
    });
})();