/* 스레드렌즈 공통 기능 */
(function () {
  'use strict';

  /* ── 저장소 (이 기기 브라우저에만 저장) ── */
  var mem = {};  /* 브라우저 저장이 막힌 곳에서는 이번 방문 동안만 기억한다 */
  var store = {
    get: function (k, d) {
      if (k in mem) return mem[k];
      try { var v = localStorage.getItem('tl_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
    },
    set: function (k, v) {
      mem[k] = v;
      try { localStorage.setItem('tl_' + k, JSON.stringify(v)); return true; } catch (e) { return false; }
    },
    del: function (k) { delete mem[k]; try { localStorage.removeItem('tl_' + k); } catch (e) {} }
  };

  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function cat(id) { for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i]; return null; }
  function struct(id) { for (var i = 0; i < STRUCTS.length; i++) if (STRUCTS[i].id === +id) return STRUCTS[i]; return null; }
  /* {cust}이, {biz}는 처럼 낱말 뒤에 붙는 조사를 받침에 맞게 고친다 (손님이 / 학부모가) */
  var JOSA = { '이': ['이', '가'], '가': ['이', '가'], '은': ['은', '는'], '는': ['은', '는'], '을': ['을', '를'], '를': ['을', '를'],
    '과': ['과', '와'], '와': ['과', '와'], '이라서': ['이라서', '라서'], '라서': ['이라서', '라서'], '이라면': ['이라면', '라면'], '라면': ['이라면', '라면'],
    '으로': ['으로', '로'], '로': ['으로', '로'] };
  function fill(t, c) {
    return t.replace(/\{(biz|when|item|cust|owner)\}(이라서|라서|이라면|라면|으로|이|가|은|는|을|를|과|와|로)?(?![가-힣])/g, function (m, k, j) {
      var w = c[k];
      if (!j) return w;
      var code = w.charCodeAt(w.length - 1), fin = (code >= 0xAC00 && code <= 0xD7A3) ? (code - 0xAC00) % 28 : 0;
      /* '으로'는 받침이 없거나 ㄹ 받침이면 '로' */
      var batchim = (j === '으로' || j === '로') ? (fin !== 0 && fin !== 8) : fin !== 0;
      return w + JOSA[j][batchim ? 0 : 1];
    }).replace(/\{(biz|when|item|cust|owner)\}/g, function (m, k) { return c[k]; });
  }
  function param(k) { var m = new RegExp('[?&]' + k + '=([^&#]*)').exec(location.search); return m ? decodeURIComponent(m[1]) : ''; }

  /* ── 알림 ── */
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.className = 'show';
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = ''; }, 2200);
  }
  function copy(text, msg) {
    function done() { toast(msg || '복사했어요'); }
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('복사가 안 됐어요. 글을 길게 눌러 복사해 주세요'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  /* ── 소재에 맞는 구조 고르기 ── */
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973; return h; }
  function rank(material, goal) {
    var text = ' ' + material + ' ';
    var seed = hash(material);
    return STRUCTS.map(function (s) {
      var hits = s.keys.filter(function (k) { return text.indexOf(k) > -1; });
      var score = hits.length * 3 + (s.goals.indexOf(goal) > -1 ? 2 : 0) + (s.goals[0] === goal ? 1 : 0);
      return { s: s, score: score, hits: hits, tie: (seed + s.id * 37) % 101 };
    }).sort(function (a, b) { return b.score - a.score || b.tie - a.tie; });
  }

  /* ── 말투 ── */
  var TONE_STYLES = [
    '친구한테 말하듯 편한 반말',
    '다정한 존댓말 (~해요)',
    '단정한 존댓말 (~입니다)',
    '유쾌하고 장난스럽게',
    '담백하고 짧게'
  ];
  function tone() { return store.get('tone', null); }
  function toneLines() {
    var t = tone(), out = [];
    if (!t) return ['- 스레드에서 흔히 쓰는 편한 말투. 사람이 직접 쓴 것처럼 자연스럽게.'];
    if (t.style) out.push('- 말투: ' + t.style);
    if (t.likes) out.push('- 자주 쓰는 말: ' + t.likes);
    if (t.bans) out.push('- 절대 쓰지 않는 말: ' + t.bans);
    if (t.sample) out.push('- 아래는 내가 직접 쓴 글이다. 문장 길이, 말끝, 분위기를 그대로 따라 한다.\n"""\n' + t.sample + '\n"""');
    if (!out.length) out.push('- 스레드에서 흔히 쓰는 편한 말투. 사람이 직접 쓴 것처럼 자연스럽게.');
    return out;
  }

  /* ── 프롬프트 만들기 ── */
  var GOAL_END = {
    v: '마지막 줄은 여운이 남는 한 줄로 끝낸다. 광고 문구는 넣지 않는다.',
    c: '마지막 줄은 누구나 한마디로 답할 수 있는 질문으로 끝낸다.',
    s: '마지막 줄은 부담 없는 방문·예약·문의 안내 한 줄로 끝낸다. (예: 프로필에 위치 있어)',
    t: '마지막 줄은 내가 지키는 것 한 줄로 끝낸다. 광고 문구는 넣지 않는다.'
  };
  function buildPrompt(c, s, material, goal, single) {
    var t = tone() || {};
    var L = [];
    L.push('너는 소상공인의 스레드(Threads) 글을 대신 써주는 카피라이터야.');
    L.push('아래 [글 구조]의 순서를 그대로 지켜서, [소재]로 스레드 글 1개를 써줘.');
    L.push('');
    L.push('[내 가게]');
    L.push('- 업종: ' + c.name);
    if (c.brandName || t.name) L.push('- 이름: ' + (c.brandName || t.name));
    if (c.brandIntro || t.intro) L.push('- 소개: ' + (c.brandIntro || t.intro));
    L.push('');
    L.push('[소재]');
    L.push(material || '(여기에 오늘 쓸 소재를 적으세요)');
    L.push('');
    L.push('[글 구조: ' + s.n + ']');
    s.flow.forEach(function (f, i) { L.push((i + 1) + '. ' + fill(f, c)); });
    L.push('');
    L.push('[첫 문장(후킹) 만드는 법 — 간다 마사노리·기누타 준이치의 카피 원칙]');
    L.push('- 첫 문장이 전부다. 스크롤을 멈추게 못 하면 나머지는 아무도 안 읽는다. 글에서 가장 공을 들인다.');
    L.push('- 첫 문장은 넷 중 하나로 연다: ① 읽는 사람이 겪는 문제를 콕 짚기 ② 지금 봐야 하는 이유(급함) ③ 갖고 싶은 것·되고 싶은 모습 건드리기 ④ 답하고 싶어지는 질문.');
    L.push('- 첫 두 줄 안에 누구에게 하는 말인지 콕 집어 부른다. (예: "' + fill('{when}', c) + ' 고민인 분")');
    L.push('- 첫 문장 후보 5개를 속으로 만들고, 아래 8가지 중 몇 개가 들어갔는지 세어 3개 이상 들어간 가장 센 것을 쓴다. 이 과정은 보여주지 않는다.');
    HOOK_CHECK.forEach(function (k) { L.push('  · ' + HOOK_KINDS[k] + ': ' + HOOK_HOW[k]); });
    L.push('- 이 구조에 잘 맞는 후킹: ' + hookLabel(s) + '. 참고할 첫 문장: ' + fill(s.hook, c) + ' (그대로 베끼지 말고 소재로 새로 쓴다)');
    L.push('- 둘째 줄은 첫 줄의 궁금증을 바로 풀지 말고 한 번 더 당긴다.');
    L.push('- 숫자와 급함은 소재에 있는 사실로만 쓴다. 없으면 의외·이야기·질문으로 세게 만든다.');
    L.push('');
    L.push('[내 말투]');
    toneLines().forEach(function (x) { L.push(x); });
    L.push('');
    L.push('[규칙]');
    L.push('- 첫 문장은 25자 안쪽. 설명하지 말고 장면이나 숫자나 질문으로 친다.');
    L.push('- 한 문장에 한 줄. 두세 줄마다 빈 줄을 넣는다.');
    L.push('- 전체 300자 안팎, 최대 450자.');
    L.push('- 소재에 없는 숫자, 후기, 효과, 사실을 지어내지 않는다.');
    L.push('- "최고", "대박", "역대급" 같은 빈 과장은 쓰지 않는다. 세기는 과장이 아니라 구체성에서 나온다.');
    L.push('- 해시태그 없음. 이모지는 0~1개.');
    L.push('- ' + GOAL_END[goal || 'v']);
    if (c.note) L.push('- ' + c.note);
    L.push('');
    L.push('[출력]');
    if (single) {
      L.push('바로 올릴 수 있는 완성 글 1개만 쓴다.');
      L.push('제목, 설명, 따옴표, 번호를 붙이지 말고 글 본문만 보여줘.');
    } else {
      L.push('1) 바로 올릴 수 있는 완성 글 1개');
      L.push('2) 첫 문장만 바꾼 다른 버전 2개. 각각 다른 방식(예: 질문형, 숫자형, 문제 짚기형)으로 쓰고 어떤 방식인지 괄호로 적는다.');
      L.push('설명은 붙이지 말고 글만 보여줘.');
    }
    return L.join('\n');
  }
  /* 구조가 쓰는 후킹 종류를 사람이 읽는 말로 */
  function hookLabel(s) { return (s.hk || []).map(function (k) { return HOOK_KINDS[k]; }).join(' + '); }

  /* 제미나이는 주소로 글을 미리 넣어 줄 수 없어서, 프롬프트를 복사한 뒤 제미나이를 연다 */
  var GEMINI = 'https://gemini.google.com/app';

  /* 내 자료에서 소재 뽑기 */
  var INFO_MAX = 6000;
  function buildMinePrompt(c, info, asJson) {
    var t = tone() || {}, L = [];
    info = (info || '').trim().slice(0, INFO_MAX);
    L.push('너는 소상공인의 스레드(Threads) 글감을 찾아 주는 편집자야.');
    L.push('[내 자료]와 함께 올린 캡처·사진·파일을 보고, 스레드 글로 쓸 만한 소재 10개를 뽑아줘.');
    L.push('');
    var nm = (c && c.brandName) || t.name, intro = (c && c.brandIntro) || t.intro;
    if (c || nm || intro) {
      L.push('[내 가게]');
      if (c) L.push('- 업종: ' + c.name);
      if (nm) L.push('- 이름: ' + nm);
      if (intro) L.push('- 소개: ' + intro);
      L.push('');
    }
    L.push('[내 자료]');
    L.push(info ? '"""\n' + info + '\n"""' : '(글 자료는 없다. 함께 올린 캡처·사진·파일을 본다.)');
    L.push('');
    L.push('[규칙]');
    L.push('- 자료에 실제로 있는 내용만 쓴다. 없는 숫자, 후기, 사실을 지어내지 않는다.');
    L.push('- 소재 하나는 한 줄, 40자 안팎. 장면, 숫자, 사람이 보이게 구체적으로 쓴다.');
    L.push('- 소재 문장 자체가 첫 문장이 될 만큼 세게 쓴다: 문제 짚기, 질문, 숫자, 의외, 이야기 중 하나가 꼭 들어가게.');
    L.push('- 서로 겹치지 않게 고른다: 손님 이야기, 만드는 과정, 가격과 기준, 실수와 배운 점, 새 소식, 자주 받는 질문 등.');
    L.push('- 자료에 있는 전화번호, 주소, 사람 이름 같은 개인정보는 소재에 넣지 않는다.');
    if (c && c.note) L.push('- ' + c.note);
    L.push('');
    L.push('[출력]');
    if (asJson) L.push('소재 10개를 JSON 문자열 배열로만 답한다. 예: ["소재 하나", "소재 둘"]');
    else L.push('번호를 붙여 10줄만 쓴다. 설명은 붙이지 않는다.');
    return L.join('\n');
  }
  /* 글 파일(txt 등)을 읽어 글자로 돌려준다 */
  function readText(file) {
    return new Promise(function (ok, no) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result || '')); };
      r.onerror = function () { no(new Error('read')); };
      r.readAsText(file);
    });
  }
  /* 글 생성 서버가 설정되어 있으면 사이트 안에서 바로 글을 받는다 */
  function apiUrl() { return (typeof TL_API === 'string' && TL_API) ? TL_API.replace(/\/+$/, '') : ''; }
  function generate(prompt) {
    return fetch(apiUrl() + '/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt })
    }).then(function (r) {
      return r.json().then(function (d) { if (!r.ok || !d.text) throw new Error(d.error || '글을 만들지 못했어요. 다시 눌러 주세요.'); return d.text; },
        function () { throw new Error('글을 만들지 못했어요. 다시 눌러 주세요.'); });
    }, function () { throw new Error('인터넷 연결을 확인하고 다시 눌러 주세요.'); });
  }
  function threadsSearch(q) { return 'https://www.threads.com/search?q=' + encodeURIComponent(q) + '&serp_type=default'; }

  /* ── 공통 머리말·꼬리말 ── */
  function chrome(active) {
    var links = [['index.html', '글 만들기', 'make'], ['category.html', '업종별 구조', 'cat'], ['tone.html', '내 말투', 'tone']];
    var logo = '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><circle cx="13.5" cy="13.5" r="9" fill="#11141c" stroke="#c9a227" stroke-width="3"/><path d="M20.5 20.5 28 28" stroke="#11141c" stroke-width="4" stroke-linecap="round"/><path d="M9.5 12h8M9.5 15.5h5" stroke="#c9a227" stroke-width="1.8" stroke-linecap="round"/></svg>';
    var nav = links.map(function (l) {
      return '<a href="' + l[0] + '"' + (l[2] === active ? ' class="on" aria-current="page"' : '') + '>' + l[1] + '</a>';
    }).join('');
    var h = document.createElement('header'); h.className = 'top';
    h.innerHTML = '<div class="wrap top-in"><a class="brand" href="index.html">' + logo + '<span>스레드렌즈</span></a><nav class="nav" aria-label="메뉴">' + nav + '</nav></div>';
    document.body.insertBefore(h, document.body.firstChild);
    var f = document.createElement('footer'); f.className = 'foot';
    f.innerHTML = '<div class="wrap"><strong>스레드렌즈</strong><p>사장님 가게를 알리는 스레드 글 구조 모음. 지금은 모두 무료입니다.</p><p class="small">말투와 찜한 계정은 지금 쓰는 기기에만 저장됩니다. 글은 AI가 쓰므로, 올리기 전에 사실과 다른 내용이 없는지 꼭 읽어 보세요.</p></div>';
    document.body.appendChild(f);
    var b = document.createElement('nav'); b.className = 'tabbar'; b.setAttribute('aria-label', '아래 메뉴'); b.innerHTML = nav;
    document.body.appendChild(b);
  }

  window.TL = { store: store, $: $, $all: $all, esc: esc, cat: cat, struct: struct, fill: fill, param: param, toast: toast, copy: copy,
    rank: rank, tone: tone, TONE_STYLES: TONE_STYLES, buildPrompt: buildPrompt, hookLabel: hookLabel, GEMINI: GEMINI, INFO_MAX: INFO_MAX, buildMinePrompt: buildMinePrompt, readText: readText, apiUrl: apiUrl, generate: generate, threadsSearch: threadsSearch, chrome: chrome };
})();
