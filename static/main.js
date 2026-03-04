/**
 * ══════════════════════════════════════════════════════════════
 * StraveX '26 — main.js  (FINAL)
 * Invisible Problems. Intelligent Solutions.
 *
 * TABLE OF CONTENTS
 * ─────────────────
 * 1.  Dynamic Background Canvas — animated particles & nebula
 * 2.  Scroll Progress Bar
 * 3.  Navbar — scroll state, active link, hamburger
 * 4.  Intersection Observer — fade-up / fade-in animations
 * 5.  Timeline Line Animation
 * 6.  Tabs — Rules & Eligibility
 * 7.  Judging Criteria — Progress Bar Animation
 * 8.  Dynamic Team Members — add / remove
 * 9.  Registration Form — validation & submission
 *
 * Flask Integration
 * ─────────────────
 * Form posts to:  POST /register
 * Expected JSON:  { "success": true, "team_id": "STRX26-014", "message": "..." }
 * ══════════════════════════════════════════════════════════════
 */

'use strict';


/* ─────────────────────────────────────────────────────────────
   1. DYNAMIC BACKGROUND CANVAS
   Renders a continuous animated scene with:
   - Drifting glow blobs (purple / indigo / blue)
   - Floating particles connected by faint lines
   - Subtle aurora wave at the bottom
   Works for both index.html and all track pages.
───────────────────────────────────────────────────────────── */
(function initBackground() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, raf;
  let mouse = { x: -9999, y: -9999 };

  /* ── Resize ── */
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  /* ── Subtle mouse parallax ── */
  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });

  /* ── NEBULA BLOBS ── */
  const BLOBS = [
    { x: 0.65, y: 0.20, r: 0.55, color: [59,  130, 246], speed: 0.00015, phase: 0.0  },
    { x: 0.18, y: 0.70, r: 0.48, color: [124,  58, 237], speed: 0.00012, phase: 1.5  },
    { x: 0.85, y: 0.65, r: 0.38, color: [79,   70, 229], speed: 0.00018, phase: 3.0  },
    { x: 0.35, y: 0.30, r: 0.32, color: [139,  92, 246], speed: 0.00010, phase: 4.5  },
    { x: 0.50, y: 0.85, r: 0.42, color: [59,  130, 246], speed: 0.00014, phase: 2.0  },
  ];

  /* ── PARTICLES ── */
  const PARTICLE_COUNT = 80;
  const particles = [];

  class Particle {
    constructor() { this.reset(true); }
    reset(init) {
      this.x  = Math.random() * W;
      this.y  = init ? Math.random() * H : -10;
      this.vx = (Math.random() - 0.5) * 0.18;
      this.vy = Math.random() * 0.25 + 0.05;
      this.r  = Math.random() * 1.6 + 0.4;
      this.alpha = Math.random() * 0.4 + 0.1;
      this.life  = 0;
      this.maxLife = Math.random() * 600 + 400;
      // Colour: mix of blue / purple / white
      const palette = [
        [148, 163, 255],
        [167, 139, 250],
        [255, 255, 255],
        [99,  102, 241],
        [59,  130, 246],
      ];
      this.color = palette[Math.floor(Math.random() * palette.length)];
    }
    update() {
      this.x  += this.vx;
      this.y  += this.vy;
      this.life++;
      // Mouse repulsion (very gentle)
      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        const force = (120 - dist) / 120 * 0.012;
        this.x += dx * force;
        this.y += dy * force;
      }
      if (this.y > H + 10 || this.life > this.maxLife) this.reset(false);
    }
    draw() {
      const fade = Math.min(1, this.life / 80, (this.maxLife - this.life) / 80);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color[0]},${this.color[1]},${this.color[2]},${this.alpha * fade})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

  /* ── CONNECTION LINES ── */
  const CONNECT_DIST = 110;
  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i], p2 = particles[j];
        const dx = p1.x - p2.x, dy = p1.y - p2.y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < CONNECT_DIST) {
          const alpha = (1 - d / CONNECT_DIST) * 0.06;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(99,102,241,${alpha})`;
          ctx.lineWidth   = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  /* ── AURORA WAVE ── */
  function drawAurora(t) {
    const y0  = H * 0.78;
    const amp = 40;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      const y = y0
        + Math.sin(x * 0.004 + t * 0.0006) * amp
        + Math.sin(x * 0.007 + t * 0.0004) * (amp * 0.5);
      if (x === 0) ctx.lineTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, y0 - amp, 0, H);
    grad.addColorStop(0, 'rgba(79,70,229,0.05)');
    grad.addColorStop(0.5, 'rgba(59,130,246,0.03)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  /* ── RENDER LOOP ── */
  let t = 0;
  function render() {
    raf = requestAnimationFrame(render);
    t++;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Nebula blobs
    BLOBS.forEach(b => {
      const ox = Math.sin(t * b.speed + b.phase) * 60;
      const oy = Math.cos(t * b.speed * 0.7 + b.phase) * 40;
      const cx = b.x * W + ox;
      const cy = b.y * H + oy;
      const r  = b.r * Math.min(W, H);
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grd.addColorStop(0,   `rgba(${b.color[0]},${b.color[1]},${b.color[2]},0.07)`);
      grd.addColorStop(0.5, `rgba(${b.color[0]},${b.color[1]},${b.color[2]},0.025)`);
      grd.addColorStop(1,   `rgba(${b.color[0]},${b.color[1]},${b.color[2]},0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    });

    // Aurora
    drawAurora(t);

    // Connections + particles
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });
  }

  render();

  // Pause when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else render();
  });
})();


/* ─────────────────────────────────────
   2. SCROLL PROGRESS BAR
───────────────────────────────────── */
(function initProgressBar() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  function update() {
    const scrolled = window.scrollY;
    const total    = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (total > 0 ? (scrolled / total) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', update, { passive: true });
})();


/* ─────────────────────────────────────
   3. NAVBAR
───────────────────────────────────── */
(function initNavbar() {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburgerBtn');
  const mobileNav = document.getElementById('mobileNav');
  if (!navbar || !hamburger || !mobileNav) return;

  // Scroll state
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // Hamburger toggle
  hamburger.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
  });

  // Close mobile nav on link click
  mobileNav.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      hamburger.setAttribute('aria-expanded', false);
    });
  });

  // Active link on scroll (index.html only)
  const navLinks = document.querySelectorAll('#navLinks a');
  const sections = document.querySelectorAll('section[id]');
  if (navLinks.length && sections.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(s => observer.observe(s));
  }
})();


/* ─────────────────────────────────────
   4. FADE-UP / FADE-IN ANIMATIONS
───────────────────────────────────── */
(function initAnimations() {
  const targets = document.querySelectorAll('.fade-up, .fade-in');
  if (!targets.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.09, rootMargin: '0px 0px -30px 0px' });
  targets.forEach(el => observer.observe(el));
})();


/* ─────────────────────────────────────
   5. TIMELINE LINE ANIMATION
───────────────────────────────────── */
(function initTimeline() {
  const line = document.getElementById('timelineLine');
  if (!line) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { line.classList.add('visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.1 });
  observer.observe(line);
})();


/* ─────────────────────────────────────
   6. TABS — RULES & ELIGIBILITY
───────────────────────────────────── */
(function initTabs() {
  const buttons   = document.querySelectorAll('.tab-btn');
  const contents  = document.querySelectorAll('.tab-content');
  const indicator = document.getElementById('tabIndicator');
  if (!buttons.length || !indicator) return;

  function setIndicator(btn) {
    indicator.style.left  = btn.offsetLeft + 'px';
    indicator.style.width = btn.offsetWidth + 'px';
  }

  function activateTab(btn) {
    const tabId = btn.dataset.tab;
    buttons.forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-selected', b === btn);
    });
    contents.forEach(c => c.classList.remove('active'));
    const target = document.getElementById('tab-' + tabId);
    if (target) target.classList.add('active');
    setIndicator(btn);
  }

  buttons.forEach(btn => btn.addEventListener('click', () => activateTab(btn)));
  const activeBtn = document.querySelector('.tab-btn.active');
  if (activeBtn) setTimeout(() => setIndicator(activeBtn), 50);
  window.addEventListener('resize', () => {
    const ab = document.querySelector('.tab-btn.active');
    if (ab) setIndicator(ab);
  });
})();


/* ─────────────────────────────────────
   7. JUDGING CRITERIA — PIE CHART (Chart.js)
   Replaces old progress bar implementation.
───────────────────────────────────── */
(function initJudgingChart() {
  const canvas = document.getElementById('judgingChart');
  if (!canvas) return;

  // Palette — matches site theme colors
  const COLORS = [
    '#3B82F6', // blue   — Innovation
    '#7C3AED', // purple — Technical Feasibility
    '#06B6D4', // cyan   — Impact
    '#10B981', // green  — Scalability
    '#F59E0B', // amber  — Presentation Quality
  ];

  // Apply matching colors to custom legend dots
  document.querySelectorAll('.legend-dot').forEach(dot => {
    const idx = parseInt(dot.dataset.idx, 10);
    if (!isNaN(idx) && COLORS[idx]) dot.style.background = COLORS[idx];
  });

  const LABELS = [
    'Innovation',
    'Technical Feasibility',
    'Impact',
    'Scalability',
    'Presentation Quality',
  ];

  function buildChart() {
    if (typeof Chart === 'undefined') {
      // Chart.js not loaded yet — retry
      setTimeout(buildChart, 200);
      return;
    }

    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: LABELS,
        datasets: [{
          data: [20, 20, 20, 20, 20],
          backgroundColor: COLORS,
          borderColor: 'rgba(7,11,22,0.85)',
          borderWidth: 3,
          hoverBorderWidth: 4,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '60%',
        animation: {
          animateRotate: true,
          duration: 1000,
          easing: 'easeInOutQuart',
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(12,18,32,0.95)',
            borderColor: 'rgba(59,130,246,0.3)',
            borderWidth: 1,
            padding: 12,
            titleColor: '#EFF6FF',
            bodyColor: '#94A3B8',
            callbacks: {
              label: (ctx) => `  ${ctx.label}: ${ctx.parsed}%`,
            },
          },
        },
      },
    });
  }

  // Trigger only when section is visible (IntersectionObserver)
  const section = document.getElementById('judging');
  if (!section) { buildChart(); return; }

  let built = false;
  const obs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !built) {
      built = true;
      buildChart();
      obs.unobserve(section);
    }
  }, { threshold: 0.2 });
  obs.observe(section);
})();


/* ─────────────────────────────────────
   8. DYNAMIC TEAM MEMBERS
───────────────────────────────────── */
(function initMembersField() {
  const container  = document.getElementById('membersContainer');
  const addBtn     = document.getElementById('addMemberBtn');
  const errMembers = document.getElementById('err-members');
  if (!container || !addBtn) return;
  const MAX_MEMBERS = 4;
  let count = 0;

  function addMember() {
    if (count >= MAX_MEMBERS) {
      if (errMembers) { errMembers.textContent = 'Maximum 4 additional members allowed.'; errMembers.style.display = 'block'; }
      return;
    }
    if (errMembers) errMembers.style.display = 'none';
    count++;
    const row = document.createElement('div');
    row.className = 'member-row';
    row.innerHTML = `
      <input type="text" class="form-control" name="members[]"
        placeholder="Member ${count} full name" autocomplete="off"
        data-member-index="${count}" />
      <button type="button" class="btn-remove-member" aria-label="Remove member">×</button>`;
    row.querySelector('.btn-remove-member').addEventListener('click', () => {
      row.remove();
      count--;
      if (errMembers) errMembers.style.display = 'none';
      container.querySelectorAll('input[name="members[]"]').forEach((inp, i) => {
        inp.placeholder = `Member ${i + 1} full name`;
      });
      addBtn.disabled = false;
    });
    container.appendChild(row);
    if (count >= MAX_MEMBERS) addBtn.disabled = true;
  }

  addBtn.addEventListener('click', addMember);
})();


/* ─────────────────────────────────────
   9. REGISTRATION FORM — VALIDATION & SUBMISSION
───────────────────────────────────── */
(function initRegistrationForm() {
  const form        = document.getElementById('registrationForm');
  const submitBtn   = document.getElementById('submitBtn');
  const submitText  = document.getElementById('submitText');
  const submitLoad  = document.getElementById('submitLoading');
  const successCard = document.getElementById('successCard');
  const teamIdDisp  = document.getElementById('teamIdDisplay');
  if (!form) return;

  function setError(fieldId, msg) {
    const grp = document.getElementById('grp-' + fieldId);
    const err = document.getElementById('err-' + fieldId);
    if (grp) grp.classList.add('has-error');
    if (err) err.textContent = msg;
  }
  function clearError(fieldId) {
    const grp = document.getElementById('grp-' + fieldId);
    const err = document.getElementById('err-' + fieldId);
    if (grp) grp.classList.remove('has-error');
    if (err) err.textContent = '';
  }
  function clearAll() {
    ['team_name','track','team_size','lead_name','lead_email','lead_phone'].forEach(clearError);
  }

  function validate() {
    clearAll();
    let valid = true;
    if (!form.team_name.value.trim()) { setError('team_name', 'Team name is required.'); valid = false; }
    if (!form.track.value)            { setError('track', 'Please select a problem track.'); valid = false; }
    const sz = parseInt(form.team_size.value, 10);
    if (isNaN(sz) || sz < 1 || sz > 5) { setError('team_size', 'Team size must be 1–5.'); valid = false; }
    if (!form.lead_name.value.trim()) { setError('lead_name', 'Lead name is required.'); valid = false; }
    const email = form.lead_email.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('lead_email', 'Enter a valid email.'); valid = false; }
    const phone = form.lead_phone.value.trim();
    if (!phone || !/^\d{10}$/.test(phone)) { setError('lead_phone', 'Enter a valid 10-digit number.'); valid = false; }
    return valid;
  }

  // Inline validation
  ['team_name','lead_name'].forEach(id => {
    form[id] && form[id].addEventListener('blur', () => { if (form[id].value.trim()) clearError(id); });
  });
  form.lead_email && form.lead_email.addEventListener('blur', () => {
    const v = form.lead_email.value.trim();
    if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) clearError('lead_email');
  });
  form.lead_phone && form.lead_phone.addEventListener('input', () => {
    form.lead_phone.value = form.lead_phone.value.replace(/\D/g, '').slice(0, 10);
  });
  form.lead_phone && form.lead_phone.addEventListener('blur', () => {
    if (/^\d{10}$/.test(form.lead_phone.value.trim())) clearError('lead_phone');
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (!validate()) return;

    const members = Array.from(form.querySelectorAll('input[name="members[]"]'))
      .map(i => i.value.trim()).filter(Boolean);
    const formData = {
      team_name : form.team_name.value.trim(),
      track     : form.track.value,
      team_size : parseInt(form.team_size.value, 10),
      lead_name : form.lead_name.value.trim(),
      lead_email: form.lead_email.value.trim(),
      lead_phone: form.lead_phone.value.trim(),
      members
    };

    submitBtn.disabled        = true;
    submitText.style.display  = 'none';
    submitLoad.style.display  = 'inline';

    fetch('/register', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(formData)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        form.style.display        = 'none';
        teamIdDisp.textContent    = data.team_id || '—';
        successCard.style.display = 'block';
        successCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        alert(data.message || 'Registration failed. Please try again.');
        submitBtn.disabled       = false;
        submitText.style.display = 'inline';
        submitLoad.style.display = 'none';
      }
    })
    .catch(() => {
      // Fallback when no backend is connected
      form.style.display        = 'none';
      teamIdDisp.textContent    = 'STRX26-XXX';
      successCard.style.display = 'block';
      successCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
})();
