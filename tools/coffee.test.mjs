import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const context={window:{}};
for(const name of ["practice","content"])vm.runInNewContext(readFileSync(new URL(`../${name}.js`,import.meta.url),"utf8"),context);
const P=context.window.PRACTICE,D=context.window.STUDY;
const date=(day,time="12:00:00")=>new Date(`${day}T${time}`);
function round({mode="questions",outcome="recognition",policy=P.scorePolicy,step=null,elapsedMs=80000}={}){
  const items=D.competencies.map(c=>mode==="recall"?{id:`r${c.id}`,c:c.id,type:"recall",...(step?{step,cue:null}:{})}:
    {id:D.questions.find(q=>q.c===c.id).id,c:c.id,type:"questions"});
  const saved={version:1,mode,scorePolicy:mode==="recall"?P.nameScorePolicy:policy,supportObserved:true,
    elapsedMs,answerMs:0,completed:true,responses:[],snapshot:{view:mode,active:null,history:[],
      scenarioNode:D.scenario.start,branchChoice:null,session:{type:mode,index:8,roundStart:0,roundEnd:8,items,results:[]}}};
  saved.snapshot.session.scorePolicy=saved.scorePolicy;
  saved.responses=items.map(i=>{
    const r={c:i.c,type:i.type,outcome:mode==="recall"?"unaided":outcome,seconds:4,
      ...(mode==="recall"?{matched:true,revealed:false,hintCount:0}:{}),...(step?{step}:{})};
    return {...r,score:P.integerPoints(r,saved.scorePolicy),scoreVersion:P.integerScoreVersion(saved)};
  });
  saved.snapshot.session.results=items.map(i=>({type:i.type,outcome:mode==="recall"?"unaided":outcome,missed:false}));
  if(step){saved.variant=P.adaptiveVariant;saved.snapshot.session.adaptiveRound=1;}
  return saved;
}
function preferences(value={version:1,days:["2026-01-01","2026-01-02","2026-01-03"],dismissed:null}){
  const store=new Map([["coachprep-coffee-days-v1",JSON.stringify(value)]]),errors=[];
  let now=date("2026-11-10"),fail=false;
  const coffee=P.coffee({getItem:k=>store.get(k)??null,setItem:(k,v)=>{if(fail)throw Error("full");store.set(k,v);}},e=>errors.push(e),()=>now);
  return {coffee,store,errors,setDate:d=>{now=d;},fail:()=>{fail=true;}};
}
test("coffee migrates old dates and same-day dismissal without inventing completions",()=>{
  const {coffee,store,setDate}=preferences({version:1,days:["2026-01-01","2026-01-02","2026-01-03"],dismissed:"2026-11-10"});
  assert.equal(coffee.eligible(20),false);
  assert.equal(JSON.parse(store.get(coffee.key)).version,3);
  assert.equal(JSON.parse(store.get(coffee.key)).days.length,3);
  setDate(date("2026-11-11"));assert.equal(coffee.eligible(20),true);
  assert.equal(P.emptySupport().total,0);
});
test("initial eligibility remains three distinct visiting days",()=>{
  const p=preferences({version:1,days:[],dismissed:null});
  assert.equal(p.coffee.eligible(100),false);
  p.coffee.visit();assert.equal(p.coffee.eligible(100),false);
  p.setDate(date("2026-11-12"));assert.equal(p.coffee.eligible(100),false);
  p.setDate(date("2026-11-20"));assert.equal(p.coffee.eligible(0),true);
});
test("treat waits for next local day regardless of completions, reload or rollback",()=>{
  const p=preferences();
  p.setDate(date("2026-11-10","23:59:59"));assert.equal(p.coffee.treat(2),true);
  assert.equal(p.coffee.eligible(100),false);
  assert.equal(preferences(JSON.parse(p.store.get(p.coffee.key))).coffee.eligible(100),false);
  p.setDate(date("2026-11-09"));assert.equal(p.coffee.eligible(100),false);
  p.setDate(date("2026-11-11","00:00:00"));assert.equal(p.coffee.eligible(2),true);
});
test("not now expires after exactly three additional completions or local midnight",()=>{
  const p=preferences();assert.equal(p.coffee.dismiss(7),true);
  for(const n of [7,8,9])assert.equal(p.coffee.eligible(n),false);
  assert.equal(p.coffee.eligible(10),true);
  assert.equal(p.coffee.dismiss(10),true);assert.equal(p.coffee.eligible(12),false);
  p.setDate(date("2026-11-11","00:00:00"));assert.equal(p.coffee.eligible(10),true);
  p.setDate(date("2026-11-10"));assert.equal(p.coffee.eligible(12),false);
});
test("reset adjusts round baseline but retains next-day suppression",()=>{
  const p=preferences();p.coffee.dismiss(7);p.coffee.resetRounds();
  assert.equal(p.coffee.eligible(2),false);assert.equal(p.coffee.eligible(3),true);
  p.coffee.treat(3);p.coffee.resetRounds();assert.equal(p.coffee.eligible(100),false);
});
test("cross-tab preference updates are read before any cooldown decision",()=>{
  const p=preferences();
  p.coffee.dismiss(0);
  p.store.set(p.coffee.key,JSON.stringify({version:2,days:["2026-01-01","2026-01-02","2026-01-03"],cooldown:{kind:"treat",day:"2026-11-10",rounds:0}}));
  assert.equal(p.coffee.eligible(3),false);
});
test("eligibility reads do not rewrite unchanged preferences or clobber another tab's cooldown",()=>{
  const errors=[];
  const value={version:3,days:["2026-01-01","2026-01-02","2026-01-03"],cooldown:null,invitation:null};
  const coffee=P.coffee({getItem:()=>JSON.stringify(value),setItem:()=>{throw Error("Unexpected preference write");}},e=>errors.push(e),()=>date("2026-11-10"));
  assert.equal(coffee.eligible(3),true);
  assert.equal(errors.length,0);
});
test("invalid or unwritable preferences fail visibly without payment state",()=>{
  const p=preferences();p.fail();assert.equal(p.coffee.treat(0),false);assert.ok(p.errors.length);
  const bad=preferences({version:2,days:["bad"],cooldown:null});
  assert.equal(bad.coffee.eligible(0),false);assert.ok(bad.errors.length);
  assert.equal(P.validCoffee({version:2,days:[],cooldown:{kind:"paid",day:"2026-11-10",rounds:0}}),false);
  assert.throws(()=>p.coffee.eligible(-1));
});
test("prospective counters use only completed ordinary rounds, across modes and dates",()=>{
  let value=P.emptySupport();
  for(const mode of ["recall","questions","mixed"]){
    const saved=round({mode:mode==="mixed"?"questions":mode});
    if(mode==="mixed"){saved.mode="mixed";saved.snapshot.session.type="mixed";saved.snapshot.view="recall";}
    value=P.supportCompletion(value,saved,date("2026-11-10"));
  }
  assert.equal(value.total,3);assert.equal(value.days.length,1);
  value=P.supportCompletion(value,round(),date("2026-11-11"));
  assert.equal(value.total,4);assert.equal(value.days.length,2);
  const frozen=JSON.stringify(value);
  for(const change of [s=>{delete s.supportObserved;},s=>{s.completed=false;},s=>{s.snapshot.session.retry=true;},
    s=>{s.mode="exam";},s=>{s.mode="scenario";},s=>{s.snapshot.session.index=7;},s=>{s.responses.pop();}]){
    const saved=round();change(saved);
    assert.equal(P.supportCompletion(value,saved,date("2026-11-11")),value);
  }
  assert.equal(JSON.stringify(value),frozen);
});
test("completion recording counts once and keeps a rollback snapshot with no new identifiers",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8"),flow=round();
  const sandbox={P,flow,session:flow.snapshot.session,stash:()=>{},
    state:{supportHistory:P.emptySupport(),previousRounds:{},completedModes:{}}};
  vm.createContext(sandbox);vm.runInContext(app.slice(app.indexOf("function recordCompletion("),app.indexOf("function confetti(")),sandbox);
  const before=JSON.stringify(sandbox.state.supportHistory);
  const completion=vm.runInContext("recordCompletion()",sandbox);
  assert.equal(sandbox.state.supportHistory.total,1);
  assert.equal(vm.runInContext("recordCompletion()",sandbox),null);
  assert.equal(sandbox.state.supportHistory.total,1);
  sandbox.state.supportHistory=completion.oldSupport;sandbox.flow.completionRecorded=false;
  assert.equal(JSON.stringify(sandbox.state.supportHistory),before);
  vm.runInContext("recordCompletion()",sandbox);assert.equal(sandbox.state.supportHistory.total,1);
  assert.doesNotMatch(JSON.stringify(sandbox.state.supportHistory),/attempt|answer|uuid|visitor|payment|donation/);
});
test("copy handles singular, plural and missing history without fabricated encouragement",()=>{
  assert.equal(P.supportCopy(P.emptySupport(),round()).progress,"");
  let value=P.supportCompletion(P.emptySupport(),round(),date("2026-11-10"));
  assert.match(P.supportCopy(value,round(),date("2026-11-10")).progress,/1 round on 1 day since this browser started counting/);
  value=P.supportCompletion(value,round(),date("2026-11-12"));
  assert.match(P.supportCopy(value,round(),date("2026-11-12")).progress,/2 rounds on 2 days/);
  assert.equal(P.supportCopy(value,round(),date("2026-11-12")).heading,"Enjoying the practice?");
});
test("positive score comparisons use percentage points, not unlike score units",()=>{
  let value=P.supportCompletion(P.emptySupport(),round({outcome:"reasonable"}),date("2026-11-09"));
  value=P.supportCompletion(value,round(),date("2026-11-10"));
  const copy=P.supportCopy(value,round(),date("2026-11-10"));
  assert.equal(copy.heading,"Good progress!");assert.match(copy.progress,/You're scoring 11 percentage points higher than yesterday\./);
  assert.doesNotMatch(copy.progress,/average|comparable|same exercises/);
  const almost=round();almost.responses[0].outcome="reasonable";almost.responses[0].score=8;
  let singular=P.supportCompletion(P.emptySupport(),almost,date("2026-11-09"));
  singular=P.supportCompletion(singular,round(),date("2026-11-10"));
  assert.match(P.supportCopy(singular,round(),date("2026-11-10")).progress,/You're scoring 1 percentage point higher than yesterday\./);
  const reversed=P.supportCopy(value,round(),date("2026-11-09"));
  assert.equal(reversed.heading,"Enjoying the practice?");
});
test("faster timing is an honest duration comparison and never a learning claim",()=>{
  let value=P.supportCompletion(P.emptySupport(),round({elapsedMs:100000}),date("2026-11-09"));
  value=P.supportCompletion(value,round({elapsedMs:75000}),date("2026-11-10"));
  const copy=P.supportCopy(value,round(),date("2026-11-10"));
  assert.equal(copy.heading,"Enjoying the practice?");
  assert.match(copy.progress,/25% less time on average/);assert.doesNotMatch(copy.progress,/learn|improved|faster/);
  let zero=P.supportCompletion(P.emptySupport(),round({elapsedMs:0}),date("2026-11-09"));
  zero=P.supportCompletion(zero,round({elapsedMs:0}),date("2026-11-10"));
  assert.doesNotMatch(P.supportCopy(zero,round(),date("2026-11-10")).progress,/less time|higher/);
});
test("comparisons require exact item sets, lengths, policies and adaptive formats/cues",()=>{
  const original=round({outcome:"reasonable"});
  for(const change of [s=>{s.scorePolicy="integer-10-9-v1";},s=>{s.mode="mixed";},
    s=>{s.snapshot.session.items[0].id="different";},s=>{s.snapshot.session.roundStart=1;},
    s=>{s.variant=P.adaptiveVariant;},s=>{s.snapshot.session.items[0].step=2;},
    s=>{s.snapshot.session.items[0].cue="Trust";}]){
    let value=P.supportCompletion(P.emptySupport(),original,date("2026-11-09"));
    const current=round();change(current);
    value=P.supportCompletion(value,current,date("2026-11-10"));
    assert.doesNotMatch(P.supportCopy(value,current,date("2026-11-10")).progress,/higher|less time/);
  }
  let value=P.supportCompletion(P.emptySupport(),original,date("2026-11-08"));
  value=P.supportCompletion(value,round(),date("2026-11-10"));
  assert.doesNotMatch(P.supportCopy(value,round(),date("2026-11-10")).progress,/higher/);
});
test("day aggregates respect local DST calendar days, not 24-hour subtraction",()=>{
  let value=P.supportCompletion(P.emptySupport(),round({outcome:"reasonable"}),date("2026-03-08","23:50:00"));
  value=P.supportCompletion(value,round(),date("2026-03-09","00:01:00"));
  assert.match(P.supportCopy(value,round(),date("2026-03-09","00:01:00")).progress,/higher than yesterday/);
  assert.equal(value.days.length,2);
});
test("comparison capacity disables incomplete averages while preserving total/day counts",()=>{
  let value=P.emptySupport();
  for(let n=0;n<258;n++){
    const saved=round();saved.snapshot.session.items[0].id=`unique-${n}`;
    value=P.supportCompletion(value,saved,date("2026-11-10"));
  }
  assert.equal(value.total,258);assert.equal(value.recent.length,0);
  assert.equal(value.unavailable[0],"2026-11-10");assert.equal(P.validSupport(value),true);
  assert.doesNotMatch(P.supportCopy(value,round(),date("2026-11-10")).progress,/higher|less time/);
});
test("support history validation preserves legacy drafts while rejecting corrupt new metadata",()=>{
  assert.equal(P.validSupport(P.emptySupport()),true);
  for(const patch of [{total:-1},{total:1},{days:["2026-02-30"]},{recent:[{}]},{version:2}])assert.equal(P.validSupport({...P.emptySupport(),...patch}),false);
  const saved=round();assert.equal(P.validSaved(saved,D),true);
  delete saved.supportObserved;assert.equal(P.validSaved(saved,D),true);
  saved.supportObserved="yes";assert.equal(P.validSaved(saved,D),false);
});
test("shared and adaptive summaries show B only on finished ordinary rounds",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const code=app.slice(app.indexOf("function renderSummary("),app.indexOf("function updateShell("));
  for(const mode of ["recall","questions","mixed","scenario","exam"]){
    for(const adaptive of mode==="recall"?[false,true]:[false]){
      for(const kind of ["finished","paused","retry"]){
        const saved=round({mode:mode==="recall"?"recall":"questions",step:adaptive?1:null});
        if(mode!=="recall")saved.mode=mode;
        if(kind==="paused")saved.completed=false;
        if(kind==="retry")saved.snapshot.session.retry=true;
        const main={innerHTML:""};
        const sandbox={P,D,result:saved,main,active:null,coffeeHiddenOn:null,coffeeSummary:null,
          state:{exam:null,adaptive:P.emptyAdaptive(),practices:{[mode]:saved},supportHistory:P.emptySupport()},
          coffee:{eligible:()=>true,invitation:()=>P.coffeeInvitations[0]},escape:String,titleLabel:c=>`C${c.id}. ${c.title}`,comp:id=>D.competencies[id-1],
          normalizeTitle:s=>s,modeNames:{},updateNavigation:()=>{},focus:()=>{},
          document:{querySelector:selector=>{
            if(selector.startsWith("#") && !main.innerHTML.includes(`id="${selector.slice(1)}"`))return null;
            return {addEventListener:()=>{}};
          }}};
        vm.createContext(sandbox);vm.runInContext(code,sandbox);vm.runInContext("renderSummary(result)",sandbox);
        const shown=kind==="finished" && ["recall","questions","mixed"].includes(mode);
        assert.equal(main.innerHTML.includes('id="coffee-reminder"'),shown,`${mode}/${adaptive}/${kind}`);
        if(shown){
          assert.match(main.innerHTML,/Enjoying the practice\?/);
          assert.match(main.innerHTML,/assets\/coffee-heart-steam.svg/);
          assert.match(main.innerHTML,/Treat me to a coffee/);
          assert.match(main.innerHTML,/A little practice for you, a little coffee for me\?/);
          assert.doesNotMatch(main.innerHTML,/Keep it up|completed 0|Good progress/);
          assert.ok(main.innerHTML.indexOf('id="coffee-reminder"')>main.innerHTML.indexOf('class="recall-total"'));
          assert.ok(main.innerHTML.indexOf('id="coffee-reminder"')<main.innerHTML.indexOf('class="summary-actions'));
        }
      }
    }
  }
});
test("B source geometry is unchanged and prompt actions do not prevent the external link",()=>{
  const svg=readFileSync(new URL("../assets/coffee-heart-steam.svg",import.meta.url),"utf8");
  assert.match(svg,/M45 34 32 21c-9-11 5-23 13-12 8-11 22 1 13 12Z/);
  assert.match(svg,/M21 43h48v16c0 13-10 21-24 21S21 72 21 59Z/);
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  assert.match(app,/#coffee-link"\)\.addEventListener\("click",\(\)=>suppressCoffee\("treat"\)\)/);
  assert.match(app,/#treat-coffee"\)\?\.addEventListener\("click",\(\)=>suppressCoffee\("treat"\)\)/);
  assert.match(app,/#dismiss-coffee"\)\?\.addEventListener\("click",\(\)=>suppressCoffee\("dismiss"\)\)/);
  const handler=app.slice(app.indexOf("function suppressCoffee("),app.indexOf("function elapsed("));
  assert.doesNotMatch(handler,/preventDefault|analytics|usage\./);
});
test("closing an introduction rechecks a restored reminder before returning focus",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8"),events=[];
  const sandbox={finishShellClose:null,finishPracticeEntry:()=>{},modalStarted:false,flow:null,
    returnView:{nodes:[],scrollY:0,view:"home",examAtOpen:null},view:"home",session:null,active:null,
    reviewIndex:null,scenarioNode:null,history:[],branchChoice:null,introMode:null,clockStarted:null,answerStarted:null,
    state:{exam:null},closeShell:done=>done(),main:{replaceChildren:()=>events.push("restore"),querySelector:()=>true},
    updateNavigation:()=>{},refreshCoffeeReminder:()=>events.push("recheck"),
    launchFocus:{isConnected:true,focus:()=>events.push("focus")},window:{scrollTo:()=>{}}};
  vm.createContext(sandbox);vm.runInContext(app.slice(app.indexOf("function closeStudy("),app.indexOf("function renderSummary(")),sandbox);
  vm.runInContext("closeStudy()",sandbox);
  assert.deepEqual(events,["restore","recheck","focus"]);
});
test("the seven approved invitations retain exact wording and coaching footing",()=>{
  assert.deepEqual(Array.from(P.coffeeInvitations),[
    "A little practice for you, a little coffee for me?",
    "If Coachprep's been good company, you can get the next coffee.",
    "You bring the determination. I'll bring the flashcards. Coffee?",
    "Finding your coaching footing? Feel free to fuel the person behind the practice.",
    "If this helped something click, I'd happily raise a mug to that.",
    "No need to send flowers. A coffee would be lovely.",
    "Coachprep runs in your browser. The person making it runs on coffee."
  ]);
  assert.doesNotMatch(P.coffeeInvitations.join(" "),/coaching feet/);
});
test("eligible new round exposures cycle all seven without repeating or skipping",()=>{
  const p=preferences();
  for(let n=0;n<15;n++){
    assert.equal(p.coffee.invitation(n),P.coffeeInvitations[n%7]);
    for(let i=0;i<3;i++)assert.equal(p.coffee.invitation(n),P.coffeeInvitations[n%7]);
  }
  const value=JSON.parse(p.store.get(p.coffee.key));
  assert.equal(value.version,3);
  assert.deepEqual(value.invitation,{index:0,rounds:14,pending:false});
  assert.deepEqual(Object.keys(value).sort(),["cooldown","days","invitation","version"]);
});
test("current invitation survives reload, review and a new date without a dismissal",()=>{
  const p=preferences();
  const shown=p.coffee.invitation(4),snapshot=p.store.get(p.coffee.key);
  const reloaded=preferences(JSON.parse(snapshot));
  assert.equal(reloaded.coffee.invitation(4),shown);
  assert.equal(reloaded.store.get(reloaded.coffee.key),snapshot);
  reloaded.setDate(date("2026-11-11"));
  assert.equal(reloaded.coffee.invitation(4),shown);
  assert.equal(reloaded.coffee.invitation(3),shown);
  assert.equal(reloaded.coffee.invitation(5),P.coffeeInvitations[1]);
});
test("dismissal rotates only on the next eligible exposure, not while suppressed",()=>{
  const p=preferences();assert.equal(p.coffee.invitation(1),P.coffeeInvitations[0]);
  p.coffee.dismiss(1);
  for(const n of [1,2,3])assert.equal(p.coffee.invitation(n),null);
  assert.equal(JSON.parse(p.store.get(p.coffee.key)).invitation.index,0);
  assert.equal(p.coffee.invitation(4),P.coffeeInvitations[1]);
  p.coffee.treat(4);
  assert.equal(p.coffee.invitation(7),null);
  p.setDate(date("2026-11-11"));
  assert.equal(p.coffee.invitation(7),P.coffeeInvitations[2]);
  assert.equal(p.coffee.invitation(7),P.coffeeInvitations[2]);
});
test("a footer click before any exposure starts at the first invitation afterward",()=>{
  const p=preferences();p.coffee.treat(0);
  assert.equal(p.coffee.invitation(0),null);
  p.setDate(date("2026-11-11"));
  assert.equal(p.coffee.invitation(0),P.coffeeInvitations[0]);
});
test("version2 migration keeps the cooldown and begins the pool only when eligible",()=>{
  const p=preferences({version:2,days:["2026-01-01","2026-01-02","2026-01-03"],cooldown:{kind:"dismiss",day:"2026-11-10",rounds:2}});
  assert.equal(p.coffee.invitation(4),null);
  let value=JSON.parse(p.store.get(p.coffee.key));
  assert.equal(value.version,3);assert.equal(value.cooldown.rounds,2);assert.equal(value.invitation,null);
  assert.equal(p.coffee.invitation(5),P.coffeeInvitations[0]);
  value=JSON.parse(p.store.get(p.coffee.key));
  assert.equal(value.cooldown.day,"2026-11-10");assert.equal(value.invitation.index,0);
});
test("exposure writes fail visibly without an unstable fallback or new tracking state",()=>{
  const p=preferences();p.coffee.visit();p.fail();
  assert.equal(p.coffee.invitation(0),null);assert.match(p.errors.at(-1),/text could not be saved/);
  assert.equal(JSON.parse(p.store.get(p.coffee.key)).invitation,null);
  for(const invitation of [{index:7,rounds:0,pending:false},{index:0,rounds:-1,pending:false},{index:0,rounds:0,pending:"yes"}]){
    assert.equal(P.validCoffee({version:3,days:[],cooldown:null,invitation}),false);
  }
});
test("cross-tab reads and resetting learning counts retain the correct next invitation",()=>{
  const p=preferences();p.coffee.invitation(10);
  const other=P.coffee({getItem:k=>p.store.get(k)??null,setItem:(k,v)=>p.store.set(k,v)},e=>p.errors.push(e),()=>date("2026-11-10"));
  assert.equal(other.invitation(10),P.coffeeInvitations[0]);
  assert.equal(p.coffee.invitation(11),P.coffeeInvitations[1]);
  assert.equal(other.invitation(11),P.coffeeInvitations[1]);
  p.coffee.resetRounds();
  assert.equal(p.coffee.invitation(0),P.coffeeInvitations[1]);
  assert.equal(p.coffee.invitation(1),P.coffeeInvitations[2]);
  p.coffee.dismiss(1);p.coffee.resetRounds();
  assert.equal(p.coffee.invitation(2),null);assert.equal(p.coffee.invitation(3),P.coffeeInvitations[3]);
});
test("focus and minute refresh update progress without selecting a new invitation",()=>{
  const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
  const code=app.slice(app.indexOf("function refreshCoffeeReminder("),app.indexOf("function elapsed("));
  assert.doesNotMatch(code,/\.invitation\(|coffee-invitation|Math\.random/);
});
