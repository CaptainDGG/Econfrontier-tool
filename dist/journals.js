// Journal discovery and issue archive. Publication metadata is read on demand from
// Crossref and OpenAlex; an absent record is never presented as a complete archive.
const JOURNAL_AEA = new Map([
  ["American Economic Review","aer"],
  ["American Economic Journal: Applied Economics","app"],
  ["American Economic Journal: Economic Policy","pol"],
  ["American Economic Journal: Macroeconomics","mac"],
  ["American Economic Journal: Microeconomics","mic"],
  ["Journal of Economic Literature","jel"],
  ["Journal of Economic Perspectives","jep"],
  ["AEA Papers and Proceedings","pandp"]
]);
const JOURNAL_SPRINGER = new Set(["0176-1714","1381-4338","1386-4157","0895-5646","0933-1433","0938-2259","0895-5638","0922-680X"]);
const JOURNAL_ELSEVIER = new Set(["0305-750X","0167-2681","0304-4076","0022-0531","0047-2727","0304-405X","0304-3878","0165-1889","0014-2921","0899-8256","0304-3932","0022-1996","0147-5967","0095-0696","0304-4068","0167-6296","0094-1190","0166-0462","0167-7187","1043-951X","0014-4983","1094-2025"]);
const JOURNAL_CAMBRIDGE = new Set(["0022-0507","0266-4666","1365-1005"]);
const JOURNAL_OXFORD = new Set(["0033-5533","0034-6527","0893-9454","0013-0133","1542-4766","1468-2702"]);
const JOURNAL_ACADEMIC_COVERS = new Map([["0012-9682",["webp","巴黎政治学院经济系"]],["0022-1082",["png","上海科技大学官网"]],["0883-7252",["jpg","慕尼黑工业大学官网"]]]);
const JOURNAL_TAYLOR = new Set(["0735-0015","0022-0485","0967-2567"]);
const JOURNAL_CHICAGO = new Set(["0022-3808","0022-2186","0734-306X"]);
const JOURNAL_OFFICIAL_ARCHIVES = new Map([
  ["0033-5533","https://academic.oup.com/qje/issue-archive"],
  ["0034-6527","https://academic.oup.com/restud/issue-archive"],
  ["0893-9454","https://academic.oup.com/rfs/issue-archive"],
  ["0013-0133","https://academic.oup.com/ej/issue-archive"]
]);
const JOURNAL_FIELDS = [
  {id:"accounting",label:"会计与审计",test:/Accounting|Accountancy/i},
  {id:"marketing",label:"市场营销",test:/Marketing|Consumer Research/i},
  {id:"operations",label:"运营与供应链",test:/Operations|Manufacturing|Management Science|Journal on Computing/i},
  {id:"information",label:"信息系统",test:/Information Systems|MIS Quarterly|Journal on Computing/i},
  {id:"strategy",label:"战略与组织",test:/Management Journal|Management Review|Administrative Science|Organization Science|Strategic Management/i},
  {id:"international-business",label:"国际商务",test:/International Business Studies/i},
  {id:"general",label:"综合经济学",test:/American Economic Review|Econometrica|Political Economy|Quarterly Journal|Review of Economic Studies|Economic Journal$|European Economic Review|International Economic Review|Canadian Journal|China Economic Review|Journal of the European|Review of Economics and Statistics|Journal of Economic Literature|Journal of Economic Perspectives|AEA Papers/i},
  {id:"finance",label:"金融与银行",test:/Financ|Monetary|Money|Banking|Real Estate|Risk and Uncertainty/i},
  {id:"macro",label:"宏观与增长",test:/Macroeconom|Economic Growth|Economic Dynamics|Economic Activity/i},
  {id:"metrics",label:"计量与方法",test:/Econometric|Quantitative Economics|Business & Economic Statistics|Applied Econometrics|Mathematical Economics/i},
  {id:"industry",label:"产业与竞争",test:/Industrial|Management Strategy|Regulatory|Games and Economic Behavior|Economic Theory|Theoretical Economics|Economic Behavior|Experimental Economics/i},
  {id:"development",label:"发展与人口",test:/Development|Comparative Economics|Human Resources|Population Economics/i},
  {id:"trade",label:"国际贸易",test:/International Economics/i},
  {id:"public",label:"公共政策与法律",test:/Public Economics|Economic Policy|Law & Economics|Social Choice/i},
  {id:"labor",label:"劳动与教育",test:/Labor Economics|Economic Education/i},
  {id:"health",label:"健康经济学",test:/Health Economics/i},
  {id:"environment",label:"环境与能源",test:/Environmental|Energy/i},
  {id:"urban",label:"城市与区域",test:/Urban|Regional|Economic Geography/i},
  {id:"history",label:"经济史",test:/Economic History|History of Economic|History of Political|Historical/i},
  {id:"agriculture",label:"农业经济学",test:/Agricultural Economics/i}
];
let journalFilter="all", journalQuery="", journalSeq=0, archiveSeq=0;
let favoriteJournals=new Set((()=>{try{return JSON.parse(localStorage.getItem("econfrontier.favoriteJournals"))||[]}catch{return []}})());
let currentJournal=null, archiveItems=[], archiveCursor="*", archiveTotal=0, archiveYear=0;
let openedIssues=new Set(), archiveBusy=false;
const journalTranslationsInFlight=new Set();
const journalSourceMap=()=>new Map(openalexSources.journals.map(item=>[item.issn,item]));
const libraryJournals=()=>catalog.filter(item=>item.name!=="经济研究");
const jEsc=value=>escapeHtml(value);
function journalFields(journal) {
  const name=journal.name;
  const ids=JOURNAL_FIELDS.filter(field=>field.test.test(name)).map(field=>field.id);
  if (name.includes("Applied Economics") && !ids.includes("development")) ids.push("development");
  if (name.includes("Microeconomics") && !ids.includes("industry")) ids.push("industry");
  if(journal.field){const fieldId=({"会计":"accounting","金融":"finance","信息系统":"information","市场营销":"marketing","运营与管理科学":"operations","组织与战略":"strategy","国际商务":"international-business"})[journal.field];if(fieldId&&!ids.includes(fieldId))ids.push(fieldId);}
  return ids.length?ids:["general"];
}
function journalCategories(journal) {
  const types=[];
  if(favoriteJournals.has(journal.issn))types.push("favorites");
  if(journal.utd24)types.push("utd24");
  if (journal.tier==="top5") types.push("top5");
  if (!["top5","utd24"].includes(journal.tier)) types.push("fieldtop");
  if (JOURNAL_AEA.has(journal.name)) types.push("aea");
  if (journal.tier==="finance" || journalFields(journal).includes("finance")) types.push("finance");
  return types;
}
function journalCoverMarkup(journal,large=false) {
  const slug=JOURNAL_AEA.get(journal.name);
  if (slug) return `<div class="journal-cover ${large?"large":""}"><img src="./covers/${slug}.svg" alt="${jEsc(journal.name)} 官方期刊封面" loading="lazy"></div>`;
  if (JOURNAL_SPRINGER.has(journal.issn) || JOURNAL_ELSEVIER.has(journal.issn) || JOURNAL_CAMBRIDGE.has(journal.issn)) return `<div class="journal-cover ${large?"large":""}"><img src="./covers/${journal.issn}.jpg" alt="${jEsc(journal.name)} 官方期刊封面" loading="lazy"></div>`;
  if (JOURNAL_OXFORD.has(journal.issn)) return `<div class="journal-cover ${large?"large":""}"><img src="./covers/${journal.issn}.jpeg" alt="${jEsc(journal.name)} 官方期刊封面" loading="lazy"></div>`;
  if (JOURNAL_ACADEMIC_COVERS.has(journal.issn)) return `<div class="journal-cover ${large?"large":""}"><img src="./covers/${journal.issn}.${JOURNAL_ACADEMIC_COVERS.get(journal.issn)[0]}" alt="${jEsc(journal.name)} 真实期刊封面" loading="lazy"></div>`;
  if (journal.issn==="0034-6535") return `<div class="journal-cover ${large?"large":""}"><img src="./covers/0034-6535.gif" alt="${jEsc(journal.name)} 官方期刊封面" loading="lazy"></div>`;
  if (JOURNAL_TAYLOR.has(journal.issn)) return `<div class="journal-cover taylor-cover ${large?"large":""}"><img src="./covers/${journal.issn}.png" alt="${jEsc(journal.name)} 官方期刊封面" loading="lazy"></div>`;
  if (journal.issn==="0741-6261") return `<div class="journal-cover ${large?"large":""}"><img src="./covers/0741-6261.png" alt="${jEsc(journal.name)} 官方期刊封面" loading="lazy"></div>`;
  if (JOURNAL_CHICAGO.has(journal.issn)) return `<div class="journal-cover ${large?"large":""}"><img src="./covers/${journal.issn}.jpg" alt="${jEsc(journal.name)} 官方期刊封面" loading="lazy"></div>`;
  if (journal.issn==="0018-2702") return `<div class="journal-cover ${large?"large":""}"><img src="./covers/0018-2702.webp" alt="${jEsc(journal.name)} 官方期刊封面" loading="lazy"></div>`;
  const initials=journal.name.split(/[\s:]+/).filter(word=>!/^of|the|and$/i.test(word)).slice(0,3).map(word=>word[0]||"").join("").toUpperCase();
  return `<div class="journal-cover journal-cover-fallback ${large?"large":""}"><small>ECONFRONTIER · JOURNAL</small><strong>${jEsc(initials||"EF")}</strong><span>${jEsc(journal.name)}</span><em>资料卡 · 非期刊封面</em></div>`;
}
function journalCategoryName(id) {
  return ({all:"全部期刊",favorites:"我的关注",top5:"Top 5",fieldtop:"Field Top",utd24:"UTD24",aea:"AEA 系列",finance:"金融类"})[id] || JOURNAL_FIELDS.find(field=>field.id===id)?.label || "全部期刊";
}
function renderJournalCategories() {
  const groups=[{id:"all",label:"全部期刊"},{id:"favorites",label:"我的关注"},{id:"top5",label:"Top 5"},{id:"fieldtop",label:"Field Top"},{id:"utd24",label:"UTD24"},{id:"aea",label:"AEA 系列"},{id:"finance",label:"金融类"}];
  const main=groups.map(group=>`<button class="journal-category ${journalFilter===group.id?"active":""}" type="button" data-journal-filter="${group.id}"><span>${group.label}</span><small>${libraryJournals().filter(j=>group.id==="all"||journalCategories(j).includes(group.id)).length}</small></button>`).join("");
  const fields=JOURNAL_FIELDS.map(field=>`<button class="journal-category ${journalFilter===field.id?"active":""}" type="button" data-journal-filter="${field.id}"><span>${field.label}</span><small>${libraryJournals().filter(j=>journalFields(j).includes(field.id)).length}</small></button>`).join("");
  const expandFields=!window.matchMedia("(max-width:700px)").matches || JOURNAL_FIELDS.some(field=>field.id===journalFilter);
  $("#journal-categories").innerHTML=`<div class="journal-sidebar-label">期刊类型</div>${main}<details class="journal-fields-group" ${expandFields?"open":""}><summary>研究领域 <span>展开选择</span></summary><div>${fields}</div></details>`;
}
function renderJournalGrid() {
  renderJournalCategories();
  const term=journalQuery.trim().toLocaleLowerCase();
  const journals=libraryJournals().filter(journal=>{
    const matchesCategory=journalFilter==="all" || journalCategories(journal).includes(journalFilter) || journalFields(journal).includes(journalFilter);
    return matchesCategory && (!term || `${journal.name} ${journal.issn}`.toLocaleLowerCase().includes(term));
  }).sort((a,b)=>a.tier===b.tier?a.name.localeCompare(b.name,"en"):(a.tier==="top5"?-1:b.tier==="top5"?1:0));
  $("#journal-count").textContent=`${journalCategoryName(journalFilter)} · ${journals.length} 本`;
  $("#journal-grid").innerHTML=journals.length?journals.map(journal=>`<div class="journal-card-wrap"><a class="journal-card" href="#journal/${encodeURIComponent(journal.issn)}" data-journal-link="${jEsc(journal.issn)}">${journalCoverMarkup(journal)}<div class="journal-card-info"><small>${journal.tier==="top5"?"TOP 5":journal.utd24?"UTD24":JOURNAL_AEA.has(journal.name)?"AEA SERIES":journal.tier==="finance"?"FINANCE":"FIELD TOP"}</small><h2 lang="en">${jEsc(journal.name)}</h2><p>ISSN ${jEsc(journal.issn)}</p><span>查看期刊与期次目录 ↗</span></div></a><button type="button" class="journal-favorite ${favoriteJournals.has(journal.issn)?"active":""}" data-favorite-journal="${jEsc(journal.issn)}" aria-label="${favoriteJournals.has(journal.issn)?"取消关注":"关注期刊"}" title="${favoriteJournals.has(journal.issn)?"取消关注":"关注期刊"}">${favoriteJournals.has(journal.issn)?"★":"☆"}</button></div>`).join(""):`<div class="empty"><h3>没有找到匹配的期刊</h3><p>可以换一个名称、ISSN 或分类。</p></div>`;
}
async function showJournalLibrary() {
  try { await catalogReady; renderJournalGrid(); }
  catch { $("#journal-grid").innerHTML='<div class="empty"><h3>期刊目录暂不可用</h3></div>'; }
}
function journalDate(record) {
  const parts=(record.published?.["date-parts"] || record["published-print"]?.["date-parts"] || record["published-online"]?.["date-parts"] || [])[0];
  if (!parts?.length) return "";
  return [parts[0],String(parts[1]||1).padStart(2,"0"),String(parts[2]||1).padStart(2,"0")].join("-");
}
async function journalApi(url) {
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),18000);
  try {const r=await fetch(url,{signal:controller.signal,headers:{Accept:"application/json"}});if(!r.ok)throw new Error(`书目服务 ${r.status}`);return await r.json();}
  finally {clearTimeout(timer);}
}
function renderJournalDetail(journal,crossref,openalex) {
  const name=crossref?.title || openalex?.display_name || journal.name;
  const publisher=crossref?.publisher || openalex?.host_organization_name || "公开书目未提供";
  const issns=[...new Set([journal.issn,...(crossref?.ISSN||[]),...(openalex?.issn||[])])];
  const homepage=openalex?.homepage_url?.startsWith("http")?openalex.homepage_url:"";
  const official=JOURNAL_AEA.has(journal.name)?`https://www.aeaweb.org/journals/${JOURNAL_AEA.get(journal.name)}/issues`:JOURNAL_OFFICIAL_ARCHIVES.get(journal.issn)||homepage;
  const fields=journalFields(journal).map(id=>journalCategoryName(id)).join(" · ");
  const total=crossref?.counts?.["total-dois"];
  const coverProvider=JOURNAL_AEA.has(journal.name)?"美国经济学会":JOURNAL_SPRINGER.has(journal.issn)?"Springer Nature":JOURNAL_ELSEVIER.has(journal.issn)?"Elsevier":JOURNAL_CAMBRIDGE.has(journal.issn)?"Cambridge University Press":JOURNAL_OXFORD.has(journal.issn)?"Oxford University Press":journal.issn==="0034-6535"?"MIT Press":JOURNAL_TAYLOR.has(journal.issn)?"Taylor & Francis":journal.issn==="0741-6261"?"RAND Journal of Economics":JOURNAL_CHICAGO.has(journal.issn)?"芝加哥大学出版社 BiblioVault":journal.issn==="0018-2702"?"Duke University Press":"";
  const coverNote=coverProvider?`封面图来自 ${jEsc(coverProvider)} 官网。`:JOURNAL_ACADEMIC_COVERS.has(journal.issn)?`封面图见于${jEsc(JOURNAL_ACADEMIC_COVERS.get(journal.issn)[1])}发布的资料。`:"图片为本站资料卡，尚未取得可核验的官方封面。";
  $("#journal-detail").innerHTML=`${journalCoverMarkup(journal,true)}<div class="journal-profile"><div class="eyebrow">JOURNAL PROFILE</div><h1 lang="en">${jEsc(name)}</h1><p class="journal-profile-sub">${jEsc(fields)}</p><dl><div><dt>出版机构</dt><dd>${jEsc(publisher)}</dd></div><div><dt>ISSN / eISSN</dt><dd>${jEsc(issns.join(" · "))}</dd></div><div><dt>目录分类</dt><dd>${jEsc(journalCategories(journal).map(journalCategoryName).join(" · "))}</dd></div><div><dt>Crossref 登记 DOI</dt><dd>${total==null?"暂不可用":Number(total).toLocaleString()}</dd></div></dl><div class="journal-profile-actions"><button type="button" class="button outlined" data-favorite-journal="${jEsc(journal.issn)}">${favoriteJournals.has(journal.issn)?"★ 已关注":"☆ 关注期刊"}</button>${official?`<a class="button outlined" href="${jEsc(official)}" target="_blank" rel="noopener noreferrer">期刊官网与完整目录 ↗</a>`:""}<a class="button outlined" href="https://search.crossref.org/?q=${encodeURIComponent(journal.issn)}" target="_blank" rel="noopener noreferrer">核对书目 ↗</a></div><p class="journal-profile-note">${coverNote}</p></div>`;
}
function fillJournalYears(firstYear,selected) {
  const current=new Date().getFullYear();
  const start=Number.isInteger(firstYear)&&firstYear>1800&&firstYear<=current?firstYear:1880;
  $("#journal-year").innerHTML=Array.from({length:current-start+1},(_,i)=>current-i).map(year=>`<option value="${year}">${year} 年</option>`).join("");
  $("#journal-year").value=String(selected);
}
async function showJournalDetail(issn) {
  const seq=++journalSeq; archiveSeq++;
  try {await catalogReady;} catch {$("#journal-detail").innerHTML='<div class="empty">期刊目录暂不可用</div>';return;}
  const journal=libraryJournals().find(item=>item.issn.toLowerCase()===issn.toLowerCase());
  if (!journal){$("#journal-detail").innerHTML='<div class="empty"><h3>未找到这本期刊</h3></div>';$("#journal-issues").innerHTML="";return;}
  currentJournal=journal;
  const year=new Date().getFullYear();
  fillJournalYears(null,year);
  renderJournalDetail(journal,null,null);
  loadJournalYear(year);
  const source=journalSourceMap().get(journal.issn);
  const [crossref,openalex,earliest]=await Promise.allSettled([
    journalApi(`https://api.crossref.org/journals/${encodeURIComponent(journal.issn)}`),
    source?journalApi(`https://api.openalex.org/sources/${source.id}`):Promise.resolve(null),
    journalApi(`https://api.crossref.org/journals/${encodeURIComponent(journal.issn)}/works?sort=published&order=asc&rows=1&select=published`)
  ]);
  if (seq!==journalSeq) return;
  renderJournalDetail(journal,crossref.status==="fulfilled"?crossref.value.message:null,openalex.status==="fulfilled"?openalex.value:null);
  const first=earliest.status==="fulfilled"?earliest.value.message?.items?.[0]?.published?.["date-parts"]?.[0]?.[0]:null;
  fillJournalYears(first,Number($("#journal-year").value)||year);
}
function issueKey(item) {return item.volume||item.issue?`${item.volume||"?"}|${item.issue||"?"}`:"online";}
function renderJournalIssues() {
  const buckets=new Map();
  for(const item of archiveItems){const key=issueKey(item);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(item);}
  const issues=[...buckets.entries()].sort((a,b)=>{
    const da=Math.max(...a[1].map(x=>Date.parse(journalDate(x))||0));
    const db=Math.max(...b[1].map(x=>Date.parse(journalDate(x))||0));
    return db-da || b[0].localeCompare(a[0],undefined,{numeric:true});
  });
  $("#journal-issues").innerHTML=issues.length?issues.map(([key,items])=>{
    const first=items[0];
    const title=key==="online"?"提前在线 · 暂无卷期":`第 ${jEsc(first.volume||"—")} 卷 · 第 ${jEsc(first.issue||"—")} 期`;
    const latest=items.map(journalDate).sort().at(-1)||"";
    const papers=items.sort((a,b)=>(Number(a.page?.split("-")[0])||99999)-(Number(b.page?.split("-")[0])||99999)).map(item=>{
      const doi=item.DOI || "";
      const author=(item.author||[]).slice(0,4).map(a=>[a.given,a.family].filter(Boolean).join(" ")).join(" · ");
      const title=Array.isArray(item.title)?item.title[0]:item.title||"未提供标题";
      const id=doi.toLowerCase();
      const translation=translationCache[id];
      return `<li><a href="#paper/${encodeURIComponent(doi)}" data-journal-paper="${jEsc(doi)}" lang="en">${jEsc(title)}</a><p class="journal-paper-translation ${translation?"":"pending"}" data-journal-translation="${jEsc(id)}" lang="zh-CN">${translation?jEsc(translation):"中文译名生成中…"}</p><button class="journal-translation-retry" type="button" data-journal-retry="${jEsc(id)}" hidden>重试翻译 ↗</button><span>${jEsc(author||journalDate(item)||doi)}</span></li>`;
    }).join("");
    return `<details class="journal-issue" data-issue-key="${jEsc(key)}" ${openedIssues.has(key)?"open":""}><summary><span><strong>${title}</strong><small>${latest?`${jEsc(latest)} · `:""}${items.length} 篇已载入</small></span><span class="issue-chevron" aria-hidden="true"></span></summary><ol>${papers}</ol></details>`;
  }).join(""):'<div class="empty"><h3>这个年份暂无可展示的目录</h3><p>可切换其他年份，或前往期刊官网核对。</p></div>';
  const loaded=archiveItems.length;
  $("#journal-archive-status").textContent=archiveTotal?`${archiveYear} 年：Crossref 检索到 ${archiveTotal.toLocaleString()} 条记录，已载入 ${loaded.toLocaleString()} 条。`:`${archiveYear} 年：Crossref 暂无匹配记录。`;
  $("#journal-load-more").hidden=archiveBusy || !archiveCursor || loaded>=archiveTotal;
  $("#journal-issues").querySelectorAll(".journal-issue[open]").forEach(translateJournalIssue);
}
async function translateJournalIssue(details,onlyId="") {
  prepareTranslator();
  const nodes=[...details.querySelectorAll("[data-journal-translation]")].filter(node=>!onlyId || node.dataset.journalTranslation===onlyId);
  await settle(nodes.map(node=>async()=>{
    const id=node.dataset.journalTranslation;
    const item=archiveItems.find(record=>record.DOI?.toLowerCase()===id);
    if(!item || translationCache[id] || journalTranslationsInFlight.has(id)) return;
    journalTranslationsInFlight.add(id);
    const updateNodes=(value,failed=false)=>{
      $("#journal-issues").querySelectorAll("[data-journal-translation]").forEach(current=>{
        if(current.dataset.journalTranslation!==id) return;
        current.textContent=value;
        current.classList.toggle("pending",failed);
        current.closest("li").querySelector("[data-journal-retry]").hidden=!failed;
      });
    };
    try {
      const title=Array.isArray(item.title)?item.title[0]:item.title||"";
      const value=await translateTitle({id,title});
      updateNodes(value);
    } catch {
      updateNodes("中文译名暂不可用 · 请以英文原题核对",true);
    } finally {journalTranslationsInFlight.delete(id);}
  }),2);
}
async function fetchJournalArchivePage(seq) {
  if (!currentJournal || archiveBusy || !archiveCursor) return;
  archiveBusy=true;
  $("#journal-archive-status").textContent=`正在载入 ${archiveYear} 年的目录…`;
  $("#journal-load-more").hidden=true;
  const url=new URL(`https://api.crossref.org/journals/${currentJournal.issn}/works`);
  url.searchParams.set("filter",`from-pub-date:${archiveYear}-01-01,until-pub-date:${archiveYear}-12-31,type:journal-article`);
  url.searchParams.set("select","DOI,title,author,volume,issue,published,published-online,published-print,page,URL");
  url.searchParams.set("rows","250");url.searchParams.set("cursor",archiveCursor);
  try {
    const payload=await journalApi(url.toString());
    if (seq!==archiveSeq) return;
    const message=payload.message||{};
    const existing=new Set(archiveItems.map(item=>item.DOI?.toLowerCase()));
    for(const item of message.items||[]) if(item.DOI && !existing.has(item.DOI.toLowerCase())){archiveItems.push(item);existing.add(item.DOI.toLowerCase());}
    archiveTotal=message["total-results"]||0;
    archiveCursor=(message.items||[]).length===250 && archiveItems.length<archiveTotal?message["next-cursor"]:null;
    archiveBusy=false;renderJournalIssues();
  } catch(error) {
    if(seq!==archiveSeq)return;
    archiveBusy=false;$("#journal-archive-status").textContent=`目录暂未载入：${error.message}。请稍后重试。`;
    $("#journal-load-more").hidden=false;
  }
}
function loadJournalYear(year) {
  archiveSeq++;
  archiveItems=[];archiveCursor="*";archiveTotal=0;archiveYear=year;archiveBusy=false;openedIssues.clear();
  $("#journal-issues").innerHTML="";
  fetchJournalArchivePage(archiveSeq);
}
document.addEventListener("DOMContentLoaded",()=>{
document.addEventListener("click",event=>{const button=event.target.closest("[data-favorite-journal]");if(!button)return;event.preventDefault();event.stopPropagation();const issn=button.dataset.favoriteJournal;favoriteJournals.has(issn)?favoriteJournals.delete(issn):favoriteJournals.add(issn);writeLocal("econfrontier.favoriteJournals",[...favoriteJournals]);renderJournalGrid();if(currentJournal?.issn===issn){button.textContent=favoriteJournals.has(issn)?"★ 已关注":"☆ 关注期刊";}});
$("#journal-categories").addEventListener("click",event=>{const button=event.target.closest("[data-journal-filter]");if(!button)return;journalFilter=button.dataset.journalFilter;renderJournalGrid();});
$("#journal-search").addEventListener("input",event=>{journalQuery=event.target.value;renderJournalGrid();});
$("#journal-grid").addEventListener("click",event=>{const link=event.target.closest("[data-journal-link]");if(link){event.preventDefault();navigate(`journal/${link.dataset.journalLink}`);}});
$("#journal-back").addEventListener("click",()=>navigate("journals"));
$("#journal-year").addEventListener("change",event=>loadJournalYear(Number(event.target.value)));
$("#journal-load-more").addEventListener("click",()=>fetchJournalArchivePage(archiveSeq));
$("#journal-issues").addEventListener("toggle",event=>{const details=event.target;if(!details.matches?.(".journal-issue"))return;const key=details.dataset.issueKey;if(details.open){openedIssues.add(key);translateJournalIssue(details);}else openedIssues.delete(key);},true);
$("#journal-issues").addEventListener("click",event=>{const retry=event.target.closest("[data-journal-retry]");if(retry){retry.hidden=true;const node=retry.closest("li").querySelector("[data-journal-translation]");node.textContent="中文译名生成中…";translateJournalIssue(retry.closest(".journal-issue"),retry.dataset.journalRetry);return;}const link=event.target.closest("[data-journal-paper]");if(link){event.preventDefault();lastListView="journals";navigate(`paper/${encodeURIComponent(link.dataset.journalPaper)}`);}});
});
