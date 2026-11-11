"use strict";
window.PRACTICE = (() => {
  const coffeeKey = "coachprep-coffee-days-v1";
  const coffeeInvitations=[
    "A little practice for you, a little coffee for me?",
    "If Coachprep's been good company, you can get the next coffee.",
    "You bring the determination. I'll bring the flashcards. Coffee?",
    "Finding your coaching footing? Feel free to fuel the person behind the practice.",
    "If this helped something click, I'd happily raise a mug to that.",
    "No need to send flowers. A coffee would be lovely.",
    "Coachprep runs in your browser. The person making it runs on coffee."
  ];
  const modes = ["recall","questions","mixed","scenario","exam"];
  const coreWords = {1:["Ethical","Practice"],2:["Coaching","Mindset"],3:["Agreements"],4:["Trust","Safety"],5:["Presence"],6:["Listens"],7:["Awareness"],8:["Client","Growth"]};
  const questionWords = {1:["Ethical"],2:["Mindset"],3:["Agreements"],4:["Trust","Safety"],5:["Presence"],6:["Listens"],7:["Awareness"],8:["Growth"]};
  const adaptiveVariant="adaptive-names-v1",dayMs=86400000;
  const nameScorePolicy="integer-10-9-v1",scorePolicy="integer-10-9-v2";
  const integerPolicies={"integer-10-9-v1":{version:5,grace:4},"integer-10-9-v2":{version:6,grace:16}};
  const isIntegerScored=saved=>["recall","questions","mixed"].includes(saved?.mode) &&
    Object.hasOwn(integerPolicies,saved.scorePolicy) && (saved.mode!=="recall" || saved.scorePolicy===nameScorePolicy);
  function integerScoreVersion(saved){
    if(!isIntegerScored(saved))throw new Error("Invalid integer scoring policy");
    return integerPolicies[saved.scorePolicy].version;
  }
  function scenarioGrace(saved){
    if(!isIntegerScored(saved))throw new Error("Invalid integer scoring policy");
    return integerPolicies[saved.scorePolicy].grace;
  }
  const stepLabels={1:"Select the name",2:"Select the C number",3:"Type with a core word",4:"Type from the C number"};
  const adaptiveSuccessMessages=["Correct!","Well done!","Exactly!"];
  function adaptiveSuccessMessage(responses){
    const successes=responses.filter(r=>r.matched===true && !r.revealed && !r.hintCount).length;
    return adaptiveSuccessMessages[successes%adaptiveSuccessMessages.length];
  }
  const isAdaptive=saved=>saved?.variant===adaptiveVariant;
  const emptyAdaptive=()=>({version:1,nextRound:0,items:{},completed:false,previousRound:null});
  const emptyAdaptiveItem=()=>({step:1,successes:0,lastSuccessAt:null,recent:[],streak:0,due:0,lastAnsweredRound:0,lastHintRound:0,counts:{}});
  function validAdaptive(value){
    const integer=n=>Number.isSafeInteger(n) && n>=0;
    const time=n=>Number.isFinite(n) && n>=0;
    const object=v=>v && typeof v==="object" && !Array.isArray(v);
    if(!object(value) || value.version!==1 || !integer(value.nextRound) || typeof value.completed!=="boolean" || !object(value.items))return false;
    if(value.previousRound!==null && (!object(value.previousRound) || !/^[1-4]{8}$/.test(value.previousRound.signature) ||
      value.previousRound.scheme!==undefined && value.previousRound.scheme!=="adaptive-integer-10-v1" ||
      !Number.isFinite(value.previousRound.score) || value.previousRound.score<0 || value.previousRound.score>1))return false;
    return Object.entries(value.items).every(([c,p])=>/^[1-8]$/.test(c) && object(p) &&
      [1,2,3,4].includes(p.step) && integer(p.successes) && p.successes<=3 &&
      (p.lastSuccessAt===null?p.successes===0:time(p.lastSuccessAt)) &&
      Array.isArray(p.recent) && p.recent.length<=3 && p.recent.every(r=>["correct","help"].includes(r)) &&
      integer(p.streak) && time(p.due) && integer(p.lastAnsweredRound) && p.lastAnsweredRound<=value.nextRound &&
      integer(p.lastHintRound) && p.lastHintRound<=value.nextRound && object(p.counts) &&
      Object.entries(p.counts).every(([step,counts])=>/^[1-4]$/.test(step) && object(counts) &&
        ["correct","assisted","missed"].every(k=>integer(counts[k]))));
  }
  function adaptiveItem(c,progress){
    const p=progress.items[c] || emptyAdaptiveItem(),counts=p.counts[p.step];
    const attempts=counts?counts.correct+counts.assisted+counts.missed:0;
    return {id:`r${c}`,type:"recall",c,step:p.step,cue:[2,3].includes(p.step)?questionWords[c][attempts%questionWords[c].length]:null};
  }
  function adaptiveHint(progress,c,round,now){
    const old=progress.items[c] || emptyAdaptiveItem();
    if(old.lastHintRound>=round || old.lastAnsweredRound>=round)return progress;
    return {...progress,items:{...progress.items,[c]:{...old,lastHintRound:round,streak:0,due:now+600000}}};
  }
  function adaptiveResult(progress,response,round,retry,now){
    const old=progress.items[response.c] || emptyAdaptiveItem();
    if(old.lastAnsweredRound>=round)return progress;
    const correct=response.matched===true && !response.revealed,help=!correct || response.hintCount>0;
    const outcome=!correct?"missed":help?"assisted":"correct";
    const counts={correct:0,assisted:0,missed:0,...old.counts[response.step]};
    counts[outcome]++;
    const next={...old,lastAnsweredRound:round,counts:{...old.counts,[response.step]:counts}};
    if(old.lastHintRound!==round){
      next.streak=help?0:old.streak+1;
      next.due=now+(help?600000:[1,3,7][Math.min(next.streak-1,2)]*dayMs);
    }
    if(!retry){
      next.recent=[...old.recent,help?"help":"correct"].slice(-3);
      if(help)next.successes=0;
      else{
        next.successes=Math.min(3,old.successes+1);next.lastSuccessAt=now;
      }
      const fallback=next.recent.filter(r=>r==="help").length>=2 && next.step>1;
      const advance=next.successes>=2 && next.step<4;
      if(fallback || advance){
        next.step+=fallback?-1:1;next.successes=0;next.recent=[];next.streak=0;
        next.due=now+(fallback?600000:dayMs);
      }
    }
    return {...progress,items:{...progress.items,[response.c]:next}};
  }
  function adaptiveMetric(saved){
    if(!isAdaptive(saved) || !saved.completed || saved.snapshot?.session?.retry)return null;
    const rows=roundResponses(saved);
    if(rows.length!==8 || new Set(rows.map(r=>r.c)).size!==8 || rows.some(r=>![1,2,3,4].includes(r.step)))return null;
    const total=isIntegerScored(saved)?roundScore(saved):null;
    if(isIntegerScored(saved) && !total)return null;
    return {signature:[...rows].sort((a,b)=>a.c-b.c).map(r=>r.step).join(""),
      ...(isIntegerScored(saved)?{scheme:"adaptive-integer-10-v1"}:{}),
      score:total?total.earned/total.maximum:rows.filter(r=>r.matched && !r.revealed && !r.hintCount).length/8};
  }
  function recallHintState(title,hints=0,states=null) {
    return states?[...states]:title.split(" ").map((_,i,words)=>i<Math.min(hints,words.length-1)?2:0);
  }
  function nextRecallHint(competency,states,kind) {
    if(!["letter","word","core"].includes(kind))throw new Error("Invalid recall hint");
    const words=competency.title.split(" ");
    const index=states.findIndex((state,i)=>kind==="letter"?state===0:state!==2 && (kind!=="core" || coreWords[competency.id].includes(words[i])));
    if(index===-1)return null;
    const next=kind==="letter" && words[index].length>1?1:2;
    if(next===2 && states.filter(state=>state===2).length>=words.length-1)return null;
    return states.map((state,i)=>i===index?next:state);
  }
  function recallHintText(title,states,spoken=false) {
    return title.split(" ").map((word,i)=>states[i]===2?word:states[i]===1?(spoken?`first letter ${word[0]}`:`${word[0]}...`):(spoken?"blank":"____")).join(" ");
  }
  function recallOutcome(response) {
    if (!response) return null;
    const expected=response.c ?? response.item?.c;
    if(response.revealed!==true && response.matched===false && Number.isInteger(response.misplacedC) &&
      response.misplacedC>=1 && response.misplacedC<=8 && Number.isInteger(expected) && expected>=1 && expected<=8 && response.misplacedC!==expected)return "misplaced";
    if (response.revealed === true || response.matched !== true || response.outcome === "missed") return "missed";
    return response.outcome === "unaided" ? "unaided" : "assisted";
  }
  function recallMissLabel(response) {
    return response?.revealed===true?"Pass: answer revealed":response?.revealed===false && response.matched===false?"Name did not match":"Needs another look";
  }
  function recallRetryTargets(rows) {
    const known=rows.filter(r=>r.type==="recall" && Number.isInteger(r.c) && r.c>=1 && r.c<=8);
    const unique=[...new Map(known.map(r=>[r.c,r])).values()];
    return {
      missed:unique.filter(r=>r.revealed===true || r.matched===false),
      assisted:unique.filter(r=>r.revealed===false && r.matched===true && recallOutcome(r)==="assisted")
    };
  }
  function recallMisplacement(answer,competencies,normalize) {
    if(!answer || answer.revealed===true || answer.matched!==false)return null;
    const expected=answer.c ?? answer.item?.c;
    if(!competencies.some(c=>c.id===expected))return null;
    const named=competencies.find(c=>c.id===answer.misplacedC) ||
      (typeof answer.attempt==="string"?competencies.find(c=>normalize(c.title)===normalize(answer.attempt)):null);
    return named && named.id!==expected?named:null;
  }
  function score(outcome, seconds, bonus, cutoff) {
    if (!["recognition","reasonable","missed"].includes(outcome) || !Number.isFinite(seconds) || seconds < 0) throw new Error("Invalid practice result");
    if (outcome === "missed") return 0;
    return (outcome === "recognition" ? 90 : 80) + bonus * Math.max(0,Math.min(1,(cutoff-seconds)/(cutoff-4)));
  }
  function points(outcome, seconds) {
    return score(outcome,seconds,14,60);
  }
  function recallPoints(response) {
    if(response.revealed)return 0;
    if(!response.matched)return response.misplacedC?1:0;
    const hints=response.hintCount ?? 0;
    return Math.max(1,10-(hints>0?4:0)-(hints>1?2:0)-Math.max(0,hints-2));
  }
  function earnedPoints(response) {
    return Object.hasOwn(response,"score")?response.score:score(response.outcome,response.seconds,10,64);
  }
  const isScoredMixed=saved=>saved?.mode==="mixed" && saved.mixedScoreVersion===1;
  function scoreMaximum(type){
    if(type==="recall")return 10;
    if(type==="questions")return 9;
    throw new Error("Invalid scored exercise type");
  }
  function integerPoints(response,policy=scorePolicy){
    if(!Object.hasOwn(integerPolicies,policy))throw new Error("Invalid integer scoring policy");
    scoreMaximum(response.type);
    if(response.type==="recall")return recallPoints(response);
    const {outcome,seconds}=response;
    if(!["recognition","reasonable","missed"].includes(outcome) || !Number.isFinite(seconds) || seconds<0)throw new Error("Invalid practice result");
    if(outcome==="missed")return 0;
    const grace=integerPolicies[policy].grace;
    const elapsed=Math.max(0,Math.min(1,(seconds-grace)/(60-grace)));
    return Math.round((outcome==="recognition"?9:8)-5*elapsed);
  }
  function mixedMaximum(type){
    if(type==="recall")return 100;
    if(type==="questions")return 90;
    throw new Error("Invalid Mixed exercise type");
  }
  function mixedPoints(response){
    const maximum=mixedMaximum(response.type);
    return Math.round(response.type==="recall"?recallPoints(response)*10:points(response.outcome,response.seconds)*maximum/104);
  }
  function roundScore(saved,c=null){
    const unified=isIntegerScored(saved);
    if(!unified && !isScoredMixed(saved))return null;
    const maximum=unified?scoreMaximum:mixedMaximum,version=unified?integerScoreVersion(saved):4;
    const session=saved.snapshot?.session;
    if(!session?.items)return null;
    const roundItems=session.items.slice(session.roundStart || 0,session.roundEnd),roundRows=roundResponses(saved);
    if(roundRows.length>roundItems.length || roundRows.some((r,index)=>r.c!==roundItems[index].c || r.type!==roundItems[index].type))return null;
    const items=roundItems.filter(item=>c===null || item.c===c),rows=roundRows.filter(r=>c===null || r.c===c);
    if(!items.length || items.some(item=>!["recall","questions"].includes(item.type)) ||
      rows.some(r=>!["recall","questions"].includes(r.type) || r.scoreVersion!==version || !Number.isInteger(r.score) || r.score<0 || r.score>maximum(r.type)))return null;
    return {earned:rows.reduce((sum,r)=>sum+r.score,0),maximum:items.reduce((sum,item)=>sum+maximum(item.type),0)};
  }
  function mixedScore(saved,c=null){
    return isScoredMixed(saved)?roundScore(saved,c):null;
  }
  function migrateScores(saved) {
    if(!saved.responses.some(r=>r.type==="questions" && !Object.hasOwn(r,"score")))return saved;
    return {...saved,responses:saved.responses.map(r=>r.type==="questions" && !Object.hasOwn(r,"score")?{...r,score:earnedPoints(r),scoreVersion:1}:r)};
  }
  function roundResponses(saved) {
    const session=saved.snapshot?.session;
    return saved.responses.slice(session?.roundStart || 0,session?.roundEnd);
  }
  function recallScore(saved) {
    if(saved.mode!=="recall" || !saved.completed)return null;
    const rows=roundResponses(saved);
    if(!rows.length || rows.length>8 || new Set(rows.map(r=>r.c)).size!==rows.length ||
      rows.some(r=>r.type!=="recall" || !Number.isInteger(r.c) || r.c<1 || r.c>8 ||
        !Object.hasOwn(r,"score") || !Number.isFinite(r.score) || r.score<0 || r.score>10))return null;
    return {earned:rows.reduce((sum,r)=>sum+r.score,0),maximum:rows.length*10};
  }
  function recallPercentage(saved) {
    if(isAdaptive(saved))return null;
    if(saved.snapshot?.session?.retry===true)return null;
    const score=recallScore(saved);
    return score?.maximum===80?Math.round(score.earned/80*100):null;
  }
  function roundMetric(saved,examMatches=null) {
    if(isAdaptive(saved))return null;
    if(saved.snapshot?.session?.retry===true)return null;
    if(saved.mode==="exam")return examMatches?.length===8?{scheme:"exam-names-v1",score:examMatches.filter(Boolean).length/8}:null;
    const rows=roundResponses(saved);
    if(isIntegerScored(saved)){
      const total=roundScore(saved),session=saved.snapshot?.session;
      return saved.completed && total && rows.length===session.roundEnd-session.roundStart?
        {scheme:`${saved.mode}-${saved.scorePolicy}`,score:total.earned/total.maximum}:null;
    }
    if(isScoredMixed(saved)){
      const total=mixedScore(saved),session=saved.snapshot?.session;
      return total && rows.length===session.items.slice(session.roundStart || 0,session.roundEnd).length?
        {scheme:"mixed-100-90-v1",score:total.earned/total.maximum}:null;
    }
    if(!rows.length || rows.some(r=>r.type==="questions" && r.scoreVersion!==2))return null;
    if(!["recall","questions","mixed"].includes(saved.mode))return null;
    return {scheme:saved.mode==="recall"?"recall-unaided-v1":`${saved.mode}-bonus14-v1`,
      score:rows.reduce((sum,r)=>sum+(r.type==="recall"?(r.matched && !r.revealed && r.outcome==="unaided"?1:0):earnedPoints(r)/104),0)/rows.length};
  }
  function validBaselines(value) {
    return value && typeof value==="object" && !Array.isArray(value) &&
      Object.entries(value).every(([mode,result])=>["recall","questions","mixed","exam"].includes(mode) && result &&
        ["recall-unaided-v1","questions-bonus14-v1","mixed-bonus14-v1","mixed-100-90-v1","exam-names-v1",
          "recall-integer-10-9-v1","questions-integer-10-9-v1","mixed-integer-10-9-v1",
          "questions-integer-10-9-v2","mixed-integer-10-9-v2"].includes(result.scheme) &&
        (result.scheme!=="mixed-100-90-v1" || mode==="mixed") &&
        (!result.scheme.includes("-integer-10-9-") || result.scheme.startsWith(`${mode}-integer-10-9-`)) &&
        Number.isFinite(result.score) && result.score>=0 && result.score<=1);
  }
  function improves(current,previous) {
    return !!current && !!previous && current.scheme===previous.scheme && current.score+1e-12>=previous.score;
  }
  function validCompletedModes(value){
    return value && typeof value==="object" && !Array.isArray(value) &&
      Object.entries(value).every(([mode,done])=>modes.includes(mode) && done===true);
  }
  function duration(ms) {
    const seconds=Math.max(0,Math.floor(ms/1000));
    return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  }
  function day(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  }
  function validDay(value) {
    if(typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const [year,month,date]=value.split("-").map(Number),d=new Date(year,month-1,date);
    return day(d)===value;
  }
  function validCoffee(value) {
    return value && [1,2,3].includes(value.version) && Array.isArray(value.days) && value.days.length<=3 &&
      value.days.every(validDay) && new Set(value.days).size===value.days.length &&
      (value.version===1?(value.dismissed===null || validDay(value.dismissed)):
        value.cooldown===null || value.cooldown && ["treat","dismiss"].includes(value.cooldown.kind) &&
          validDay(value.cooldown.day) && Number.isSafeInteger(value.cooldown.rounds) && value.cooldown.rounds>=0) &&
      (value.version!==3 || value.invitation===null || value.invitation &&
        Number.isInteger(value.invitation.index) && value.invitation.index>=0 && value.invitation.index<coffeeInvitations.length &&
        Number.isSafeInteger(value.invitation.rounds) && value.invitation.rounds>=0 && typeof value.invitation.pending==="boolean");
  }
  function visit(value,today) {
    if(!validDay(today) || !validCoffee(value))throw new Error("Invalid coffee visit state");
    const next={...value,days:[...value.days]};
    if(next.days.length<3 && !next.days.includes(today))next.days.push(today);
    return next;
  }
  function previousDay(date){
    return day(new Date(date.getFullYear(),date.getMonth(),date.getDate()-1));
  }
  const emptySupport=()=>({version:1,total:0,days:[],recent:[],unavailable:[]});
  function validSupport(value){
    return value?.version===1 && Number.isSafeInteger(value.total) && value.total>=0 &&
      Array.isArray(value.days) && value.days.length<=value.total && value.days.every(validDay) &&
      new Set(value.days).size===value.days.length && (value.total===0)===(value.days.length===0) &&
      Array.isArray(value.unavailable) && value.unavailable.length<=2 &&
      value.unavailable.every(d=>value.days.includes(d)) && new Set(value.unavailable).size===value.unavailable.length &&
      Array.isArray(value.recent) && value.recent.length<=256 &&
      new Set(value.recent.map(r=>`${r?.day}:${r?.signature}`)).size===value.recent.length &&
      value.recent.every(r=>r && value.days.includes(r.day) && !value.unavailable.includes(r.day) &&
        typeof r.signature==="string" && r.signature.length>0 && r.signature.length<=2048 &&
        Number.isSafeInteger(r.rounds) && r.rounds>0 && Number.isSafeInteger(r.earned) && r.earned>=0 &&
        Number.isSafeInteger(r.maximum) && r.maximum>0 && r.earned<=r.maximum &&
        Number.isFinite(r.elapsedMs) && r.elapsedMs>=0 && r.elapsedMs<=r.rounds*1e10) &&
      value.recent.reduce((sum,r)=>sum+r.rounds,0)<=value.total;
  }
  function ordinaryRound(saved){
    const s=saved?.snapshot?.session,start=s?.roundStart || 0,end=s?.roundEnd ?? s?.items?.length;
    return !!(saved?.completed===true && ["recall","questions","mixed"].includes(saved.mode) && s &&
      Array.isArray(s.items) && Array.isArray(saved.responses) &&
      s.retry!==true && Number.isInteger(end) && end>start && end-start<=8 && s.index===end &&
      roundResponses(saved).length===end-start);
  }
  function supportSignature(saved){
    if(!ordinaryRound(saved) || !isIntegerScored(saved))return null;
    const total=roundScore(saved);
    if(!total)return null;
    const s=saved.snapshot.session;
    return JSON.stringify([saved.mode,saved.variant || "typed",saved.scorePolicy,total.maximum,
      s.items.slice(s.roundStart || 0,s.roundEnd).map(i=>[i.id,i.step || null,i.cue || null]).sort((a,b)=>a[0].localeCompare(b[0]))]);
  }
  function supportCompletion(value,saved,date=new Date()){
    if(!validSupport(value))throw new Error("Invalid local round summary");
    if(!ordinaryRound(saved) || saved.supportObserved!==true)return value;
    const today=day(date),keep=[today,previousDay(date)],signature=supportSignature(saved);
    const next={version:1,total:value.total+1,days:value.days.includes(today)?[...value.days]:[...value.days,today],
      recent:value.recent.filter(r=>keep.includes(r.day)).map(r=>({...r})),
      unavailable:value.unavailable.filter(d=>keep.includes(d))};
    if(signature && !next.unavailable.includes(today)){
      const total=roundScore(saved),row=next.recent.find(r=>r.day===today && r.signature===signature);
      if(row){row.rounds++;row.earned+=total.earned;row.maximum+=total.maximum;row.elapsedMs+=saved.elapsedMs;}
      else if(next.recent.length<256)next.recent.push({day:today,signature,rounds:1,...total,elapsedMs:saved.elapsedMs});
      else {next.recent=next.recent.filter(r=>r.day!==today);next.unavailable.push(today);}
    }
    if(!validSupport(next))throw new Error("Local round summary could not be updated");
    return next;
  }
  function supportCopy(value,saved,date=new Date()){
    if(!validSupport(value))throw new Error("Invalid local round summary");
    const today=day(date),yesterday=previousDay(date),signature=supportSignature(saved);
    const current=value.recent.find(r=>r.day===today && r.signature===signature);
    const previous=value.recent.find(r=>r.day===yesterday && r.signature===signature);
    let comparison="",improved=false;
    if(signature && !value.unavailable.some(d=>d===today || d===yesterday) && current && previous){
      const gain=Math.floor((current.earned/current.maximum-previous.earned/previous.maximum)*100+1e-9);
      const faster=previous.elapsedMs>0 && current.elapsedMs>0?
        Math.floor((1-(current.elapsedMs/current.rounds)/(previous.elapsedMs/previous.rounds))*100+1e-9):0;
      if(gain>0){comparison=`You're scoring ${gain} percentage point${gain===1?"":"s"} higher than yesterday.`;improved=true;}
      else if(faster>0)comparison=`For the same exercises, today's rounds took ${faster}% less time on average than yesterday.`;
    }
    return {heading:improved?"Good progress!":"Enjoying the practice?",
      progress:value.total?`You've completed ${value.total} round${value.total===1?"":"s"} on ${value.days.length} day${value.days.length===1?"":"s"} since this browser started counting.${comparison?` ${comparison}`:""} Keep it up!`:""};
  }
  function coffee(storage,onError,now=()=>new Date()) {
    let value=null,migrate=false;
    function read(){
      try{
        const raw=storage.getItem(coffeeKey);
        value=raw===null?{version:3,days:[],cooldown:null,invitation:null}:JSON.parse(raw);
        if(!validCoffee(value))throw new Error("Invalid coffee preferences");
        migrate=value.version!==3;
        if(value.version===1)value={version:2,days:value.days,cooldown:value.dismissed?{kind:"treat",day:value.dismissed,rounds:0}:null};
        if(migrate)value={version:3,days:value.days,cooldown:value.cooldown,invitation:null};
        return true;
      }catch{value=null;onError("The coffee reminder preference could not be read. The reminder is off; your study progress is unchanged.");return false;}
    }
    function today(date=now()){
      if(!read())return false;
      const next=visit(value,day(date));
      if(!migrate && next.days.length===value.days.length)return true;
      try{storage.setItem(coffeeKey,JSON.stringify(next));value=next;return true;}
      catch{value=null;onError("The coffee reminder preference could not be saved. The reminder is off; your study progress is unchanged.");return false;}
    }
    function suppress(kind,total){
      const date=now();
      if(!Number.isSafeInteger(total) || total<0)throw new Error("Invalid completed round count");
      if(!today(date))return false;
      const next={...value,cooldown:{kind,day:day(date),rounds:total},
        invitation:value.invitation?{...value.invitation,pending:true}:null};
      try{storage.setItem(coffeeKey,JSON.stringify(next));value=next;return true;}
      catch{onError("The coffee reminder preference could not be saved. This tab will keep it hidden; another tab or reload may show it again. Your study progress is unchanged.");return false;}
    }
    function eligible(total=0){
      if(!Number.isSafeInteger(total) || total<0)throw new Error("Invalid completed round count");
      const date=now();
      return today(date) && value.days.length===3 && (!value.cooldown || day(date)>value.cooldown.day ||
        value.cooldown.kind==="dismiss" && total-value.cooldown.rounds>=3);
    }
    return {
      key:coffeeKey,eligible,
      invitation(total=0){
        if(!eligible(total))return null;
        const current=value.invitation;
        if(current && !current.pending && total<=current.rounds)return coffeeInvitations[current.index];
        const index=current?(current.index+1)%coffeeInvitations.length:0;
        const next={...value,invitation:{index,rounds:total,pending:false}};
        try{storage.setItem(coffeeKey,JSON.stringify(next));value=next;return coffeeInvitations[index];}
        catch{onError("The coffee reminder text could not be saved. The reminder is off; your study progress is unchanged.");return null;}
      },
      visit:today,
      dismiss(total=0){return suppress("dismiss",total);},
      treat(total=0){return suppress("treat",total);},
      resetRounds(){
        if(!read())return false;
        if(value.cooldown?.kind!=="dismiss" && !value.invitation)return true;
        const next={...value,cooldown:value.cooldown?.kind==="dismiss"?{...value.cooldown,rounds:0}:value.cooldown,
          invitation:value.invitation?{...value.invitation,rounds:0}:null};
        try{storage.setItem(coffeeKey,JSON.stringify(next));return true;}
        catch{onError("The coffee reminder preference could not be reset. It may stay hidden until tomorrow. Your study progress was deleted.");return false;}
      }
    };
  }
  function validSaved(p,data) {
    const adaptive=isAdaptive(p),scaledMixed=isScoredMixed(p),unified=isIntegerScored(p),versioned=unified || scaledMixed,version=unified?integerScoreVersion(p):4;
    if(p?.scorePolicy!==undefined && !unified || unified && p.mixedScoreVersion!==undefined)return false;
    if(p?.mixedScoreVersion!==undefined && !scaledMixed)return false;
    if(p?.variant!==undefined && (!adaptive || p.mode!=="recall"))return false;
    if(p?.supportObserved!==undefined && (p.supportObserved!==true || !["recall","questions","mixed"].includes(p.mode)))return false;
    if(!p || p.version!==1 || !modes.includes(p.mode) || typeof p.completed!=="boolean" ||
      (p.completionRecorded!==undefined && typeof p.completionRecorded!=="boolean") ||
      !Number.isFinite(p.elapsedMs) || p.elapsedMs<0 || p.elapsedMs>1e10 ||
      !Number.isFinite(p.answerMs) || p.answerMs<0 || p.answerMs>1e10 ||
      !Array.isArray(p.responses) || p.responses.length>128 || !p.snapshot)return false;
    if(!p.responses.every(r=>r && Number.isInteger(r.c) && r.c>=1 && r.c<=8 &&
      ["recall","questions","scenario"].includes(r.type) && ["unaided","assisted","recognition","reasonable","missed","explored"].includes(r.outcome) &&
      Number.isFinite(r.seconds) && r.seconds>=0 && r.seconds<=1e7 &&
      (!versioned || r.scoreVersion===version && Object.hasOwn(r,"score") && ["recall","questions"].includes(r.type) &&
        (r.type==="questions"?["recognition","reasonable","missed"]:["unaided","assisted","missed"]).includes(r.outcome)) &&
      (!Object.hasOwn(r,"misplacedC") || r.type==="recall" && Number.isInteger(r.misplacedC) && r.misplacedC>=1 && r.misplacedC<=8 && r.misplacedC!==r.c && r.matched===false && r.revealed===false) &&
      (!Object.hasOwn(r,"hintCount") || r.type==="recall" && (r.scoreVersion===2 || adaptive && r.scoreVersion===3 || versioned && r.scoreVersion===version) && Number.isInteger(r.hintCount) && r.hintCount>=0 && r.hintCount<=10) &&
      (!Object.hasOwn(r,"score") || r.type==="questions" && Number.isFinite(r.score) && r.score>=0 && r.score<=(unified?9:scaledMixed?90:104) && (!versioned || Number.isInteger(r.score) && r.score===(unified?integerPoints(r,p.scorePolicy):mixedPoints(r))) ||
        r.type==="recall" && typeof r.matched==="boolean" && typeof r.revealed==="boolean" && r.score===(unified?integerPoints(r,p.scorePolicy):scaledMixed?mixedPoints(r):recallPoints(r)) && ([1,2].includes(r.scoreVersion) || adaptive && r.scoreVersion===3 || versioned && r.scoreVersion===version)) &&
      (!Object.hasOwn(r,"scoreVersion") || r.type==="questions" && ([1,2].includes(r.scoreVersion) || versioned && r.scoreVersion===version) ||
        r.type==="recall" && ([1,2].includes(r.scoreVersion) || adaptive && r.scoreVersion===3 || versioned && r.scoreVersion===version) && Object.hasOwn(r,"score") && (r.scoreVersion===1 || Object.hasOwn(r,"hintCount"))) &&
      (!adaptive || r.scoreVersion===(unified?5:3) && [1,2,3,4].includes(r.step) && (r.step===4 || r.hintCount===0) && (!r.misplacedC || r.step===4)) &&
      (r.type==="questions"?["recognition","reasonable","missed"]:r.type==="recall"?["unaided","assisted","missed"]:["explored"]).includes(r.outcome) &&
      (p.mode==="mixed" || r.type===p.mode || p.mode==="scenario"&&r.type==="scenario")))return false;
    const s=p.snapshot;
    if(unified?s.session?.scorePolicy!==p.scorePolicy:s.session?.scorePolicy!==undefined)return false;
    if(scaledMixed?s.session?.mixedScoreVersion!==1:s.session?.mixedScoreVersion!==undefined)return false;
    if(versioned && (!Number.isInteger(s.session.roundStart) || !Number.isInteger(s.session.roundEnd)))return false;
    const validItem=i=>i && (adaptive?[1,2,3,4].includes(i.step) &&
      ([2,3].includes(i.step)?questionWords[i.c]?.includes(i.cue):i.cue===null):!Object.hasOwn(i,"step") && !Object.hasOwn(i,"cue")) && (i.type==="recall"?data.competencies.some(c=>i.id==="r"+c.id && i.c===c.id):
      i.type==="questions"&&data.questions.some(q=>q.id===i.id && q.c===i.c));
    const validAnswer=(a,item)=>a && validItem(a.item) && a.item.id===item?.id &&
      typeof a.attempt==="string" && a.attempt.length<=10000 && Number.isInteger(a.hints) && a.hints>=0 && a.hints<=10 &&
      typeof a.done==="boolean" && typeof a.revealed==="boolean" && typeof a.assistLogged==="boolean" &&
      (!a.done || a.reported===true) &&
      (!versioned || (a.done?a.scoreVersion===version && p.responses.some((r,index)=>s.session.items[index]?.id===item?.id &&
        a.score===r.score && a.outcome===r.outcome && (item.type!=="recall" ||
          a.matched===r.matched && a.revealed===r.revealed && a.hints===r.hintCount && (a.misplacedC || null)===(r.misplacedC || null))):
        !Object.hasOwn(a,"score") && !Object.hasOwn(a,"scoreVersion"))) &&
      (!adaptive || a.item.step===item.step && a.item.cue===item.cue && (item.step===4 || a.hints===0) &&
        (!Object.hasOwn(a,"successMessage") || adaptiveSuccessMessages.includes(a.successMessage) && a.done && a.matched && !a.revealed && a.hints===0) &&
        (!a.done || typeof a.matched==="boolean") && (!a.revealed || a.done && !a.matched && a.selected===null) &&
        (item.step<=2?Array.isArray(a.choices) && a.choices.length===4 && new Set(a.choices).size===4 &&
          a.choices.every(c=>Number.isInteger(c) && c>=1 && c<=8) && a.choices.includes(item.c) &&
          (a.selected===null || a.choices.includes(a.selected)) &&
          (!a.done || a.revealed || a.selected!==null && a.matched===(a.selected===item.c)):a.selected===null)) &&
      (!Object.hasOwn(a,"hintWords") || a.item.type==="recall" && Array.isArray(a.hintWords) &&
        a.hintWords.length===data.competencies.find(c=>c.id===a.item.c).title.split(" ").length &&
        a.hintWords.every(state=>[0,1,2].includes(state)) && a.hintWords.filter(state=>state===2).length<a.hintWords.length &&
        (a.hints>0 || a.hintWords.every(state=>state===0)) &&
        a.hintWords.every((state,i)=>state!==1 || data.competencies.find(c=>c.id===a.item.c).title.split(" ")[i].length>1)) &&
      (!Object.hasOwn(a,"misplacedC") || a.item.type==="recall" && a.done && Number.isInteger(a.misplacedC) && a.misplacedC>=1 && a.misplacedC<=8 && a.misplacedC!==a.item.c && a.matched===false && a.revealed===false) &&
      (a.item.type!=="questions" || Array.isArray(a.optionOrder) && a.optionOrder.length===4 &&
        new Set(a.optionOrder).size===4 && a.optionOrder.every(i=>Number.isInteger(i) && i>=0 && i<4) &&
        (!a.done || a.selected!==null) && (a.selected===null || Number.isInteger(a.selected) && a.selected>=0 && a.selected<4));
    if(s.view!==(p.mode==="mixed"?"recall":p.mode) || !Array.isArray(s.history) || s.history.length>8 ||
      !s.history.every(h=>h && Number.isInteger(h.index) && Object.hasOwn(data.scenario.nodes,h.node) && data.scenario.nodes[h.node]?.choices?.[h.index]) ||
      s.scenarioNode!==null && !Object.hasOwn(data.scenario.nodes,s.scenarioNode) ||
      s.branchChoice!==null && (!Number.isInteger(s.branchChoice) || !data.scenario.nodes[s.scenarioNode]?.choices?.[s.branchChoice]))return false;
    if(["scenario","exam"].includes(p.mode)?s.session!==null || s.active!==null:!s.session)return false;
    if(s.session && (s.session.type!==p.mode || !Array.isArray(s.session.items) || !s.session.items.length || s.session.items.length>40 ||
      (adaptive && (!Number.isSafeInteger(s.session.adaptiveRound) || s.session.adaptiveRound<1)) ||
      (s.session.retry!==undefined && (s.session.retry!==true || p.mode!=="recall" || s.session.items.length>8 || s.session.roundStart!==0 || s.session.roundEnd!==s.session.items.length)) ||
      !s.session.items.every(i=>validItem(i) && (p.mode==="mixed" || i.type===p.mode)) ||
      new Set(s.session.items.map(i=>i.id)).size!==s.session.items.length ||
      !Number.isInteger(s.session.index) || s.session.index<0 || s.session.index>s.session.items.length ||
      (s.session.roundStart!==undefined && (!Number.isInteger(s.session.roundStart) || s.session.roundStart<0 || s.session.roundStart>s.session.index ||
        !Number.isInteger(s.session.roundEnd) || s.session.roundEnd<s.session.index || s.session.roundEnd>s.session.items.length ||
        s.session.roundEnd-s.session.roundStart<1 || s.session.roundEnd-s.session.roundStart>8)) ||
      !Array.isArray(s.session.results) || s.session.results.length!==s.session.index ||
      !s.session.results.every(r=>r && ["recall","questions"].includes(r.type) && ["unaided","assisted","recognition","reasonable","missed"].includes(r.outcome) && typeof r.missed==="boolean")))return false;
    if(s.active && !validAnswer(s.active,s.session?.items[s.session.index]))return false;
    const answers=s.session?.answers;
    if(answers!==undefined && (!answers || typeof answers!=="object" || Array.isArray(answers) ||
      Object.entries(answers).some(([key,a])=>String(Number(key))!==key || !Number.isInteger(Number(key)) ||
        Number(key)<0 || Number(key)>s.session.index || !a || !a.done || !validAnswer(a,s.session.items[Number(key)]))))return false;
    if(s.reviewIndex!==undefined && s.reviewIndex!==null && (!s.session || !Number.isInteger(s.reviewIndex) ||
      s.reviewIndex<(s.session.roundStart || 0) || !Object.hasOwn(answers || {},s.reviewIndex)))return false;
    if(p.examReview!==undefined && (p.mode!=="exam" || typeof p.examReview!=="boolean"))return false;
    if(s.session && p.responses.length!==s.session.index+(s.active?.done?1:0))return false;
    if(adaptive && p.responses.some((r,index)=>r.c!==s.session.items[index]?.c || r.step!==s.session.items[index]?.step))return false;
    if(versioned && p.responses.some((r,index)=>r.c!==s.session.items[index]?.c || r.type!==s.session.items[index]?.type))return false;
    if(versioned && p.completed && (s.session.index!==s.session.roundEnd || s.active!==null))return false;
    if(s.session && s.session.index===s.session.items.length && !p.completed)return false;
    if(p.mode==="scenario" && (p.responses.length!==s.history.length+(s.branchChoice!==null?1:0) || p.completed!==(s.scenarioNode===null)))return false;
    return true;
  }
  return {uiVersion:16,coffeeInvitations,nameScorePolicy,scorePolicy,isIntegerScored,integerScoreVersion,scenarioGrace,scoreMaximum,integerPoints,roundScore,adaptiveVariant,questionWords,stepLabels,adaptiveSuccessMessage,isAdaptive,emptyAdaptive,validAdaptive,adaptiveItem,adaptiveHint,adaptiveResult,adaptiveMetric,recallOutcome,recallMissLabel,recallRetryTargets,recallMisplacement,points,recallPoints,isScoredMixed,mixedMaximum,mixedPoints,mixedScore,recallScore,recallPercentage,recallHintState,nextRecallHint,recallHintText,earnedPoints,migrateScores,roundResponses,roundMetric,validBaselines,validCompletedModes,improves,duration,day,validDay,validCoffee,visit,emptySupport,validSupport,ordinaryRound,supportCompletion,supportCopy,coffee,validSaved};
})();
