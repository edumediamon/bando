import { clamp, stages } from './process.js';

const colors = {
  silicon: '#81b7dd', oxide: '#e6ad70', resist: '#ae91e2', light: '#a4d6ff',
  film: '#86d1bc', doping: '#ed9e9b', metal: '#eac58e', probe: '#abd9f4',
  result: '#b9b0ed', package: '#9bcead'
};

// These are teaching intervals, shared by captions, model changes, and directional cues.
export const learningPlans = [
  { boundaries: [0, .32, .67, 1], phases: [
    { target: 'silicon', keyword: '単結晶', phrase: '単結晶', focus: '실리콘 잉곳', detail: '실리콘 단결정을 성장시켜 기둥 모양의 잉곳을 만듭니다. 파란색 기둥이 위로 자라는 부분을 보세요.', flow: '잉곳 성장 방향', guide: true },
    { target: 'silicon', phrase: '얇게 자르고', focus: '절단되는 웨이퍼', detail: '절단선이 지나가며 잉곳에서 얇은 원판 한 장이 분리됩니다. 화살표는 절단 방향을 안내합니다.', flow: '절단 방향', guide: true },
    { target: 'silicon', phrase: '표면을 매끄럽게', focus: '연마되는 웨이퍼 표면', detail: '분리된 원판의 표면을 연마하고 세정합니다. 곡선 화살표는 연마 동작의 회전 방향을 나타냅니다.', flow: '표면 연마의 회전 방향', guide: true }
  ]},
  { boundaries: [0, .25, .62, 1], phases: [
    { target: 'oxide', phrase: '산소나 수증기', focus: '표면으로 유입되는 산화 가스', detail: '산소 또는 수증기가 웨이퍼 표면으로 공급됩니다. 곡선 화살표를 따라 가스가 들어오는 방향을 살펴보세요.', flow: '산소·수증기 유입', guide: false },
    { target: 'oxide', phrase: '반응시켜', focus: '실리콘과 산화 가스의 반응 영역', detail: '표면의 실리콘이 산소와 반응하며 산화막이 자랍니다. 주황색 막과 표면을 향하는 화살표가 반응 영역입니다.', flow: '표면으로 향하는 산화 가스', guide: false },
    { target: 'oxide', phrase: '산화막을 형성', focus: '성장한 절연용 산화막', detail: '표면에 절연용 산화막이 형성됩니다. 짧은 위쪽 화살표는 막 두께의 변화를 강조한 학습 안내입니다.', flow: '산화막 성장 영역', guide: true }
  ]},
  { boundaries: [0, .28, .68, 1], phases: [
    { target: 'resist', phrase: '감광액을 바르고', focus: '표면에 도포되는 감광막', detail: '감광액을 바르고 회전시켜 표면에 얇게 펼칩니다. 보라색 층이 덮이는 모습과 곡선 회전 방향을 보세요.', flow: '감광액 도포·회전 방향', guide: true },
    { target: 'light', phrase: '마스크의 회로 모양을 빛으로 옮깁니다', focus: '마스크에서 감광막으로 향하는 빛', detail: '마스크의 패턴을 빛으로 감광막에 옮깁니다. 밝은 하늘색 직선 화살표는 노광 빛이 조사되는 방향입니다.', flow: '노광 빛의 조사 방향', guide: false },
    { target: 'resist', phrase: '감광막 일부를 제거', focus: '현상 후 남는 감광막 패턴', detail: '현상으로 감광막 일부를 제거해 패턴을 남깁니다. 보라색 패턴 사이가 비워지는 부분을 보세요.', flow: '제거되는 감광막의 이동 안내', guide: true }
  ]},
  { boundaries: [0, .2, .72, 1], phases: [
    { target: 'resist', phrase: '감광막으로 보호', focus: '식각 마스크로 쓰이는 감광막', detail: '감광막이 덮인 영역은 보호되고, 틈 사이로 아래층이 노출됩니다. 보라색 보호 패턴을 먼저 확인하세요.', flow: '감광막 보호 영역 안내', guide: true },
    { target: 'oxide', phrase: '재료를 선택적으로 제거', focus: '틈 사이에서 제거되는 산화막', detail: '노출된 아래층이 선택적으로 제거됩니다. 직선 화살표는 입사 방향, 바깥쪽 곡선은 반응 생성물의 배출 방향을 개념적으로 보여줍니다.', flow: '식각 입사 → 반응 생성물 배출', guide: false },
    { target: 'resist', phrase: '회로 모양이 아래층으로 옮겨집니다', focus: '감광막 제거 후 남은 아래층 패턴', detail: '역할을 마친 감광막을 제거하고 세정합니다. 보라색 막이 사라진 뒤 아래층에 남는 패턴을 확인하세요.', flow: '감광막 제거·세정 방향 안내', guide: true }
  ]},
  { boundaries: [0, .4, .76, 1], phases: [
    { target: 'film', phrase: '얇은 층으로 쌓는', focus: '새로 쌓이는 박막', detail: '필요한 재료를 공급해 얇은 막을 쌓습니다. 민트색 층이 두꺼워지는 부분이 증착 영역입니다.', flow: '증착 재료의 공급 방향', guide: false },
    { target: 'doping', phrase: '불순물 이온을 넣어', focus: '이온이 주입되는 실리콘 영역', detail: '이온을 선택한 영역에 주입합니다. 붉은색 직선 화살표 아래에 생기는 영역이 도핑된 실리콘을 나타냅니다.', flow: '이온의 주입 방향', guide: false },
    { target: 'doping', phrase: '전기적 특성을 조절', focus: '후속 열처리로 조정되는 도핑 영역', detail: '이온주입 후에는 열처리 등 후속 작업이 이어집니다. 곡선은 열처리 대상 영역을 가리키는 안내이며 가스 흐름이 아닙니다.', flow: '후속 열처리 영역 안내', guide: true }
  ]},
  { boundaries: [0, .3, .66, 1], phases: [
    { target: 'film', phrase: '절연층', focus: '금속 사이를 분리할 절연층', detail: '서로 다른 배선이 섞이지 않도록 절연층과 연결 통로를 준비합니다. 민트색 층과 그 사이의 통로를 보세요.', flow: '절연층·연결 통로 위치 안내', guide: true },
    { target: 'metal', phrase: '금속선으로 이어', focus: '통로를 채우는 금속 배선', detail: '연결 통로와 배선 자리에 금속이 채워집니다. 금색 연결부가 아래 소자와 배선을 이어 주는 부분입니다.', flow: '금속 연결부 형성 방향 안내', guide: true },
    { target: 'metal', phrase: '금속 배선층을 쌓아', focus: '여러 층으로 이어지는 배선', detail: '절연층과 배선층을 반복해서 쌓습니다. 곡선 화살표는 층 사이의 연결 경로를 따라 움직이는 학습 안내입니다.', flow: '층 사이의 배선 연결 경로', guide: true }
  ]},
  { boundaries: [0, .22, .76, 1], phases: [
    { target: 'probe', phrase: '탐침을 접촉시켜', focus: '칩의 단자에 닿는 탐침', detail: '탐침이 칩의 단자에 내려와 접촉합니다. 하늘색 탐침과 아래쪽 화살표를 함께 보세요.', flow: '탐침의 접촉 방향', guide: true },
    { target: 'metal', phrase: '전기적 특성을 확인', focus: '전기적 동작을 확인하는 검사 경로', detail: '탐침을 통해 시험 신호를 전달하며 특성을 확인합니다. 금색 화살표는 검사 신호의 연결 경로를 단순화한 안내입니다.', flow: '검사 신호 경로', guide: true },
    { target: 'result', phrase: '양품과 불량품을 판정', focus: '기록되는 칩별 판정 결과', detail: '검사 결과를 칩별로 기록합니다. 초록은 양품 예시, 빨강은 불량 예시입니다. 보라색 표시는 현재 결과를 살펴보는 영역입니다.', flow: '칩별 판정 결과 기록 순서', guide: true }
  ]},
  { boundaries: [0, .32, .72, 1], phases: [
    { target: 'silicon', phrase: '기판 위에 올립니다', focus: '기판에 부착되는 개별 칩', detail: '분리한 개별 칩을 패키지 기판에 올립니다. 파란색 칩과 아래로 움직이는 화살표가 부착 방향을 보여줍니다.', flow: '개별 칩의 부착 방향', guide: true },
    { target: 'metal', phrase: '칩과 외부 단자를 연결', focus: '칩과 기판을 잇는 본딩 와이어', detail: '가느다란 와이어로 칩과 기판을 연결합니다. 금색 곡선 화살표가 와이어 연결 경로를 따라 움직입니다.', flow: '본딩 와이어의 연결 경로', guide: true },
    { target: 'package', phrase: '보호재로 감싸고', focus: '칩을 감싸는 보호재', detail: '보호재로 칩과 연결부를 감싼 뒤 패키지 상태에서 최종 검사합니다. 화살표는 성형·검사 영역을 가리키는 학습 안내입니다.', flow: '보호재 성형·최종 검사 영역 안내', guide: true }
  ]}
];

// Use exact source-copy phrases so highlighting never rewrites the supplied explanation.
learningPlans[0].phases[0].phrase = '단결정 기둥인 잉곳';
delete learningPlans[0].phases[0].keyword;

export function getLearningState(stage, progress) {
  stage = Math.floor(clamp(stage, 0, stages.length - 1));
  progress = clamp(progress, 0, 1);
  const plan = learningPlans[stage];
  const index = progress >= plan.boundaries[2] ? 2 : progress >= plan.boundaries[1] ? 1 : 0;
  const fractions = plan.phases.map((_, i) => clamp((progress-plan.boundaries[i])/(plan.boundaries[i+1]-plan.boundaries[i]), 0, 1));
  const phase = plan.phases[index], color = colors[phase.target];
  return {
    ...phase, stage, index, progress, fractions, localProgress: fractions[index], color,
    rgba: [1,3,5].map(offset => parseInt(color.slice(offset, offset+2),16)/255).concat(1),
    states: plan.phases.map((_,i) => progress===1 || i<index ? 'done' : i===index ? 'active' : 'pending')
  };
}

export function sampleCurve(points, t) {
  t = clamp(t, 0, 1);
  const s = 1-t;
  return [0,1,2].map(i => s*s*s*points[0][i] + 3*s*s*t*points[1][i] + 3*s*t*t*points[2][i] + t*t*t*points[3][i]);
}

const line = (start, end) => [start, ...[1/3,2/3].map(t=>start.map((v,i)=>v+(end[i]-v)*t)), end];

export function getFlowPaths(cue, section = false) {
  const {stage,index,localProgress:q} = cue;
  const surface = section ? .48 : .25;
  const inward = [[-2.6,1.6,-.2],[-2.0,1.9,-.2],[-1.2,.65,-.2],[-.5,surface,-.2]];
  const outward = [[.1,surface+.1,.1],[.9,surface+.35,.1],[1.8,1.4,.1],[2.55,1.35,.1]];
  const spin = [[-1.6,surface+.3,0],[-1.6,surface+.3,2.05],[1.6,surface+.3,2.05],[1.6,surface+.3,0]];
  const down = x => line([x,1.75,.15],[x,surface,.15]);
  switch(stage) {
    case 0: return index===0 ? [line([2.35,-.1,0],[2.35,1.15,0])] : index===1 ? [line([-2.35,.25,0],[2.35,.25,0])] : [spin];
    case 1: return index===0 ? [inward] : index===1 ? [down(-.75),down(.75)] : [line([1.2,.18,.5],[1.2,.63,.5])];
    case 2: return index===0 ? [inward,spin] : index===1 ? [down(-1.65+q*3.3)] : [outward];
    case 3: return index===0 ? [line([1.38,1.0,.1],[1.38,surface,.1])] : index===1 ? [down(-.6),outward] : [outward];
    case 4: return index===0 ? [inward] : index===1 ? [down(-.69),down(.69)] : [spin];
    case 5: return index===0 ? [line([-1.0,1.4,.5],[-1.0,surface,.5])] : index===1 ? [down(-.69),down(.69)] : [[[.7,.4,.8],[.7,1.4,.8],[-.7,1.4,-.5],[-1.5,.96,-.5]]];
    case 6: return index===0 ? [down(-.45),down(.45)] : index===1 ? [[[-.9,1.3,.5],[-.9,.5,.5],[.9,.5,.5],[.9,1.3,.5]]] : [line([-1.75,1.15,.75],[1.75,1.15,.75])];
    case 7: return index===0 ? [line([.0,1.5,.0],[.0,.27,.0])] : index===1 ? [[[.0,.23,.64],[.0,.95,.9],[.0,.65,1.3],[.0,-.01,1.42]]] : [inward,outward];
    default: return [];
  }
}
