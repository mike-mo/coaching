"use strict";
window.PRACTICE = (() => {
  const coffeeKey = "coachprep-coffee-days-v1";
  const modes = ["recall","questions","mixed","scenario","exam"];
  function points(outcome, seconds) {
    if (!["recognition","reasonable","missed"].includes(outcome) || !Number.isFinite(seconds) || seconds < 0) throw new Error("Invalid practice result");
    if (outcome === "missed") return 0;
    return (outcome === "recognition" ? 90 : 80) + 10 * Math.max(0,Math.min(1,(64-seconds)/60));
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
    return value && value.version===1 && Array.isArray(value.days) && value.days.length<=3 &&
      value.days.every(validDay) && new Set(value.days).size===value.days.length &&
      (value.dismissed===null || validDay(value.dismissed));
  }
  function visit(value,today) {
    if(!validDay(today) || !validCoffee(value))throw new Error("Invalid coffee visit state");
    const next={version:1,days:[...value.days],dismissed:value.dismissed};
    if(next.days.length<3 && !next.days.includes(today))next.days.push(today);
    return next;
  }
  function coffee(storage,onError) {
    let value=null;
    function read(){
      try{
        const raw=storage.getItem(coffeeKey);
        value=raw===null?{version:1,days:[],dismissed:null}:JSON.parse(raw);
        if(!validCoffee(value))throw new Error("Invalid coffee preferences");
        return true;
      }catch{value=null;onError("The coffee reminder preference could not be read. The reminder is off; your study progress is unchanged.");return false;}
    }
    function today(){
      if(!read())return false;
      const next=visit(value,day());
      try{storage.setItem(coffeeKey,JSON.stringify(next));value=next;return true;}
      catch{value=null;onError("The coffee reminder preference could not be saved. The reminder is off; your study progress is unchanged.");return false;}
    }
    return {
      key:coffeeKey,
      eligible(){return today() && value.days.length===3 && value.dismissed!==day();},
      visit:today,
      dismiss(){
        if(!today())return false;
        const next={...value,days:[...value.days],dismissed:day()};
        try{storage.setItem(coffeeKey,JSON.stringify(next));value=next;return true;}
        catch{onError("Not now could not be saved. The reminder has not been dismissed for today. Your study progress is unchanged.");return false;}
      }
    };
  }
  function validSaved(p,data) {
    if(!p || p.version!==1 || !modes.includes(p.mode) || typeof p.completed!=="boolean" ||
      !Number.isFinite(p.elapsedMs) || p.elapsedMs<0 || p.elapsedMs>1e10 ||
      !Number.isFinite(p.answerMs) || p.answerMs<0 || p.answerMs>1e10 ||
      !Array.isArray(p.responses) || p.responses.length>128 || !p.snapshot)return false;
    if(!p.responses.every(r=>r && Number.isInteger(r.c) && r.c>=1 && r.c<=8 &&
      ["recall","questions","scenario"].includes(r.type) && ["unaided","assisted","recognition","reasonable","missed","explored"].includes(r.outcome) &&
      Number.isFinite(r.seconds) && r.seconds>=0 && r.seconds<=1e7 &&
      (r.type==="questions"?["recognition","reasonable","missed"]:r.type==="recall"?["unaided","assisted","missed"]:["explored"]).includes(r.outcome) &&
      (p.mode==="mixed" || r.type===p.mode || p.mode==="scenario"&&r.type==="scenario")))return false;
    const s=p.snapshot;
    const validItem=i=>i && (i.type==="recall"?data.competencies.some(c=>i.id==="r"+c.id && i.c===c.id):
      i.type==="questions"&&data.questions.some(q=>q.id===i.id && q.c===i.c));
    if(s.view!==(p.mode==="mixed"?"recall":p.mode) || !Array.isArray(s.history) || s.history.length>8 ||
      !s.history.every(h=>h && Number.isInteger(h.index) && Object.hasOwn(data.scenario.nodes,h.node) && data.scenario.nodes[h.node]?.choices?.[h.index]) ||
      s.scenarioNode!==null && !Object.hasOwn(data.scenario.nodes,s.scenarioNode) ||
      s.branchChoice!==null && (!Number.isInteger(s.branchChoice) || !data.scenario.nodes[s.scenarioNode]?.choices?.[s.branchChoice]))return false;
    if(["scenario","exam"].includes(p.mode)?s.session!==null || s.active!==null:!s.session)return false;
    if(s.session && (s.session.type!==p.mode || !Array.isArray(s.session.items) || !s.session.items.length || s.session.items.length>40 ||
      !s.session.items.every(i=>validItem(i) && (p.mode==="mixed" || i.type===p.mode)) ||
      new Set(s.session.items.map(i=>i.id)).size!==s.session.items.length ||
      !Number.isInteger(s.session.index) || s.session.index<0 || s.session.index>s.session.items.length ||
      !Array.isArray(s.session.results) || s.session.results.length!==s.session.index ||
      !s.session.results.every(r=>r && ["recall","questions"].includes(r.type) && ["unaided","assisted","recognition","reasonable","missed"].includes(r.outcome) && typeof r.missed==="boolean")))return false;
    if(s.active){
      const a=s.active;
      if(!validItem(a.item) || a.item.id!==s.session?.items[s.session.index]?.id ||
        typeof a.attempt!=="string" || a.attempt.length>10000 ||
        !Number.isInteger(a.hints) || a.hints<0 || a.hints>10 || typeof a.done!=="boolean" ||
        typeof a.revealed!=="boolean" || typeof a.assistLogged!=="boolean" ||
        a.done && a.reported!==true ||
        a.item.type==="questions" && (!Array.isArray(a.optionOrder) || a.optionOrder.length!==4 ||
          new Set(a.optionOrder).size!==4 || a.optionOrder.some(i=>!Number.isInteger(i)||i<0||i>3) ||
          a.done && a.selected===null || a.selected!==null && (!Number.isInteger(a.selected)||a.selected<0||a.selected>3)))return false;
    }
    if(s.session && p.responses.length!==s.session.index+(s.active?.done?1:0))return false;
    if(s.session && s.session.index===s.session.items.length && !p.completed)return false;
    if(p.mode==="scenario" && (p.responses.length!==s.history.length+(s.branchChoice!==null?1:0) || p.completed!==(s.scenarioNode===null)))return false;
    return true;
  }
  return {points,duration,day,validDay,validCoffee,visit,coffee,validSaved};
})();
