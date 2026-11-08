"use strict";
window.STUDY = {
  source: "2025 ICF Core Competencies",
  version: "Released September 2025 · rev. 09.08.25",
  competencies: [
    {id:1, title:"Demonstrates Ethical Practice", definition:"Understands and consistently applies coaching ethics and standards of coaching", group:"Foundation", summary:"Follow coaching ethics, protect the client's information and notice when they need a different kind of professional help."},
    {id:2, title:"Embodies a Coaching Mindset", definition:"Engages in ongoing personal and professional learning and development as a coach. Works with coaching supervisors or mentor coaches as needed. Develops and maintains a mindset that is open, curious, flexible and client-centered.", group:"Foundation", summary:"Keep learning and reflecting on your coaching. Notice how your assumptions and biases affect your work with clients."},
    {id:3, title:"Establishes and Maintains Agreements", definition:"Partners with the client and relevant stakeholders to create clear agreements about the coaching relationship, process, plans and goals. Establishes agreements for the overall coaching engagement as well as those for each coaching session.", group:"Co-creating the relationship", summary:"Agree with the client on what coaching will cover and what each session is for. Check the agreement again when their needs change."},
    {id:4, title:"Cultivates Trust and Safety", definition:"Partners with the client to create a safe, supportive environment that allows the client to share freely. Maintains a relationship of mutual respect and trust.", group:"Co-creating the relationship", summary:"Respect the client's experience and context so they can express themselves freely."},
    {id:5, title:"Maintains Presence", definition:"Is fully conscious and present with the client, employing a style that is open, flexible, grounded and confident", group:"Co-creating the relationship", summary:"Pay attention to what's happening with the client. Give them time to think, even when you don't know what comes next."},
    {id:6, title:"Listens Actively", definition:"Focuses on what the client is and is not saying to fully understand what is being communicated in the context of the client systems and to support client self-expression", group:"Communicating effectively", summary:"Follow the client's words and context. Check what they mean before relying on your interpretation."},
    {id:7, title:"Evokes Awareness", definition:"Facilitates client insight and learning by using tools and techniques such as powerful questioning, silence, metaphor or analogy", group:"Communicating effectively", summary:"Help the client explore their thinking and see things differently. Share what you notice without insisting that you're right."},
    {id:8, title:"Facilitates Client Growth", definition:"Partners with the client to transform learning and insight into action. Promotes client autonomy in the coaching process.", group:"Cultivating learning and growth", summary:"Help the client use what they've learned and choose their own next steps. Ask what support they want and how they'll follow through."}
  ],
  examExamples: {
    1:[
      {text:"When a sponsor asks what the client discussed, the coach checks the confidentiality agreement and relevant legal limits before sharing anything.",refs:["1.05"]},
      {text:"A client asks for an expert recommendation. The coach explains how that differs from coaching before agreeing on how to proceed.",refs:["1.06"]},
      {text:"The coach uses respectful language that fits the client's background and checks unfamiliar terms instead of assuming what they mean.",refs:["1.02","1.03"]}
    ],
    2:[
      {text:"The coach notices they want to push their own solution and returns to what matters to the client.",refs:["2.04","2.10"]},
      {text:"When the coach feels frustrated, they manage their response so it doesn't take over the conversation.",refs:["2.06"]},
      {text:"The client chooses a path the coach wouldn't choose. The coach stays curious and respects that it's the client's decision.",refs:["2.01","2.09"]}
    ],
    3:[
      {text:"At the start, the coach asks what the client wants from this session and checks that they've understood it in the client's own words.",refs:["3.06"]},
      {text:"The client wants clarity. The coach asks how they'd know they had it by the end of the session.",refs:["3.08"]},
      {text:"Another concern comes up. The coach asks whether the client wants to change the focus and checks their agreement again.",refs:["3.09","3.12"]}
    ],
    4:[
      {text:"The coach takes the client's concern seriously and gives them room to explain it.",refs:["4.05"]},
      {text:"When the client asks for a slower pace, the coach adjusts rather than defending their usual style.",refs:["4.02"]},
      {text:"Before assuming what an opportunity means, the coach asks about the client's circumstances and values.",refs:["4.01"]}
    ],
    5:[
      {text:"The client asks for thinking time, and the coach allows the pause without adding another question.",refs:["5.07"]},
      {text:"The coach doesn't yet know where the conversation is going. They stay curious instead of rushing to explain it.",refs:["5.02","5.06"]},
      {text:"During an emotional moment, the coach notices their own reaction and handles it so they can keep paying attention to the client.",refs:["5.01","5.04"]}
    ],
    6:[
      {text:"The coach briefly repeats back what they've heard and asks whether they've understood the client correctly.",refs:["6.02"]},
      {text:"A client calls a decision risky. The coach asks what the risk means in the client's circumstances.",refs:["6.01"]},
      {text:"When it sounds as though the client has more to say about a concern, the coach asks about it before moving to a solution.",refs:["6.03"]}
    ],
    7:[
      {text:"The coach asks what a belief means to the client and how it shapes their thinking.",refs:["7.03","7.08"]},
      {text:"The coach offers an observation as a possibility and asks what the client thinks of it. They let it go if it doesn't fit.",refs:["7.11"]},
      {text:"The coach asks the client to think of possible ways forward and what they'd be willing or able to try.",refs:["7.09"]}
    ],
    8:[
      {text:"When the client realizes something new, the coach asks how they want to use it in their life or work.",refs:["8.01"]},
      {text:"With the coach's help, the client chooses their next step and how to keep themselves on track.",refs:["8.02","8.03"]},
      {text:"Before closing, the coach asks what support the client may need and what could get in the way of their chosen step.",refs:["8.05","8.09"]}
    ]
  },
  questions: [
    {id:"q1", c:1, refs:["1.05"], prompt:"A sponsor asks for a client's session notes. What should the coach do before sharing them?", options:[
      ["Send the notes because the sponsor pays for coaching.","Paying for coaching does not give the sponsor permission to see client information."],
      ["Check the confidentiality agreement and relevant legal requirements.","Check what the agreement allows and what the law allows or requires before sharing anything."],
      ["Promise that information can never be shared under any circumstances.","The agreement or law may allow sharing, and the law may require it. The coach can't promise there will never be an exception."]
    ], answer:1, takeaway:"Check the confidentiality agreement and relevant laws before sharing client information."},
    {id:"q2", c:2, refs:["2.03","2.04","2.10"], prompt:"After a session, a coach notices they assumed the client would want the same career they'd choose. What would help them learn from this?", options:[
      ["Look back at how that assumption affected the session, with a supervisor if needed.","This helps the coach see how their preference may have affected the conversation and keep checking for it in later sessions."],
      ["Avoid discussing career decisions from now on.","Avoiding the topic leaves the assumption unexamined."],
      ["Find stronger reasons to recommend that career path.","The coach is still trying to defend their own preference instead of understanding the client."]
    ], answer:0, takeaway:"Reflect on how your own assumptions affect your coaching."},
    {id:"q3", c:3, refs:["3.06","3.08"], prompt:"A client says, 'I want clarity about my next step.' Which reply helps the coach and client agree on the goal for today?", options:[
      ["We'll finish with a three-step plan.","The coach has chosen the result. The client may mean something else by clarity."],
      ["Why haven't you decided already?","This asks about the delay without clarifying what the client wants from today's session."],
      ["At the end of our session, what would tell you that things are clearer?","The client can say what a useful result would look like. The coach still needs to check that they both understand and agree on it."]
    ], answer:2, takeaway:"Ask the client how they would recognize a useful session result."},
    {id:"q4", c:4, refs:["4.02","4.05"], prompt:"A client says the coach's questions come too quickly and asks for more time to think. What would show the coach has taken the request seriously?", options:[
      ["Explain why rapid questioning works best.","This dismisses the client's concern and keeps the coach's preferred pace."],
      ["Agree to slow down and give the client more thinking time.","The client said what they need. The coach listens and changes the pace."],
      ["Praise the client for being unusually sensitive.","The label doesn't address the request for more time."]
    ], answer:1, takeaway:"Respect the client's concern and adapt the pace together."},
    {id:"q5", c:5, refs:["5.06","5.07"], prompt:"A client says, 'I'd like a moment to think,' after an open question. How should the coach respond?", options:[
      ["Give several examples to help them answer.","The client asked for time. More examples may interrupt their thinking."],
      ["Move to another topic to keep the session going.","Changing topics cuts short the reflection the client requested."],
      ["Give them time to think without adding another question.","The coach lets them pause and keeps paying attention without knowing what they'll say next."]
    ], answer:2, takeaway:"Allow the thinking time the client has asked for."},
    {id:"q6", c:6, refs:["6.01","6.02","6.03"], prompt:"A client calls a change 'too risky.' The coach isn't sure what risk means to this client. Which response would best help them understand?", options:[
      ["When you say 'too risky,' what risk are you thinking of?","The coach asks what the client means, using the client's own words."],
      ["You're afraid of failure, aren't you?","The coach has assumed what the client means before checking."],
      ["Risk is necessary for growth.","That gives the coach's opinion about risk. It doesn't help them understand this client's concern."]
    ], answer:0, takeaway:"Ask what the client's words mean in their situation."},
    {id:"q7", c:7, refs:["7.11"], prompt:"A coach thinks two things a client has said may be connected. How should they offer that observation?", options:[
      ["Diagnose the pattern and explain its cause.","An observation isn't enough to diagnose a problem or explain its cause."],
      ["Share what they noticed, ask what the client thinks of it, and accept that it may not fit.","The client can think it through or reject it. The coach lets them decide whether it's useful."],
      ["Repeat the observation until the client agrees.","Repeating it to get agreement puts the coach's interpretation ahead of the client's understanding."]
    ], answer:1, takeaway:"Let the client decide whether your observation is useful."},
    {id:"q8", c:8, refs:["8.02","8.03","8.05"], prompt:"A client has learned something useful and wants to try it between sessions. Which response best supports that?", options:[
      ["Set a daily exercise and require an email report.","The coach has picked the task and check-in without asking what works for the client."],
      ["End the session because the insight is enough.","The client asked to put the learning into practice. Ending now leaves that request unanswered."],
      ["Help the client choose something manageable to try, what help they need and how they'll follow through.","The client chooses how to use what they've learned. They can think through what fits their life and what help they need."]
    ], answer:2, takeaway:"Help the client design their own next step and how to support it."}
  ],
  scenario: {
    title:"Taking on another project",
    intro:"A fictional client is weighing a new project. You've agreed to discuss it, but don't yet know what they want from today's session. Choose your reply at each turn. The client's replies are invented.",
    start:"opening",
    nodes:{
      opening:{c:3, refs:["3.06","3.08"], client:"They've asked me to lead another project. I keep going back and forth. I'd like to get clearer about it.", choices:[
        {text:"What would make this conversation useful to you today?", reaction:"I'd like to figure out what I need to ask before I decide. I don't want to decide today.", reason:"They want to work out what to ask, not decide today. Ask how they'll know they've worked that out, then check you agree on the session's goal.", next:"explore"},
        {text:"What would tell you this conversation had helped?", reaction:"I'd know which questions I still need to ask. I keep trying to force a yes or no before I have the information.", reason:"You're asking how they'll know the session has helped. Check you both understand what they want before moving on.", next:"explore"},
        {text:"Let's use today to decide whether you should accept.", reaction:"I'm not ready to decide. There are things I haven't asked about.", reason:"You decided the goal for them. They've said they need more information, so return to that.", next:"repair"}
      ]},
      repair:{c:3, refs:["3.06","3.12"], client:"I need to work out what's missing before I make a decision.", choices:[
        {text:"I got ahead of you. What would you like to understand by the end of our session?", reaction:"What I need to ask about the workload. And why I'm hesitating to ask.", reason:"You admit you got ahead of them and ask what they want. Their answer helps you agree on a better focus.", next:"explore"},
        {text:"Would focusing on the missing information be useful today?", reaction:"Yes. I want to look at the workload and why I haven't asked about it.", reason:"You're suggesting a new focus and asking if it fits. A yes-or-no question works for checking an agreement.", next:"explore"}
      ]},
      explore:{c:6, refs:["6.01","6.02","6.03"], client:"I don't know how much extra work it would be. I keep thinking I should be grateful they've asked me, so I don't ask about the workload.", choices:[
        {text:"What does 'I should be grateful' mean to you here?", reaction:"I worry that asking will sound unappreciative. I do want to know what I'm agreeing to, though.", reason:"You ask about 'grateful' instead of assuming why they won't ask. This can help you understand their concern and may help them see something new.", next:"close"},
        {text:"You want to know about the workload, and you're worried about how asking might come across. Is that right?", reaction:"Yes. Asking isn't refusing, is it? I've been treating them as if they're the same.", reason:"You check that you've understood and give them room to correct you. Repeating back what you heard can help as much as asking another question.", next:"close"},
        {text:"This sounds like people-pleasing. You need firmer boundaries.", reaction:"I don't think that label fits. I still need to know about the workload.", reason:"You label the problem and tell them what to do before checking what they mean. Accept the correction and return to what they want to understand.", next:"closeRepair"}
      ]},
      closeRepair:{c:8, refs:["8.03","8.05","8.09"], client:"I need to know more about the workload. I'm not ready to act yet, and we're nearly out of time.", choices:[
        {text:"I got that wrong. How would you like to finish today?", reaction:"I'd like to write down the information I need. I'll decide what to do with it later.", reason:"You admit you got it wrong and let them choose how to finish. They can act, think it over or leave the decision for another day.", next:null},
        {text:"Let's stay with the workload. What would help you think about it after today?", reaction:"Some time, and maybe a colleague who knows the project. I don't want a deadline yet.", reason:"You return to the workload and ask what would help them think it through. Respect their wish to leave the timing open and agree how to finish.", next:null},
        {text:"You're avoiding it again. Commit to asking tonight.", reaction:"That's not what I said I wanted. I'd like to stop here.", reason:"You push the same idea after they've rejected it, then tell them what to do. They've asked to stop; respect that and let them choose whether to act.", next:null}
      ]},
      close:{c:8, refs:["8.01","8.03","8.05","8.09"], client:"I can appreciate being asked and still ask about the workload. That helps. We're nearly out of time, and I'd like to do something with this.", choices:[
        {text:"How would you like to use what you've learned today?", reaction:"I'll draft two questions about the workload and decide when to send them. I'd like a colleague to check the wording.", reason:"They pick their own step and name someone who could help. If time allows, ask what support they need or what could get in the way, then agree how to finish.", next:null},
        {text:"Would you like to choose a next step now, or take some time to think first?", reaction:"I'd rather write down what I've learned before I choose an action.", reason:"They prefer to write down what they learned before choosing an action. Thinking it over is a valid next step. Follow their choice and agree how to finish.", next:null},
        {text:"Email the project lead tonight and report back to me tomorrow.", reaction:"Tonight won't work. I want to prepare my questions first.", reason:"You choose the task and set a deadline and check-in. Ask what would work for them and let them choose how to follow through.", next:null}
      ]}
    }
  }
};
