"use strict";
const $=s=>document.querySelector(s);
const routes={
 home:{title:"Home",group:"Workspace"},
 neural:{title:"Neural explorer",group:"Explore",url:"https://bbycroft.net/llm",remote:true},
 attention:{title:"Attention explorer",group:"Explore",url:"https://poloclub.github.io/transformer-explainer/",remote:true},
 layers:{title:"Network layers",group:"Explore",url:"https://tensorspace.org/html/playground/index.html",remote:true},
 cad:{title:"CAD & assembly",group:"Build",url:"/studio/assembly.html"},
 fusion:{title:"Fusion controls",group:"Build",url:"/studio/assembly.html#fusion"},
 physics:{title:"Physics",group:"Build",tool:"mujoco"},
 freecad:{title:"FreeCAD / FEM",group:"Build",tool:"freecad"},
 training:{title:"Training",group:"Train",tool:"minimind"},
 projects:{title:"Projects & review",group:"Workspace",url:"/workbench/index.html"},
 files:{title:"Results & files",group:"Workspace"},
 flows:{title:"Visual workflows",group:"Workspace",url:"/studio/flows.html"},
 extensions:{title:"Integration studio",group:"Workspace",url:"/studio/index.html"},
 activity:{title:"Activity",group:"Workspace"},
 settings:{title:"Setup & connections",group:"Settings",url:"/phone/control.html#more"}
};
let route="home",state=null,ready=false,frames=new Map(),refreshing=false,trainingDraft="";
const element=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
function say(text){$("#notice").textContent=text;$("#notice").hidden=!text;}
async function api(path,method="GET",body){const r=await fetch("/api/"+path,{method,headers:method==="POST"?{"Content-Type":"application/json"}:{},body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});const v=await r.json();if(!r.ok)throw Error(v.error||"Host unavailable");return v;}
function button(text,fn,primary=false){const b=element("button",text,primary?"primary":"");b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){say(e.message);}finally{b.disabled=false;}};return b;}
function link(id,text){const a=element("a",text||routes[id].title,"button");a.href="#"+id;return a;}
function card(id,description){const a=element("a",null,"card");a.href="#"+id;a.append(element("small",routes[id].group.toUpperCase()),element("h3",routes[id].title),element("p",description),element("strong","Open workspace →"));return a;}
const groups=[["",["home","projects"]],["EXPLORE",["neural","attention","layers"]],["BUILD & TEST",["cad","fusion","physics","freecad"]],["EXPERIMENTS",["training","flows","extensions"]],["OUTPUT",["files","activity"]]];
for(const [group,ids] of groups){if(group)$("#navigation").append(element("small",group));for(const id of ids){const a=element("a",routes[id].title);a.href="#"+id;a.dataset.route=id;$("#navigation").append(a);}}
$("#menu").onclick=()=>{const open=document.body.classList.toggle("menu-open");$("#menu").setAttribute("aria-expanded",String(open));};
function mappedRoute(url){
 if(url.origin!==location.origin)return null;
 const map={"/phone/":"home","/phone/workspace.html":"home","/workbench/index.html":"projects","/studio/index.html":"extensions","/studio/flows.html":"flows","/studio/assembly.html":url.hash==="#fusion"?"fusion":"cad"};
 return map[url.pathname]||null;
}
function wireFrame(frame){
 try{const doc=frame.contentDocument;if(!doc)return;
 const current=new URL(frame.contentWindow.location.href);
 const mapped=mappedRoute(current);
 if(current.pathname==="/phone/"||current.pathname==="/phone/workspace.html"){frame.src=routes[frame.dataset.route].url;location.hash="home";return;}
 if(mapped && mapped!==frame.dataset.route && frame.dataset.route!=="settings"){frame.src=routes[frame.dataset.route].url;location.hash=mapped;return;}
 if(!doc.querySelector('[data-dino-embedded]')){const css=doc.createElement("link");css.rel="stylesheet";css.href="/phone/embedded.css";css.dataset.dinoEmbedded="true";doc.head.append(css);}
 doc.addEventListener("click",e=>{const a=e.target.closest?.("a");if(!a||a.hasAttribute("download"))return;const target=mappedRoute(new URL(a.href));if(target){e.preventDefault();location.hash=target;}},true);
 }catch{}
}
function showFrame(id){
 const r=routes[id];$("#content").hidden=true;$("#frames").hidden=false;
 let frame=frames.get(id);
 if(!frame){frame=element("iframe",null,"workspace-frame");frame.title=r.title;frame.dataset.route=id;
 if(r.remote){frame.setAttribute("sandbox","allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-downloads");frame.allow="fullscreen";}
 frame.src=r.url;frame.onload=()=>wireFrame(frame);frames.set(id,frame);$("#frames").append(frame);}
 frame.hidden=false;
 if(id==="settings")say("Advanced installation and connection controls. Use the sidebar to return to your tools.");
 else if(r.remote)say("Hosted interactive tool · internet required. If the viewer is unavailable, use Open in tab.");
}
function renderHome(){const main=$("#content");main.append(element("div","ONE CONNECTED WORKSPACE","eyebrow"),element("h2","What would you like to work on?"),element("p","Explore models, build an assembly or run an experiment. Your navigation, projects and results stay together.","intro"));
 const cards=element("div",null,"cards");cards.append(card("neural","See tokens and layers inside a transformer."),card("cad","Edit dimensions, inspect parts and check assembly fit."),card("training","Prepare a small dataset and manage a CPU training run."),card("fusion","Inspect your open Fusion design and review parameter changes."),card("physics","Run the existing gravity example and inspect its output."),card("projects","Keep notes, model revisions and review markups together."));main.append(cards);
 const p=element("section",null,"panel");p.append(element("h3","Continue across tools"),element("p","Build in CAD → review in Projects → inspect Results. Open the Integration studio to pass compatible files to enabled tools."));
 const actions=element("div",null,"actions");actions.append(link("files"),link("flows"),link("extensions"));p.append(actions);main.append(p);}
async function run(id,action){await api("action","POST",{id,action});say(action==="launch"?"Native application launch requested.":"Action queued. Progress and output appear below.");await refresh();}
function enginePage(id){const r=routes[id],main=$("#content");main.append(element("h2",r.title));
 const notes={training:"Run a small MiniMind CPU experiment using up to 32 text records. This is a diagnostic training profile, not full model training.",physics:"Run the existing MuJoCo sphere-drop example under gravity. Your CAD assembly is not yet connected to this simulation.",freecad:"Open the native FreeCAD editor or connect its MCP bridge. Material-strength analysis still requires setup in FreeCAD."};
 main.append(element("p",notes[id],"intro"));
 if(id==="training"){const panel=element("section",null,"panel");panel.append(element("h3","1. Prepare your training text"),element("p","Paste JSONL: one object with a text field per line, or choose a .jsonl file. Preparing data does not start training."));
 const label=element("label","Training records");label.htmlFor="dataset";const input=element("textarea");input.id="dataset";input.value=trainingDraft;input.placeholder='{"text":"Your first training example."}';const file=element("input");file.type="file";file.accept=".jsonl";file.setAttribute("aria-label","Choose JSONL dataset");file.onchange=async()=>{try{if(file.files[0].size>1024*1024)throw Error("Choose a JSONL file under 1 MB for this small profile.");input.value=await file.files[0].text();}catch(e){say(e.message);}};
 const result=element("p");panel.append(label,input,file,button("Prepare dataset",async()=>{const v=await api("training-data","POST",{text:input.value});result.textContent=v.records+" records prepared · "+v.profile;}),result);main.append(panel);}
 const p=element("section",null,"panel");p.append(element("h3",id==="training"?"2. Run experiment":"Run & inspect"));
 const actions=element("div",null,"actions");
 if(id==="freecad")actions.append(button("Open FreeCAD",()=>run(r.tool,"launch"),true),button("Connect bridge",()=>run(r.tool,"connect")));
 else actions.append(button(id==="training"?"Start CPU training":"Run gravity example",()=>run(r.tool,id==="training"?"train":"sample"),true));
 actions.append(button("Stop job",()=>run(r.tool,"stop")),link("files","View results →"));
 p.append(actions);const setup=element("details");setup.append(element("summary","First-time engine setup"),element("p","Install this engine once before its first run. Downloads run on your computer."),button("Install engine",()=>run(r.tool,"install")));p.append(setup);
 const status=element("p");status.id="job-status";const logs=element("details");logs.append(element("summary","Execution details"));const log=element("pre",null,"log");log.id="job-log";logs.append(log);p.append(status,logs);main.append(p);updateJob();}
function updateJob(){if(!routes[route].tool)return;const job=state?.jobs?.find(j=>j.id===routes[route].tool);if($("#job-status"))$("#job-status").textContent=job?job.action+" · "+job.state:"No run yet. Install the engine before its first run.";if($("#job-log"))$("#job-log").textContent=job?.log||"No output yet.";}
async function filesPage(){const main=$("#content");main.append(element("h2","Results & files"),element("p","Downloads and model outputs from your shared workspace. Open Projects to attach and review them, or use the Integration studio to send compatible files to tools."));
 const actions=element("div",null,"actions");actions.append(link("projects"),link("extensions","Send files to a tool →"));main.append(actions);const list=element("div",null,"panel");main.append(list);
 try{const files=await api("files");if(route!=="files")return;if(!files.length)list.append(element("p","No artifacts yet. Build an assembly or run an experiment first."));for(const f of files){const row=element("div",null,"file");const a=element("a","Download");a.href="/api/download?name="+encodeURIComponent(f.name);a.download=f.name;row.append(element("span",f.name),a);list.append(row);}}catch(e){say(e.message);}}
function activityPage(){const main=$("#content");main.append(element("h2","Activity"),element("p","All tools share this job history. Changing pages does not stop an active job."));const list=element("div");list.id="activity-list";main.append(list);updateActivity();}
function updateActivity(){const list=$("#activity-list");if(!list)return;list.replaceChildren();const jobs=state?.jobs||[];if(!jobs.length)list.append(element("p","No jobs yet."));for(const job of jobs){const p=element("section",null,"panel");p.append(element("h3",job.id+" · "+job.action),element("span",job.state,"badge"));if(["running","queued","stopping"].includes(job.state))p.append(button("Stop",()=>run(job.id,"stop")));const details=element("details");details.append(element("summary","Output"),element("pre",job.log||"No output yet.","log"));p.append(details);list.append(p);}}
function navigate(){if($("#dataset"))trainingDraft=$("#dataset").value;const key=location.hash.slice(1);route=routes[key]?key:"home";document.body.classList.remove("menu-open");$("#menu").setAttribute("aria-expanded","false");$("#title").textContent=routes[route].title;$("#category").textContent=routes[route].group.toUpperCase();document.title=routes[route].title+" · Dino Lab";document.querySelectorAll("#navigation [data-route]").forEach(a=>{if(a.dataset.route===route)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});say("");
 for(const [id,frame] of frames){if(routes[id].remote&&id!==route){frame.remove();frames.delete(id);}else frame.hidden=true;}
 $("#content").hidden=false;$("#content").replaceChildren();$("#frames").hidden=true;$("#external").hidden=!routes[route].remote;if(routes[route].remote)$("#external").href=routes[route].url;
 if(routes[route].url)showFrame(route);else if(route==="home")renderHome();else if(route==="files")filesPage();else if(route==="activity")activityPage();else enginePage(route);}
async function refresh(){if(refreshing)return;refreshing=true;try{state=await api("state");ready=true;$("#connection").textContent="Host connected";updateJob();updateActivity();}catch(e){ready=false;$("#connection").textContent="Host not connected";}finally{refreshing=false;}}
async function initialize(){const params=new URLSearchParams(location.hash.slice(1));const key=params.get("pair");if(key){try{await api("pair","POST",{key});}catch(e){say(e.message);}const target=params.get("workspace")||(params.has("cad")?"cad":params.has("studio")?"extensions":params.has("workbench")?"projects":"home");history.replaceState(null,"","#"+(routes[target]?target:"home"));}
 await refresh();navigate();if(!ready)say("Connect to your Dino host through Setup & connections. Hosted neural viewers are still available.");}
window.addEventListener("hashchange",navigate);initialize();setInterval(refresh,5000);
