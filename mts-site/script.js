(() => {
  "use strict";

  const ANIME_URL = "https://cdn.jsdelivr.net/npm/animejs@4/+esm";
  const ANIME_TIMEOUT_MS = 2500;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  // Модуль Anime.js v4; null, если CDN недоступен или истёк таймаут
  let anime = null;

  // Footer year
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Header state + scroll progress
  const header = document.getElementById("header");
  const progress = document.getElementById("progress");
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle("scrolled", y > 40);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile menu
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
  burger.addEventListener("click", () => {
    const open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    burger.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", String(open));
  });
  nav.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      nav.classList.remove("open");
      burger.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    })
  );

  // Counters: Anime.js (объект как target) или rAF-фолбэк
  const countEls = [...document.querySelectorAll("[data-count]")];
  const countUp = (el, delay = 0) => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    const render = (v) => {
      el.textContent = Math.round(v) + suffix;
    };
    if (reduced) return render(target);
    if (anime) {
      const state = { value: 0 };
      anime.animate(state, {
        value: target,
        duration: 1800,
        delay,
        ease: "outExpo",
        onUpdate: () => render(state.value),
      });
      return;
    }
    const start = performance.now() + delay;
    const tick = (now) => {
      const p = Math.min(Math.max((now - start) / 1800, 0), 1);
      render(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const countObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        countUp(e.target);
        countObs.unobserve(e.target);
      });
    },
    { threshold: 0.5 }
  );
  countEls.forEach((el) => {
    if (el.closest(".hero")) return;
    el.textContent = "0" + (el.dataset.suffix || "");
    countObs.observe(el);
  });

  // Tabs filter
  const tabs = document.querySelectorAll(".tab");
  const cards = document.querySelectorAll(".card[data-type]");
  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", String(t === tab));
      });
      const f = tab.dataset.filter;
      const shown = [];
      cards.forEach((c) => {
        const show = f === "all" || c.dataset.type === f;
        c.classList.toggle("hidden", !show);
        if (show) shown.push(c);
      });
      if (anime && !reduced && shown.length) {
        anime.animate(shown, {
          opacity: [0, 1],
          y: [24, 0],
          scale: [0.96, 1],
          delay: anime.stagger(80),
          duration: 500,
          ease: "outExpo",
        });
      }
    })
  );

  // Lead form with validation + fake submit
  const form = document.getElementById("leadForm");
  const phoneInput = document.getElementById("phone");
  const field = phoneInput.closest(".field");
  const errorEl = field.querySelector(".error");
  const success = document.getElementById("formSuccess");

  phoneInput.addEventListener("input", () => {
    let d = phoneInput.value.replace(/\D/g, "");
    if (d.startsWith("8")) d = "7" + d.slice(1);
    if (!d.startsWith("7")) d = "7" + d;
    d = d.slice(0, 11);
    let out = "+7";
    if (d.length > 1) out += " (" + d.slice(1, 4);
    if (d.length >= 4) out += ")";
    if (d.length >= 5) out += " " + d.slice(4, 7);
    if (d.length >= 8) out += "-" + d.slice(7, 9);
    if (d.length >= 10) out += "-" + d.slice(9, 11);
    phoneInput.value = out;
    field.classList.remove("invalid");
    errorEl.textContent = "";
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const digits = phoneInput.value.replace(/\D/g, "");
    if (digits.length !== 11) {
      field.classList.remove("invalid");
      void field.offsetWidth; // перезапуск shake-анимации
      field.classList.add("invalid");
      errorEl.textContent = "Введите номер полностью";
      return;
    }
    const btn = form.querySelector("button");
    btn.classList.add("loading");
    setTimeout(() => {
      btn.classList.remove("loading");
      form.hidden = true;
      success.hidden = false;
    }, 1400);
  });

  // ---------- Motion ----------

  // Группировка .reveal по родителю: элементы одной группы появляются вместе со stagger
  const observeRevealGroups = (onReveal) => {
    const groups = new Map();
    document.querySelectorAll(".reveal").forEach((el) => {
      if (el.closest(".hero")) return;
      const key = el.parentElement;
      groups.set(key, [...(groups.get(key) || []), el]);
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const key = entry.target.parentElement;
          const items = groups.get(key);
          if (!items) return;
          groups.delete(key);
          items.forEach((el) => io.unobserve(el));
          onReveal(items);
        });
      },
      { threshold: 0.15 }
    );
    groups.forEach((items) => items.forEach((el) => io.observe(el)));
  };

  // Полный сценарий на Anime.js v4
  function initAnime(A) {
    const { animate, stagger, createTimeline } = A;

    // Hero: последовательное появление бейджа, строк заголовка и блоков
    createTimeline({ defaults: { ease: "outExpo" } })
      .add(".hero .badge", { opacity: [0, 1], y: [30, 0], duration: 900 }, 100)
      .add(".hero-title .line > span", { y: ["110%", "0%"], duration: 1100, delay: stagger(150) }, 250)
      .add(".hero-sub", { opacity: [0, 1], y: [30, 0], duration: 900 }, 700)
      .add(".hero-cta", { opacity: [0, 1], y: [30, 0], duration: 900 }, 850);

    // Карточки, услуги, статистика, CTA: stagger при появлении в зоне видимости
    observeRevealGroups((items) =>
      animate(items, {
        opacity: [0, 1],
        y: [40, 0],
        duration: 900,
        ease: "outExpo",
        delay: stagger(100),
      })
    );

    if (finePointer) {
      // 3D-наклон и свечение за курсором для карточек тарифов
      document.querySelectorAll(".tilt").forEach((card) => {
        const glow = card.querySelector(".card-glow");
        card.addEventListener("pointermove", (e) => {
          const r = card.getBoundingClientRect();
          const x = e.clientX - r.left;
          const y = e.clientY - r.top;
          animate(card, {
            rotateX: (y / r.height - 0.5) * -10,
            rotateY: (x / r.width - 0.5) * 10,
            y: -6,
            duration: 400,
            ease: "out(3)",
          });
          if (glow) animate(glow, { x: x - 150, y: y - 150, duration: 400, ease: "out(3)" });
        });
        card.addEventListener("pointerleave", () => {
          animate(card, { rotateX: 0, rotateY: 0, y: 0, duration: 800, ease: "outElastic(1, .6)" });
        });
      });

      // Spotlight-свечение и подъём карточек услуг
      document.querySelectorAll(".service").forEach((s) => {
        const spot = document.createElement("span");
        spot.className = "spot";
        s.prepend(spot);
        s.addEventListener("pointermove", (e) => {
          const r = s.getBoundingClientRect();
          animate(spot, {
            x: e.clientX - r.left - 200,
            y: e.clientY - r.top - 200,
            duration: 350,
            ease: "out(3)",
          });
        });
        s.addEventListener("pointerenter", () => animate(s, { y: -8, duration: 500, ease: "outExpo" }));
        s.addEventListener("pointerleave", () => animate(s, { y: 0, duration: 600, ease: "outExpo" }));
      });

      // Магнитные кнопки
      document.querySelectorAll(".btn-magnetic").forEach((btn) => {
        let tx = 0;
        let ty = 0;
        btn.addEventListener("pointermove", (e) => {
          const r = btn.getBoundingClientRect();
          // Центр без учёта текущего смещения, иначе кнопка дрожит
          const cx = r.left + r.width / 2 - tx;
          const cy = r.top + r.height / 2 - ty;
          tx = (e.clientX - cx) * 0.25;
          ty = (e.clientY - cy) * 0.35;
          animate(btn, { x: tx, y: ty, duration: 400, ease: "out(3)" });
        });
        btn.addEventListener("pointerleave", () => {
          tx = 0;
          ty = 0;
          animate(btn, { x: 0, y: 0, duration: 800, ease: "outElastic(1, .5)" });
        });
      });
    }

    // Фазы сигнала в телефоне
    animate(".signal span", {
      scaleY: [0.7, 1],
      opacity: [0.35, 1],
      duration: 800,
      alternate: true,
      loop: true,
      ease: "inOutSine",
      delay: stagger(150),
    });

    // Плавание телефона и parallax за курсором
    const phone = document.querySelector(".phone");
    if (phone) {
      const float = animate(phone, {
        rotateY: [-12, 10],
        rotateX: [6, -4],
        y: [0, -18],
        duration: 4000,
        alternate: true,
        loop: true,
        ease: "inOutSine",
      });
      window.addEventListener("mousemove", (e) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        float.pause();
        animate(phone, { rotateY: nx * 25, rotateX: -ny * 15, y: 0, duration: 600, ease: "out(3)" });
      });
      // Возобновляем плавание, когда курсор покидает окно
      window.addEventListener("mouseout", (e) => {
        if (!e.relatedTarget) float.play();
      });
    }

    // Плавание плавающих карточек
    animate(".card-a", { y: [0, -16], duration: 3000, alternate: true, loop: true, ease: "inOutSine" });
    animate(".card-b", { y: [0, -16], duration: 3500, alternate: true, loop: true, ease: "inOutSine" });
  }

  // CSS-фолбэк без Anime.js: переходы через классы .visible и .in
  function initFallback() {
    requestAnimationFrame(() => {
      document.querySelectorAll(".hero .badge, .hero-sub, .hero-cta").forEach((el, i) => {
        el.style.transitionDelay = i * 120 + "ms";
        el.classList.add("visible");
      });
      const title = document.querySelector(".hero-title");
      if (title) title.classList.add("in");
    });
    observeRevealGroups((items) =>
      items.forEach((el, i) => {
        el.style.transitionDelay = i * 100 + "ms";
        el.classList.add("visible");
      })
    );
  }

  const startMotion = () => {
    if (!reduced) {
      try {
        if (anime) initAnime(anime);
        else initFallback();
      } catch (err) {
        console.warn("Anime.js: ошибка инициализации, включён CSS-фолбэк", err);
        initFallback();
      }
    }
    document.querySelectorAll(".hero [data-count]").forEach((el) => countUp(el, 600));
  };

  const loadAnime = () =>
    Promise.race([
      import(ANIME_URL),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("таймаут загрузки Anime.js")), ANIME_TIMEOUT_MS)
      ),
    ]);

  if (reduced) {
    startMotion();
  } else {
    loadAnime()
      .then(
        (mod) => {
          anime = mod;
        },
        (err) => console.warn("Anime.js не загружен, включён CSS-фолбэк", err)
      )
      .then(startMotion);
  }
})();
