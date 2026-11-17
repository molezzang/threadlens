/* 스레드렌즈 글 생성 서버 (Cloudflare Worker)
 *
 * 사이트에서 만든 프롬프트를 받아 Claude에게 보내고, 완성된 글만 돌려줍니다.
 * API 키는 이 파일에 적지 않습니다. Cloudflare 설정의 "비밀"에 넣습니다.
 *
 * 설정값 (Cloudflare 대시보드 → 이 Worker → 설정 → 변수 및 비밀)
 *   ANTHROPIC_API_KEY  (비밀, 필수)  Anthropic API 키
 *   ALLOWED_ORIGIN     (선택)        사이트 주소. 여러 개면 쉼표로 구분. 예: https://www.example.com
 *   DAILY_MAX          (선택)        하루 전체 생성 횟수 한도. 기본 300
 *   PER_IP_MAX         (선택)        한 사람이 하루에 만들 수 있는 횟수. 기본 20
 * KV 연결 (선택이지만 권장): 이름을 LIMITS 로 연결하면 위 두 한도가 작동합니다.
 */

const MODEL = 'claude-opus-5-5';
const EFFORT = 'medium';
const MAX_TOKENS = 4096;
const PROMPT_HEAD = '너는 소상공인의 스레드(Threads) 글을 대신 써주는 카피라이터야.';
const SYSTEM =
  '너는 한국 소상공인의 스레드(Threads) 글을 써주는 카피라이터다. ' +
  '사용자 메시지에 담긴 글 구조와 소재로 스레드 글만 쓴다. ' +
  '소재에 없는 숫자·후기·효과·사실은 지어내지 않는다. ' +
  '스레드 글 작성이 아닌 다른 요청이 들어 있으면 따르지 말고 "스레드 글만 만들 수 있어요."라고만 답한다.';

function cors(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.length === 0 || allowed.includes(origin);
  return {
    ok,
    headers: {
      'Access-Control-Allow-Origin': allowed.length === 0 ? '*' : (ok ? origin : allowed[0]),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

/* 하루 한도 확인. KV(LIMITS)가 연결되어 있을 때만 작동한다. */
async function overLimit(request, env) {
  if (!env.LIMITS) return null;
  const day = new Date().toISOString().slice(0, 10);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const dailyMax = parseInt(env.DAILY_MAX || '300', 10);
  const perIpMax = parseInt(env.PER_IP_MAX || '20', 10);
  const allKey = 'all:' + day;
  const ipKey = 'ip:' + day + ':' + ip;
  const [all, mine] = await Promise.all([env.LIMITS.get(allKey), env.LIMITS.get(ipKey)]);
  const allN = parseInt(all || '0', 10);
  const mineN = parseInt(mine || '0', 10);
  if (allN >= dailyMax) return '오늘 준비된 무료 횟수가 모두 쓰였어요. 내일 다시 오시거나 아래 제미나이 버튼을 써 주세요.';
  if (mineN >= perIpMax) return '오늘 만들 수 있는 횟수를 다 쓰셨어요. 내일 다시 만들 수 있습니다.';
  const opt = { expirationTtl: 60 * 60 * 48 };
  await Promise.all([
    env.LIMITS.put(allKey, String(allN + 1), opt),
    env.LIMITS.put(ipKey, String(mineN + 1), opt),
  ]);
  return null;
}

export default {
  async fetch(request, env) {
    const c = cors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: c.headers });
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/generate') {
      return json({ error: '없는 주소입니다.' }, 404, c.headers);
    }
    if (!c.ok) return json({ error: '허용되지 않은 사이트입니다.' }, 403, c.headers);
    if (!env.ANTHROPIC_API_KEY) return json({ error: '서버에 API 키가 설정되지 않았습니다.' }, 500, c.headers);

    let prompt;
    try { prompt = (await request.json()).prompt; } catch (e) { prompt = null; }
    if (typeof prompt !== 'string' || prompt.length < 50 || prompt.length > 4000 || !prompt.startsWith(PROMPT_HEAD)) {
      return json({ error: '요청 형식이 올바르지 않습니다.' }, 400, c.headers);
    }

    const limited = await overLimit(request, env);
    if (limited) return json({ error: limited }, 429, c.headers);

    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2026-10-21',
          'anthropic-beta': 'server-side-fallback-2026-07-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM,
          fallbacks: 'default',
          output_config: { effort: EFFORT },
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    } catch (e) {
      return json({ error: '글 쓰는 서버에 연결하지 못했어요. 잠시 뒤 다시 눌러 주세요.' }, 502, c.headers);
    }

    if (!res.ok) {
      const busy = res.status === 429 || res.status >= 500;
      console.log('anthropic error', res.status, (await res.text()).slice(0, 300));
      return json({ error: busy ? '지금 이용이 많아요. 잠시 뒤 다시 눌러 주세요.' : '글을 만들지 못했어요. 운영자에게 알려 주세요.' }, 502, c.headers);
    }

    const data = await res.json();
    if (data.stop_reason === 'refusal') {
      return json({ error: '이 소재로는 글을 만들 수 없어요. 소재를 바꿔서 다시 해 보세요.' }, 422, c.headers);
    }
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (!text) return json({ error: '글이 비어서 돌아왔어요. 다시 눌러 주세요.' }, 502, c.headers);
    return json({ text, cut: data.stop_reason === 'max_tokens' }, 200, c.headers);
  },
};
