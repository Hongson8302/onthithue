let DATA=null, all=[], filtered=[], page=1;
const PAGE_SIZE=20;
const $=id=>document.getElementById(id);

function norm(s){
  return (s||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();
}
function esc(s){return (s||"").toString().replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

// Tô sáng từ khóa: so khớp trên bản đã bỏ dấu nhưng tô trên chữ gốc có dấu
function highlight(text, terms){
  text=(text||"").toString();
  terms=terms.filter(Boolean);
  if(!terms.length) return esc(text);
  let n="", map=[];
  for(let i=0;i<text.length;i++){
    const c=norm(text[i]);
    for(const ch of c){ n+=ch; map.push(i); }
  }
  const ranges=[];
  terms.forEach(t=>{
    const nt=norm(t);
    if(!nt) return;
    let from=0, idx;
    while((idx=n.indexOf(nt,from))!==-1){
      ranges.push([map[idx], map[idx+nt.length-1]+1]);
      from=idx+nt.length;
    }
  });
  if(!ranges.length) return esc(text);
  ranges.sort((a,b)=>a[0]-b[0]);
  const merged=[];
  for(const r of ranges){
    const last=merged[merged.length-1];
    if(last && r[0]<=last[1]) last[1]=Math.max(last[1],r[1]);
    else merged.push([r[0],r[1]]);
  }
  let out="", pos=0;
  for(const [s,e] of merged){
    out+=esc(text.slice(pos,s))+"<mark>"+esc(text.slice(s,e))+"</mark>";
    pos=e;
  }
  return out+esc(text.slice(pos));
}

// Văn bản dùng để tìm kiếm (không gồm số câu, số câu được so khớp riêng)
function searchable(q){
  return norm([q.section,q.question,...Object.values(q.options),q.answer,q.explanation].join(" "));
}
const ID_LIKE=/^\d+\.\d+$/;   // ví dụ 9.121
function matches(q, terms){
  const hay=q._hay;
  return terms.every(t=>{
    const nt=norm(t);
    if(ID_LIKE.test(nt)) return q.id===nt || hay.includes(nt);
    return hay.includes(nt);
  });
}
function card(q, terms){
  let opts="";
  ["A","B","C","D","E","F"].forEach(k=>{
    if(q.options[k]) opts+=`<div class="option ${q.answer===k?"correct":""}">
      <span class="letter">${k}.</span>${highlight(q.options[k],terms)}
    </div>`;
  });
  return `<article class="card">
    <div class="meta"><span class="qid">Câu ${esc(q.id)}</span>
      ${q.section?`<span class="tag">${esc(q.section)}</span>`:""}
      ${q.warning?`<span class="warn">⚠ Cần đối chiếu</span>`:""}
    </div>
    <div class="question">${highlight(q.question,terms)}</div>
    ${opts}
    ${q.answer?`<div class="answer">✓ Đáp án: ${esc(q.answer)}</div>`:""}
    ${q.explanation?`<div class="explain"><b>Giải thích:</b> ${highlight(q.explanation,terms)}</div>`:""}
  </article>`;
}
function render(){
  const terms=norm($("searchInput").value).split(/\s+/).filter(Boolean);
  const sec=$("sectionFilter").value, ans=$("answerFilter").value, warn=$("warningFilter").checked;
  filtered=all.filter(q=>(!terms.length||matches(q,terms))&&(!sec||q.section===sec)&&(!ans||q.answer===ans)&&(!warn||q.warning));
  const total=filtered.length, pages=Math.max(1,Math.ceil(total/PAGE_SIZE)); if(page>pages)page=pages;
  const start=(page-1)*PAGE_SIZE;
  $("results").innerHTML=filtered.slice(start,start+PAGE_SIZE).map(q=>card(q,terms)).join("");
  $("resultCount").textContent=`${total.toLocaleString("vi-VN")} kết quả`;
  $("empty").classList.toggle("hidden",total!==0);
  $("pager").classList.toggle("hidden",total<=PAGE_SIZE);
  $("pageInfo").textContent=`Trang ${page}/${pages}`;
  $("prevBtn").disabled=page<=1;$("nextBtn").disabled=page>=pages;
  $("clearBtn").classList.toggle("hidden",!$("searchInput").value);
}
async function init(){
  // no-cache: trình duyệt kiểm tra lại với máy chủ, có dữ liệu mới thì tải về ngay
  DATA=await fetch("questions.json",{cache:"no-cache"}).then(r=>r.json());
  all=DATA.questions||[];
  all.forEach(q=>{q._hay=searchable(q);});
  const letters=[...new Set(all.map(q=>q.answer).filter(Boolean))].sort();
  const af=$("answerFilter"); while(af.options.length>1) af.remove(1);
  letters.forEach(l=>{const o=document.createElement("option");o.value=l;o.textContent="Đáp án "+l;af.appendChild(o)});
  const sections=[...new Set(all.map(q=>q.section).filter(Boolean))];
  sections.forEach(s=>{const o=document.createElement("option");o.value=s;o.textContent=s;$("sectionFilter").appendChild(o)});
  render();
}
$("searchInput").addEventListener("input",()=>{leaveOcr();page=1;render()});
$("sectionFilter").addEventListener("change",()=>{leaveOcr();page=1;render()});
$("answerFilter").addEventListener("change",()=>{leaveOcr();page=1;render()});
$("warningFilter").addEventListener("change",()=>{leaveOcr();page=1;render()});
$("clearBtn").addEventListener("click",()=>{leaveOcr();$("searchInput").value="";page=1;render();$("searchInput").focus()});
$("prevBtn").addEventListener("click",()=>{page--;render();scrollTo({top:0,behavior:"smooth"})});
$("nextBtn").addEventListener("click",()=>{page++;render();scrollTo({top:0,behavior:"smooth"})});
$("randomBtn").addEventListener("click",()=>{
  if(!all.length)return; leaveOcr();
  const q=all[Math.floor(Math.random()*all.length)];
  $("sectionFilter").value=""; $("answerFilter").value=""; $("warningFilter").checked=false;
  $("searchInput").value=q.id; page=1; render();
});
$("themeBtn").addEventListener("click",()=>{document.body.classList.toggle("dark");localStorage.setItem("dark",document.body.classList.contains("dark")?"1":"0")});
if(localStorage.getItem("dark")==="1")document.body.classList.add("dark");

/* ===================== TRA CÂU HỎI BẰNG ẢNH (OCR) ===================== */
let ocrActive=false, IDX=null;
const TESS_URL="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

function trigrams(s){
  const t=" "+s.replace(/[^a-z0-9]+/g," ").trim()+" ";
  const m=new Map();
  for(let i=0;i<t.length-2;i++){const g=t.substr(i,3); m.set(g,(m.get(g)||0)+1);}
  return m;
}
// Chỉ mục TF-IDF theo cụm 3 ký tự: chịu được lỗi nhận dạng chữ và mất dấu
function buildIndex(){
  const N=all.length, df=new Map(), docs=[];
  all.forEach(q=>{
    const full=trigrams(norm(q.question+" "+Object.values(q.options).join(" ")));
    const stem=trigrams(norm(q.question));
    docs.push({full,stem});
    for(const g of full.keys()) df.set(g,(df.get(g)||0)+1);
    for(const g of stem.keys()) if(!full.has(g)) df.set(g,(df.get(g)||0)+1);
  });
  const idf=g=>Math.log((N+1)/((df.get(g)||0)+1))+1;
  const mk=key=>{
    const post=new Map();
    docs.forEach((d,i)=>{
      let norm2=0; const w=[];
      for(const [g,tf] of d[key]){const x=(1+Math.log(tf))*idf(g); w.push([g,x]); norm2+=x*x;}
      const nr=Math.sqrt(norm2)||1;
      for(const [g,x] of w){ if(!post.has(g)) post.set(g,[]); post.get(g).push([i,x/nr]); }
    });
    return post;
  };
  IDX={idf,full:mk("full"),stem:mk("stem")};
}
function findSimilar(text,top=5){
  if(!all.length) return [];
  if(!IDX) buildIndex();
  const qv=trigrams(norm(text));
  if(!qv.size) return [];
  const w=new Map(); let n2=0;
  for(const [g,tf] of qv){const x=(1+Math.log(tf))*IDX.idf(g); w.set(g,x); n2+=x*x;}
  const nr=Math.sqrt(n2)||1;
  const score=new Float64Array(all.length);
  for(const key of ["full","stem"]){
    const sc=new Float64Array(all.length);
    for(const [g,x] of w){const p=IDX[key].get(g); if(!p) continue; for(const [i,v] of p) sc[i]+=(x/nr)*v;}
    for(let i=0;i<sc.length;i++) if(sc[i]>score[i]) score[i]=sc[i];
  }
  return [...score.keys()].map(i=>({q:all[i],s:score[i]})).sort((a,b)=>b.s-a.s).slice(0,top);
}
function leaveOcr(){ if(!ocrActive) return; ocrActive=false; $("ocrBanner").classList.add("hidden"); }
function renderOcrResults(list,text){
  ocrActive=true;
  $("ocrBanner").classList.remove("hidden");
  const best=list.length?list[0].s:0;
  $("ocrMsg").textContent=best>=0.5?"Đã tìm thấy câu khớp nhất:":best>=0.3?"Có thể là các câu sau (độ khớp chưa cao, hãy sửa lại chữ nhận dạng nếu cần):":"Không có câu nào khớp rõ ràng. Hãy chụp rõ hơn hoặc sửa lại chữ nhận dạng rồi tra lại:";
  $("results").innerHTML=list.map(({q,s})=>`<div class="match-score">Độ khớp: ${Math.round(s*100)}%</div>`+card(q,[])).join("");
  $("resultCount").textContent=`Kết quả tra từ ảnh (${list.length} câu gần nhất)`;
  $("empty").classList.add("hidden"); $("pager").classList.add("hidden");
  scrollTo({top:0,behavior:"smooth"});
}
function loadTesseract(){
  return new Promise((res,rej)=>{
    if(window.Tesseract) return res();
    const sc=document.createElement("script"); sc.src=TESS_URL;
    sc.onload=()=>res(); sc.onerror=()=>rej(new Error("Không tải được bộ nhận dạng chữ. Hãy kiểm tra kết nối mạng."));
    document.head.appendChild(sc);
  });
}
async function prepImage(file){   // thu nhỏ, chuyển xám, kéo giãn tương phản để nhận dạng tốt hơn
  const bmp=await createImageBitmap(file);
  const sc=Math.min(1,1800/Math.max(bmp.width,bmp.height));
  const c=document.createElement("canvas"); c.width=Math.round(bmp.width*sc); c.height=Math.round(bmp.height*sc);
  const x=c.getContext("2d"); x.drawImage(bmp,0,0,c.width,c.height);
  const d=x.getImageData(0,0,c.width,c.height), p=d.data, g=new Uint8Array(p.length/4);
  let lo=255,hi=0;
  for(let i=0,j=0;i<p.length;i+=4,j++){const v=(p[i]*0.299+p[i+1]*0.587+p[i+2]*0.114)|0; g[j]=v; if(v<lo)lo=v; if(v>hi)hi=v;}
  const r=Math.max(1,hi-lo);
  for(let i=0,j=0;i<p.length;i+=4,j++){const v=Math.max(0,Math.min(255,((g[j]-lo)*255/r)|0)); p[i]=p[i+1]=p[i+2]=v;}
  x.putImageData(d,0,0);
  return new Promise(res=>c.toBlob(res,"image/png"));
}
function setOcrStatus(t){ $("ocrStatus").textContent=t; }
async function ocrFile(file){
  $("ocrBox").classList.remove("hidden"); $("ocrText").value="";
  try{
    setOcrStatus("Đang xử lý ảnh...");
    const img=await prepImage(file);
    setOcrStatus("Đang tải bộ nhận dạng tiếng Việt (lần đầu có thể mất vài chục giây)...");
    await loadTesseract();
    const out=await window.Tesseract.recognize(img,"vie",{logger:m=>{
      if(m.status==="recognizing text") setOcrStatus(`Đang nhận dạng chữ... ${Math.round((m.progress||0)*100)}%`);
      else if(m.status) setOcrStatus("Đang chuẩn bị: "+m.status);
    }});
    const text=(out.data.text||"").replace(/\s+/g," ").trim();
    $("ocrText").value=text;
    if(!text){ setOcrStatus("Không đọc được chữ nào trong ảnh. Hãy chụp gần và rõ hơn."); return; }
    setOcrStatus("Đã đọc xong. Bạn có thể sửa lại chữ bên dưới rồi bấm Tra lại.");
    renderOcrResults(findSimilar(text),text);
  }catch(e){ console.error(e); setOcrStatus("Lỗi: "+(e&&e.message?e.message:e)); }
}
$("camBtn").addEventListener("click",()=>$("camInput").click());
$("camInput").addEventListener("change",e=>{const f=e.target.files&&e.target.files[0]; if(f) ocrFile(f); e.target.value="";});
$("ocrRedo").addEventListener("click",()=>{const t=$("ocrText").value.trim(); if(t) renderOcrResults(findSimilar(t),t);});
$("ocrClose").addEventListener("click",()=>{$("ocrBox").classList.add("hidden"); leaveOcr(); $("searchInput").value=""; page=1; render();});
$("ocrBack").addEventListener("click",()=>{leaveOcr(); page=1; render();});
window.__findSimilar=findSimilar;   // phục vụ kiểm thử

init().catch(e=>{$("results").innerHTML="<div class='card'>Không đọc được questions.json. Hãy mở website qua máy chủ web (không mở trực tiếp bằng file://).</div>";console.error(e)});
