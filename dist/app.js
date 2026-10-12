const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const readLocal = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const writeLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const TOPICS = [
  {id:"innovation",name:"创新与技术",term:"innovation",words:["innovation","technology","patent","research and development","r&d"]},
  {id:"labor",name:"劳动经济学",term:"labor",words:["labor","labour","employment","wage","worker"]},
  {id:"industry",name:"产业组织",term:"industrial organization",words:["industry","industrial","competition","market power","firm"]},
  {id:"development",name:"发展经济学",term:"development",words:["development","poverty","low income"]},
  {id:"macro",name:"宏观经济学",term:"macroeconomics",words:["macroeconomic","growth","inflation","business cycle"]},
  {id:"monetary",name:"货币与银行",term:"monetary policy",words:["monetary","bank","central bank","interest rate"]},
  {id:"finance",name:"金融经济学",term:"finance",words:["finance","financial","asset pricing","capital market"]},
  {id:"trade",name:"国际贸易",term:"international trade",words:["trade","export","import","tariff"]},
  {id:"public",name:"公共经济学",term:"public economics",words:["tax","public","fiscal","government"]},
  {id:"education",name:"教育经济学",term:"education",words:["education","school","student","teacher"]},
  {id:"health",name:"健康经济学",term:"health economics",words:["health","hospital","medical","mortality"]},
  {id:"environment",name:"环境与能源",term:"climate",words:["climate","environment","energy","carbon","emission"]},
  {id:"urban",name:"城市与区域",term:"urban",words:["urban","city","housing","regional"]},
  {id:"behavior",name:"行为经济学",term:"behavioral",words:["behavior","behaviour","experiment","preference"]},
  {id:"metrics",name:"计量经济学",term:"econometrics",words:["econometric","causal inference","estimation","identification"]},
  {id:"political",name:"政治经济学",term:"political economy",words:["political","election","democracy","institution"]},
  {id:"digital",name:"数字经济与 AI",term:"artificial intelligence",words:["artificial intelligence","machine learning","digital","platform"]},
  {id:"inequality",name:"不平等",term:"inequality",words:["inequality","income distribution","wealth"]},
  {id:"accounting",name:"会计与审计",term:"accounting",words:["accounting","audit","financial reporting"]},
  {id:"marketing",name:"市场营销",term:"marketing",words:["marketing","consumer","advertising","brand"]},
  {id:"operations",name:"运营与供应链",term:"operations management",words:["operations","supply chain","inventory","logistics"]},
  {id:"information",name:"信息系统",term:"information systems",words:["information systems","digital transformation","computing"]},
  {id:"strategy",name:"战略与组织",term:"strategic management",words:["strategy","organization","leadership","governance"]},
  {id:"international-business",name:"国际商务",term:"international business",words:["multinational","international business","foreign direct investment"]},
];
const MANAGEMENT_TOPIC_IDS=new Set(["accounting","marketing","operations","information","strategy","international-business"]);
const WORKING = [
  {name:"NBER Working Papers",short:"NBER",prefix:"10.3386"},
  {name:"IMF Working Papers",short:"IMF",prefix:"10.5089"}
];
const PUBLISHERS = [
  {name:"AER Forthcoming",publisher:"AEA",url:"https://www.aeaweb.org/journals/aer/forthcoming"},
  {name:"AEJ: Applied Forthcoming",publisher:"AEA",url:"https://www.aeaweb.org/journals/app/forthcoming"},
  {name:"AEJ: Macro Forthcoming",publisher:"AEA",url:"https://www.aeaweb.org/journals/mac/forthcoming"},
  {name:"AEJ: Micro Forthcoming",publisher:"AEA",url:"https://www.aeaweb.org/journals/mic/forthcoming"},
  {name:"QJE Advance Articles",publisher:"Oxford",url:"https://academic.oup.com/qje/advance-articles"},
  {name:"REStud Advance Articles",publisher:"Oxford",url:"https://academic.oup.com/restud/advance-articles"},
  {name:"RFS Advance Articles",publisher:"Oxford",url:"https://academic.oup.com/rfs/advance-articles"},
  {name:"JFE Articles in Press",publisher:"Elsevier",url:"https://www.sciencedirect.com/journal/journal-of-financial-economics/articles-in-press"},
  {name:"JPubE Articles in Press",publisher:"Elsevier",url:"https://www.sciencedirect.com/journal/journal-of-public-economics/articles-in-press"}
];
let catalog = [];
let openalexSources = {journals:[],working:[],missing:[]};
let sourceById = new Map();
let saved = readLocal("econfrontier.saved", []);
const legacyDefaults = new Set(["未归档","稍后阅读","正在阅读","已读"]);
let folders = readLocal("econfrontier.folderTree", null);
if (!Array.isArray(folders)) {
  folders = readLocal("econfrontier.folders", []).filter(name=>!legacyDefaults.has(name)).map((name,index)=>({id:`legacy-${index}`,name,parentId:null}));
  writeLocal("econfrontier.folderTree",folders);
}
let paperOrganization = readLocal("econfrontier.organization", {});
for (const entry of Object.values(paperOrganization)) if (!entry.folderId && entry.folder) entry.folderId = folders.find(folder=>folder.name===entry.folder)?.id || "";
let libraryFilter = "all";
let selectedTopics = readLocal("econfrontier.topics", []).filter(id => TOPICS.some(t => t.id === id));
let searchKind = "all";
let selectedJournalIds = new Set();
let selectedWorking = new Set(["NBER","IMF"]);
let searchTopics = [];
let draftSearchTopics = [];
let searchInitialized = false;
let searchCursor = "*", searchCount = 0, searchShown = 0, searchBatch = 0;
let searchBuffered = [];
let searchBackend = "openalex", crossrefSearchCursors = {};
let openalexUnavailableUntil = 0;
let searchLoading = false;
let visible = new Map();
let searchSeq = 0, feedSeq = 0;
let feedInitialized = false, feedItems = [], feedShown = 0;
let detailSeq = 0, currentDetail = null, lastListView = "search";
const apiCache = new Map();
const translationCache = readLocal("econfrontier.translations.v2", {});
let localTranslatorPromise = null;
let localTranslator = null;
let myMemoryUnavailableUntil = 0;
function prepareTranslator() {
  if (!("Translator" in self) || localTranslatorPromise) return;
  try {
    localTranslatorPromise = Translator.create({sourceLanguage:"en",targetLanguage:"zh"}).then(translator => {localTranslator=translator;return translator;}).catch(() => {localTranslatorPromise=null;return null;});
  } catch { localTranslatorPromise = null; }
}
function rememberTranslation(item,text) {
  translationCache[item.id] = text;
  const keys = Object.keys(translationCache);
  if (keys.length > 300) delete translationCache[keys[0]];
  writeLocal("econfrontier.translations.v2",translationCache);
}

function navigate(view) {
  if (view.startsWith("journal/")) {
    document.querySelectorAll(".view").forEach(el => el.classList.toggle("active",el.id === "view-journal"));
    document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active",el.dataset.view === "journals"));
    history.replaceState(null,"","#" + view);
    window.scrollTo({top:0,behavior:"smooth"});
    showJournalDetail(decodeURIComponent(view.slice(8)));
    return;
  }
  if (view.startsWith("paper/")) {
    document.querySelectorAll(".view").forEach(el => el.classList.toggle("active",el.id === "view-paper"));
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
    history.replaceState(null,"","#" + view);
    window.scrollTo({top:0,behavior:"smooth"});
    showPaper(decodeURIComponent(view.slice(6)));
    return;
  }
  if (!$("#view-" + view)) view = "home";
  if (["search","discover","journals","library"].includes(view)) lastListView = view;
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active",el.id === "view-" + view));
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active",el.dataset.view === view));
  history.replaceState(null,"","#" + view);
  window.scrollTo({top:0,behavior:"smooth"});
  if (view === "library") renderLibrary();
  if (view === "journals") showJournalLibrary();
  if (view === "search" && !searchInitialized) runSearch();
  if (view === "discover" && !feedInitialized) runFeed();
}
document.querySelectorAll("[data-go]").forEach(el => el.addEventListener("click",() => navigate(el.dataset.go)));
document.querySelectorAll(".nav-item").forEach(el => el.addEventListener("click",() => navigate(el.dataset.view)));
window.addEventListener("hashchange",() => navigate(location.hash.slice(1)));
$("#close-about").addEventListener("click",() => $("#about-dialog").close());
$("#about-dialog").addEventListener("click",event => { if (event.target.id === "about-dialog") event.target.close(); });
$("#publisher-links").innerHTML = PUBLISHERS.map(item => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.name)} <small>${escapeHtml(item.publisher)} ↗</small></a>`).join("");

async function loadCatalog() {
  const [catalogResponse,sourceResponse] = await Promise.all([fetch("./catalog.json"),fetch("./openalex-sources.json")]);
  if (!catalogResponse.ok || !sourceResponse.ok) throw new Error("期刊目录无法加载");
  catalog = (await catalogResponse.json()).journals;
  openalexSources = await sourceResponse.json();
  // Resolve newly curated ISSNs in one request; journal-only searches can also
  // use OpenAlex's ISSN filter when a source ID is not yet indexed.
  const unresolved=openalexSources.journals.filter(source=>!source.id);
  if(unresolved.length){
    try{
      const url=new URL("https://api.openalex.org/sources");
      url.searchParams.set("filter","issn:"+unresolved.map(source=>source.issn).join("|"));
      url.searchParams.set("per_page","100");
      const response=await fetch(url);
      if(response.ok){
        const data=await response.json();
        for(const item of data.results||[])for(const source of unresolved){
          if((item.issn||[]).some(issn=>issn.toUpperCase()===source.issn.toUpperCase()))source.id=String(item.id).split("/").pop();
        }
      }
    }catch{}
  }
  sourceById = new Map([...openalexSources.journals,...openalexSources.working].map(source=>[source.id,source]));
  updateTierOptions();
}
function groupSources(group) {
  const journals = group === "all" ? catalog : catalog.filter(item => group === "fieldtop" ? !["top5","utd24"].includes(item.tier) : group === "utd24" ? item.utd24 : item.tier === group);
  return group === "all" || group === "working" ? [...journals,...WORKING] : journals;
}
function crossrefUrl(source, params) {
  const url = new URL(source.prefix ? `https://api.crossref.org/prefixes/${source.prefix}/works` : "https://api.crossref.org/works");
  for (const [key,value] of Object.entries(params)) if (value != null && value !== "") url.searchParams.set(key,value);
  url.searchParams.set("select","DOI,title,author,container-title,ISSN,published,published-online,published-print,created,URL,type,score,abstract,publisher,volume,issue");
  return url.toString();
}
async function requestSource(source, params) {
  const url = crossrefUrl(source,params);
  const hit = apiCache.get(url);
  if (hit && Date.now() - hit.time < 10*60*1000) return hit.items;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),20000);
  try {
    const response = await fetch(url,{signal:controller.signal,headers:{Accept:"application/json"}});
    if (!response.ok) throw new Error(`Crossref HTTP ${response.status}`);
    const data = await response.json();
    const items = (data.message?.items || []).map(item => normalize(item,source)).filter(Boolean);
    apiCache.set(url,{time:Date.now(),items});
    return items;
  } finally { clearTimeout(timer); }
}
function normalize(item, source) {
  const rawTitle = item.title?.[0]?.replace(/<[^>]+>/g,"").trim();
  const decoder = document.createElement("textarea");
  decoder.innerHTML = rawTitle || "";
  const title = decoder.value;
  const doi = item.DOI?.trim();
  if (!title || !doi) return null;
  if (source.short === "NBER" && !/^10\.3386\/w\d+$/i.test(doi)) return null;
  if (source.short === "IMF" && !String(item["container-title"]?.[0] || "").toLowerCase().includes("imf working paper")) return null;
  const matched = source.prefix ? source : catalog.find(j => (item.ISSN || []).some(issn => issn.toUpperCase() === j.issn.toUpperCase()));
  if (!matched) return null;
  const parts = item["published-online"]?.["date-parts"]?.[0] || item.published?.["date-parts"]?.[0] || item.created?.["date-parts"]?.[0] || [];
  const date = parts.length ? `${parts[0]}-${String(parts[1] || 1).padStart(2,"0")}-${String(parts[2] || 1).padStart(2,"0")}` : "";
  const authorNames = (item.author || []).map(person => [person.given,person.family].filter(Boolean).join(" ")).filter(Boolean);
  const authors = authorNames.slice(0,5).join(", ");
  const abstract = String(item.abstract || "").replace(/<[^>]+>/g," ").replace(/\s+/g," ").slice(0,1200);
  return {id:doi.toLowerCase(),title,doi,url:`https://doi.org/${encodeURIComponent(doi).replace(/%2F/gi,"/")}`,authors,authorsFull:authorNames,sourceName:matched.name,tier:matched.tier || "working",issn:matched.issn || "",publisher:item.publisher || "",date,online:!!item["published-online"],onlineFirst:!!item["published-online"] && !item.volume && !item.issue && !item["published-print"],score:Number(item.score)||0,abstract};
}
function normalizeOpenAlex(work) {
  const doi = String(work.doi || "").replace(/^https?:\/\/doi\.org\//i,"");
  const title = String(work.title || work.display_name || "").trim();
  const sourceId = String(work.primary_location?.source?.id || "").split("/").pop();
  const source = sourceById.get(sourceId)||openalexSources.journals.find(item=>(work.primary_location?.source?.issn||[]).includes(item.issn));
  if (!doi || !title || !source) return null;
  if (source.tier === "working" && !doi.toLowerCase().startsWith(source.prefix + "/")) return null;
  const authorNames = (work.authorships || []).map(author=>author.author?.display_name || author.raw_author_name).filter(Boolean);
  const abstract = reconstructAbstract(work.abstract_inverted_index);
  return {id:doi.toLowerCase(),title,doi,url:`https://doi.org/${encodeURIComponent(doi).replace(/%2F/gi,"/")}`,authors:authorNames.slice(0,5).join(", "),authorsFull:authorNames,sourceName:source.name,tier:source.tier,issn:source.issn || "",publisher:"",date:work.publication_date || "",online:true,score:Number(work.relevance_score)||0,abstract};
}
function unique(items,sort="score") {
  return [...new Map(items.map(x => [x.id,x])).values()].sort((a,b) => sort === "date" ? b.date.localeCompare(a.date) : b.score-a.score);
}
async function settle(jobs,limit=2) {
  const out = new Array(jobs.length); let next = 0;
  await Promise.all(Array.from({length:Math.min(limit,jobs.length)},async () => {
    while (next < jobs.length) { const i = next++; try { out[i] = {ok:true,value:await jobs[i]()}; } catch(error) { out[i] = {ok:false,error}; } }
  }));
  return out;
}
function jobsFor(group,query,feed=false) {
  const sources = groupSources(group);
  const journalGroups = feed ? ["top5","sufe1","sufe2","finance","utd24"].map(tier => sources.filter(x => x.tier === tier)).filter(x => x.length) : [sources.filter(x => x.issn)].filter(x => x.length);
  const jobs = journalGroups.map(part => {
    const filter = part.map(j => "issn:" + j.issn).join(",") + ",type:journal-article";
    const start = new Date(); start.setFullYear(start.getFullYear()-1);
    const dateFilter = feed ? `,from-online-pub-date:${start.toISOString().slice(0,10)}` : "";
    return () => requestSource({name:part[0].name},{filter:filter+dateFilter,"query.bibliographic":query,sort:feed?"published-online":undefined,order:feed?"desc":undefined,rows:feed?"18":"60"});
  });
  for (const source of sources.filter(x => x.prefix)) {
    const start = new Date(); start.setFullYear(start.getFullYear()-1);
    const params = {"query.bibliographic":query,rows:feed?"10":"20"};
    if (feed) { params.filter = `from-pub-date:${start.toISOString().slice(0,10)}`;params.sort="published";params.order="desc"; }
    jobs.push(() => requestSource(source,params));
  }
  return jobs;
}
function translatedMarkup(item) {
  const text = translationCache[item.id];
  return `<p class="translated-title ${text ? "" : "pending"}" data-translation="${escapeHtml(item.id)}" lang="zh-CN">${text ? escapeHtml(text) : "中文译名生成中…"}</p><button class="translation-retry" data-retry-id="${escapeHtml(item.id)}" hidden>重试翻译 ↗</button>`;
}
function folderDepth(id) {
  const folder=folders.find(value=>value.id===id);
  return folder ? 1+(folder.parentId?folderDepth(folder.parentId):0) : 0;
}
function folderPath(id) {
  const folder=folders.find(value=>value.id===id);
  return folder ? (folder.parentId?folderPath(folder.parentId)+" / ":"")+folder.name : "";
}
function folderOptions(selected="") {
  const rows=[];
  const visit=(parentId,depth)=>{for(const folder of folders.filter(value=>value.parentId===parentId)){rows.push(`<option value="${escapeHtml(folder.id)}" ${folder.id===selected?"selected":""}>${"　".repeat(depth)}${escapeHtml(folder.name)}</option>`);visit(folder.id,depth+1);}};
  visit(null,0);return rows.join("");
}
function card(item,showAbstract=false,library=false) {
  const marked = saved.some(x => x.id === item.id);
  const tierLabel = {top5:"Top 5",sufe1:"Field Top",sufe2:"Field Top",finance:"金融类",utd24:"UTD24",working:"工作论文"}[item.tier] || "";
  const isNew=!!item.date&&Date.now()-Date.parse(item.date)<7*86400000&&Date.now()>=Date.parse(item.date);
  const preview = showAbstract && item.abstract ? `<p class="paper-abstract-preview">${escapeHtml(item.abstract.slice(0,360))}${item.abstract.length>360?"…":""}</p>` : "";
  const organization=paperOrganization[item.id] || {};
  const organize=library ? `<div class="library-organize"><label>放入栏目<select data-folder-for="${escapeHtml(item.id)}"><option value="">不分类</option>${folderOptions(organization.folderId||"")}</select></label></div>` : "";
  return `<article class="paper-card" data-paper="${escapeHtml(item.id)}"><div class="paper-main"><div class="paper-overline"><strong>${escapeHtml(tierLabel)}</strong><span class="dot">·</span><span>${escapeHtml(item.date || "日期未提供")}</span>${isNew?'<span class="new-badge">NEW</span>':""}<span class="dot">·</span><span class="paper-source">${escapeHtml(item.sourceName)}</span>${item.onlineFirst?'<span class="online-first-badge">Online first</span>':""}</div><h3 lang="en"><a data-paper-link href="#paper/${encodeURIComponent(item.doi)}">${escapeHtml(item.title)}</a></h3>${translatedMarkup(item)}<p class="paper-authors">${escapeHtml(item.authors || "作者信息未提供")}</p>${preview}<div class="paper-details"><span class="paper-detail"><strong>来源</strong>${escapeHtml(item.sourceName)}</span><span class="paper-detail doi"><strong>DOI</strong>${escapeHtml(item.doi)}</span><a class="paper-detail-link" data-paper-link href="#paper/${encodeURIComponent(item.doi)}">查看详情</a></div>${organize}</div><div class="paper-actions"><button class="save-paper ${marked?"saved":""}" data-id="${escapeHtml(item.id)}" aria-label="${marked?"取消收藏":"收藏论文"}" title="${marked?"取消收藏":"收藏论文"}">${marked?"★":"☆"}</button><a class="paper-open" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" aria-label="打开原文">↗</a></div></article>`;
}
document.addEventListener("click",event => { if(event.target.closest("[data-paper-link]")) prepareTranslator(); });
function renderPapers(target,items,emptyTitle,emptyBody) {
  items.forEach(item => visible.set(item.id,item));
  target.innerHTML = items.length ? items.map(item=>card(item,["search-results","feed-results","forthcoming-results"].includes(target.id),target.id==="library-list")).join("") : `<div class="empty"><h3>${escapeHtml(emptyTitle)}</h3><p>${escapeHtml(emptyBody)}</p></div>`;
  translateVisible(target,items);
}
async function translateTitle(item) {
  if (translationCache[item.id]) return translationCache[item.id];
  if (/[\u3400-\u9fff]/.test(item.title)) {
    rememberTranslation(item,item.title);
    return item.title;
  }
  if (item.title.length > 350) throw new Error("标题过长");
  if (localTranslator) {
    try {
      const result = (await localTranslator.translate(item.title))?.trim();
      if (result && /[\u3400-\u9fff]/.test(result)) {
        rememberTranslation(item,result);
        return result;
      }
    } catch { localTranslator = null; }
  }
  try {
    const result = await translateViaGoogle(item.title);
    rememberTranslation(item,result);
    return result;
  } catch {}
  if (Date.now() < myMemoryUnavailableUntil) throw new Error("备用翻译接口已达额度");
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q",item.title);
  url.searchParams.set("langpair","en|zh-CN");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),12000);
  try {
    const response = await fetch(url,{signal:controller.signal});
    if (!response.ok) {if(response.status===429)myMemoryUnavailableUntil=Date.now()+6*60*60*1000;throw new Error("翻译接口暂不可用");}
    const data = await response.json();
    const translated = data.responseData?.translatedText?.replace(/<[^>]+>/g,"").trim();
    if (data.responseStatus !== 200 || !translated || !/[\u3400-\u9fff]/.test(translated)) {
      if (/MYMEMORY WARNING|FREE TRANSLATIONS/i.test(translated || "")) myMemoryUnavailableUntil = Date.now() + 6*60*60*1000;
      throw new Error("未取得有效中文译名");
    }
    rememberTranslation(item,translated);
    return translated;
  } finally { clearTimeout(timer); }
}
async function translateViaGoogle(text) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client","gtx");url.searchParams.set("sl","en");url.searchParams.set("tl","zh-CN");url.searchParams.set("dt","t");url.searchParams.set("q",text);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),12000);
  try {
    const response = await fetch(url,{signal:controller.signal});
    if (!response.ok) throw new Error("翻译请求失败");
    const data = await response.json();
    const result = data?.[0]?.map(part=>part?.[0]||"").join("").trim();
    if (!result || !/[\u3400-\u9fff]/.test(result)) throw new Error("翻译结果无效");
    return result;
  } finally {clearTimeout(timer);}
}
async function translateVisible(target,items) {
  const pending = items.filter(item => !translationCache[item.id]);
  await settle(pending.map(item => async () => {
    let value;
    try { value = await translateTitle(item); }
    catch { value = "中文译名暂不可用 · 请以英文原题核对"; }
    target.querySelectorAll("[data-translation]").forEach(el => {
      if (el.dataset.translation === item.id) { el.textContent = value; el.classList.toggle("pending",!translationCache[item.id]); }
    });
    target.querySelectorAll("[data-retry-id]").forEach(button => {if (button.dataset.retryId === item.id) button.hidden = !!translationCache[item.id];});
  }),2);
}
document.addEventListener("click",event => {
  const button = event.target.closest("[data-retry-id]");
  if (!button) return;
  const item = visible.get(button.dataset.retryId) || saved.find(x => x.id === button.dataset.retryId);
  if (!item) return;
  prepareTranslator();
  button.hidden = true;
  document.querySelectorAll("[data-translation]").forEach(el => {if(el.dataset.translation===item.id)el.textContent="正在准备中文翻译…";});
  translateVisible(button.closest(".paper-list"),[item]);
});
document.addEventListener("click",event => {
  const button = event.target.closest(".save-paper");
  if (!button) return;
  const item = visible.get(button.dataset.id) || saved.find(x => x.id === button.dataset.id);
  if (!item) return;
  saved = saved.some(x => x.id === item.id) ? saved.filter(x => x.id !== item.id) : [item,...saved];
  writeLocal("econfrontier.saved",saved);
  $("#saved-count").textContent = saved.length;
  const marked = saved.some(x => x.id === item.id);
  button.textContent = marked ? "★" : "☆";button.classList.toggle("saved",marked);button.title = marked ? "取消收藏" : "收藏论文";button.setAttribute("aria-label",button.title);
  if ($("#view-library").classList.contains("active")) renderLibrary();
});
$("#saved-count").textContent = saved.length;
function renderTopicControls() {
  const filter = $("#topic-picker-filter").value.trim().toLowerCase();
  const matches=TOPICS.filter(t => !filter || t.name.toLowerCase().includes(filter) || t.term.toLowerCase().includes(filter));
  $("#search-topic-options").innerHTML = matches.length?[false,true].map(management=>{
    const options=matches.filter(t=>MANAGEMENT_TOPIC_IDS.has(t.id)===management);
    return options.length?`<div class="topic-group-title">${management?"管理学":"经济学"}</div>${options.map(t => `<label class="topic-option"><input type="checkbox" value="${t.id}" ${draftSearchTopics.includes(t.id)?"checked":""}><span>${t.name}</span></label>`).join("")}`:"";
  }).join(""):'<p class="topic-no-match">没有匹配的领域</p>';
  $("#topic-picker-label").textContent = searchTopics.length ? `已选 ${searchTopics.length} 个领域：${searchTopics.map(id=>TOPICS.find(t=>t.id===id)?.name).filter(Boolean).join("、")}` : "全部领域";
  $("#topic-chips").innerHTML = [false,true].map(management=>`<div class="feed-topic-group"><strong>${management?"管理学":"经济学"}</strong>${TOPICS.filter(t=>MANAGEMENT_TOPIC_IDS.has(t.id)===management).map(t => `<button class="chip ${selectedTopics.includes(t.id)?"selected":""}" data-feed-topic="${t.id}" aria-pressed="${selectedTopics.includes(t.id)}">${t.name}${selectedTopics.includes(t.id)?" ✓":" +"}</button>`).join("")}</div>`).join("");
  $("#topic-selection").textContent = selectedTopics.length ? `已选 ${selectedTopics.length} 个` : "全部领域";
}
renderTopicControls();
function closeTopicPicker() { $("#topic-picker-panel").hidden=true;$("#topic-picker-toggle").setAttribute("aria-expanded","false"); }
$("#topic-picker-toggle").addEventListener("click",() => {
  const panel=$("#topic-picker-panel");
  panel.hidden=!panel.hidden;
  $("#topic-picker-toggle").setAttribute("aria-expanded",String(!panel.hidden));
  if (!panel.hidden) { draftSearchTopics=[...searchTopics];$("#topic-picker-filter").value="";renderTopicControls();$("#topic-picker-filter").focus(); }
});
$("#topic-picker-filter").addEventListener("input",renderTopicControls);
$("#search-topic-options").addEventListener("change",event => {
  const input=event.target.closest('input[type="checkbox"]');if(!input)return;
  if (input.checked && draftSearchTopics.length >= 4) {input.checked=false;return;}
  draftSearchTopics=input.checked?[...draftSearchTopics,input.value]:draftSearchTopics.filter(id=>id!==input.value);
});
$("#topic-picker-clear").addEventListener("click",() => {draftSearchTopics=[];renderTopicControls();});
$("#topic-picker-apply").addEventListener("click",() => {prepareTranslator();searchTopics=[...draftSearchTopics];renderTopicControls();closeTopicPicker();runSearch();});
document.addEventListener("click",event => {if(!event.target.closest("#topic-picker"))closeTopicPicker();});
document.addEventListener("keydown",event => {if(event.key==="Escape")closeTopicPicker();});
$("#topic-chips").addEventListener("click",event => {const button=event.target.closest("[data-feed-topic]");if(!button)return;const id=button.dataset.feedTopic;selectedTopics=selectedTopics.includes(id)?selectedTopics.filter(x=>x!==id):[...selectedTopics,id];writeLocal("econfrontier.topics",selectedTopics);renderTopicControls();});
function setSearchKind(kind) {
  searchKind=kind;
  $("#search-source-tabs").querySelectorAll("[data-kind]").forEach(button=>button.classList.toggle("selected",button.dataset.kind===kind));
  $("#search-discipline").closest(".filter-field").hidden=kind==="working";
  $("#search-tier").closest(".filter-field").hidden=kind!=="journal";
  $("#journal-picker").closest(".filter-field").hidden=kind!=="journal";
  $("#working-picker").closest(".filter-field").hidden=kind!=="working";
  $("#search-tier").disabled=kind!=="journal";
}
function journalDiscipline(source) {
  return source.tier==="finance"?"finance":source.utd24?"management":"economics";
}
function availableJournals() {
  const discipline=$("#search-discipline").value;
  return openalexSources.journals.filter(source=>discipline==="all"||journalDiscipline(source)===discipline);
}
function tierMatches(source,tier) {
  return tier==="all"||tier==="top5"&&source.tier==="top5"||tier==="fieldtop"&&["sufe1","sufe2"].includes(source.tier)||tier==="utd24"&&source.utd24||tier==="finance"&&source.tier==="finance";
}
function updateTierOptions() {
  const discipline=$("#search-discipline").value;
  const options=discipline==="economics"?[["all","全部经济学期刊"],["top5","Top 5"],["fieldtop","Field Top"]]
    :discipline==="management"?[["all","全部管理学期刊"],["utd24","UTD24"]]
    :discipline==="finance"?[["all","全部金融学期刊"],["utd24","UTD24"],["finance","金融类"]]
    :[["all","全部期刊"],["top5","Top 5"],["fieldtop","Field Top"],["utd24","UTD24"],["finance","金融类"]];
  const current=$("#search-tier").value;
  $("#search-tier").innerHTML=options.map(([value,label])=>`<option value="${value}">${label}</option>`).join("");
  $("#search-tier").value=options.some(([value])=>value===current)?current:"all";
  updateJournalOptions();
}
function updateJournalOptions() {
  const tier=$("#search-tier").value;
  const options=availableJournals().filter(source=>tierMatches(source,tier));
  const allowed=new Set(options.map(source=>source.issn));
  selectedJournalIds=new Set([...selectedJournalIds].filter(issn=>allowed.has(issn)));
  $("#journal-picker-options").innerHTML=options.slice().sort((a,b)=>a.name.localeCompare(b.name,"en")).map(source=>`<label><input type="checkbox" value="${escapeHtml(source.issn)}" ${selectedJournalIds.has(source.issn)?"checked":""}><span>${escapeHtml(source.name)}</span></label>`).join("");
  $("#journal-picker-label").textContent=selectedJournalIds.size?`已选 ${selectedJournalIds.size} 本期刊`:"全部期刊";
}
function selectedSearchSources() {
  if (searchKind==="working") return openalexSources.working.filter(source=>selectedWorking.has(source.name.startsWith("NBER")?"NBER":"IMF"));
  if (searchKind==="all") return [...availableJournals(),...($("#search-discipline").value==="all"||$("#search-discipline").value==="economics"?openalexSources.working:[])];
  const tier=$("#search-tier").value;
  return availableJournals().filter(source=>tierMatches(source,tier)&&(!selectedJournalIds.size||selectedJournalIds.has(source.issn)));
}
function selectedDateRange(){
  const value=$("#search-year").value;
  if(value==="custom")return {from:$("#search-date-from").value,to:$("#search-date-to").value};
  return value==="all"?{from:"",to:""}:{from:`${value}-01-01`,to:`${value}-12-31`};
}
function buildOpenAlexUrl(cursor) {
  const raw=$("#search-input").value.trim();
  const field=$("#search-field").value;
  const terms=searchTopics.map(id=>TOPICS.find(t=>t.id===id)?.term).filter(Boolean);
  const sources=selectedSearchSources();
  const locationFilter=searchKind==="journal"?"primary_location.source.issn:"+sources.map(source=>source.issn).join("|"):"primary_location.source.id:"+sources.map(source=>source.id).filter(Boolean).join("|");
  const filter=[locationFilter,"has_doi:true","type:article|report|preprint","to_publication_date:"+new Date().toISOString().slice(0,10)];
  const range=selectedDateRange();
  if(range.from)filter.push("from_publication_date:"+range.from);
  if(range.to)filter.push("to_publication_date:"+range.to);
  const url=new URL("https://api.openalex.org/works");
  if (field==="doi" && raw) filter.push("doi:https://doi.org/"+raw.replace(/^https?:\/\/doi\.org\//i,""));
  else if (field==="author" && raw) filter.push('raw_author_name.search:"'+raw.replace(/"/g,"")+'"');
  if ((field==="topic" || field==="title") && raw) {
    url.searchParams.set(field==="title"?"search.title":"search.title_abstract_keywords",terms.length?`(${raw}) AND (${terms.join(" OR ")})`:raw);
  } else if (terms.length && field!=="doi") url.searchParams.set("search.title_abstract_keywords",terms.join(" OR "));
  url.searchParams.set("filter",filter.join(","));
  const hasTextSearch=(field==="topic" || field==="title") ? !!(raw || terms.length) : field==="author" && !!terms.length;
  const sort=$("#search-sort").value==="relevance" && hasTextSearch ? "relevance_score:desc" : "publication_date:desc";
  url.searchParams.set("sort",sort);
  url.searchParams.set("per_page","100");
  url.searchParams.set("cursor",cursor);
  url.searchParams.set("select","id,doi,title,authorships,publication_date,primary_location,abstract_inverted_index,relevance_score,type");
  return url.toString();
}
async function requestOpenAlex(url) {
  const hit=apiCache.get(url);
  if(hit && Date.now()-hit.time<10*60*1000)return hit.payload;
  if(Date.now()<openalexUnavailableUntil)throw new Error("OpenAlex HTTP 429");
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
  try {
    const response=await fetch(url,{signal:controller.signal,headers:{Accept:"application/json"}});
    if(!response.ok){if(response.status===429)openalexUnavailableUntil=Date.now()+10*60*1000;throw new Error(`OpenAlex HTTP ${response.status}`);}
    const payload=await response.json();
    apiCache.set(url,{time:Date.now(),payload});
    return payload;
  } finally {clearTimeout(timer);}
}
function crossrefSearchGroups() {
  const sources=selectedSearchSources();
  const journals=sources.filter(source=>source.issn);
  const working=sources.filter(source=>source.prefix);
  return [journals.length?{id:"journals",sources:journals,filter:journals.map(source=>`issn:${source.issn}`).join(",")}:null,
    working.length?{id:"working",sources:working,filter:[...new Set(working.map(source=>source.prefix))].map(prefix=>`prefix:${prefix}`).join(",")}:null].filter(Boolean);
}
function crossrefSearchUrl(group,offset) {
  const raw=$("#search-input").value.trim();
  const field=$("#search-field").value;
  const filter=[group.filter];
  if(group.id==="journals")filter.push("type:journal-article");
  const range=selectedDateRange();
  if(range.from)filter.push(`from-pub-date:${range.from}`);
  filter.push(`until-pub-date:${range.to||new Date().toISOString().slice(0,10)}`);
  if(field==="doi" && raw)filter.push(`doi:${raw.replace(/^https?:\/\/doi\.org\//i,"")}`);
  const url=new URL("https://api.crossref.org/works");
  url.searchParams.set("filter",filter.join(","));
  const terms=searchTopics.map(id=>TOPICS.find(topic=>topic.id===id)?.term).filter(Boolean);
  const query=[raw,...terms].filter(Boolean).join(" ");
  if(query && field!=="doi")url.searchParams.set(field==="author"?"query.author":field==="title"?"query.title":"query.bibliographic",query);
  if($("#search-sort").value!=="relevance" || !query){url.searchParams.set("sort","published");url.searchParams.set("order","desc");}
  url.searchParams.set("rows","30");url.searchParams.set("offset",String(offset));
  url.searchParams.set("select","DOI,title,author,container-title,ISSN,published,published-online,published-print,created,URL,type,score,abstract,publisher,volume,issue");
  return url.toString();
}
async function requestCrossrefSearchPage(group,offset) {
  const url=crossrefSearchUrl(group,offset);
  const hit=apiCache.get(url);
  if(hit && Date.now()-hit.time<10*60*1000)return hit.payload;
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),25000);
  try {
    const response=await fetch(url,{signal:controller.signal,headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error(`Crossref HTTP ${response.status}`);
    const payload=(await response.json()).message;
    apiCache.set(url,{time:Date.now(),payload});
    return payload;
  } finally {clearTimeout(timer);}
}
async function loadCrossrefSearchPage(seq,reset=false) {
  const target=$("#search-results"),button=$("#search-load-more");
  if(reset){target.innerHTML='<div class="loading">OpenAlex 限流，正在改用 Crossref 检索…</div>';crossrefSearchCursors=Object.fromEntries(crossrefSearchGroups().map(group=>[group.id,"0"]));}
  const groups=crossrefSearchGroups().filter(group=>crossrefSearchCursors[group.id]);
  if(!groups.length){button.hidden=true;return;}
  searchLoading=true;button.hidden=true;
  try {
    const responses=await Promise.allSettled(groups.map(group=>requestCrossrefSearchPage(group,crossrefSearchCursors[group.id])));
    if(seq!==searchSeq)return;
    const successful=responses.map((result,index)=>({result,group:groups[index]})).filter(entry=>entry.result.status==="fulfilled");
    if(!successful.length)throw responses[0].reason;
    const already=new Set([...target.querySelectorAll("[data-paper]")].map(node=>node.dataset.paper));
    const items=[];
    for(const {result,group} of successful){
      const payload=result.value, records=payload.items||[];
      const nextOffset=Number(crossrefSearchCursors[group.id])+records.length;
      crossrefSearchCursors[group.id]=records.length===30&&nextOffset<Math.min(Number(payload["total-results"])||0,10000)?String(nextOffset):null;
      for(const record of records){
        const source=group.id==="working"?group.sources.find(item=>record.DOI?.toLowerCase().startsWith(item.prefix+"/")):{};
        const item=normalize(record,source||{});
        if(item&&!already.has(item.id)){items.push(item);already.add(item.id);}
      }
    }
    for(const {result,group} of responses.map((result,index)=>({result,group:groups[index]})))if(result.status==="rejected")crossrefSearchCursors[group.id]=null;
    items.sort((a,b)=>b.date.localeCompare(a.date));
    if(reset)target.innerHTML="";
    if(items.length){items.forEach(item=>visible.set(item.id,item));target.insertAdjacentHTML("beforeend",items.map(item=>card(item,true)).join(""));translateVisible(target,items);}
    else if(reset)target.innerHTML='<div class="empty"><h3>暂未找到匹配文献</h3><p>试试更宽泛的关键词、其他年份或来源。</p></div>';
    searchShown+=items.length;searchBatch++;
    $("#search-summary").textContent=`Crossref 备用检索 · 已显示 ${searchShown.toLocaleString("zh-CN")} 篇`;
    $("#search-page-status").textContent="OpenAlex 当前请求受限，结果来自 Crossref；可继续加载。";
    button.hidden=!Object.values(crossrefSearchCursors).some(Boolean);
  } catch(error) {
    if(seq!==searchSeq)return;
    if(reset)target.innerHTML=`<div class="empty"><h3>检索暂不可用</h3><p>OpenAlex 限流，Crossref 备用检索也未成功：${escapeHtml(error.message)}</p></div>`;
    $("#search-summary").textContent="检索请求失败，请稍后重试";
    $("#search-page-status").textContent=error.message;
    button.hidden=true;
  } finally {if(seq===searchSeq)searchLoading=false;}
}
async function loadRecentSupplement(seq) {
  const section=$("#recent-supplement");
  const raw=$("#search-input").value.trim();
  const field=$("#search-field").value;
  const year=$("#search-year").value;
  const currentYear=new Date().getFullYear();
  const journals=selectedSearchSources().filter(source=>source.issn);
  if (!raw || field==="doi" || !journals.length || searchTopics.length || year==="custom" || (year!=="all" && Number(year)<currentYear-1)) {
    section.hidden=true;
    return;
  }
  section.hidden=false;
  $("#recent-supplement-status").textContent="正在核对近一年在线发表的期刊记录…";
  $("#recent-supplement-results").innerHTML="";
  const start=new Date();start.setFullYear(start.getFullYear()-1);
  const filters=journals.map(source=>"issn:"+source.issn);
  filters.push("type:journal-article","from-online-pub-date:"+(year==="all"?start.toISOString().slice(0,10):year+"-01-01"));
  if(year!=="all")filters.push("until-online-pub-date:"+year+"-12-31");
  const params={filter:filters.join(","),rows:"40",sort:"published-online",order:"desc"};
  params[field==="author"?"query.author":"query.title"]=raw;
  try {
    const items=await requestSource({},params);
    if(seq!==searchSeq)return;
    const allowed=new Set(journals.map(source=>source.issn.toUpperCase()));
    const already=new Set([...$("#search-results").querySelectorAll("[data-paper]")].map(el=>el.dataset.paper));
    const queryWords=raw.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").match(/[\p{L}\p{N}]+/gu)||[];
    const supplemental=items.filter(item=>{
      const haystack=(field==="author"?item.authorsFull.join(" "):item.title).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"");
      return allowed.has(item.issn.toUpperCase()) && !already.has(item.id) && queryWords.every(word=>haystack.includes(word));
    }).slice(0,8);
    if(!supplemental.length){section.hidden=true;return;}
    supplemental.forEach(item=>visible.set(item.id,item));
    $("#recent-supplement-results").innerHTML=supplemental.map(item=>card(item,true)).join("");
    $("#recent-supplement-status").textContent=`Crossref 标题/作者检索 · 展示 ${supplemental.length} 条与首批主结果不同的近期记录；请以 DOI 核对。`;
    translateVisible($("#recent-supplement-results"),supplemental);
  } catch(error) {
    if(seq!==searchSeq)return;
    $("#recent-supplement-status").textContent=`Crossref 近期补查暂不可用：${error.message}`;
  }
}
async function loadSearchPage(seq,reset=false) {
  if(searchBackend==="crossref")return loadCrossrefSearchPage(seq,reset);
  if((searchLoading && !reset) || (!searchCursor&&!searchBuffered.length))return;
  searchLoading=true;
  const target=$("#search-results");const button=$("#search-load-more");
  button.hidden=true;
  if(reset)target.innerHTML='<div class="loading">正在检索精选来源…</div>';
  else $("#search-page-status").textContent="正在加载更多…";
  try {
    let payload=null;
    if(!searchBuffered.length){
      payload=await requestOpenAlex(buildOpenAlexUrl(searchCursor));
      if(seq!==searchSeq)return;
      searchBuffered=(payload.results||[]).map(normalizeOpenAlex).filter(Boolean);
      searchCount=Number(payload.meta?.count)||0;
      searchCursor=payload.meta?.next_cursor&&(payload.results||[]).length===100?payload.meta.next_cursor:null;
    }
    let items=searchBuffered.splice(0,25);
    let crossrefFallback=false;
    if(reset && !items.length && $("#search-field").value==="doi" && $("#search-input").value.trim()) {
      const doi=$("#search-input").value.trim().replace(/^https?:\/\/doi\.org\//i,"");
      try {
        const metadata=await getDetailMetadata(doi);
        const source=WORKING.find(value=>doi.toLowerCase().startsWith(value.prefix+"/")) || {};
        const item=metadata.crossref ? normalize(metadata.crossref,source) : null;
        if(item){items=[item];crossrefFallback=true;}
      } catch {}
    }
    if(seq!==searchSeq)return;
    if(reset)target.innerHTML="";
    if(items.length) {
      items.forEach(item=>visible.set(item.id,item));
      target.insertAdjacentHTML("beforeend",items.map(item=>card(item,true)).join(""));
      translateVisible(target,items);
    } else if(reset)target.innerHTML='<div class="empty"><h3>暂未找到匹配文献</h3><p>试试更宽泛的关键词、其他年份或来源。</p></div>';
    if(crossrefFallback)searchCount=1;
    searchShown+=items.length;searchBatch++;
    if(crossrefFallback){searchCursor=null;searchBuffered=[];}
    $("#search-summary").textContent=`${crossrefFallback?"Crossref 补充命中":"索引命中"} ${searchCount.toLocaleString("zh-CN")} 篇 · 已显示 ${searchShown.toLocaleString("zh-CN")} 篇`;
    $("#search-page-status").textContent=searchCount?`每次请求最多获取 100 篇，逐批显示 25 篇 · 已显示 ${searchBatch} 批`:"";
    button.hidden=!searchCursor&&!searchBuffered.length;
    if(reset)loadRecentSupplement(seq);
  } catch(error) {
    if(seq===searchSeq){
      if(error.message?.includes("OpenAlex HTTP 429") || error.message?.includes("OpenAlex HTTP 503")){
        searchBackend="crossref";searchLoading=false;return await loadCrossrefSearchPage(seq,reset);
      }
      if(reset)target.innerHTML=`<div class="empty"><h3>检索暂不可用</h3><p>${escapeHtml(error.message)}</p></div>`;
      $("#search-summary").textContent="检索请求失败，请稍后重试";
      $("#search-page-status").textContent=error.message;
      button.hidden=reset;
    }
  } finally {if(seq===searchSeq)searchLoading=false;}
}
async function runSearch() {
  searchInitialized=true;
  const raw=$("#search-input").value.trim();
  const field=$("#search-field").value;
  const canSortByRelevance=((field==="topic" || field==="title") && !!(raw || searchTopics.length)) || (field==="author" && !!searchTopics.length);
  $("#search-sort").querySelector('option[value="relevance"]').disabled=!canSortByRelevance;
  if(!canSortByRelevance && $("#search-sort").value==="relevance")$("#search-sort").value="date";
  const seq=++searchSeq;
  $("#recent-supplement").hidden=true;
  searchLoading=false;
  searchBackend="openalex";crossrefSearchCursors={};
  searchCursor="*";searchBuffered=[];searchCount=0;searchShown=0;searchBatch=0;
  $("#search-load-more").hidden=true;
  $("#search-summary").textContent="正在检索精选来源…";
  try {
    await catalogReady;
    if(seq!==searchSeq)return;
    if(!selectedSearchSources().length){$("#search-results").innerHTML='<div class="empty"><h3>请选择检索范围</h3><p>至少选择一本期刊，或选择 NBER / IMF。</p></div>';$("#search-summary").textContent="没有选中的来源";return;}
    if(searchKind==="all"&&selectedSearchSources().some(source=>!source.id)){searchBackend="crossref";await loadCrossrefSearchPage(seq,true);}
    else await loadSearchPage(seq,true);
  }
  catch(error){if(seq===searchSeq)$("#search-results").innerHTML=`<div class="empty"><h3>来源目录暂不可用</h3><p>${escapeHtml(error.message)}</p></div>`;}
}
$("#search-form").addEventListener("submit",event=>{event.preventDefault();prepareTranslator();runSearch();});
$("#search-source-tabs").addEventListener("click",event=>{const button=event.target.closest("[data-kind]");if(!button)return;prepareTranslator();setSearchKind(button.dataset.kind);runSearch();});
$("#search-discipline").addEventListener("change",()=>{$("#search-tier").value="all";selectedJournalIds.clear();updateTierOptions();runSearch();});
$("#search-tier").addEventListener("change",()=>{updateJournalOptions();runSearch();});
$("#journal-picker-toggle").addEventListener("click",()=>{const panel=$("#journal-picker-panel");panel.hidden=!panel.hidden;$("#journal-picker-toggle").setAttribute("aria-expanded",String(!panel.hidden));});
$("#journal-picker-options").addEventListener("change",event=>{const input=event.target.closest('input[type="checkbox"]');if(!input)return;input.checked?selectedJournalIds.add(input.value):selectedJournalIds.delete(input.value);$("#journal-picker-label").textContent=selectedJournalIds.size?`已选 ${selectedJournalIds.size} 本期刊`:"全部期刊";runSearch();});
$("#journal-picker-clear").addEventListener("click",()=>{selectedJournalIds.clear();updateJournalOptions();runSearch();});
$("#working-picker-toggle").addEventListener("click",()=>{const panel=$("#working-picker-panel");panel.hidden=!panel.hidden;$("#working-picker-toggle").setAttribute("aria-expanded",String(!panel.hidden));});
$("#working-picker-panel").addEventListener("change",event=>{const input=event.target.closest('input[type="checkbox"]');if(!input)return;input.checked?selectedWorking.add(input.value):selectedWorking.delete(input.value);$("#working-picker-label").textContent=[...selectedWorking].join(" 与 ")||"请选择来源";runSearch();});
document.addEventListener("click",event=>{for(const id of ["journal-picker","working-picker"]){if(event.target.closest("#"+id))continue;$("#"+id+"-panel").hidden=true;$("#"+id+"-toggle").setAttribute("aria-expanded","false");}});
$("#search-year").addEventListener("change",()=>{$(".custom-date-field").hidden=$("#search-year").value!=="custom";runSearch();});
$("#search-date-from").addEventListener("change",runSearch);
$("#search-date-to").addEventListener("change",runSearch);
$("#search-field").addEventListener("change",runSearch);
$("#search-sort").addEventListener("change",runSearch);
$("#search-load-more").addEventListener("click",()=>{prepareTranslator();loadSearchPage(searchSeq);});
$("#reset-search-filters").addEventListener("click",()=>{$("#search-input").value="";$("#search-field").value="topic";$("#search-discipline").value="all";$("#search-tier").value="all";selectedJournalIds.clear();selectedWorking=new Set(["NBER","IMF"]);$("#working-picker-panel").querySelectorAll('input').forEach(input=>input.checked=true);$("#working-picker-label").textContent="NBER 与 IMF";updateTierOptions();$("#search-year").value="all";$(".custom-date-field").hidden=true;$("#search-date-from").value="";$("#search-date-to").value="";$("#search-sort").value="date";searchTopics=[];draftSearchTopics=[];renderTopicControls();setSearchKind("all");runSearch();});
setSearchKind("all");
$("#refresh-feed").addEventListener("click",() => {prepareTranslator();runFeed();});
$("#feed-group").addEventListener("change",runFeed);
$("#feed-period").addEventListener("change",runFeed);
$("#feed-keyword").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();runFeed();}});
$(".feed-view-tabs").addEventListener("click",event=>{const button=event.target.closest("[data-feed-view]");if(!button)return;const forthcoming=button.dataset.feedView==="forthcoming";$("#feed-online-panel").hidden=forthcoming;$("#feed-forthcoming-panel").hidden=!forthcoming;document.querySelectorAll("[data-feed-view]").forEach(el=>el.classList.toggle("selected",el===button));});
function feedSources() {
  const group=$("#feed-group").value;
  if(group==="working")return openalexSources.working;
  const journals=openalexSources.journals.filter(source=>group==="all" || (group==="top5"?source.tier==="top5":group==="fieldtop"?!["top5","utd24"].includes(source.tier):group==="utd24"?source.utd24:source.tier===group));
  return group==="all"?[...journals,...openalexSources.working]:journals;
}
function topicMatch(item) {
  if(!selectedTopics.length)return true;
  const haystack=(item.title+" "+item.abstract).toLowerCase();
  return selectedTopics.some(id=>TOPICS.find(topic=>topic.id===id)?.words.some(word=>haystack.includes(word)));
}
function titleMatchesQuery(title,query) {
  const words=query.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").match(/[\p{L}\p{N}]+/gu)||[];
  const text=title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"");
  return words.every(word=>text.includes(word));
}
function showFeedMore() {
  feedShown=Math.min(feedShown+30,feedItems.length);
  renderPapers($("#feed-results"),feedItems.slice(0,feedShown),"近期暂无匹配记录","试试扩大时间范围或清除关键词。");
  $("#feed-show-more").hidden=feedShown>=feedItems.length;
}
$("#feed-show-more").addEventListener("click",showFeedMore);
async function runFeed() {
  feedInitialized=true;
  const seq=++feedSeq;
  const target=$("#feed-results");
  target.innerHTML='<div class="loading">正在查找近期在线论文…</div>';
  $("#forthcoming-results").innerHTML='<div class="loading">正在核对 Online first 记录…</div>';
  $("#feed-show-more").hidden=true;
  $("#feed-summary").textContent="";
  try {
    await catalogReady;
    const sources=feedSources();
    const journals=sources.filter(source=>source.issn);
    const today=new Date().toISOString().slice(0,10);
    const start=new Date();start.setDate(start.getDate()-Number($("#feed-period").value)+1);
    const from=start.toISOString().slice(0,10);
    const keyword=$("#feed-keyword").value.trim();
    const terms=selectedTopics.map(id=>TOPICS.find(topic=>topic.id===id)?.term).filter(Boolean);
    const oaUrl=new URL("https://api.openalex.org/works");
    const locationFilter=$("#feed-group").value==="working"||$("#feed-group").value==="all"?`primary_location.source.id:${sources.map(source=>source.id).filter(Boolean).join("|")}`:`primary_location.source.issn:${journals.map(source=>source.issn).join("|")}`;
    oaUrl.searchParams.set("filter",[locationFilter,"has_doi:true","type:article|report|preprint",`from_publication_date:${from}`,`to_publication_date:${today}`].join(","));
    if(keyword || terms.length)oaUrl.searchParams.set("search.title_abstract_keywords",keyword && terms.length?`(${keyword}) AND (${terms.join(" OR ")})`:keyword||terms.join(" OR "));
    oaUrl.searchParams.set("sort","publication_date:desc");oaUrl.searchParams.set("per_page","150");
    oaUrl.searchParams.set("select","id,doi,title,authorships,publication_date,primary_location,abstract_inverted_index,relevance_score,type");
    const jobs=[requestOpenAlex(oaUrl.toString())];
    if(journals.length){
      const params={filter:[...journals.map(source=>"issn:"+source.issn),"type:journal-article",`from-online-pub-date:${from}`,`until-online-pub-date:${today}`].join(","),rows:"120",sort:"published-online",order:"desc"};
      if(keyword)params["query.title"]=keyword;
      jobs.push(requestSource({},params));
    }
    const results=await Promise.allSettled(jobs);
    if(seq!==feedSeq)return;
    if(results.every(result=>result.status==="rejected"))throw new Error("文献接口暂时没有响应");
    const oa=results[0].status==="fulfilled"?(results[0].value.results||[]).map(normalizeOpenAlex).filter(Boolean):[];
    const cr=results[1]?.status==="fulfilled"?results[1].value.filter(item=>item.date>=from && item.date<=today && topicMatch(item) && (!keyword || titleMatchesQuery(item.title,keyword))):[];
    const merged=new Map(oa.map(item=>[item.id,item]));
    cr.forEach(item=>{const prior=merged.get(item.id);merged.set(item.id,prior?{...prior,...item,abstract:item.abstract||prior.abstract}:item);});
    feedItems=[...merged.values()].sort((a,b)=>b.date.localeCompare(a.date));
    feedShown=0;showFeedMore();
    $("#feed-summary").textContent=`本次汇集 ${feedItems.length} 条记录 · 按发表日期由近到远`;
    const forthcoming=cr.filter(item=>item.onlineFirst).slice(0,40);
    renderPapers($("#forthcoming-results"),forthcoming,"当前筛选下暂无 Online first 候选","可放宽关键词或时间范围，或查看下方期刊官方页面。");
  } catch(error) {if(seq===feedSeq){target.innerHTML=`<div class="empty"><h3>速递暂不可用</h3><p>${escapeHtml(error.message)}</p></div>`;$("#forthcoming-results").innerHTML="";}}
}
function renderLibrary() {
  $("#library-total").textContent=saved.length;
  const descendants=id=>{const ids=new Set([id]);let changed=true;while(changed){changed=false;for(const folder of folders)if(ids.has(folder.parentId)&&!ids.has(folder.id)){ids.add(folder.id);changed=true;}}return ids;};
  const tree=(parentId,depth)=>folders.filter(folder=>folder.parentId===parentId).map(folder=>{
    const count=saved.filter(item=>descendants(folder.id).has(paperOrganization[item.id]?.folderId)).length;
    return `<div class="folder-row" style="--depth:${depth}"><button type="button" class="library-filter ${libraryFilter==="folder:"+folder.id?"active":""}" data-library-filter="${escapeHtml("folder:"+folder.id)}">${escapeHtml(folder.name)} <span>${count}</span></button>${depth<2?`<button type="button" class="folder-child-add" data-add-child="${escapeHtml(folder.id)}" title="新建下级栏目" aria-label="在${escapeHtml(folder.name)}下新建栏目">＋</button>`:""}</div>${tree(folder.id,depth+1)}`;
  }).join("");
  $("#library-folders").innerHTML=tree(null,0);
  $("#view-library [data-library-filter=all]").classList.toggle("active",libraryFilter==="all");
  const folderId=libraryFilter.startsWith("folder:")?libraryFilter.slice(7):"";
  $("#library-current").textContent=folderId?folderPath(folderId):"全部文献";
  const ids=folderId?descendants(folderId):null;
  const items=saved.filter(item=>!ids || ids.has(paperOrganization[item.id]?.folderId));
  renderPapers($("#library-list"),items,"这里还没有文献","收藏论文后，可选择栏目整理。");
}
function openFolderForm(parentId="") {
  $("#folder-parent").innerHTML='<option value="">作为一级栏</option>'+folders.filter(folder=>folderDepth(folder.id)<3).map(folder=>`<option value="${escapeHtml(folder.id)}">${escapeHtml(folderPath(folder.id))}</option>`).join("");
  $("#folder-parent").value=parentId;
  $("#folder-create-form").hidden=false;
  $("#folder-name").focus();
}
$("#view-library").addEventListener("click",event=>{const child=event.target.closest("[data-add-child]");if(child){openFolderForm(child.dataset.addChild);return;}const button=event.target.closest("[data-library-filter]");if(button){libraryFilter=button.dataset.libraryFilter;renderLibrary();}});
$("#library-list").addEventListener("change",event=>{const select=event.target.closest("[data-folder-for]");if(!select)return;const id=select.dataset.folderFor;paperOrganization[id]={...(paperOrganization[id]||{}),folderId:select.value};writeLocal("econfrontier.organization",paperOrganization);renderLibrary();});
$("#folder-add-toggle").addEventListener("click",()=>{$("#folder-create-form").hidden?openFolderForm():$("#folder-create-form").hidden=true;});
$("#folder-create-form").addEventListener("submit",event=>{event.preventDefault();const name=$("#folder-name").value.trim();const parentId=$("#folder-parent").value||null;if(!name || folders.some(folder=>folder.parentId===parentId && folder.name.toLowerCase()===name.toLowerCase()) || (parentId && folderDepth(parentId)>=3))return;const id=`folder-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;folders=[...folders,{id,name,parentId}];writeLocal("econfrontier.folderTree",folders);$("#folder-name").value="";$("#folder-create-form").hidden=true;libraryFilter="folder:"+id;renderLibrary();});
$("#export-library").addEventListener("click",() => {
  if (!saved.length) return alert("文献库还没有论文可导出。");
  const rows=[["Title","Chinese title","Authors","Journal","Date","DOI","URL","Folder"],...saved.map(x=>[x.title,translationCache[x.id]||"",x.authors,x.sourceName,x.date,x.doi,x.url,folderPath(paperOrganization[x.id]?.folderId)])];
  const csv="\ufeff"+rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="econfrontier-library.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
const tierNames = {top5:"经济学 Top 5",sufe1:"Field Top",sufe2:"Field Top",finance:"Field Top",working:"工作论文"};
function clearDetail() {
  $("#detail-title").textContent = "正在加载论文…";
  $("#detail-translation").textContent = "";
  $("#detail-authors").textContent = "";
  $("#detail-abstract").textContent = "正在获取摘要…";
  $("#detail-abstract-zh").hidden = true;
  $("#detail-abstract-zh").textContent = "";
  $("#translate-abstract").hidden = true;
  $("#detail-keywords").textContent = "";
  $("#detail-topics").textContent = "";
  $("#detail-journal-link").hidden = true;
}
function reconstructAbstract(index) {
  if (!index || typeof index !== "object") return "";
  const words = [];
  for (const [word,positions] of Object.entries(index)) for (const position of positions) if (position < 12000) words[position] = word;
  return words.filter(Boolean).join(" ").replace(/\s+([,.;:!?])/g,"$1").replace(/([.!?])(?=[A-Z])/g,"$1 ").trim();
}
async function getDetailMetadata(doi) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),15000);
  try {
    const [crossref,openalex] = await Promise.allSettled([
      fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`,{signal:controller.signal}).then(r => {if(!r.ok)throw Error("Crossref "+r.status);return r.json();}),
      fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`,{signal:controller.signal}).then(r => {if(!r.ok)throw Error("OpenAlex "+r.status);return r.json();})
    ]);
    return {crossref:crossref.status==="fulfilled"?crossref.value.message:null,openalex:openalex.status==="fulfilled"?openalex.value:null};
  } finally {clearTimeout(timer);}
}
function setTags(target,values,emptyText) {
  target.innerHTML = values.length ? values.map(value => `<span>${escapeHtml(value)}</span>`).join("") : `<p class="missing-data">${escapeHtml(emptyText)}</p>`;
}
function updateDetailSave() {
  const marked = currentDetail && saved.some(x => x.id === currentDetail.id);
  $("#detail-save").textContent = marked ? "★ 已收藏" : "☆ 收藏论文";
}
async function showPaper(doi) {
  const seq = ++detailSeq;
  clearDetail();
  try {
    await catalogReady;
    let item = visible.get(doi.toLowerCase()) || saved.find(x => x.id === doi.toLowerCase());
    const metadataPromise = getDetailMetadata(doi);
    if (!item) {
      const metadata = await metadataPromise;
      const source = WORKING.find(x => doi.toLowerCase().startsWith(x.prefix+"/")) || {};
      item = (metadata.crossref ? normalize(metadata.crossref,source) : null) || (metadata.openalex ? normalizeOpenAlex(metadata.openalex) : null);
      if (!item) throw new Error("这篇论文不在当前已核对的来源目录中，或元数据暂不可用。");
    }
    if (seq !== detailSeq) return;
    currentDetail = item;
    $("#detail-title").textContent = item.title;
    $("#detail-overline").textContent = `${tierNames[item.tier] || "论文"} · ${item.date || "日期未提供"}`;
    $("#detail-authors").textContent = (item.authorsFull || item.authors?.split(", ") || []).join("  ·  ") || "作者信息未提供";
    $("#detail-journal").textContent = item.sourceName || "来源信息未提供";
    $("#detail-tier").textContent = tierNames[item.tier] || "未分类";
    $("#detail-issn").textContent = item.issn || "不适用";
    $("#detail-date").textContent = item.date || "未提供";
    $("#detail-doi").textContent = item.doi;
    $("#detail-doi-link").href = item.url;
    updateDetailSave();
    $("#detail-translation").textContent = translationCache[item.id] || "中文译名生成中…";
    if (!translationCache[item.id]) translateTitle(item).then(text => {if(seq===detailSeq)$("#detail-translation").textContent=text;}).catch(() => {if(seq===detailSeq)$("#detail-translation").textContent="中文译名暂不可用，请以英文原题核对";});
    const metadata = await metadataPromise;
    if (seq !== detailSeq) return;
    const crossref = metadata.crossref;
    const openalex = metadata.openalex;
    let crossrefAbstract = "";
    if (crossref?.abstract) {
      const decoder = document.createElement("textarea");
      decoder.innerHTML = String(crossref.abstract).replace(/<[^>]*>/g," ");
      crossrefAbstract = decoder.value.replace(/\s+/g," ").trim();
    }
    const openalexAbstract = reconstructAbstract(openalex?.abstract_inverted_index);
    const abstract = crossrefAbstract || openalexAbstract || item.abstract;
    $("#detail-abstract").textContent = abstract || "公开书目记录暂未提供摘要。请打开 DOI 原文页面查看。";
    $("#abstract-source").textContent = abstract ? `摘要来源：${crossrefAbstract?"Crossref":openalexAbstract?"OpenAlex":"检索记录"}` : "";
    $("#translate-abstract").hidden = !abstract;
    const keywords = (openalex?.keywords || []).slice(0,10).map(x => x.display_name).filter(Boolean);
    setTags($("#detail-keywords"),keywords,"公开记录暂无关键词。");
    const primary = openalex?.primary_topic;
    const categories = [primary?.domain?.display_name,primary?.field?.display_name,primary?.subfield?.display_name,primary?.display_name].filter(Boolean);
    if (!categories.length) categories.push(...(crossref?.subject || []).slice(0,5));
    setTags($("#detail-topics"),categories,crossref || openalex ? "当前记录暂无研究分类。" : "研究分类暂不可用。");
    const journalUrl = openalex?.primary_location?.source?.homepage_url;
    if (journalUrl && /^https?:\/\//.test(journalUrl)) {$("#detail-journal-link").href=journalUrl;$("#detail-journal-link").hidden=false;}
  } catch(error) {
    if (seq===detailSeq) {$("#detail-title").textContent="论文详情暂不可用";$("#detail-abstract").textContent=error.message;}
  }
}
$("#paper-back").addEventListener("click",() => navigate(lastListView));
$("#detail-save").addEventListener("click",() => {
  if (!currentDetail) return;
  saved = saved.some(x => x.id === currentDetail.id) ? saved.filter(x => x.id !== currentDetail.id) : [currentDetail,...saved];
  writeLocal("econfrontier.saved",saved);
  $("#saved-count").textContent=saved.length;
  updateDetailSave();
});
$("#translate-abstract").addEventListener("click",async () => {
  prepareTranslator();
  const button=$("#translate-abstract");
  const output=$("#detail-abstract-zh");
  if (!output.hidden) { output.hidden=true;button.textContent="查看中文翻译 ↗";return; }
  const original=$("#detail-abstract").textContent;
  button.disabled=true;button.textContent="正在翻译…";
  try {
    const chunks=original.match(/[\s\S]{1,800}/g) || [];
    const parts=[];
    for(const chunk of chunks) parts.push(localTranslator ? await localTranslator.translate(chunk) : await translateViaGoogle(chunk));
    output.textContent=parts.join(" ");
    output.hidden=false;
    button.textContent="收起中文翻译";
  } catch {output.textContent="摘要翻译暂不可用，请阅读英文原文。";output.hidden=false;button.textContent="重试翻译 ↗";}
  finally {button.disabled=false;}
});
const catalogReady=loadCatalog();
catalogReady.catch(error=>{console.error(error);$("#search-summary").textContent="来源目录暂无法加载";});
const initialQuery = new URL(location.href).searchParams.get("q");
if (initialQuery) $("#search-input").value=initialQuery;
navigate(initialQuery?"search":location.hash.slice(1)||"home");
