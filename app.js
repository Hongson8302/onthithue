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
$("searchInput").addEventListener("input",()=>{page=1;render()});
$("sectionFilter").addEventListener("change",()=>{page=1;render()});
$("answerFilter").addEventListener("change",()=>{page=1;render()});
$("warningFilter").addEventListener("change",()=>{page=1;render()});
$("clearBtn").addEventListener("click",()=>{$("searchInput").value="";page=1;render();$("searchInput").focus()});
$("prevBtn").addEventListener("click",()=>{page--;render();scrollTo({top:0,behavior:"smooth"})});
$("nextBtn").addEventListener("click",()=>{page++;render();scrollTo({top:0,behavior:"smooth"})});
$("randomBtn").addEventListener("click",()=>{
  if(!all.length)return;
  const q=all[Math.floor(Math.random()*all.length)];
  $("sectionFilter").value=""; $("answerFilter").value=""; $("warningFilter").checked=false;
  $("searchInput").value=q.id; page=1; render();
});
$("themeBtn").addEventListener("click",()=>{document.body.classList.toggle("dark");localStorage.setItem("dark",document.body.classList.contains("dark")?"1":"0")});
if(localStorage.getItem("dark")==="1")document.body.classList.add("dark");
init().catch(e=>{$("results").innerHTML="<div class='card'>Không đọc được questions.json. Hãy mở website qua máy chủ web (không mở trực tiếp bằng file://).</div>";console.error(e)});
