(function () {
  const T = window.MarketingTest;
  const app = document.getElementById('app');
  const params = new URLSearchParams(location.search);

  let state = freshState();

  function freshState() {
    return { step: -1, answers: [] };
  }

  // Ответы хранятся только в адресе страницы: на сервер ничего не отправляется.
  function answersFromUrl() {
    const saved = params.get('r') || '';
    if (!/^[0-5]+$/.test(saved)) return null;
    const answers = saved.split('').map(Number);
    return T.isValidAnswers(answers) ? answers : null;
  }

  function setResultParam(answers) {
    const url = new URL(location.href);
    if (answers) url.searchParams.set('r', answers.join(''));
    else url.searchParams.delete('r');
    history.replaceState(null, '', url);
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(function (entry) {
      const k = entry[0]; const v = entry[1];
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    });
    (children || []).forEach(function (c) { if (c) node.append(c); });
    return node;
  }

  function haptic() {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
  }

  function render(children) {
    app.replaceChildren.apply(app, children);
    window.scrollTo(0, 0);
  }

  function renderIntro() {
    render([el('div', { class: 'intro' }, [
      el('div', { class: 'brand', text: 'BrandBrain' }),
      el('div', { class: 'intro-body' }, [
        el('h1', { text: 'Где у вашего бизнеса слабые места в маркетинге?' }),
        el('p', { class: 'lead', text: 'Короткая самодиагностика по 10 направлениям.' }),
        el('ul', { class: 'facts' }, [
          el('li', { text: T.QUESTIONS.length + ' утверждений, около 5 минут' }),
          el('li', { text: 'Индекс маркетинговой зрелости от 0 до 100' }),
          el('li', { text: 'Приоритеты на 30, 60 и 90 дней' }),
        ]),
      ]),
      el('button', { class: 'btn', text: 'Начать', onclick: function () { state.step = 0; renderStep(); } }),
      el('p', { class: 'small muted foot', text: 'Оценивайте то, что есть в компании сейчас, а не планы.' }),
    ])]);
  }

  function goBack() {
    state.step -= 1;
    if (state.step < 0) renderIntro(); else renderStep();
  }

  function advance(button) {
    haptic();
    button.classList.add('selected');
    setTimeout(function () { state.step += 1; renderStep(); }, 160);
  }

  function renderStep() {
    if (state.step >= T.QUESTIONS.length) return finish();
    const total = T.QUESTIONS.length;
    const q = T.QUESTIONS[state.step];
    const direction = T.DIRECTIONS.find(function (d) { return d.id === q.direction; });
    const progress = el('span');
    progress.style.width = ((state.step + 1) / total * 100) + '%';
    render([
      el('div', { class: 'top' }, [
        el('button', { class: 'link', text: 'Назад', onclick: goBack }),
        el('span', { class: 'small muted', text: (state.step + 1) + ' из ' + total }),
      ]),
      el('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': String(state.step + 1), 'aria-valuemin': '0', 'aria-valuemax': String(total) }, [progress]),
      el('p', { class: 'small muted direction', text: direction.name }),
      el('h1', { class: 'question', text: q.text }),
      el('div', { class: 'options' }, T.SCALE.map(function (o) {
        const selected = state.answers[state.step] === o.value;
        const cls = 'option' + (o.value === T.NOT_APPLICABLE ? ' option-na' : '') + (selected ? ' selected' : '');
        return el('button', { class: cls, onclick: function (e) { state.answers[state.step] = o.value; advance(e.currentTarget); } }, [
          o.value !== T.NOT_APPLICABLE && el('span', { class: 'score', text: String(o.value) }),
          el('span', { text: o.text }),
        ]);
      })),
    ]);
  }

  function section(title, content) {
    return el('section', {}, [el('h2', { text: title })].concat(content));
  }

  function finish() {
    if (!T.isValidAnswers(state.answers)) return renderNoAnswers();
    setResultParam(state.answers);
    renderResult(T.buildReport(state.answers));
  }

  function restartButton() {
    return el('div', { class: 'retake' }, [
      el('button', { class: 'link', text: 'Пройти заново', onclick: function () { setResultParam(null); state = freshState(); renderIntro(); } }),
    ]);
  }

  function saveLink() {
    const note = el('p', { class: 'small muted notice saved-link' });
    function showLink() { note.textContent = 'Сохраните эту ссылку: ' + location.href; }
    return el('div', { class: 'save' }, [
      el('button', { class: 'link', text: 'Скопировать ссылку на результат', onclick: function () {
        if (!navigator.clipboard) return showLink();
        navigator.clipboard.writeText(location.href).then(function () {
          note.textContent = 'Ссылка скопирована. Сохраните её, чтобы вернуться к результату.';
        }, showLink);
      } }),
      note,
    ]);
  }

  function renderNoAnswers() {
    render([
      el('div', { class: 'brand', text: 'BrandBrain' }),
      el('div', { class: 'result-head' }, [
        el('h1', { text: 'Недостаточно ответов' }),
        el('p', { class: 'lead', text: 'Все утверждения отмечены как неприменимые, поэтому посчитать индекс нельзя.' }),
      ]),
      restartButton(),
    ]);
  }

  function renderResult(report) {
    const rows = report.directions.map(function (d) {
      const bar = el('span');
      bar.style.width = (d.index === null ? 0 : d.index) + '%';
      return el('li', {}, [
        el('div', { class: 'mix-row' }, [
          el('span', { text: d.name }),
          el('b', { text: d.index === null ? '—' : String(d.index) }),
        ]),
        el('div', { class: 'bar' }, [bar]),
      ]);
    });
    const plan = report.limits.map(function (d, i) {
      return el('li', {}, [
        el('p', { class: 'plan-term', text: ((i + 1) * 30) + ' дней' }),
        el('h3', { text: d.name }),
        el('p', { text: d.step }),
        el('p', { class: 'small muted notice', text: 'Готово, когда: ' + d.metric }),
      ]);
    });
    render([
      el('div', { class: 'brand', text: 'BrandBrain' }),
      el('div', { class: 'result-head' }, [
        el('p', { class: 'eyebrow', text: 'Индекс маркетинговой зрелости' }),
        el('h1', {}, [el('span', { class: 'index', text: String(report.index) }), el('span', { class: 'index-of', text: ' из 100' })]),
        el('p', { class: 'lead', text: report.level.name }),
        el('p', { class: 'muted notice', text: report.level.text }),
        saveLink(),
      ]),
      section('Приоритеты', [el('ol', { class: 'plan' }, plan)]),
      section('По направлениям', [el('ul', { class: 'mix' }, rows)]),
      report.strengths.length && section('Сильнее остальных', [
        el('ul', { class: 'list' }, report.strengths.map(function (d) { return el('li', { text: d.name }); })),
      ]),
      renderOffer(),
      el('p', { class: 'disclaimer', text: T.DISCLAIMER }),
      restartButton(),
    ].filter(Boolean));
  }

  function renderOffer() {
    const O = T.OFFER;
    return el('div', { class: 'offer' }, [
      el('h2', { text: O.title }),
      el('p', { text: O.text }),
      O.contactUrl && el('a', { class: 'btn', href: O.contactUrl, target: '_blank', rel: 'noopener', text: O.contactLabel }),
    ]);
  }

  function applyTelegram() {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return;
    tg.ready();
    tg.expand();
    const scheme = tg.colorScheme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = scheme;
    const bg = scheme === 'dark' ? '#14161B' : '#F5F2EB';
    if (tg.setHeaderColor) tg.setHeaderColor(bg);
    if (tg.setBackgroundColor) tg.setBackgroundColor(bg);
  }

  window.addEventListener('load', applyTelegram);
  const savedAnswers = answersFromUrl();
  if (savedAnswers) {
    state.answers = savedAnswers;
    renderResult(T.buildReport(savedAnswers));
  } else {
    renderIntro();
  }
})();
