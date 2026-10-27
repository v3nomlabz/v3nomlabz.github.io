/* ==========================================================================
   V3NOM LABZ — UI, motion & interactions
   ========================================================================== */
(function () {
  'use strict';

  const CFG = window.V3NOM;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const animate = hasGSAP && !reduced;

  if (animate) document.documentElement.classList.add('js-anim');
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  /* ---------- Shared helpers (used by quote.js etc.) ---------- */
  const moneyFmt = new Intl.NumberFormat(CFG.currency.locale, {
    style: 'currency', currency: CFG.currency.code, maximumFractionDigits: 0,
  });
  let toastTimer;
  function toast(msg, isError) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('is-error', !!isError);
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3200);
  }
  let lenis = null;
  function scrollToEl(target) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    const offset = -(parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 70) + 1;
    if (lenis) lenis.scrollTo(el, { offset, duration: 1.4 });
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: reduced ? 'auto' : 'smooth' });
  }
  window.V3UI = { money: (n) => moneyFmt.format(Math.round(n)), toast, scrollTo: scrollToEl, reduced, animate };

  /* ---------- Contact details from config ---------- */
  const waLink = (text) => `https://wa.me/${CFG.contact.whatsapp}${text ? '?text=' + encodeURIComponent(text) : ''}`;
  $$('[data-contact]').forEach((el) => {
    const k = el.dataset.contact;
    if (k === 'email') { el.href = `mailto:${CFG.contact.email}`; if (el.textContent.trim() === '–') el.textContent = CFG.contact.email; }
    if (k === 'whatsapp') { el.href = waLink(); if (el.textContent.trim() === '–') el.textContent = CFG.contact.phoneDisplay; }
    if (k === 'instagram') el.href = CFG.contact.instagram;
    if (k === 'location') el.textContent = CFG.contact.location;
    if (k === 'hours') el.textContent = CFG.contact.hours;
  });
  $('#year').textContent = new Date().getFullYear();

  /* ---------- Smooth scroll (Lenis) ---------- */
  if (animate && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    closeMenu();
    scrollToEl(target);
    history.replaceState(null, '', id);
  });

  /* ---------- Mobile menu ---------- */
  const burger = $('#burger');
  function closeMenu() {
    document.body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    $('#mobile-menu').setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
  }
  burger.addEventListener('click', () => {
    const open = !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    $('#mobile-menu').setAttribute('aria-hidden', String(!open));
    if (lenis) open ? lenis.stop() : lenis.start();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  /* ---------- Nav state, progress, back-to-top, active link ---------- */
  const nav = $('#nav'), progress = $('#scroll-progress'), toTop = $('#to-top');
  let lastY = 0;
  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    nav.classList.toggle('is-scrolled', y > 30);
    nav.classList.toggle('is-hidden', y > 600 && y > lastY + 2 && !document.body.classList.contains('menu-open'));
    if (y < lastY - 2) nav.classList.remove('is-hidden');
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    toTop.classList.toggle('is-visible', y > 900);
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const navLinks = $$('.nav__links a');
  const sectionObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['services', 'process', 'quote', 'materials', 'showcase', 'why', 'faq', 'contact'].forEach((id) => {
    const s = document.getElementById(id); if (s) sectionObs.observe(s);
  });

  /* ---------- Split text ---------- */
  function splitWords(el) {
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const inner = document.createElement('span'); inner.textContent = part;
            w.appendChild(inner); frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) walk(child);
      });
    };
    walk(el);
    return $$('.w > span', el);
  }

  /* ---------- Counters ---------- */
  function runCounter(el, delay = 0) {
    const to = parseFloat(el.dataset.to), dec = parseInt(el.dataset.dec || '0', 10);
    if (!animate) { el.textContent = to.toFixed(dec); return; }
    const o = { v: 0 };
    gsap.to(o, { v: to, duration: 2, delay, ease: 'power3.out', onUpdate: () => { el.textContent = o.v.toFixed(dec); } });
  }

  /* ---------- Preloader → hero intro ---------- */
  function heroIntro() {
    document.body.classList.remove('is-loading');
    if (lenis) lenis.start();
    $$('.counter').forEach((c, i) => runCounter(c, animate ? 0.9 + i * 0.1 : 0));
    if (!animate) return;
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('.hero__title .line__inner', { y: 0, duration: 1.4, stagger: 0.12 }, 0.1)
      .to('.reveal-hero', { opacity: 1, y: 0, duration: 1.1, stagger: 0.07 }, 0.45);
    gsap.to('.hero__inner', {
      yPercent: -12, opacity: 0.2, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  (function preloader() {
    const el = $('#preloader'), bar = $('#preloader-bar'), pct = $('#preloader-pct');
    const start = performance.now();
    const minTime = reduced ? 300 : 1700;
    let loaded = document.readyState === 'complete';
    window.addEventListener('load', () => { loaded = true; });
    const tick = (now) => {
      const t = Math.min(1, (now - start) / minTime);
      const target = loaded ? t : Math.min(t, 0.9);
      const v = Math.round(target * 100);
      bar.style.width = v + '%';
      pct.textContent = String(v).padStart(3, '0') + '%';
      if ((target >= 1) || now - start > 5000) return finish();
      requestAnimationFrame(tick);
    };
    function finish() {
      bar.style.width = '100%'; pct.textContent = '100%';
      if (animate) {
        gsap.timeline()
          .to('.preloader__inner', { opacity: 0, y: -20, duration: 0.5, ease: 'power2.in' })
          .to(el, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'expo.inOut' }, '-=0.1')
          .add(() => { el.remove(); }, '+=0')
          .add(heroIntro, '-=0.6');
      } else { el.remove(); heroIntro(); }
    }
    requestAnimationFrame(tick);
  })();

  /* ---------- Scroll-triggered reveals ---------- */
  if (animate) {
    $$('.split').forEach((el) => {
      const words = splitWords(el);
      gsap.from(words, {
        yPercent: 115, rotate: 4, duration: 1.2, ease: 'expo.out', stagger: 0.035,
        scrollTrigger: { trigger: el, start: 'top 88%' },
      });
    });
    ScrollTrigger.batch('.reveal', {
      start: 'top 90%',
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
    });

    // Marquee driven by GSAP so it reacts to scroll velocity
    const track = $('.marquee__track');
    track.style.animation = 'none';
    const mq = gsap.to(track, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
    let vel = 0;
    ScrollTrigger.create({
      onUpdate: (self) => { vel = Math.min(Math.abs(self.getVelocity()) / 400, 6); },
    });
    gsap.ticker.add(() => {
      vel *= 0.92;
      mq.timeScale(1 + vel);
    });

    // Process line + steps
    gsap.to('#process-fill', {
      strokeDashoffset: 0, ease: 'none',
      scrollTrigger: { trigger: '.process', start: 'top 75%', end: 'bottom 55%', scrub: 0.6 },
    });
    $$('.step').forEach((s, i) => {
      ScrollTrigger.create({ trigger: '.process', start: () => `top+=${i * 60} 70%`, onEnter: () => s.classList.add('is-lit'), onLeaveBack: () => s.classList.remove('is-lit') });
    });
  } else {
    $$('.step').forEach((s) => s.classList.add('is-lit'));
    const pf = $('#process-fill'); if (pf) pf.style.strokeDashoffset = '0';
  }

  /* ---------- Cursor follower ---------- */
  if (finePointer && !reduced) {
    const cursor = $('#cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring');
    let mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; cursor.classList.remove('is-hidden'); }, { passive: true });
    document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
    const loop = () => {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    };
    loop();
    document.addEventListener('mouseover', (e) => {
      const hit = e.target.closest('a, button, label[for], .shot, .work__item, .swatch, .chip, summary, select');
      cursor.classList.toggle('is-hover', !!hit);
    });
  }

  /* ---------- Magnetic buttons ---------- */
  if (finePointer && animate) {
    $$('.magnetic').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        gsap.to(btn, { x: x * 0.25, y: y * 0.35, duration: 0.4, ease: 'power3.out' });
      });
      btn.addEventListener('mouseleave', () => gsap.to(btn, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' }));
    });
  }

  /* ---------- Card spotlight + tilt ---------- */
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest && e.target.closest('.card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  if (finePointer && !reduced) {
    $$('.tilt').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 10).toFixed(2)}deg) translateY(-4px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- Materials explorer ---------- */
  (function materials() {
    const tabs = $('#mat-tabs');
    const propNames = { strength: 'Strength', flex: 'Flexibility', heat: 'Heat resist.', detail: 'Detail' };
    CFG.materials.forEach((m, i) => {
      const b = document.createElement('button');
      b.className = 'mat-tab'; b.type = 'button'; b.role = 'tab';
      b.dataset.id = m.id;
      b.innerHTML = `<i></i>${m.name}<small>${m.tech}</small>`;
      b.addEventListener('click', () => select(m.id, true));
      tabs.appendChild(b);
    });

    let current = null;
    function select(id, user) {
      const m = CFG.materials.find((x) => x.id === id);
      if (!m || current === id) return;
      current = id;
      $$('.mat-tab', tabs).forEach((t) => { const on = t.dataset.id === id; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', on); });
      const apply = () => {
        $('#mat-name').textContent = m.name;
        $('#mat-tech').textContent = m.tech === 'SLA' ? 'RESIN · SLA' : 'FDM';
        $('#mat-tagline').textContent = m.tagline;
        $('#mat-desc').textContent = m.desc;
        $('#mat-price').textContent = window.V3UI.money(m.pricePerGram);
        $('#mat-spool-label').textContent = m.name.toUpperCase();
        const c = m.colors[0] === '#0d0d0d' && m.colors[1] ? m.colors.find((x) => x !== '#0d0d0d' && x !== '#f2f2f2') || m.colors[1] : m.colors[0];
        $('#mat-spool').style.setProperty('--c', m.id === 'pla' ? '#a3ff12' : c);
        $('#mat-bars').innerHTML = Object.entries(m.props).map(([k, v]) =>
          `<div class="bar"><span>${propNames[k]}</span><div class="bar__track">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= v ? 'on' : ''}" style="transition-delay:${n * 60}ms"></i>`).join('')}</div><b>${v}/5</b></div>`).join('');
        $('#mat-colors').innerHTML = m.colors.map((c) => `<span style="background:${c}" title="${c}"></span>`).join('');
      };
      if (animate && user) {
        gsap.timeline()
          .to('.matlib__info > *', { opacity: 0, y: 10, duration: 0.2, stagger: 0.02, ease: 'power2.in' })
          .add(apply)
          .to('.matlib__info > *', { opacity: 1, y: 0, duration: 0.6, stagger: 0.04, ease: 'expo.out' });
        gsap.fromTo('#mat-spool', { rotate: -40, scale: 0.9 }, { rotate: 0, scale: 1, duration: 1, ease: 'expo.out' });
      } else apply();
    }
    select(CFG.materials[0].id, false);

    $('#mat-cta').addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('v3:material', { detail: current }));
    });
  })();

  /* ---------- Work gallery lightbox ---------- */
  (function lightbox() {
    const dlg = $('#lightbox'), items = $$('#work-grid .work__item');
    if (!dlg || !items.length || typeof dlg.showModal !== 'function') return;
    const img = $('#lb-img', dlg);
    let index = 0;
    function show(i) {
      index = (i + items.length) % items.length;
      const item = items[index], thumb = $('img', item);
      const title = $('.work__title', item).textContent;
      img.src = item.dataset.full;
      img.alt = thumb.alt;
      $('#lb-tag', dlg).textContent = $('.work__tag', item).textContent;
      $('#lb-title', dlg).textContent = title;
      $('#lb-desc', dlg).textContent = $('.work__desc', item).textContent;
      $('#lb-wa', dlg).href = waLink(`Hi V3nom Labz! I saw the ${title} on your website and would like something like it.`);
      $('#lb-count', dlg).textContent = `${String(index + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
      // warm the cache for the next photo
      new Image().src = items[(index + 1) % items.length].dataset.full;
    }
    items.forEach((item, i) => item.addEventListener('click', () => {
      show(i);
      dlg.showModal();
      if (lenis) lenis.stop();
    }));
    dlg.addEventListener('close', () => {
      if (lenis) lenis.start();
      items[index].focus({ preventScroll: true });
    });
    dlg.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lb]');
      if (btn) {
        const act = btn.dataset.lb;
        if (act === 'close') dlg.close();
        else show(index + (act === 'next' ? 1 : -1));
      } else if (e.target === dlg) dlg.close(); // click on the backdrop
    });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(index + 1);
      if (e.key === 'ArrowLeft') show(index - 1);
    });
    let touchX = null;
    dlg.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      touchX = null;
    }, { passive: true });
  })();

  /* ---------- Bento price ticker ---------- */
  (function ticker() {
    const el = $('#ticker');
    const values = [349, 1290, 649, 2499, 189, 899];
    let i = 0, running = false;
    const step = () => {
      if (!running) return;
      const to = values[i++ % values.length];
      if (animate) {
        const o = { v: parseInt(el.textContent.replace(/\D/g, ''), 10) || 0 };
        gsap.to(o, { v: to, duration: 1.2, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString(CFG.currency.locale); } });
      } else el.textContent = to.toLocaleString(CFG.currency.locale);
      setTimeout(step, 2400);
    };
    $('.ticker span').textContent = CFG.currency.symbol;
    new IntersectionObserver(([en]) => { const was = running; running = en.isIntersecting; if (running && !was) step(); }).observe(el);
  })();

  /* ---------- FAQ accordion with smooth height ---------- */
  $$('.faq__item').forEach((d) => {
    const sum = $('summary', d);
    sum.addEventListener('click', (e) => {
      e.preventDefault();
      const open = d.open;
      $$('.faq__item[open]').forEach((o) => { if (o !== d) toggle(o, false); });
      toggle(d, !open);
    });
    function toggle(item, open) {
      const b = $('.faq__body', item);
      if (!animate) { item.open = open; return; }
      if (open) {
        item.open = true;
        gsap.fromTo(b, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.6, ease: 'expo.out' });
      } else {
        gsap.to(b, { height: 0, opacity: 0, duration: 0.4, ease: 'power3.inOut', onComplete: () => { item.open = false; b.style.height = ''; b.style.opacity = ''; } });
      }
    }
  });

  /* ---------- Contact form ---------- */
  const form = $('#contact-form');
  function formText() {
    const f = new FormData(form);
    return `Hi V3nom Labz!\n\nName: ${f.get('name') || ''}\nEmail: ${f.get('email') || ''}\nPhone: ${f.get('phone') || '-'}\nService: ${f.get('service')}\n\n${f.get('message') || ''}`;
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    ['f-name', 'f-email', 'f-msg'].forEach((id) => {
      const input = document.getElementById(id);
      const valid = input.value.trim() && (input.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim()));
      input.parentElement.classList.toggle('is-invalid', !valid);
      if (!valid) ok = false;
    });
    if (!ok) { toast('Please fill in your name, a valid email and a message.', true); return; }
    const f = new FormData(form);
    const subject = `New project enquiry: ${f.get('service')} (${f.get('name')})`;
    window.location.href = `mailto:${CFG.contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(formText())}`;
    toast('Opening your email app…');
  });
  form.addEventListener('input', (e) => e.target.parentElement.classList.remove('is-invalid'));
  $('#f-wa').addEventListener('click', () => window.open(waLink(formText()), '_blank', 'noopener'));

  /* Refresh ScrollTrigger once everything (fonts, images) has settled */
  window.addEventListener('load', () => { if (hasGSAP) ScrollTrigger.refresh(); });
})();
