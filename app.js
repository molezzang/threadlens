/* THREADLENS — 스레드 성장 인텔리전스 (클라이언트 전용, localStorage 저장) */
"use strict";

/* collect.js와 동일 내용 내장 — 서버(Node) 없이 index.html만 열어도 [수집 스크립트 복사]가 작동하도록 */
const COLLECT_SCRIPT = String.raw`(async () => {
  const P = { posts: {} };
  const pk = s => {
    s = (s || "").replace(/,/g, "").trim();
    const m = s.match(/^([\d.]+)(만|천)?$/);
    return m ? Math.round(parseFloat(m[1]) * (m[2] === "만" ? 1e4 : m[2] === "천" ? 1e3 : 1)) : 0;
  };
  const collect = () => {
    document.querySelectorAll('div[data-pressable-container]').forEach(c => {
      const t = c.querySelector("time[datetime]");
      const l = c.querySelector('a[href*="/post/"]');
      if (!t || !l) return;
      const cnt = { like: 0, reply: 0, repost: 0, share: 0 };
      c.querySelectorAll("svg[aria-label]").forEach(s => {
        const map = { "좋아요": "like", "좋아요 취소": "like", "답글": "reply", "리포스트": "repost", "공유하기": "share" };
        const lab = s.getAttribute("aria-label");
        if (!(lab in map)) return;
        const b = s.closest('div[role="button"],button,a');
        const n = b ? (b.innerText || "").trim() : "";
        if (n) cnt[map[lab]] = Math.max(cnt[map[lab]], pk(n));
      });
      const lines = (c.innerText || "").split("\n").map(x => x.trim());
      const dt = (t.innerText || "").trim();
      const i = lines.findIndex(x => x === dt);
      const body = lines.slice(i + 1);
      while (body.length && (/^[\d.,]+(만|천)?$/.test(body[body.length - 1]) || body[body.length - 1] === "/" || /^답글 .*더 보기$/.test(body[body.length - 1]) || body[body.length - 1] === "번역" || body[body.length - 1] === "")) body.pop();
      P.posts[l.getAttribute("href")] = {
        at: t.getAttribute("datetime"), text: body.join("\n").trim(),
        likes: cnt.like, replies: cnt.reply, reposts: cnt.repost, shares: cnt.share
      };
    });
    return Object.keys(P.posts).length;
  };
  console.log("%cTHREADLENS 수집 시작 — 자동 스크롤 중… (탭을 건드리지 마세요)", "color:#d9b878;font-weight:bold");
  let prev = -1, stall = 0, n = collect();
  for (let i = 0; i < 250 && stall < 12; i++) {
    window.scrollBy(0, Math.round(innerHeight * 0.85));
    await new Promise(r => setTimeout(r, 550));
    n = collect();
    stall = n === prev ? stall + 1 : 0;
    prev = n;
    if (i % 10 === 0) console.log("수집된 게시물:", n);
  }
  const bt = document.body.innerText;
  const f = bt.match(/팔로워 ([\d,.]+[만천]?)명/);
  const handle = (location.pathname.match(/@[\w.]+/) || [""])[0];
  const h1 = document.querySelector("h1");
  const out = {
    name: h1 ? h1.innerText.trim() : handle,
    handle,
    followers: f ? pk(f[1]) : 0,
    harvestedAt: new Date().toISOString(),
    posts: Object.entries(P.posts).sort((a, b) => a[1].at.localeCompare(b[1].at))
      .map(([k, p]) => ({ tid: k, text: p.text, at: p.at, views: 0, likes: p.likes, replies: p.replies, reposts: p.reposts, shares: p.shares }))
  };
  const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "threadlens-harvest.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  console.log("%c✓ 수집 완료! " + out.posts.length + "개 게시물 → threadlens-harvest.json 다운로드됨. THREADLENS의 [수집 결과 가져오기]에서 이 파일을 선택하세요.", "color:#0ca30c;font-weight:bold;font-size:14px");
})();`;

/* ============================== 유틸 ============================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtN = n => Math.round(n).toLocaleString("ko-KR");
const fmtC = n => n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, "") + "만" : fmtN(n);
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function relTime(iso) {
  const h = (Date.now() - new Date(iso)) / 36e5;
  if (h < 1) return Math.max(1, Math.round(h * 60)) + "분 전";
  if (h < 24) return (Math.round(h * 10) / 10) + "h 전";
  const d = h / 24;
  if (d < 30) return Math.round(d * 10) / 10 + "일 전";
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
function whenLabel(iso) {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${String(d.getHours()).padStart(2, "0")}시 · ${d.getMonth() + 1}/${d.getDate()}`;
}

/* ============================== 데모 데이터 ============================== */
/* [daysAgo, hour, views, likes, replies, reposts, text] — 수07/일22/금20 패턴 내장 */
const DEMO_POSTS = [
  [0.2, 7, 3814, 152, 61, 15, "17년 동안 심장 시술방에서 일하며\n깨달은 단 하나의 진실.\n\n혈관은 하루아침에 막히지 않습니다.\n10년 넘게 조용히 좁아지다가, 어느 날 갑자기 신호를 보냅니다.\n\n오늘부터 할 수 있는 3가지\n1. 저녁 라면 국물 반만 남기기\n2. 엘리베이터 대신 계단 2층만\n3. 잠들기 전 스트레칭 5분\n\n가족에게 공유해 주세요. 늦기 전에."],
  [0.3, 5, 1377, 98, 44, 10, "비가 오나 눈이 오나 바람이 부나,\n새벽 응급 시술은 멈추지 않습니다.\n\n오늘 새벽 3시에 들어온 55세 환자분,\n골든타임 안에 도착해서 다행이었어요.\n\n가슴 통증, 절대 참지 마세요."],
  [0.3, 9, 1420, 44, 9, 5, "알아두면 좋은 소소한 혈압 Tip 모음집!\n\n✓ 아침 기상 직후가 하루 중 가장 위험한 시간\n✓ 혈압 잴 때는 앉아서 5분 쉬고\n✓ 커피는 측정 30분 전 금지\n\n저장해두고 부모님 혈압 재드릴 때 써먹으세요."],
  [0.6, 20, 2267, 71, 13, 5, "17년차 방사선사가 심혈관 지키려고\n실제로 하고 있는 것들\n\n1. 콜레스테롤 약 꾸준히 (LDL 250이었습니다)\n2. 라면은 한 달에 2번만\n3. 주 3회 30분 걷기\n4. 아버지 심근경색 이후 가족 전원 검진\n\n유전은 못 바꿔도 습관은 바꿀 수 있어요."],
  [0.7, 17, 818, 59, 14, 3, "평일 저녁 8시엔 요정이 나타나요 ✨\n\n퇴근하고 아이 숙제 봐주는 시간.\n심장은 병원에서, 마음은 집에서 지킵니다."],
  [1, 7, 5100, 180, 72, 22, "심근경색으로 실려온 40대 환자분이\n시술 끝나고 처음 한 말.\n\n\"어제까지 멀쩡했는데요.\"\n\n아닙니다. 몸은 계속 신호를 보내고 있었어요.\n\n놓치기 쉬운 심장 경고 신호 5가지\n1. 계단만 오르면 유독 숨참\n2. 왼쪽 어깨·턱으로 퍼지는 통증\n3. 이유 없는 식은땀\n4. 체한 것 같은 명치 답답함\n5. 전에 없던 극심한 피로\n\n2개 이상이면 검진 받아보세요.\n가족에게도 공유해 주세요."],
  [2, 22, 2900, 120, 38, 14, "아버지가 심근경색으로 쓰러지신 날,\n제 인생이 바뀌었습니다.\n\n그날 이후 저는 심혈관 조영실에서 17년을 일했고,\n제 LDL이 250이라는 걸 알게 됐죠.\n\n가족력은 경고장입니다.\n부모님이 심장병이셨다면, 당신은 검진이 필수예요."],
  [3, 8, 1150, 41, 11, 4, "콜레스테롤 수치, 어디까지가 정상일까요?\n\nLDL(나쁜 콜레스테롤) 기준\n· 정상: 130 미만\n· 주의: 130~159\n· 위험: 160 이상\n· 가족력 있으면 100 미만 목표\n\n저는 250이었습니다. 약 시작하고 90까지 내렸어요.\n숫자는 거짓말하지 않습니다."],
  [4, 12, 620, 22, 6, 1, "점심 뭐 드셨나요?\n\n국물 다 마시면 나트륨 하루치 절반이 넘어요.\n오늘부터 국물 반만!"],
  [5, 7, 3300, 130, 51, 17, "담배 끊은 지 1년이 지나면\n심장에 무슨 일이 생기는지 아세요?\n\n· 20분 후: 혈압·맥박 정상화 시작\n· 12시간 후: 혈중 일산화탄소 정상\n· 1년 후: 심장병 위험 절반으로\n· 15년 후: 비흡연자와 동일 수준\n\n늦은 때는 없습니다.\n금연 시작한 분들, 댓글로 며칠째인지 알려주세요. 같이 응원해요."],
  [6, 15, 480, 18, 4, 1, "오늘의 조영실 한 컷.\n\n스텐트 하나가 사람을 살립니다.\n기술의 발전에 매일 감사해요."],
  [7, 7, 2750, 105, 40, 12, "병원 사람들만 아는 사실 하나.\n\n심정지 환자의 생존율을 가르는 건\n병원이 아니라 '목격자'입니다.\n\nCPR 4분의 기적\n1. 어깨를 두드리며 의식 확인\n2. 119 신고 + 주변에 AED 요청\n3. 가슴 중앙을 분당 100~120회 압박\n4. 구급대 도착까지 멈추지 않기\n\n이 글 하나가 언젠가 누군가를 살릴 수 있어요. 저장해 두세요."],
  [8, 22, 2100, 88, 29, 9, "일요일 밤, 내일 출근이 두려운 당신에게.\n\n스트레스는 진짜로 심장을 공격합니다.\n'상심증후군'이라는 병이 실제로 있어요.\n\n오늘 밤은 일 생각 대신,\n따뜻한 물로 샤워하고 일찍 누우세요.\n\n당신의 심장은 소중하니까."],
  [9, 10, 530, 19, 5, 2, "혈관 나이 자가 테스트\n\n□ 계단 3층에 숨이 찬다\n□ 손발이 자주 차다\n□ 눈 밑이 자주 붓는다\n□ 담배를 피운다\n□ 아침에 일어나기 힘들다\n\n3개 이상이면 혈관 나이가 실제보다 10살 많을 수 있어요."],
  [10, 20, 1900, 77, 25, 8, "금요일 밤 치킨에 맥주, 저도 좋아합니다.\n\n하지만 조영실에서 본 진실 하나.\n주말마다 폭식+폭음 반복하면\n혈관은 '매주 공사판'이 됩니다.\n\n먹더라도 이것만 지키세요\n1. 튀김 껍질 절반은 남기기\n2. 맥주는 500 한 잔까지\n3. 다음날 아침 30분 걷기\n\n즐기면서 지키는 게 오래갑니다."],
  [11, 7, 2400, 95, 33, 10, "'가슴이 두근두근' 그냥 넘기지 마세요.\n\n부정맥은 생각보다 흔하고,\n방치하면 뇌졸중 위험이 5배까지 올라갑니다.\n\n이런 두근거림은 병원행\n· 가만히 있는데 심장이 벌렁거림\n· 맥이 널뛰듯 불규칙\n· 두근거림+어지러움 동반\n\n스마트워치 심전도 기능, 한 번씩 확인해 보세요."],
  [12, 13, 450, 16, 3, 1, "오늘도 무사히.\n\n시술 7건, 모두 잘 끝났습니다.\n이 일을 사랑하는 이유예요."],
  [13, 21, 1600, 62, 21, 6, "토요일 밤에 읽는 심장 이야기.\n\n심장은 하루 10만 번 뜁니다.\n평생이면 30억 번.\n\n단 한 번도 쉬지 않고 일하는 유일한 장기에게\n우리가 해줄 수 있는 최소한의 예의는\n\n담배 안 물리기, 기름 덜 붓기, 가끔 뛰게 해주기."],
  [14, 7, 4200, 160, 58, 19, "건강검진에서 '경계' 판정 받고\n그냥 넘긴 적 있으신가요?\n\n조영실에서 만나는 환자의 절반은\n'경계' 단계에서 아무것도 안 한 분들입니다.\n\n경계 판정 받았을 때 해야 할 일\n1. 3개월 후 재검 예약부터\n2. 하루 나트륨 절반 줄이기\n3. 주 150분 걷기 (하루 20분꼴)\n4. 가족력 있으면 바로 진료\n\n'괜찮겠지'가 제일 무섭습니다.\n부모님 검진 결과지도 한번 봐드리세요."],
  [15, 18, 720, 26, 7, 2, "퇴근길 5분 습관.\n\n지하철 한 정거장 먼저 내려 걷기.\n한 달이면 유산소 300분입니다."],
  [16, 9, 890, 34, 9, 3, "약 드시는 부모님께 꼭 확인해야 할 것\n\n1. 아스피린+진통제 같이 드시는지\n2. 약 드시고 자몽 드시는지 (상호작용!)\n3. 혈압약 임의로 끊으신 적 있는지\n\n이번 주말 전화로 여쭤보세요."],
  [17, 22, 1750, 70, 24, 7, "일요일 밤 고백 하나.\n\n의료인인 저도 건강검진이 무서웠습니다.\nLDL 250 결과지를 받던 날, 손이 떨렸어요.\n\n하지만 아는 게 모르는 것보다 낫습니다.\n숫자를 알아야 바꿀 수 있으니까요.\n\n미뤄둔 검진 있으면 내일 예약하세요."],
  [18, 11, 510, 20, 4, 1, "물 얼마나 드세요?\n\n혈액의 90%는 물입니다.\n물 부족 = 피가 끈적해진다는 뜻.\n\n하루 1.5L, 오늘부터."],
  [20, 7, 2600, 100, 37, 11, "새벽 조깅하다 쓰러지는 사람들의 공통점.\n\n겨울·환절기 새벽, 급격한 온도차는\n혈관을 갑자기 수축시킵니다.\n\n안전하게 아침 운동하는 법\n1. 기상 후 30분 지나서 나가기\n2. 실내에서 5분 워밍업 먼저\n3. 목·손목 따뜻하게\n4. 가슴 답답하면 즉시 중단\n\n운동도 '어떻게'가 중요합니다."],
  [21, 22, 1850, 74, 26, 8, "심장이 보내는 마지막 경고를\n무시한 환자를 잊을 수 없습니다.\n\n\"바빠서요\"\n\n이 한마디가 조영실에서 제일 슬픈 말이에요.\n건강은 미룰수록 이자가 붙습니다."],
  [22, 14, 430, 15, 3, 1, "오후 3시 당 떨어질 때,\n초콜릿 대신 아몬드 한 줌 어때요?\n\n불포화지방산이 혈관 청소를 도와줍니다."],
  [24, 20, 1700, 66, 22, 7, "불금에 드리는 심장 지킴 술자리 가이드\n\n1. 빈속에 첫 잔 금지 (혈압 급변동)\n2. 물 한 잔 = 술 한 잔 규칙\n3. 안주는 마른안주보다 두부김치\n4. 2차는 노래방 말고 집으로\n\n즐거운 금요일, 심장도 즐겁게."],
  [25, 8, 950, 36, 10, 3, "혈압약, 평생 먹어야 하나요?\n\n제일 많이 받는 질문인데요.\n\n답: 사람마다 다릅니다.\n체중 감량+운동으로 끊는 분도 있고,\n평생 관리가 필요한 분도 있어요.\n\n확실한 건, '임의로 끊으면' 더 위험하다는 것."],
  [27, 7, 2300, 92, 30, 9, "환자분들이 제일 많이 후회하는 것 1위.\n\n\"진작 병원 올걸.\"\n\n심장 검사, 생각보다 간단합니다\n· 심전도: 5분, 만원 안팎\n· 심장초음파: 20분\n· 관상동맥 CT: 10분\n\n대단한 결심이 필요한 게 아니에요.\n건강보험 적용되는 것도 많습니다."],
  [28, 16, 560, 21, 5, 2, "계단 오르기 딱 2층만.\n\n엘리베이터 기다리는 시간이면\n심장 운동 하나가 끝납니다."],
  [30, 22, 1950, 80, 27, 8, "부모님이 나이 들수록 말수가 줄어드는 이유,\n혹시 심장 때문일 수도 있습니다.\n\n심부전 초기엔 피곤하고 숨차서\n말하는 것조차 힘들어져요.\n\n이번 주말, 부모님과 통화할 때\n목소리 기운을 한번 들어보세요."],
  [31, 10, 700, 27, 7, 2, "커피와 심장의 진실\n\n하루 2~3잔까지는 오히려 심혈관에 이로울 수 있어요.\n단, 믹스커피 말고 블랙 기준입니다.\n\n설탕+프림이 문제지, 카페인이 죄가 아니에요."],
  [33, 7, 2150, 85, 28, 9, "간호사도 의사도 아닌 방사선사가\n심장 이야기를 하는 이유.\n\n조영실에서 17년,\n막힌 혈관이 뚫리는 순간을 수만 번 봤습니다.\n\n그리고 알게 됐어요.\n그 시술의 절반은 '예방 가능'했다는 걸.\n\n그래서 씁니다. 당신이 여기 오지 않도록."],
  [35, 19, 640, 24, 6, 2, "저녁 늦게 먹으면 왜 안 좋을까요?\n\n자는 동안에도 소화기관이 일하면\n혈압이 떨어지지 않습니다.\n\n잠들기 3시간 전 식사 마감, 오늘부터!"],
  [38, 21, 1500, 58, 19, 6, "토요일 밤의 소소한 자랑.\n\n제 글 보고 부모님 검진 예약했다는\nDM을 받았습니다.\n\n이 맛에 씁니다. 감사합니다."],
  [40, 7, 1980, 78, 26, 8, "40대가 되면 심장에 생기는 변화 3가지\n\n1. 혈관 탄력 저하 → 혈압 상승 시작\n2. 기초대사량 감소 → 같은 식사에도 살\n3. 회복력 저하 → 무리하면 티가 남\n\n30대의 습관으로 40대를 살면 안 되는 이유입니다."],
  [43, 12, 390, 14, 3, 1, "점심 먹고 10분 산책.\n\n혈당 스파이크를 잡는\n가장 저렴한 방법입니다."],
  [46, 22, 1680, 65, 22, 7, "잠들기 전 스마트폰이 심장에도 나쁜 이유.\n\n수면의 질이 떨어지면\n혈압·혈당·염증 수치가 다 같이 올라갑니다.\n\n오늘 밤은 폰 대신 책 한 페이지 어때요?"],
  [49, 7, 1820, 72, 24, 7, "환절기에 심혈관 환자가 늘어나는 이유\n\n기온이 1도 떨어지면\n수축기 혈압은 약 1.3mmHg 올라갑니다.\n\n환절기 심장 지키기\n1. 새벽 외출 시 목도리 필수\n2. 실내외 온도차 10도 이내로\n3. 아침 첫 물 한 잔 미지근하게\n\n부모님께 전달해 주세요."],
  [52, 15, 470, 17, 4, 1, "오늘의 감사.\n\n90세 할머니 시술이 잘 끝났습니다.\n\"고마워요\" 한마디에 피로가 녹네요."],
  [55, 20, 1420, 55, 18, 5, "금요일 퇴근길에 읽는 짧은 글.\n\n심장은 금요일도 야근합니다.\n당신이 쉴 때도 뛰고 있어요.\n\n이번 주말은 심장에게 보너스를 주세요.\n30분 산책이면 충분합니다."],
  [58, 9, 610, 23, 6, 2, "아침 사과가 심장에 좋은 이유\n\n펙틴이 콜레스테롤 흡수를 줄여줍니다.\n껍질째 드세요. 영양의 절반은 껍질에 있어요."],
  [62, 7, 1650, 63, 21, 6, "혈관에 좋다는 영양제, 다 먹어야 할까요?\n\n17년차 의료인의 솔직한 답:\n오메가3 하나면 충분한 분이 대부분입니다.\n\n영양제 10만원어치보다\n라면 국물 남기는 게 더 효과적이에요."],
  [65, 22, 1380, 52, 17, 5, "일요일 밤, 한 주를 마치며.\n\n이번 주 조영실에서 만난 환자는 43명.\n그중 30대가 4명이었습니다.\n\n심장병은 더 이상 노인의 병이 아니에요.\n다음 주도 건강하게, 우리 같이 지켜요."],
  [68, 8, 540, 20, 5, 1, "출근길 버스에서 읽는 심장 상식.\n\n하품이 자주 나오면 심장이 산소를\n더 달라고 조르는 신호일 수 있습니다."]
];

/* ============================== 저장소 ============================== */
const LS_KEY = "threadlens.v1";
const store = {
  data: null,
  load() {
    try { this.data = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { this.data = null; }
    if (!this.data || !this.data.profiles || !this.data.profiles.length) {
      this.data = { activeId: "demo", profiles: [this.makeDemoProfile()], benchmarks: [] };
      this.save();
    }
    if (!this.data.benchmarks) this.data.benchmarks = [];
  },
  save() { localStorage.setItem(LS_KEY, JSON.stringify(this.data)); },
  makeDemoProfile() {
    const now = Date.now();
    return {
      id: "demo", name: "튼튼혈관연구소", handle: "@tt_vessel_lab", followers: 12480, isDemo: true,
      posts: DEMO_POSTS.map(([d, h, views, likes, replies, reposts, text]) => {
        const dt = new Date(now - d * 864e5); dt.setHours(h, Math.floor(Math.random() * 50), 0, 0);
        return { id: uid(), text, at: dt.toISOString(), views, likes, replies, reposts };
      })
    };
  },
  profile() { return this.data.profiles.find(p => p.id === this.data.activeId) || this.data.profiles[0]; }
};

/* ============================== 분석 엔진 ============================== */
const engage = p => (p.likes || 0) + (p.replies || 0) * 2 + (p.reposts || 0) * 3 + (p.shares || 0) * 3;

function stats(posts) {
  if (!posts.length) return { avgE: 0, avgV: 0, totV: 0, totE: 0, rate: 0 };
  const totE = posts.reduce((a, p) => a + engage(p), 0);
  const totV = posts.reduce((a, p) => a + (p.views || 0), 0);
  return { avgE: totE / posts.length, avgV: totV / posts.length, totV, totE, rate: totV ? totE / totV * 100 : 0 };
}
function tierOf(mult) {
  if (mult >= 3) return { cls: "t4", label: "📈 고점 돌파", color: "var(--gold-2)" };
  if (mult >= 1.5) return { cls: "t3", label: "↗ 우상향", color: "#3fc496" };
  if (mult >= 0.8) return { cls: "t2", label: "평균권", color: "var(--ink-2)" };
  return { cls: "t1", label: "저점 구간", color: "var(--s-red)" };
}
/* 참여 누적 곡선 s(t)=t/(t+10h) 기반 24h/7d 추정 */
function project(p) {
  const ageH = Math.max(0.5, (Date.now() - new Date(p.at)) / 36e5);
  const s = t => t / (t + 10);
  const e = engage(p), einf = e / s(ageH);
  return { ageH, e24: ageH >= 24 ? null : Math.round(einf * s(24)), e7d: ageH >= 168 ? null : Math.round(einf * s(168)) };
}
function byHour(posts, avgE) {
  const buckets = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }));
  posts.forEach(p => { const h = new Date(p.at).getHours(); buckets[h].sum += engage(p); buckets[h].n++; });
  return buckets.map(b => ({ n: b.n, avg: b.n ? b.sum / b.n : 0, mult: b.n && avgE ? (b.sum / b.n) / avgE : 0 }));
}
function byDay(posts, avgE) {
  const buckets = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
  posts.forEach(p => { const d = new Date(p.at).getDay(); buckets[d].sum += engage(p); buckets[d].n++; });
  return buckets.map(b => ({ n: b.n, avg: b.n ? b.sum / b.n : 0, mult: b.n && avgE ? (b.sum / b.n) / avgE : 0 }));
}
function heatData(posts, avgE) {
  const m = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ sum: 0, n: 0 })));
  posts.forEach(p => { const d = new Date(p.at); m[d.getDay()][d.getHours()].sum += engage(p); m[d.getDay()][d.getHours()].n++; });
  return m.map(row => row.map(c => ({ n: c.n, mult: c.n && avgE ? (c.sum / c.n) / avgE : 0 })));
}
function bestSlots(posts, avgE) {
  const out = [];
  heatData(posts, avgE).forEach((row, d) => row.forEach((c, h) => { if (c.n) out.push({ d, h, ...c }); }));
  return out.sort((a, b) => (b.mult * Math.log2(b.n + 1)) - (a.mult * Math.log2(a.n + 1))).slice(0, 3);
}

/* ---------- 발행 전 예측 스코어러 ---------- */
const HOOK_WORDS = /(진실|비밀|후회|충격|절대|아무도|사실|이유|경고|공통점|모르|잊을 수 없|단 하나|\d+가지|\d+위|\d+년|\?)/;
const CTA_WORDS = /(저장|공유|댓글|팔로|알려주|남겨주|전달|예약하세요|어때요|주세요)/;
const STORY_WORDS = /(저는|제가|저도|경험|년차|이야기|그날|잊을 수 없|고백|만난|환자)/;
function emojiCount(t) { const m = t.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}✨❤]/gu); return m ? m.length : 0; }

function scoreText(text) {
  const t = (text || "").trim();
  if (!t) return null;
  const lines = t.split("\n"), first = lines[0].trim();
  const paras = t.split(/\n\s*\n/).length;
  const clamp = v => Math.max(5, Math.min(100, Math.round(v)));

  let hook = 20;
  if (first.length > 0 && first.length <= 30) hook += 25; else if (first.length <= 45) hook += 12;
  if (HOOK_WORDS.test(first + (lines[1] || ""))) hook += 30;
  if (/\d/.test(first)) hook += 12;
  if (/[,.…]$|\.\.\.$/.test(first) || (lines[1] !== undefined && lines[1].trim() !== "" && first.length < 35)) hook += 13;
  hook = clamp(hook);

  const avgLine = lines.filter(l => l.trim()).reduce((a, l) => a + l.length, 0) / Math.max(1, lines.filter(l => l.trim()).length);
  let read = 30;
  if (avgLine <= 30) read += 35; else if (avgLine <= 45) read += 22; else if (avgLine <= 60) read += 8;
  if (paras >= 3) read += 25; else if (paras >= 2) read += 14;
  const emo = emojiCount(t);
  if (emo >= 1 && emo <= 6) read += 10; else if (emo > 10) read -= 15;
  read = clamp(read);

  let struct = 20;
  const hasList = /^([0-9]+[.)]|[-·✓□•])/m.test(t);
  if (hasList) struct += 35;
  if (lines.filter(l => l.trim()).length >= 5) struct += 20;
  if (t.length >= 150 && t.length <= 600) struct += 25; else if (t.length >= 80) struct += 12;
  struct = clamp(struct);

  let cta = 15;
  if (CTA_WORDS.test(t)) cta += 45;
  if (/\?/.test(t)) cta += 25;
  if (/(같이|우리|함께)/.test(t)) cta += 15;
  cta = clamp(cta);

  let story = 20;
  if (STORY_WORDS.test(t)) story += 40;
  if (/(당신|여러분|부모님|가족)/.test(t)) story += 25;
  if (/["“]/.test(t)) story += 15;
  story = clamp(story);

  const total = Math.round(hook * .3 + read * .15 + struct * .15 + cta * .2 + story * .2);
  const mult = +(0.4 + Math.pow(total / 100, 1.4) * 4.6).toFixed(2);

  const tips = [];
  const tip = (ok, good, bad) => tips.push({ ok, msg: ok ? good : bad });
  tip(hook >= 70, "첫 줄이 유입 장치 역할을 제대로 합니다. 스크롤이 여기서 멈춰요.", "첫 줄이 곧 유입처입니다. 30자 이내로 줄이고 숫자·질문 같은 유입 장치를 심어보세요.");
  tip(read >= 70, "줄바꿈 리듬이 좋아 모바일에서 끝까지 읽힙니다.", "한 줄을 30자 안팎으로 끊고, 2~3줄마다 빈 줄을 넣으면 완독 트래픽이 올라갑니다.");
  tip(struct >= 70, "목록형 구조라 저장을 부릅니다. 저장은 재방문 트래픽 자산이에요.", "핵심을 1·2·3 목록으로 정리하세요. 저장되는 글이 곧 자산이 됩니다.");
  tip(cta >= 70, "행동 장치가 자연스럽게 심어져 있습니다. 결과값으로 이어지는 마무리예요.", "마지막 줄에 행동 장치 하나를 심으세요 — '저장해 두세요', '가족에게 전달해 주세요' 같은 것.");
  tip(story >= 70, "1인칭 경험이 담겨 신뢰 자산이 쌓입니다.", "'제가 겪은/만난' 실제 경험 한 스푼이 들어가면 체류시간과 신뢰가 같이 올라갑니다.");
  return { hook, read, struct, cta, story, total, mult, tips };
}

/* ---------- 반응층 분석 ---------- */
const PERSONAS = [
  { name: "🎯 행동력 실천파", key: /(방법|가지|Tip|팁|법\n|하세요|습관|체크|테스트|가이드|기준)/, tags: ["#행동력", "#바로 실천", "#저장각", "#꾸준함"], quote: "정보를 받으면 바로 행동으로 옮기는 실행형 트래픽", color: "var(--s-aqua)" },
  { name: "🤝 관계 자산파", key: /(감사|응원|오늘도|밤|주말|마음|고백|자랑|퇴근)/, tags: ["#단골 반응", "#안부", "#관계 자산"], quote: "저점 구간에도 반응을 받쳐주는 단골 지원군 — 계정의 기초 자산", color: "var(--s-red)" },
  { name: "👨‍👩‍👧 가족 건강 지킴이", key: /(부모님|가족|아버지|어머니|공유|전달|검진)/, tags: ["#부모님 걱정", "#가족력", "#공유 유발"], quote: "가족 걱정에 글을 퍼 나르는 확산형 트래픽 — 공유 결과값의 원천", color: "var(--gold)" },
  { name: "📊 수치 검증파", key: /(수치|LDL|혈압|콜레스테롤|부정맥|심전도|스텐트|CPR|기전)/, tags: ["#수치", "#근거", "#깊은 질문"], quote: "정확한 수치와 근거를 파고드는 데이터형 트래픽", color: "var(--s-violet)" }
];
function personaShares(posts) {
  const sums = PERSONAS.map(() => 0); let tot = 0;
  posts.forEach(p => {
    const e = engage(p);
    PERSONAS.forEach((per, i) => { if (per.key.test(p.text)) { sums[i] += e; tot += e; } });
  });
  if (!tot) return PERSONAS.map(() => 25);
  return sums.map(s => Math.round(s / tot * 100));
}

/* ============================== Threads API 동기화 ============================== */
async function tapi(pathName, params) {
  const r = await fetch(`/api/v1.0/${pathName}?${new URLSearchParams(params)}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.error_user_msg || j.error.message || JSON.stringify(j.error));
  return j;
}
async function syncThreads(P, onStatus) {
  const T = (P.token || "").trim();
  if (!T) throw new Error("액세스 토큰을 먼저 입력해 주세요.");

  onStatus("프로필 확인 중…");
  const me = await tapi("me", { fields: "id,username,name", access_token: T });
  P.threadsUserId = me.id;
  if (me.username) P.handle = "@" + me.username;
  if (me.name) P.name = me.name;

  try {
    const fi = await tapi("me/threads_insights", { metric: "followers_count", access_token: T });
    const fv = fi.data?.[0]?.total_value?.value;
    if (fv) P.followers = fv;
  } catch (e) { /* followers_count는 계정 조건에 따라 미제공 — 무시 */ }

  onStatus("게시물 목록 가져오는 중…");
  let list = [];
  let next = `/api/v1.0/me/threads?${new URLSearchParams({ fields: "id,text,timestamp,media_type,is_quote_post", limit: "50", access_token: T })}`;
  while (next && list.length < 300) {
    const r = await fetch(next);
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
    list.push(...(j.data || []));
    next = j.paging?.next ? j.paging.next.replace("https://graph.threads.net", "/api") : null;
  }
  list = list.filter(p => p.media_type !== "REPOST_FACADE");

  if (P.isDemo) P.posts = []; // 데모 데이터는 실데이터로 교체
  let done = 0, added = 0, updated = 0;
  for (const tp of list) {
    onStatus(`인사이트 수집 중… ${++done} / ${list.length}`);
    const m = { views: 0, likes: 0, replies: 0, reposts: 0 };
    try {
      const ins = await tapi(`${tp.id}/insights`, { metric: "views,likes,replies,reposts,quotes", access_token: T });
      (ins.data || []).forEach(d => {
        const v = d.values?.[0]?.value ?? d.total_value?.value ?? 0;
        if (d.name === "views") m.views = v;
        else if (d.name === "likes") m.likes = v;
        else if (d.name === "replies") m.replies = v;
        else if (d.name === "reposts" || d.name === "quotes") m.reposts += v;
      });
    } catch (e) { /* 오래된 글 등 인사이트 미제공 게시물 — 0으로 유지 */ }
    const rec = { text: tp.text || "(미디어 게시물)", at: new Date(tp.timestamp).toISOString(), views: m.views, likes: m.likes, replies: m.replies, reposts: m.reposts };
    const ex = P.posts.find(x => x.tid === tp.id);
    if (ex) { Object.assign(ex, rec); updated++; }
    else { P.posts.push({ id: uid(), tid: tp.id, ...rec }); added++; }
  }
  P.isDemo = false;
  P.lastSync = new Date().toISOString();
  store.save();
  return { added, updated, total: list.length };
}
async function refreshToken(P) {
  const r = await fetch(`/api/refresh_access_token?${new URLSearchParams({ grant_type: "th_refresh_token", access_token: (P.token || "").trim() })}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
  P.token = j.access_token;
  store.save();
  return j.expires_in;
}

/* ============================== 차트 ============================== */
const tooltip = $("#tooltip");
function tipOn(el, html) {
  el.addEventListener("mousemove", e => {
    tooltip.innerHTML = html; tooltip.style.opacity = 1;
    const w = tooltip.offsetWidth;
    tooltip.style.left = Math.min(innerWidth - w - 14, e.clientX + 14) + "px";
    tooltip.style.top = (e.clientY - tooltip.offsetHeight - 10) + "px";
  });
  el.addEventListener("mouseleave", () => tooltip.style.opacity = 0);
}
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v || 1))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }

/* 막대차트: 24px 이하 두께, 상단 4px 라운드, 헤어라인 그리드, 호버 툴팁 */
function barChart(el, data, { color = "var(--s-blue)", hi = [], h = 220, fmt = fmtC, tipFn } = {}) {
  const W = 900, H = h, padL = 44, padB = 24, padT = 12;
  const max = niceMax(Math.max(...data.map(d => d.v), 1));
  const iw = (W - padL) / data.length, bw = Math.min(24, iw * 0.62);
  const y = v => padT + (H - padB - padT) * (1 - v / max);
  let g = "";
  for (let i = 0; i <= 3; i++) {
    const gv = max * i / 3, gy = y(gv);
    g += `<line x1="${padL}" x2="${W}" y1="${gy}" y2="${gy}" stroke="var(--grid)" stroke-width="1"/>
          <text x="${padL - 8}" y="${gy + 4}" text-anchor="end" font-size="10" fill="var(--ink-3)" font-variant-numeric="tabular-nums">${fmt(gv)}</text>`;
  }
  let bars = "", labs = "";
  data.forEach((d, i) => {
    const x = padL + iw * i + (iw - bw) / 2, by = y(d.v), bh = Math.max(d.v > 0 ? 2 : 0, H - padB - by);
    const r = Math.min(4, bh);
    const c = hi.includes(i) ? "var(--gold)" : color;
    if (bh > 0) bars += `<path class="bar" data-i="${i}" d="M${x},${H - padB} v${-(bh - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${bh - r} z" fill="${c}"/>`;
    bars += `<rect class="bar-hit" data-i="${i}" x="${padL + iw * i}" y="${padT}" width="${iw}" height="${H - padB - padT}" fill="transparent"/>`;
    labs += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" font-size="10" fill="${hi.includes(i) ? "var(--gold-2)" : "var(--ink-3)"}" ${hi.includes(i) ? 'font-weight="700"' : ""}>${d.label}</text>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%">${g}
    <line x1="${padL}" x2="${W}" y1="${H - padB}" y2="${H - padB}" stroke="var(--hairline-2)" stroke-width="1"/>
    ${bars}${labs}</svg>`;
  $$(".bar-hit", el).forEach(hit => {
    const i = +hit.dataset.i;
    tipOn(hit, tipFn ? tipFn(data[i], i) : `<b>${data[i].label}</b><br>${fmtN(data[i].v)}`);
  });
}

/* 라인+영역 워시 (단일 시리즈, 끝점 마커 8px + 서피스 링) */
function areaLine(el, pts, { h = 200, color = "var(--gold)", fmt = fmtC, labels = [] } = {}) {
  if (pts.length < 2) { el.innerHTML = '<div class="empty">데이터가 2건 이상 필요합니다</div>'; return; }
  const W = 900, H = h, padL = 44, padB = 22, padT = 12;
  const max = niceMax(Math.max(...pts, 1));
  const x = i => padL + (W - padL - 10) * i / (pts.length - 1);
  const y = v => padT + (H - padB - padT) * (1 - v / max);
  let g = "";
  for (let i = 0; i <= 3; i++) {
    const gv = max * i / 3, gy = y(gv);
    g += `<line x1="${padL}" x2="${W}" y1="${gy}" y2="${gy}" stroke="var(--grid)" stroke-width="1"/>
          <text x="${padL - 8}" y="${gy + 4}" text-anchor="end" font-size="10" fill="var(--ink-3)">${fmt(gv)}</text>`;
  }
  const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const area = line + ` L${x(pts.length - 1)},${H - padB} L${padL},${H - padB} Z`;
  const ex = x(pts.length - 1), ey = y(pts[pts.length - 1]);
  let hits = "";
  pts.forEach((v, i) => { hits += `<rect class="ln-hit" data-i="${i}" x="${x(i) - (W - padL) / pts.length / 2}" y="0" width="${(W - padL) / pts.length}" height="${H}" fill="transparent"/>`; });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%">
    ${g}
    <path d="${area}" fill="${color}" opacity="0.09"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${ex}" cy="${ey}" r="6" fill="var(--surface)"/>
    <circle cx="${ex}" cy="${ey}" r="4" fill="${color}"/>
    ${hits}</svg>`;
  $$(".ln-hit", el).forEach(hit => {
    const i = +hit.dataset.i;
    tipOn(hit, `<b>${labels[i] || i + 1}</b><br>반응값 ${fmtN(pts[i])}`);
  });
}

/* 히트맵 (시퀀셜 블루 램프, 다크 표면에선 밝을수록 큼) */
const HEAT_RAMP = ["#161b26", "#1c2c48", "#1f406e", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"];
function heatmap(el, m) {
  const flat = m.flat().map(c => c.mult), mx = Math.max(...flat, 0.01);
  let html = "";
  for (let d = 0; d < 7; d++) {
    const di = (d + 1) % 7; // 월요일 시작
    html += `<div class="hm-lab">${DAYS[di]}</div>`;
    for (let h = 0; h < 24; h++) {
      const c = m[di][h];
      const step = c.n === 0 ? 0 : Math.min(6, 1 + Math.floor(c.mult / mx * 5.99));
      html += `<div class="hm-cell" data-d="${di}" data-h="${h}" style="background:${HEAT_RAMP[step]}"></div>`;
    }
  }
  el.innerHTML = html;
  let xl = "<span></span>";
  for (let h = 0; h < 24; h++) xl += `<span>${h % 3 === 0 ? h : ""}</span>`;
  el.nextElementSibling.innerHTML = xl;
  $$(".hm-cell", el).forEach(cell => {
    const d = +cell.dataset.d, h = +cell.dataset.h, c = m[d][h];
    tipOn(cell, `<b>${DAYS[d]} ${h}시</b><br>${c.n ? `평균 ×${c.mult.toFixed(2)} · 글 ${c.n}개` : "게시물 없음"}`);
  });
}

function ring(el, score) {
  const R = 62, C = 2 * Math.PI * R, off = C * (1 - score / 100);
  const col = score >= 75 ? "var(--gold)" : score >= 50 ? "var(--s-blue)" : "var(--s-red)";
  el.innerHTML = `<svg viewBox="0 0 150 150" width="150" height="150">
    <circle cx="75" cy="75" r="${R}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="9"/>
    <circle cx="75" cy="75" r="${R}" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 75 75)" style="transition:stroke-dashoffset .7s cubic-bezier(.22,1,.36,1)"/>
  </svg>
  <div class="ring-num"><div class="n">${score}</div><div class="c">/ 100</div></div>`;
}

/* ============================== 뷰 렌더링 ============================== */
function vhead(eyebrow, title, sub) {
  return `<div class="vhead"><div class="eyebrow">${eyebrow}</div><h2 class="vtitle">${title}</h2><p class="vsub">${sub}</p></div>`;
}
const needData = view => `<div class="card"><div class="empty"><div class="big">🗂</div>아직 분석할 결과값이 없습니다.<br><b>결과값 수집·관리</b>에서 게시물을 추가하거나 데모 데이터를 불러오세요.<br><br><button class="btn gold" onclick="location.hash='data'">결과값 수집·관리로 이동</button></div></div>`;

function renderDashboard() {
  const P = store.profile(), posts = [...P.posts].sort((a, b) => new Date(a.at) - new Date(b.at));
  const el = $("#v-dashboard");
  if (!posts.length) { el.innerHTML = vhead("Result Report", "우상향 리포트", "") + needData(); return; }
  const S = stats(posts);
  const recent = posts.slice(-10), prev = posts.slice(-20, -10);
  const rAvg = stats(recent).avgE, pAvg = prev.length ? stats(prev).avgE : rAvg;
  const delta = pAvg ? ((rAvg - pAvg) / pAvg * 100) : 0;
  const top = [...posts].sort((a, b) => engage(b) - engage(a)).slice(0, 3);
  el.innerHTML = vhead("Result Report", "우상향 리포트", `${esc(P.name)}의 게시물 ${posts.length}건으로 정리한 결과값 브리핑입니다. 결과값에는 이유가 있습니다.`) + `
    <div class="grid g2">
      <div class="card">
        <h3>평균 반응값 <span class="sub">좋아요 + 답글×2 + 리포스트·공유×3</span></h3>
        <div class="hero-num mt16" style="background:var(--gold-grad);-webkit-background-clip:text;background-clip:text;color:transparent">${fmtN(S.avgE)}</div>
        <div class="hero-cap">최근 10개 글은 평균 <b style="color:${delta >= 0 ? "var(--good)" : "var(--s-red)"}">${fmtN(rAvg)} (${delta >= 0 ? "▲" : "▼"}${Math.abs(delta).toFixed(0)}%)</b> — 직전 10개 대비</div>
      </div>
      <div class="grid g2 kpi" style="gap:16px">
        <div class="card tile"><div class="label">총 게시물</div><div class="value">${fmtN(posts.length)}</div><div class="delta">분석 표본</div></div>
        <div class="card tile"><div class="label">총 조회수</div><div class="value">${S.totV ? fmtC(S.totV) : "—"}</div><div class="delta">${S.totV ? "전체 누적" : "조회수 데이터 없음"}</div></div>
        <div class="card tile"><div class="label">평균 조회수</div><div class="value">${S.totV ? fmtC(S.avgV) : "—"}</div><div class="delta">${S.totV ? "글 1개당" : "조회수 데이터 없음"}</div></div>
        <div class="card tile"><div class="label">반응 전환율</div><div class="value">${S.totV ? S.rate.toFixed(1) + "%" : "—"}</div><div class="delta">반응값 ÷ 조회수</div></div>
      </div>
    </div>
    <div class="card mt16">
      <h3>결과값 흐름 <span class="sub">발행 순서대로 본 글별 반응값 — 점이 모여 선이 됩니다</span></h3>
      <div class="chart-wrap" id="dashLine"></div>
    </div>
    <div class="card">
      <div class="flex-between"><h3>하이트래픽 TOP 3 <span class="sub">반응값 기준</span></h3>
      <button class="btn ghost sm" onclick="location.hash='tracking'">전체 보기 →</button></div>
      <div id="dashTop"></div>
    </div>`;
  areaLine($("#dashLine"), posts.map(engage), { labels: posts.map(p => whenLabel(p.at)) });
  $("#dashTop").innerHTML = top.map((p, i) => {
    const mult = S.avgE ? engage(p) / S.avgE : 0, t = tierOf(mult);
    return `<div class="post-row">
      <div style="font-family:var(--serif);font-size:19px;font-weight:900;color:${i === 0 ? "var(--gold-2)" : "var(--ink-3)"};width:26px;padding-top:2px">${i + 1}</div>
      <div class="txt">
        <div class="head"><span class="tier ${t.cls}">×${mult.toFixed(2)}</span><span style="font-size:12px;color:var(--ink-3)">${whenLabel(p.at)}</span></div>
        <div class="body">${esc(p.text)}</div>
      </div>
      <div class="nums">조회 <b>${p.views ? fmtC(p.views) : "—"}</b><br>반응 <b>${fmtN(engage(p))}</b></div>
    </div>`;
  }).join("");
}

function renderTracking() {
  const P = store.profile(), el = $("#v-tracking");
  if (!P.posts.length) { el.innerHTML = vhead("Tracking", "결과값 추적", "") + needData(); return; }
  const S = stats(P.posts);
  const posts = [...P.posts].sort((a, b) => new Date(b.at) - new Date(a.at));
  el.innerHTML = vhead("Tracking", "결과값 추적", `글 하나하나가 결과값입니다. 각 글의 현재 구간과 24시간·7일 후 반응값 추정치 — 계정 평균 ${fmtN(S.avgE)} 기준.`) + `
    <div class="card" id="trackList"></div>`;
  $("#trackList").innerHTML = posts.map(p => {
    const mult = S.avgE ? engage(p) / S.avgE : 0, t = tierOf(mult), pr = project(p);
    return `<div class="post-row">
      <div class="txt">
        <div class="head">
          <span class="tier ${t.cls}">${t.label} · ×${mult.toFixed(2)}</span>
          <span style="font-size:12px;color:var(--ink-3)">${relTime(p.at)} · ${whenLabel(p.at)}</span>
        </div>
        <div class="body">${esc(p.text)}</div>
        ${(pr.e24 || pr.e7d) ? `<div class="proj">${pr.e24 ? `24h 추정 <b>${fmtN(pr.e24)}</b>` : ""}${pr.e7d ? `<span>7d 추정 <b>${fmtN(pr.e7d)}</b></span>` : ""}</div>` : ""}
      </div>
      <div class="nums">조회 <b>${p.views ? fmtC(p.views) : "—"}</b><br>반응 <b>${fmtN(engage(p))}</b><br><span style="font-size:11px">♥${fmtN(p.likes)} 💬${fmtN(p.replies)} 🔁${fmtN(p.reposts)}${p.shares ? " 📤" + fmtN(p.shares) : ""}</span></div>
    </div>`;
  }).join("");
}

function renderPredict() {
  const P = store.profile(), el = $("#v-predict"), S = stats(P.posts);
  el.innerHTML = vhead("Logic Check", "발행 전 로직 점검", "결과값은 발행 전에 절반이 결정됩니다. 초안을 붙여넣으면 첫 줄 유입력·구조·행동 장치를 점검하고 예상 결과값을 계산합니다.") + `
    <div class="card">
      <label class="f-label" style="margin-top:0">스레드 초안</label>
      <textarea id="draftBox" placeholder="여기에 발행할 글을 붙여넣으세요…"></textarea>
      <div class="mt16"><button class="btn gold" id="draftBtn">✦ 로직 점검</button></div>
    </div>
    <div id="draftResult"></div>`;
  const run = () => {
    const r = scoreText($("#draftBox").value);
    const box = $("#draftResult");
    if (!r) { box.innerHTML = ""; return; }
    const t = tierOf(r.mult);
    box.innerHTML = `
      <div class="card mt16">
        <div class="ring-wrap">
          <div class="ring" id="scoreRing"></div>
          <div style="flex:1;min-width:240px">
            <div class="eyebrow" style="margin-bottom:4px">Verdict</div>
            <div style="font-size:20px;font-weight:800">예상 <span style="color:${t.color}">×${r.mult.toFixed(2)}</span> — ${t.label}</div>
            ${P.posts.length ? `<div class="hint">계정 평균 기준 예상 반응값 <b style="color:var(--ink)">${fmtN(S.avgE * r.mult)}</b> · 예상 조회수 <b style="color:var(--ink)">${fmtC(S.avgV * r.mult)}</b></div>` : `<div class="hint">게시물 데이터를 추가하면 예상 조회수까지 계산됩니다.</div>`}
            <div class="mt16">
              ${[["첫줄 유입력", r.hook], ["가독 리듬", r.read], ["저장 유도", r.struct], ["행동 장치", r.cta], ["신뢰 자산", r.story]].map(([l, v]) => `
                <div class="meter-row"><div class="m-label">${l}</div>
                  <div class="m-track"><div class="m-fill" style="width:${v}%;background:${v >= 70 ? "var(--s-aqua)" : v >= 45 ? "var(--s-blue)" : "var(--s-red)"}"></div></div>
                  <div class="m-val">${v}</div></div>`).join("")}
            </div>
          </div>
        </div>
        <div class="tip-list">${r.tips.map(x => `<div class="tip ${x.ok ? "good" : "warn"}"><span class="t-ico">${x.ok ? "✓" : "▲"}</span><span>${x.msg}</span></div>`).join("")}</div>
      </div>`;
    ring($("#scoreRing"), r.total);
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  $("#draftBtn").onclick = run;
  $("#draftBox").addEventListener("input", () => { if ($("#draftResult").innerHTML) run(); });
}

function renderTiming() {
  const P = store.profile(), el = $("#v-timing");
  if (P.posts.length < 3) { el.innerHTML = vhead("Golden Time", "트래픽 골든타임", "") + needData(); return; }
  const S = stats(P.posts);
  const best = bestSlots(P.posts, S.avgE);
  const hours = byHour(P.posts, S.avgE), days = byDay(P.posts, S.avgE);
  const medals = ["🥇 골든타임", "🥈 2순위", "🥉 3순위"];
  el.innerHTML = vhead("Golden Time", "트래픽 골든타임", `같은 글도 언제 쏘느냐에 따라 결과값이 다릅니다. 전체 ${P.posts.length}개 글의 요일×시간 결과값 통계 (KST) — 평균 반응값 ${fmtN(S.avgE)} 기준.`) + `
    <div class="podium">${best.map((b, i) => `
      <div class="p-card ${i === 0 ? "first" : ""}">
        <div class="medal">${medals[i]}</div>
        <div class="when">${DAYS[b.d]} ${String(b.h).padStart(2, "0")}시</div>
        <div class="stat">평균 <b style="color:var(--ink)">×${b.mult.toFixed(2)}</b> · 글 ${b.n}개</div>
      </div>`).join("")}</div>
    <div class="card mt16">
      <h3>시간대별 평균 반응값 <span class="sub">금색 = 골든타임</span></h3>
      <div class="chart-wrap" id="hourChart"></div>
    </div>
    <div class="grid g2 mt16">
      <div class="card">
        <h3>요일별 평균 반응값</h3>
        <div class="chart-wrap" id="dayChart"></div>
      </div>
      <div class="card">
        <h3>요일 × 시간 히트맵 <span class="sub">밝을수록 트래픽이 터진 자리</span></h3>
        <div class="hm" id="heat"></div><div class="hm-x"></div>
      </div>
    </div>`;
  const hiH = best.map(b => b.h);
  barChart($("#hourChart"), hours.map((b, h) => ({ label: h + "시", v: Math.round(b.avg), n: b.n })), {
    hi: hours.map((b, h) => hiH.includes(h) ? h : -1).filter(x => x >= 0),
    tipFn: d => `<b>${d.label}</b><br>평균 반응값 ${fmtN(d.v)}${d.n ? ` · 글 ${d.n}개` : "<br>게시물 없음"}`
  });
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  const bestD = best.length ? dayOrder.indexOf(best[0].d) : -1;
  barChart($("#dayChart"), dayOrder.map(d => ({ label: DAYS[d], v: Math.round(days[d].avg), n: days[d].n })), {
    h: 240, hi: bestD >= 0 ? [bestD] : [],
    tipFn: d => `<b>${d.label}요일</b><br>평균 반응값 ${fmtN(d.v)} · 글 ${d.n}개`
  });
  heatmap($("#heat"), heatData(P.posts, S.avgE));
}

function renderPersona() {
  const P = store.profile(), el = $("#v-persona");
  if (!P.posts.length) { el.innerHTML = vhead("Traffic Source", "반응층 분석", "") + needData(); return; }
  const shares = personaShares(P.posts);
  const order = shares.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]);
  const topPer = PERSONAS[order[0][1]];
  el.innerHTML = vhead("Traffic Source", "반응층 분석", "어떤 주제의 글에 반응값이 몰리는지로 역산한 내 트래픽의 구성입니다. 결과값을 만드는 사람이 누구인지 알아야 다음 글의 방향이 잡힙니다.") + `
    <div class="card">
      <h3>📌 본질 한 줄</h3>
      <p class="vsub" style="margin-top:12px">이 계정 트래픽의 중심은 <b style="color:var(--gold-2)">${topPer.name.replace(/^[^\s]+\s/, "")}</b>입니다.
      이 유형이 반응하는 글(반응값 기준 ${order[0][0]}%)을 중심축으로 삼되, 나머지 유형을 위한 글을 주기적으로 섞으면 트래픽의 폭이 넓어집니다.</p>
      <div style="display:flex;height:12px;border-radius:99px;overflow:hidden;margin-top:18px;gap:2px">
        ${order.map(([s, i]) => s > 0 ? `<div style="width:${s}%;background:${PERSONAS[i].color}"></div>` : "").join("")}
      </div>
    </div>
    <div class="grid g2 mt16">
      ${order.map(([s, i]) => { const per = PERSONAS[i]; return `
        <div class="persona-card">
          <div class="p-head"><div class="p-name">${per.name}</div><div class="p-pct">${s}%</div></div>
          <div class="p-bar"><i style="width:${s}%;background:${per.color}"></i></div>
          <div class="tags">${per.tags.map(t => `<span>${t}</span>`).join("")}</div>
          <div class="quote">"${per.quote}"</div>
        </div>`; }).join("")}
    </div>
    <div class="hint mt16">※ 반응값(좋아요·답글·리포스트·공유)이 어떤 키워드 주제에 몰리는지 기반의 추정치입니다. 데이터가 쌓일수록 정확해집니다.</div>`;
}

function renderBenchmark() {
  const el = $("#v-benchmark");
  el.innerHTML = vhead("High Traffic", "하이트래픽 글 구조 벤치마킹", "터진 글에는 로직이 있습니다. 하이트래픽 글을 붙여넣으면 유입 장치·본문 로직·행동 장치로 분해해서, 내 글에 이식할 원리를 뽑아드립니다.") + `
    <div class="card">
      <label class="f-label" style="margin-top:0">하이트래픽 글 붙여넣기</label>
      <textarea id="bmBox" placeholder="트래픽이 터진 글을 그대로 붙여넣으세요…"></textarea>
      <div class="mt16" style="display:flex;gap:8px">
        <button class="btn gold" id="bmBtn">🔍 구조 분해하기</button>
        <button class="btn ghost" id="bmSave" style="display:none">보관함에 저장</button>
      </div>
    </div>
    <div id="bmResult"></div>
    <div class="card mt16">
      <h3>📚 하이트래픽 보관함 <span class="sub">저장한 글 ${store.data.benchmarks.length}건</span></h3>
      <div id="bmLib">${store.data.benchmarks.length ? "" : '<div class="empty">아직 저장한 글이 없습니다.</div>'}</div>
    </div>`;
  const renderLib = () => {
    $("#bmLib").innerHTML = store.data.benchmarks.length ? store.data.benchmarks.map((b, i) => `
      <div class="post-row">
        <div class="txt">
          <div class="head"><span class="tier t3">점수 ${b.score}</span><span style="font-size:12px;color:var(--ink-3)">${new Date(b.at).toLocaleDateString("ko-KR")}</span></div>
          <div class="body">${esc(b.text)}</div>
        </div>
        <button class="del-x" data-i="${i}" title="삭제">✕</button>
      </div>`).join("") : '<div class="empty">아직 저장한 벤치마크가 없습니다.</div>';
    $$("#bmLib .del-x").forEach(btn => btn.onclick = () => { store.data.benchmarks.splice(+btn.dataset.i, 1); store.save(); renderBenchmark(); });
  };
  renderLib();
  $("#bmBtn").onclick = () => {
    const text = $("#bmBox").value.trim();
    const r = scoreText(text);
    if (!r) return;
    const lines = text.split("\n");
    let hookEnd = 1;
    while (hookEnd < lines.length && lines[hookEnd].trim() !== "" && hookEnd < 2) hookEnd++;
    const hook = lines.slice(0, hookEnd).join("\n");
    let ctaStart = lines.length;
    for (let i = lines.length - 1; i >= hookEnd; i--) {
      if (lines[i].trim() === "") break;
      if (CTA_WORDS.test(lines[i])) ctaStart = i;
    }
    const body = lines.slice(hookEnd, ctaStart).join("\n").trim();
    const cta = lines.slice(ctaStart).join("\n").trim();
    $("#bmResult").innerHTML = `
      <div class="card mt16">
        <div class="flex-between"><h3>구조 분해 결과</h3><span class="tier ${tierOf(r.mult).cls}">로직 완성도 ${r.total}점 · 예상 ×${r.mult.toFixed(2)}</span></div>
        <div class="bm-part hook"><div class="bp-tag">유입 장치 — 스크롤을 멈추는 첫 줄</div><p>${esc(hook)}</p></div>
        ${body ? `<div class="bm-part"><div class="bp-tag">본문 로직 — 끝까지 읽게 만드는 전개</div><p>${esc(body)}</p></div>` : ""}
        ${cta ? `<div class="bm-part cta"><div class="bp-tag">행동 장치 — 저장·공유를 부르는 마무리</div><p>${esc(cta)}</p></div>` : ""}
        <div class="tip-list">${r.tips.filter(t => t.ok).map(x => `<div class="tip good"><span class="t-ico">✓</span><span>이 글의 무기: ${x.msg}</span></div>`).join("") || '<div class="tip warn"><span class="t-ico">▲</span><span>구조적 강점이 뚜렷하지 않은 글입니다. 유입 장치와 행동 장치만 참고용으로 보세요.</span></div>'}</div>
      </div>`;
    $("#bmSave").style.display = "";
    $("#bmSave").onclick = () => {
      store.data.benchmarks.unshift({ text, score: r.total, at: new Date().toISOString() });
      store.save(); renderBenchmark();
    };
  };
}

function renderData() {
  const P = store.profile(), el = $("#v-data");
  const posts = [...P.posts].sort((a, b) => new Date(b.at) - new Date(a.at));
  el.innerHTML = vhead("Data", "결과값 수집·관리", "분석은 데이터가 전부입니다. 내 계정이든 벤치마킹 대상이든, 결과값을 넣는 만큼 로직이 정확해집니다. 모든 데이터는 이 브라우저에만 저장됩니다.") + `
    <div class="card" style="margin-bottom:16px;border-color:rgba(217,184,120,.4)">
      <div class="flex-between">
        <h3>🧲 트래픽 데이터 수집 <span class="sub">추천 — 토큰 필요 없음, 내 계정이든 남의 계정이든 OK</span></h3>
        <span class="tier t4">가장 쉬운 방법</span>
      </div>
      <div class="hint" style="margin-top:12px">
        ① 아래 [수집 스크립트 복사] 클릭 →
        ② <code>threads.com</code>에서 분석할 프로필 열기 →
        ③ <b>F12</b> → Console 탭에 붙여넣고 Enter (크롬이 막으면 <code>allow pasting</code> 먼저 입력) →
        ④ 자동 스크롤이 끝나면 <code>threadlens-harvest.json</code>이 다운로드됨 →
        ⑤ [수집 결과 가져오기]에서 그 파일 선택
      </div>
      <div class="mt16" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn gold" id="hvCopy">📋 수집 스크립트 복사</button>
        <button class="btn ghost" id="hvImport">⬇ 수집 결과 가져오기</button>
        <input type="file" id="hvFile" accept=".json" style="display:none">
      </div>
      <div class="hint" id="hvStatus"></div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="flex-between">
        <h3>🔗 Threads 공식 API 연동 <span class="sub">${P.lastSync ? "마지막 동기화 " + relTime(P.lastSync) : "선택 — 토큰을 넣으면 조회수(views)까지 자동으로 가져옵니다"}</span></h3>
        <button class="btn ghost sm" id="apiHelp">연동 방법 보기</button>
      </div>
      <div id="apiGuide" style="display:none" class="hint" >
        <b style="color:var(--gold-2)">1회만 설정하면 됩니다 (약 10분, 무료)</b><br>
        ① <code>developers.facebook.com</code> 접속 → 로그인 → [내 앱] → [앱 만들기] → 사용 사례에서 <b>"Threads API 액세스"</b> 선택<br>
        ② 만든 앱의 [사용 사례] → Threads → 설정에서 권한 <code>threads_basic</code>, <code>threads_manage_insights</code> 추가<br>
        ③ [앱 역할] → [역할] → 사람 추가 → 내 스레드 계정을 <b>"Threads 테스터"</b>로 추가<br>
        ④ 스레드 앱 → 설정 → 계정 → <b>웹사이트 권한</b>에서 초대 수락<br>
        ⑤ 개발자 대시보드의 Threads 사용 사례 설정에 있는 <b>토큰 생성기(User Token Generator)</b>에서 토큰 생성 → 아래에 붙여넣기<br>
        ※ 토큰은 60일간 유효 — 만료 전에 [토큰 갱신] 버튼을 누르면 연장됩니다. 인사이트는 <b>본인 계정만</b> 제공됩니다(다른 계정은 수동 입력).
      </div>
      <label class="f-label">액세스 토큰</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input type="password" id="apiToken" placeholder="THAA로 시작하는 토큰 붙여넣기" value="${esc(P.token || "")}" style="flex:1;min-width:220px">
        <button class="btn gold" id="apiSync">⟳ 지금 동기화</button>
        <button class="btn ghost" id="apiRefresh" title="토큰 유효기간 60일 연장">토큰 갱신</button>
      </div>
      <div class="hint" id="apiStatus"></div>
    </div>
    <div class="grid g2">
      <div class="card">
        <h3>✏️ 게시물 1건 추가</h3>
        <label class="f-label">글 내용</label>
        <textarea id="npText" style="min-height:110px" placeholder="게시물 텍스트"></textarea>
        <label class="f-label">발행 일시</label>
        <input type="datetime-local" id="npAt">
        <div class="grid g4" style="gap:10px;margin-top:4px">
          <div><label class="f-label">조회수</label><input type="number" id="npV" min="0" value="0"></div>
          <div><label class="f-label">좋아요</label><input type="number" id="npL" min="0" value="0"></div>
          <div><label class="f-label">답글</label><input type="number" id="npR" min="0" value="0"></div>
          <div><label class="f-label">리포스트</label><input type="number" id="npS" min="0" value="0"></div>
        </div>
        <div class="mt16"><button class="btn gold" id="npAdd">추가하기</button></div>
      </div>
      <div class="card">
        <h3>📋 여러 건 한꺼번에 붙여넣기</h3>
        <textarea id="bulkBox" style="min-height:180px" placeholder="2026-07-01 07:00 | 1234 | 56 | 12 | 3&#10;글 내용 첫 줄&#10;글 내용 둘째 줄&#10;&#10;2026-07-02 22:00 | 890 | 40 | 8 | 2&#10;다음 글 내용…"></textarea>
        <div class="hint">형식: 첫 줄에 <code>날짜 시간 | 조회 | 좋아요 | 답글 | 리포스트</code>, 그 아래 글 내용. <b>빈 줄</b>로 게시물을 구분합니다.</div>
        <div class="mt16"><button class="btn gold" id="bulkAdd">일괄 추가</button></div>
      </div>
    </div>
    <div class="card mt16">
      <h3>⚙️ 프로필 설정</h3>
      <div class="grid g3" style="gap:10px">
        <div><label class="f-label">계정 이름</label><input type="text" id="pfName" value="${esc(P.name)}"></div>
        <div><label class="f-label">핸들</label><input type="text" id="pfHandle" value="${esc(P.handle || "")}"></div>
        <div><label class="f-label">팔로워 수</label><input type="number" id="pfFol" min="0" value="${P.followers || 0}"></div>
      </div>
      <div class="mt16" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ghost" id="pfSave">프로필 저장</button>
        <button class="btn ghost" id="pfNew">＋ 새 프로필 만들기</button>
        <button class="btn ghost" id="exportBtn">JSON 내보내기</button>
        <button class="btn ghost" id="importBtn">JSON 가져오기</button>
        <input type="file" id="importFile" accept=".json" style="display:none">
        <button class="btn ghost" id="demoBtn">데모 데이터 새로 넣기</button>
        <button class="btn danger" id="wipeBtn">이 프로필 게시물 전체 삭제</button>
      </div>
    </div>
    <div class="card mt16">
      <h3>게시물 목록 <span class="sub">${posts.length}건</span></h3>
      ${posts.length ? `<div style="overflow-x:auto"><table class="data"><thead><tr>
        <th>발행</th><th>내용</th><th>조회</th><th>좋아요</th><th>답글</th><th>리포스트</th><th>반응값</th><th></th>
      </tr></thead><tbody>
      ${posts.map(p => `<tr>
        <td style="white-space:nowrap">${whenLabel(p.at)}</td>
        <td class="t-text" title="${esc(p.text)}">${esc(p.text.split("\n")[0])}</td>
        <td>${fmtN(p.views)}</td><td>${fmtN(p.likes)}</td><td>${fmtN(p.replies)}</td><td>${fmtN(p.reposts)}</td>
        <td><b style="color:var(--ink)">${fmtN(engage(p))}</b></td>
        <td><button class="del-x" data-id="${p.id}">✕</button></td>
      </tr>`).join("")}</tbody></table></div>` : '<div class="empty">게시물이 없습니다.</div>'}
    </div>`;

  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  $("#npAt").value = now.toISOString().slice(0, 16);

  /* --- 브라우저 수집 --- */
  const hvStatus = (msg, tone) => {
    const s = $("#hvStatus");
    s.textContent = msg;
    s.style.color = tone === "err" ? "var(--s-red)" : tone === "ok" ? "#3fc496" : "var(--ink-3)";
  };
  $("#hvCopy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(COLLECT_SCRIPT);
      hvStatus("✓ 복사 완료! threads.com 프로필 → F12 콘솔에 붙여넣고 Enter 하세요.", "ok");
    } catch (e) { hvStatus("✕ 클립보드 복사 실패: " + e.message, "err"); }
  };
  const mergeHarvest = j => {
    if (!Array.isArray(j.posts) || !j.posts.length) throw new Error("수집된 게시물이 0건입니다.");
    let target = store.data.profiles.find(x => x.handle === j.handle);
    if (!target) {
      target = { id: uid(), name: j.name || j.handle, handle: j.handle, followers: j.followers || 0, posts: [] };
      store.data.profiles.push(target);
    } else {
      if (j.name) target.name = j.name;
      if (j.followers) target.followers = j.followers;
    }
    if (target.isDemo) { target.posts = []; target.isDemo = false; }
    let added = 0, updated = 0;
    j.posts.forEach(np => {
      const ex = target.posts.find(x => x.tid === np.tid);
      if (ex) {
        ex.text = np.text; ex.at = np.at; ex.likes = np.likes; ex.replies = np.replies; ex.reposts = np.reposts; ex.shares = np.shares;
        if (np.views) ex.views = np.views;
        updated++;
      } else { target.posts.push({ id: uid(), ...np }); added++; }
    });
    target.lastHarvest = j.harvestedAt || new Date().toISOString();
    store.data.activeId = target.id;
    store.save(); renderTopbar(); renderData();
    $("#hvStatus").textContent = `✓ '${target.name}' 프로필로 가져왔습니다 — 새 글 ${added}건, 업데이트 ${updated}건`;
    $("#hvStatus").style.color = "#3fc496";
  };
  window.__mergeHarvest = mergeHarvest;
  $("#hvImport").onclick = async () => {
    /* 서버 폴더에 harvest.json이 있으면 그것부터, 없으면 파일 선택 */
    try {
      const r = await fetch("/harvest.json?t=" + Date.now());
      if (r.ok) {
        const j = await r.json();
        const label = (j.handle || "수집 데이터") + " " + (j.posts?.length || 0) + "건";
        if (confirm(`서버 폴더의 수집 파일(${label})을 가져올까요?\n[취소]를 누르면 다운로드된 파일을 직접 선택합니다.`)) { mergeHarvest(j); return; }
      }
    } catch (e) { /* 파일 선택으로 진행 */ }
    $("#hvFile").click();
  };
  $("#hvFile").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => {
      try { mergeHarvest(JSON.parse(txt)); }
      catch (err) { hvStatus("✕ " + err.message, "err"); }
    });
    e.target.value = "";
  };

  /* --- Threads API --- */
  const apiStatus = (msg, tone) => {
    const s = $("#apiStatus");
    s.textContent = msg;
    s.style.color = tone === "err" ? "var(--s-red)" : tone === "ok" ? "#3fc496" : "var(--ink-3)";
  };
  $("#apiHelp").onclick = () => {
    const g = $("#apiGuide");
    g.style.display = g.style.display === "none" ? "" : "none";
  };
  $("#apiSync").onclick = async () => {
    P.token = $("#apiToken").value.trim();
    store.save();
    if (location.protocol === "file:" || location.hostname.endsWith("github.io")) { apiStatus("공식 API 동기화는 PC에서 실행.bat으로 서버를 켠 상태에서만 가능합니다 (프록시 필요). 웹 버전에서는 위의 브라우저 수집을 이용하세요.", "err"); return; }
    const btn = $("#apiSync");
    btn.disabled = true; btn.style.opacity = .6;
    try {
      const r = await syncThreads(P, m => apiStatus(m));
      apiStatus(`✓ 동기화 완료 — 새 글 ${r.added}건 추가, ${r.updated}건 업데이트 (전체 ${r.total}건)`, "ok");
      renderTopbar();
      setTimeout(() => renderData(), 1200);
    } catch (e) {
      apiStatus("✕ " + e.message, "err");
    } finally {
      btn.disabled = false; btn.style.opacity = 1;
    }
  };
  $("#apiRefresh").onclick = async () => {
    P.token = $("#apiToken").value.trim();
    store.save();
    if (location.protocol === "file:" || location.hostname.endsWith("github.io")) { apiStatus("토큰 갱신도 PC에서 실행.bat으로 서버를 켠 상태에서만 가능합니다.", "err"); return; }
    try {
      const sec = await refreshToken(P);
      apiStatus(`✓ 토큰이 갱신되었습니다 (유효기간 약 ${Math.round(sec / 86400)}일)`, "ok");
      $("#apiToken").value = P.token;
    } catch (e) { apiStatus("✕ " + e.message, "err"); }
  };

  $("#npAdd").onclick = () => {
    const text = $("#npText").value.trim();
    if (!text) { alert("글 내용을 입력해 주세요."); return; }
    P.posts.push({ id: uid(), text, at: new Date($("#npAt").value || Date.now()).toISOString(), views: +$("#npV").value || 0, likes: +$("#npL").value || 0, replies: +$("#npR").value || 0, reposts: +$("#npS").value || 0 });
    P.isDemo = false; store.save(); renderData(); renderTopbar();
  };
  $("#bulkAdd").onclick = () => {
    const blocks = $("#bulkBox").value.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    let added = 0, failed = 0;
    blocks.forEach(b => {
      const lines = b.split("\n");
      const m = lines[0].split("|").map(s => s.trim());
      const dt = new Date(m[0]);
      if (m.length >= 2 && !isNaN(dt) && lines.length > 1) {
        P.posts.push({ id: uid(), text: lines.slice(1).join("\n").trim(), at: dt.toISOString(), views: +m[1] || 0, likes: +m[2] || 0, replies: +m[3] || 0, reposts: +m[4] || 0 });
        added++;
      } else failed++;
    });
    if (added) { P.isDemo = false; store.save(); renderData(); renderTopbar(); }
    alert(`${added}건 추가${failed ? `, ${failed}건은 형식 오류로 건너뜀` : ""}`);
  };
  $("#pfSave").onclick = () => {
    P.name = $("#pfName").value.trim() || P.name;
    P.handle = $("#pfHandle").value.trim();
    P.followers = +$("#pfFol").value || 0;
    store.save(); renderTopbar(); alert("저장되었습니다.");
  };
  $("#pfNew").onclick = () => {
    const name = prompt("새 프로필 이름 (예: 벤치마킹할 계정 이름)");
    if (!name) return;
    const np = { id: uid(), name, handle: "", followers: 0, posts: [] };
    store.data.profiles.push(np); store.data.activeId = np.id; store.save();
    renderTopbar(); renderData();
  };
  $("#exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(P, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `threadlens-${(P.handle || P.name).replace(/[@\s]/g, "")}.json`; a.click();
  };
  $("#importBtn").onclick = () => $("#importFile").click();
  $("#importFile").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => {
      try {
        const j = JSON.parse(txt);
        if (!Array.isArray(j.posts)) throw 0;
        j.id = uid(); j.isDemo = false;
        j.posts.forEach(p => p.id = p.id || uid());
        store.data.profiles.push(j); store.data.activeId = j.id; store.save();
        renderTopbar(); renderData(); alert(`'${j.name}' 프로필로 ${j.posts.length}건을 가져왔습니다.`);
      } catch { alert("JSON 형식이 올바르지 않습니다."); }
    });
  };
  $("#demoBtn").onclick = () => {
    if (!confirm("이 프로필의 게시물을 데모 데이터로 교체할까요?")) return;
    const demo = store.makeDemoProfile();
    P.posts = demo.posts; P.isDemo = true; store.save(); renderData(); renderTopbar();
  };
  $("#wipeBtn").onclick = () => {
    if (!confirm(`'${P.name}' 프로필의 게시물 ${P.posts.length}건을 모두 삭제할까요?`)) return;
    P.posts = []; store.save(); renderData(); renderTopbar();
  };
  $$("#v-data .del-x[data-id]").forEach(btn => btn.onclick = () => {
    P.posts = P.posts.filter(p => p.id !== btn.dataset.id);
    store.save(); renderData(); renderTopbar();
  });
}

/* ============================== 상단바 & 라우터 ============================== */
function renderTopbar() {
  const P = store.profile();
  $("#acctAvatar").textContent = (P.name || "T").replace(/[^가-힣a-zA-Z]/g, "").charAt(0).toUpperCase() || "T";
  $("#acctName").textContent = P.name;
  $("#acctMeta").innerHTML = `${esc(P.handle || "")} ${P.followers ? `· 팔로워 <b>${fmtC(P.followers)}</b>` : ""} · 게시물 ${P.posts.length}건`;
  $("#demoBadge").style.display = P.isDemo ? "" : "none";
  const sel = $("#profileSel");
  sel.innerHTML = store.data.profiles.map(p => `<option value="${p.id}" ${p.id === store.data.activeId ? "selected" : ""}>${esc(p.name)}</option>`).join("");
}
$("#profileSel").onchange = e => {
  store.data.activeId = e.target.value; store.save();
  renderTopbar(); route();
};

const RENDER = { dashboard: renderDashboard, tracking: renderTracking, predict: renderPredict, timing: renderTiming, persona: renderPersona, benchmark: renderBenchmark, data: renderData };
function route() {
  const v = location.hash.replace("#", "") || "dashboard";
  const view = RENDER[v] ? v : "dashboard";
  $$(".view").forEach(s => s.classList.remove("on"));
  $$("#nav a").forEach(a => a.classList.toggle("active", a.dataset.v === view));
  RENDER[view]();
  $("#v-" + view).classList.add("on");
  window.scrollTo({ top: 0 });
}
window.addEventListener("hashchange", route);

store.load();
renderTopbar();
route();
