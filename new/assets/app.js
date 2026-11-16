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
  function fill(t, c) {
    return t.replace(/\{(biz|when|item|cust|owner)\}/g, function (m, k) { return c[k]; });
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
    if (t.name) L.push('- 이름: ' + t.name);
    if (t.intro) L.push('- 소개: ' + t.intro);
    L.push('');
    L.push('[소재]');
    L.push(material || '(여기에 오늘 쓸 소재를 적으세요)');
    L.push('');
    L.push('[글 구조: ' + s.n + ']');
    s.flow.forEach(function (f, i) { L.push((i + 1) + '. ' + fill(f, c)); });
    L.push('첫 문장 느낌 예시: ' + fill(s.hook, c) + ' (그대로 베끼지 말고 소재에 맞게 새로 쓴다)');
    L.push('');
    L.push('[내 말투]');
    toneLines().forEach(function (x) { L.push(x); });
    L.push('');
    L.push('[규칙]');
    L.push('- 첫 문장은 20자 안팎. 읽던 사람이 손을 멈추게 쓴다.');
    L.push('- 한 문장에 한 줄. 두세 줄마다 빈 줄을 넣는다.');
    L.push('- 전체 300자 안팎, 최대 450자.');
    L.push('- 소재에 없는 숫자, 후기, 효과, 사실을 지어내지 않는다.');
    L.push('- "최고", "대박", "지금 바로" 같은 광고 말투를 쓰지 않는다.');
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
      L.push('2) 첫 문장만 바꾼 다른 버전 2개');
      L.push('설명은 붙이지 말고 글만 보여줘.');
    }
    return L.join('\n');
  }
  function aiUrl(which, prompt) {
    var q = encodeURIComponent(prompt);
    return which === 'claude' ? 'https://claude.ai/new?q=' + q : 'https://chatgpt.com/?q=' + q;
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
    f.innerHTML = '<div class="wrap"><strong>스레드렌즈</strong><p>사장님 가게를 알리는 스레드 글 구조 모음. 지금은 모두 무료입니다.</p><p class="small">말투와 찜한 계정은 지금 쓰는 기기에만 저장됩니다. 글은 ChatGPT 같은 AI가 쓰므로, 올리기 전에 사실과 다른 내용이 없는지 꼭 읽어 보세요.</p></div>';
    document.body.appendChild(f);
    var b = document.createElement('nav'); b.className = 'tabbar'; b.setAttribute('aria-label', '아래 메뉴'); b.innerHTML = nav;
    document.body.appendChild(b);
  }

  window.TL = { store: store, $: $, $all: $all, esc: esc, cat: cat, struct: struct, fill: fill, param: param, toast: toast, copy: copy,
    rank: rank, tone: tone, TONE_STYLES: TONE_STYLES, buildPrompt: buildPrompt, aiUrl: aiUrl, apiUrl: apiUrl, generate: generate, threadsSearch: threadsSearch, chrome: chrome };
})();
