const $ = id => document.getElementById(id);
const BUCKET = 'story-media';
const MAX_MB = { image: 10, video: 50, audio: 50 };
let supabaseClient = null, stories = [], currentId = null, editingId = null, isAdmin = false, busy = false, hasMediaCols = true;
const config = window.APP_CONFIG || {};
const configured = config.SUPABASE_URL && !config.SUPABASE_URL.includes("PASTE_") &&
  config.SUPABASE_PUBLISHABLE_KEY && !config.SUPABASE_PUBLISHABLE_KEY.includes("PASTE_") &&
  config.ADMIN_EMAIL && !config.ADMIN_EMAIL.includes("PASTE_");
const COLS_FULL = 'id,title,content,emoji,category,image_url,video_url,audio_url,created_at';
const COLS_BASIC = 'id,title,content,created_at';

function esc(s){return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function show(section){['home','reader','editor','quiz'].forEach(id=>$(id).classList.toggle('hidden',id!==section));window.scrollTo({top:0,behavior:'smooth'})}
function setAdminUI(){
  document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',!isAdmin));
  $('adminLogoutBtn').classList.toggle('hidden',!isAdmin);
  const lb=$('adminLoginBtn');if(lb)lb.classList.toggle('hidden',isAdmin);
  $('setupWarn').classList.toggle('hidden',!(isAdmin&&!hasMediaCols));
}
function fromDb(r){return {id:String(r.id),title:r.title,text:r.content,emoji:r.emoji||'📖',category:r.category||'हिंदी कहानी',image:r.image_url||'',video:r.video_url||'',audio:r.audio_url||''}}

async function checkIsAdmin(userId){
  const {data,error}=await supabaseClient.from('admins').select('user_id').eq('user_id',userId).maybeSingle();
  if(error){console.error(error);window.__adminErr=error.message;return null}
  return !!data;
}

/* ---------- Offline: पिछली बार की कहानियाँ फोन में सेव रहती हैं (सिर्फ़ पढ़ने के लिए, database को नहीं छूता) ---------- */
const CACHE_KEY='rk_stories_v1';
function saveCache(rows){try{if(rows.length)localStorage.setItem(CACHE_KEY,JSON.stringify(rows))}catch(_){}}
function showOffline(on){const n=$('offlineNote');if(n)n.classList.toggle('hidden',!on)}
function loadFromCache(){
  try{
    const d=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
    if(Array.isArray(d)&&d.length){stories=d.map(fromDb);render();showOffline(true);return true}
  }catch(_){}
  return false;
}
async function loadStories(){
  $('cards').innerHTML='<p class="muted">कहानियाँ लोड हो रही हैं…</p>';
  if(!configured){$('cards').innerHTML='<p>वेबसाइट सेटअप पूरा नहीं हुआ है। Admin को config.js में Supabase की जानकारी भरनी होगी।</p>';return}
  let res;
  try{res=await supabaseClient.from('stories').select(hasMediaCols?COLS_FULL:COLS_BASIC).order('created_at',{ascending:false})}catch(e){res={error:e}}
  // अगर नए columns (emoji/image/video/audio) अभी database में नहीं हैं, तो पुराने तरीके से चलाओ
  if(res.error&&hasMediaCols&&/column|schema cache/i.test(res.error.message||'')){
    hasMediaCols=false;setAdminUI();
    res=await supabaseClient.from('stories').select(COLS_BASIC).order('created_at',{ascending:false});
  }
  if(res.error){
    console.error(res.error);
    if(loadFromCache())return;   // इंटरनेट नहीं है तो पिछली बार वाली कहानियाँ दिखाओ
    $('cards').innerHTML='<p>कहानियाँ लोड नहीं हुईं। इंटरनेट और Supabase की policies/table जाँचें।</p>';return;
  }
  saveCache(res.data||[]);showOffline(false);
  stories=(res.data||[]).map(fromDb);
  render();
}
function render(){
  $('count').textContent=stories.length+' कहानियाँ';
  if(!stories.length){$('cards').innerHTML='<p class="muted">अभी कोई कहानी नहीं है। जल्द ही नई कहानियाँ आएँगी!</p>';return}
  $('cards').innerHTML=stories.map(s=>{
    const top=s.image?`<img class="thumb" loading="lazy" alt="" src="${esc(s.image)}">`:`<span class="emoji">${esc(s.emoji)}</span>`;
    const badges=(s.video?'🎬 ':'')+(s.audio?'🎧 ':'');
    return `<button class="storycard" data-id="${esc(s.id)}">${top}<strong>${esc(s.title)}</strong><small>${badges}${esc(s.category)} · पढ़ें और सुनें →</small></button>`;
  }).join('');
  document.querySelectorAll('.storycard').forEach(b=>b.onclick=()=>openStory(b.dataset.id));
}

/* ---------- कहानी खोलना ---------- */
function stopMedia(){stopListening();document.querySelectorAll('#reader audio,#reader video').forEach(m=>{try{m.pause()}catch(_){}})}
function openStory(id){
  const s=stories.find(x=>x.id===String(id));if(!s)return;
  stopMedia();currentId=s.id;
  const art=$('readEmoji');art.textContent='';
  if(s.image){const im=document.createElement('img');im.alt=s.title;im.src=s.image;art.appendChild(im)}else art.textContent=s.emoji;
  $('readTitle').textContent=s.title;$('readMeta').textContent=s.category;buildWords(s.text);
  const a=$('readAudio'),v=$('readVideo');a.textContent='';v.textContent='';
  if(s.audio){
    const l=document.createElement('div');l.className='lbl';l.textContent='🎧 कहानी की आवाज़ सुनें';
    const el=document.createElement('audio');el.controls=true;el.preload='none';el.src=s.audio;
    a.append(l,el);a.classList.remove('hidden');
  }else a.classList.add('hidden');
  if(s.video){
    const l=document.createElement('div');l.className='lbl';l.textContent='🎬 वीडियो देखें';
    const el=document.createElement('video');el.controls=true;el.playsInline=true;el.preload='metadata';el.src=s.video;
    if(s.image)el.poster=s.image;
    v.append(l,el);v.classList.remove('hidden');
  }else v.classList.add('hidden');
  show('reader');
}

/* ---------- आवाज़ (Text-to-Speech, अगर ऑडियो अपलोड नहीं है) ---------- */
function stopSpeech(){if('speechSynthesis'in window)window.speechSynthesis.cancel()}
function chunkText(t,max=180){
  const parts=t.split(/(?<=[।.!?\n])\s*/).filter(Boolean),out=[];let cur='';
  for(const p of parts){
    if((cur+' '+p).length>max&&cur){out.push(cur);cur=p}else cur=cur?cur+' '+p:p;
  }
  if(cur)out.push(cur);
  return out;
}
function speak(){
  const s=stories.find(x=>x.id===currentId);if(!s)return;
  if(!('speechSynthesis'in window)){alert('इस ब्राउज़र में आवाज़ उपलब्ध नहीं है।');return}
  stopSpeech();stopMedia();
  const hi=speechSynthesis.getVoices().find(v=>/^hi(-|_|$)/i.test(v.lang));
  let warned=false;
  chunkText(s.title+'. '+s.text).forEach(part=>{
    const u=new SpeechSynthesisUtterance(part);
    u.lang='hi-IN';u.rate=.88;u.pitch=1.05;if(hi)u.voice=hi;
    u.onerror=e=>{if(e.error==='canceled'||e.error==='interrupted'||warned)return;warned=true;alert('Hindi voice उपलब्ध नहीं लग रही। डिवाइस की Text-to-Speech settings में Hindi voice देखें।')};
    speechSynthesis.speak(u);
  });
}

/* ---------- Editor ---------- */
const KINDS=['image','video','audio'];
function resetFileInputs(s){
  KINDS.forEach(k=>{
    $(k+'Input').value='';$(k+'Rm').checked=false;
    const has=!!(s&&s[k]);
    $(k+'Now').textContent=has?'✅ पहले से अपलोड है। नई फ़ाइल चुनेंगे तो बदल जाएगी।':'अभी कुछ अपलोड नहीं है (ज़रूरी नहीं)';
    $(k+'RmWrap').classList.toggle('hidden',!has);
  });
  const p=$('imagePrev');p.classList.toggle('hidden',!(s&&s.image));if(s&&s.image)p.src=s.image;
  $('saveProgress').classList.add('hidden');
}
function openEditor(id=null){
  if(!isAdmin){alert('कहानी बदलने के लिए Admin login ज़रूरी है।');return}
  stopSpeech();stopMedia();editingId=id?String(id):null;const s=stories.find(x=>x.id===editingId);
  $('editorHeading').textContent=s?'कहानी Edit करें':'नई कहानी जोड़ें';
  $('titleInput').value=s?.title||'';$('emojiInput').value=s?.emoji||'📖';$('categoryInput').value=(s&&s.category!=='हिंदी कहानी')?s.category:'';
  $('textInput').value=s?.text||'';$('deleteBtn').hidden=!s;resetFileInputs(s);show('editor');
}
$('imageInput').onchange=()=>{
  const f=$('imageInput').files[0],p=$('imagePrev');
  if(f){p.src=URL.createObjectURL(f);p.classList.remove('hidden')}
};

/* ---------- Media upload ---------- */
function compressImage(file,max=1280,q=.82){
  return new Promise(res=>{
    if(!file.type.startsWith('image/')||file.type==='image/gif'||file.type==='image/svg+xml')return res(file);
    const img=new Image(),u=URL.createObjectURL(file);
    img.onload=()=>{
      const r=Math.min(1,max/Math.max(img.width,img.height)),w=Math.round(img.width*r),h=Math.round(img.height*r);
      const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
      c.toBlob(b=>{URL.revokeObjectURL(u);res(b?new File([b],'image.jpg',{type:'image/jpeg'}):file)},'image/jpeg',q);
    };
    img.onerror=()=>{URL.revokeObjectURL(u);res(file)};
    img.src=u;
  });
}
async function uploadFile(file,kind){
  const ext=((file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,5))||'bin';
  const path=`${kind}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const {error}=await supabaseClient.storage.from(BUCKET).upload(path,file,{cacheControl:'31536000',upsert:false,contentType:file.type||undefined});
  if(error)throw error;
  return supabaseClient.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
function pathFromUrl(url){
  const key='/'+BUCKET+'/',i=(url||'').indexOf(key);
  return i<0?null:decodeURIComponent(url.slice(i+key.length).split('?')[0]);
}
async function removeFiles(urls){
  const paths=urls.map(pathFromUrl).filter(Boolean);
  if(!paths.length)return;
  try{await supabaseClient.storage.from(BUCKET).remove(paths)}catch(e){console.error(e)}
}

/* ---------- Admin login (छिपा हुआ) ---------- */
function openLogin(){
  if(!configured){alert('पहले config.js में Supabase Project URL, Publishable key और Admin email भरें।');return}
  $('loginEmail').value=config.ADMIN_EMAIL;$('loginPass').value='';$('loginErr').textContent='';
  $('loginModal').classList.remove('hidden');setTimeout(()=>$('loginPass').focus(),50);
}
function closeLogin(){$('loginModal').classList.add('hidden');$('loginPass').value='';if(location.hash==='#admin')history.replaceState(null,'',location.pathname+location.search)}
// गुप्त तरीका: ऊपर "Rijual Ki Khaniya" नाम पर 5 बार जल्दी-जल्दी टैप करें, या वेबसाइट के पते के आख़िर में #admin जोड़ें
let taps=0,tapTimer=null;
$('brand').onclick=()=>{
  taps++;clearTimeout(tapTimer);tapTimer=setTimeout(()=>taps=0,2500);
  if(taps>=5){taps=0;if(!isAdmin)openLogin()}
};
{const lb=$('adminLoginBtn');if(lb)lb.onclick=openLogin}
$('loginCancel').onclick=closeLogin;
$('loginModal').addEventListener('click',e=>{if(e.target.id==='loginModal')closeLogin()});
$('loginForm').onsubmit=async e=>{
  e.preventDefault();
  const password=$('loginPass').value;if(!password)return;
  const btn=$('loginSubmit'),errBox=$('loginErr');
  const fail=(hi,tech)=>{errBox.innerHTML=esc(hi)+(tech?'<br><small>Detail: '+esc(tech)+'</small>':'')};
  btn.disabled=true;btn.textContent='जाँच रहे हैं…';errBox.textContent='';
  try{
    if(!supabaseClient){fail('Supabase शुरू नहीं हुआ। पेज रीफ़्रेश करें / इंटरनेट जाँचें।','supabase library या config समस्या');return}
    const {data,error}=await supabaseClient.auth.signInWithPassword({email:config.ADMIN_EMAIL.trim(),password});
    if(error){
      const m=(error.message||'').toLowerCase();
      if(m.includes('invalid login'))fail('Email या password गलत है। config.js का ADMIN_EMAIL वही होना चाहिए जिससे Supabase Auth में user बनाया था।',error.message);
      else if(m.includes('confirm'))fail('Email confirm नहीं हुआ। Supabase → Authentication → Users में user को Confirm करें।',error.message);
      else if(m.includes('api key')||m.includes('apikey')||error.status===401)fail('Publishable key गलत है। config.js में सही key डालें।',error.message);
      else fail('Login नहीं हुआ।',error.message);
      return;
    }
    const ok=await checkIsAdmin(data.user.id);
    if(ok!==true){
      await supabaseClient.auth.signOut();
      if(ok===null)fail('Login हो गया, पर admins table पढ़ी नहीं जा सकी। Table और SELECT policy जाँचें (setup_media.sql चलाएँ)।',window.__adminErr||'');
      else fail('Login सही है, पर यह user admins table में नहीं है। Supabase में public.admins में user_id = '+data.user.id+' डालें।');
      return;
    }
    isAdmin=true;setAdminUI();closeLogin();await loadStories();
  }catch(err){console.error(err);fail('गड़बड़ हुई।',err&&err.message)}
  finally{btn.disabled=false;btn.textContent='Login'}
};
$('adminLogoutBtn').onclick=async()=>{await supabaseClient.auth.signOut();isAdmin=false;setAdminUI();show('home');await loadStories()};

$('allBtn').onclick=()=>{stopSpeech();stopMedia();show('home')};
$('addBtn').onclick=()=>openEditor();
$('backBtn').onclick=()=>{stopSpeech();stopMedia();show('home')};
$('cancelEditBtn').onclick=()=>currentId?show('reader'):show('home');
$('editCurrentBtn').onclick=()=>openEditor(currentId);
$('speakBtn').onclick=speak;
$('pauseBtn').onclick=()=>window.speechSynthesis&&window.speechSynthesis.pause();
$('resumeBtn').onclick=()=>window.speechSynthesis&&window.speechSynthesis.resume();
$('stopBtn').onclick=()=>{stopSpeech();stopMedia()};

/* ---------- Save / Delete ---------- */
$('saveBtn').onclick=async()=>{
  if(!isAdmin){alert('Admin login ज़रूरी है।');return}
  if(busy)return;
  const title=$('titleInput').value.trim(),content=$('textInput').value.trim();
  if(!title||!content){alert('कहानी का नाम और टेक्स्ट ज़रूर भरें।');return}
  const s=editingId?stories.find(x=>x.id===editingId):null;
  const picked={};KINDS.forEach(k=>{const f=$(k+'Input').files[0];if(f)picked[k]=f});
  if(!hasMediaCols&&Object.keys(picked).length){alert('फोटो/वीडियो/ऑडियो के लिए पहले Supabase में setup_media.sql एक बार चलाएँ।');return}
  for(const k of KINDS){
    if(picked[k]&&picked[k].size>MAX_MB[k]*1024*1024*(k==='image'?4:1)){alert(`${k==='image'?'फोटो':k==='video'?'वीडियो':'ऑडियो'} बहुत बड़ा है। ज़्यादा से ज़्यादा ${MAX_MB[k]} MB चुनें।`);return}
  }
  busy=true;$('saveBtn').disabled=true;
  const prog=$('saveProgress');
  const uploaded=[],toRemove=[];
  try{
    const payload={title,content};
    if(hasMediaCols){payload.emoji=$('emojiInput').value.trim()||'📖';payload.category=$('categoryInput').value.trim()||null}
    for(const k of KINDS){
      const col=k+'_url';
      if(picked[k]){
        prog.textContent='⏳ '+(k==='image'?'फोटो':k==='video'?'वीडियो':'ऑडियो')+' अपलोड हो रहा है… कृपया रुकें (बड़ी फ़ाइल में समय लगता है)';prog.classList.remove('hidden');
        let f=picked[k];if(k==='image')f=await compressImage(f);
        if(f.size>MAX_MB[k]*1024*1024){throw new Error('फ़ाइल बहुत बड़ी है')}
        const url=await uploadFile(f,k);uploaded.push(url);payload[col]=url;
        if(s&&s[k])toRemove.push(s[k]);
      }else if($(k+'Rm').checked&&s&&s[k]){payload[col]=null;toRemove.push(s[k])}
    }
    prog.textContent='⏳ कहानी सेव हो रही है…';prog.classList.remove('hidden');
    let result,newId=editingId;
    if(editingId){
      result=await supabaseClient.from('stories').update(payload).eq('id',editingId).select('id');
      if(!result.error&&(!result.data||!result.data.length)){await removeFiles(uploaded);alert('सेव नहीं हुआ: permission नहीं मिली। setup_media.sql चलाकर policies जाँचें।');return}
    }else{
      result=await supabaseClient.from('stories').insert(payload).select('id').single();
      if(!result.error)newId=String(result.data.id);
    }
    if(result.error){
      console.error(result.error);await removeFiles(uploaded);
      alert('कहानी सेव नहीं हुई।\n'+(result.error.message||'')+'\n\nsetup_media.sql एक बार चलाकर देखें।');return;
    }
    await removeFiles(toRemove);
    await loadStories();
    if(newId&&stories.some(x=>x.id===String(newId)))openStory(newId);else show('home');
  }catch(err){
    console.error(err);await removeFiles(uploaded);
    const m=(err&&err.message)||'';
    alert('सेव नहीं हो पाया।\n'+(/row-level|policy|unauthorized|403/i.test(m)?'Storage की permission नहीं मिली — setup_media.sql चलाएँ।':/not found|bucket/i.test(m)?'Storage bucket "story-media" नहीं मिला — setup_media.sql चलाएँ।':m||'नेटवर्क जाँचें और फिर कोशिश करें।'));
  }
  finally{busy=false;$('saveBtn').disabled=false;prog.classList.add('hidden')}
};
$('deleteBtn').onclick=async()=>{
  if(!isAdmin||!editingId||busy)return;{const t=(stories.find(x=>x.id===editingId)||{}).title||'यह कहानी';if(!confirm('⚠️ क्या "'+t+'" हमेशा के लिए हटानी है?\nयह वापस नहीं आएगी।'))return}
  busy=true;
  try{
    const s=stories.find(x=>x.id===editingId);
    const {data,error}=await supabaseClient.from('stories').delete().eq('id',editingId).select('id');
    if(error||!data||!data.length){alert('कहानी हट नहीं पाई। Admin permissions जाँचें।');return}
    if(s)await removeFiles([s.image,s.video,s.audio].filter(Boolean));
    currentId=null;editingId=null;await loadStories();show('home');
  }catch(err){console.error(err);alert('नेटवर्क की दिक्कत है। फिर कोशिश करें।')}
  finally{busy=false}
};


/* ============ शब्द पर टैप = बोलकर सुनाओ  +  बोलकर पढ़ो = शब्द highlight (karaoke) ============ */
let emptyRuns=0,gotWords=false,wordEls=[],wordNorm=[],pos=0,listening=false,rec=null,lastProgress=0,stuckTimer=null,consumed={},tapSpeaking=false;
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;

function cleanWord(w){return w.replace(/[।॥.,!?;:"“”‘’'()\[\]\-–—…॥]/g,'').trim()}
function norm(w){
  return cleanWord(w).toLowerCase().normalize('NFC')
    .replace(/[​-‍़]/g,'').replace(/ँ/g,'ं');
}
function skeleton(w){return w.replace(/[ा-्ंःँ]/g,'')}
function lev(a,b){
  const m=a.length,n=b.length;if(!m)return n;if(!n)return m;
  let prev=Array.from({length:n+1},(_,i)=>i);
  for(let i=1;i<=m;i++){const cur=[i];for(let j=1;j<=n;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}
  return prev[n];
}
function similar(a,b){
  if(!a||!b)return 0;if(a===b)return 1;
  const full=1-lev(a,b)/Math.max(a.length,b.length);
  const sa=skeleton(a),sb=skeleton(b);
  const sk=(sa.length>=3&&sb.length>=3)?(1-lev(sa,sb)/Math.max(sa.length,sb.length))*0.9:0;
  return Math.max(full,sk);
}

function buildWords(text){
  const box=$('readText');box.textContent='';wordEls=[];wordNorm=[];pos=0;
  text.split(/(\s+)/).forEach(tok=>{
    if(!tok)return;
    if(/^\s+$/.test(tok)){box.appendChild(document.createTextNode(tok));return}
    const sp=document.createElement('span');sp.className='w';sp.textContent=tok;sp.dataset.i=wordEls.length;
    box.appendChild(sp);wordEls.push(sp);wordNorm.push(norm(tok));
  });
  $('micStatus').textContent=SR?'💡 अटक जाओ तो किसी शब्द पर टैप करो — वो बोलकर सुनाएगा।':'💡 किसी शब्द पर टैप करो — वो बोलकर सुनाएगा।';
}
function paint(){
  wordEls.forEach((el,i)=>{el.classList.toggle('done',i<pos);el.classList.toggle('cur',listening&&i===pos);if(i!==pos)el.classList.remove('hint')});
  const c=wordEls[pos];if(listening&&c&&c.scrollIntoView){const r=c.getBoundingClientRect();if(r.top<80||r.bottom>innerHeight-80)c.scrollIntoView({block:'center',behavior:'smooth'})}
}

// ---- टैप करके शब्द सुनना
function speakWord(raw){
  if(!('speechSynthesis'in window)){alert('इस ब्राउज़र में आवाज़ उपलब्ध नहीं है।');return}
  const w=cleanWord(raw);if(!w)return;
  stopSpeech();
  const wasListening=listening;
  if(wasListening&&rec){tapSpeaking=true;try{rec.abort()}catch(_){}}
  const u=new SpeechSynthesisUtterance(w);u.lang='hi-IN';u.rate=.65;u.pitch=1.05;
  const hi=speechSynthesis.getVoices().find(v=>/^hi(-|_|$)/i.test(v.lang));if(hi)u.voice=hi;
  const done=()=>{tapSpeaking=false;if(wasListening&&listening)startRec()};
  u.onend=done;u.onerror=done;
  speechSynthesis.speak(u);
}
$('readText').addEventListener('click',e=>{
  const el=e.target.closest&&e.target.closest('.w');if(!el)return;
  el.classList.add('tapped');setTimeout(()=>el.classList.remove('tapped'),900);
  speakWord(el.textContent);
});

// ---- बोलकर पढ़ना
// ---- मिलान: बच्चे की आवाज़ सुनकर ही शब्द हरे होते हैं ----
let startPos={},restartChecked={},lastHeard=0,restartTimes=[];
function strictSame(n,w){return n.replace(/ं/g,'')===w.replace(/ं/g,'')}
// p से शुरू करके win शब्दों में n को ढूँढो। छोटे शब्द (≤2 अक्षर: का/की/के/था) सिर्फ़ तब जब वही हों;
// बड़े शब्द थोड़े अलग उच्चारण/वर्तनी पर भी चलेंगे।
function findMatch(n,p,win,thr){
  let best=-1,bs=0;
  for(let k=p;k<Math.min(wordNorm.length,p+win);k++){
    const w=wordNorm[k];if(!w)continue;
    let sc;
    if(n.length<=2||w.length<=2){if(!strictSame(n,w)||k-p>1)continue;sc=1}   // छोटा शब्द: वही हो और बिल्कुल पास में हो
    else sc=(strictSame(n,w)?1:similar(n,w));
    sc-=(k-p)*0.04;
    if(sc>bs){bs=sc;best=k}
  }
  return bs>=thr?best:-1;
}
function alignFrom(start,words){
  const stalled=Date.now()-lastProgress>4000;           // काफ़ी देर से रुका है तो थोड़ा ज़्यादा उदार बनो
  const win=stalled?7:5,off=stalled?0.07:0;
  let p=start;
  for(const raw of words){
    const n=norm(raw);if(!n)continue;
    const k=findMatch(n,p,win,(0.58-off));
    if(k>=0&&(k===p||similar(n,wordNorm[k])>=0.66-off||strictSame(n,wordNorm[k])))p=k+1;
  }
  return p;
}
function looksLikeRestart(words){
  if(pos<4||words.length<2)return false;
  const n0=norm(words[0]),n1=norm(words[1]);if(!n0||!n1)return false;
  if(findMatch(n0,pos,2,0.75)===pos)return false;       // वही जगह है जहाँ अभी पढ़ रहे थे
  return findMatch(n0,0,1,0.75)===0&&findMatch(n1,1,1,0.75)===1;
}
function onResult(ev){
  let moved=false;
  for(let i=ev.resultIndex;i<ev.results.length;i++){
    const r=ev.results[i],text=(r[0].transcript||'').trim();if(!text)continue;
    lastHeard=Date.now();
    const words=text.split(/\s+/).filter(Boolean);
    if(!(i in startPos))startPos[i]=pos;
    if(!restartChecked[i]&&words.length>=2){
      restartChecked[i]=true;
      if(looksLikeRestart(words)){pos=0;startPos[i]=0;lastProgress=Date.now();moved=true;$('micStatus').textContent='🔄 कहानी फिर से शुरू!'}
    }
    const np=alignFrom(startPos[i],words);
    if(np>pos){pos=np;lastProgress=Date.now();moved=true}
  }
  if(moved){gotWords=true;emptyRuns=0;paint();if(pos>=wordEls.length)finishReading()}
}
function startRec(){
  if(!listening||!SR)return;
  // बहुत तेज़ी से बार-बार शुरू/बंद होने (loop) से बचाव
  const now=Date.now();restartTimes=restartTimes.filter(t=>now-t<6000);restartTimes.push(now);
  if(restartTimes.length>12){listening=false;clearInterval(stuckTimer);updateMic();$('micStatus').textContent='⚠️ माइक बार-बार बंद हो रहा है। इंटरनेट/अनुमति जाँचकर फिर 🎤 दबाएँ।';return}
  try{
    rec=new SR();rec.lang='hi-IN';rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=1;
    startPos={};restartChecked={};
    rec.onresult=onResult;
    rec.onerror=e=>{
      if(e.error==='not-allowed'||e.error==='service-not-allowed'){listening=false;updateMic();alert('माइक की अनुमति नहीं मिली। ब्राउज़र की settings में माइक allow करें।')}
      else if(e.error==='network'){listening=false;updateMic();alert('बोलकर पढ़ने के लिए इंटरनेट चाहिए।')}
      else if(e.error==='audio-capture'){listening=false;updateMic();alert('माइक नहीं मिला। दूसरा app माइक इस्तेमाल कर रहा हो तो उसे बंद करें।')}
    };
    // माइक बंद नहीं रहता: सेशन ख़त्म होते ही तुरंत अपने-आप फिर चालू (पढ़ाई की जगह वही रहती है)
    rec.onend=()=>{if(listening&&!tapSpeaking)setTimeout(startRec,60)};
    rec.start();
  }catch(err){console.error(err)}
}
function updateMic(){
  const b=$('micBtn');if(!b)return;
  b.textContent=listening?'⏹ पढ़ना बंद करें':'🎤 बोलकर पढ़ें';
  const rb=$('restartBtn');if(rb)rb.classList.toggle('hidden',!listening);
  $('micStatus').textContent=listening?'🎙️ सुन रहा हूँ… कहानी पढ़ना शुरू करो! (अटको तो शब्द पर टैप करो)':'💡 अटक जाओ तो किसी शब्द पर टैप करो — वो बोलकर सुनाएगा।';
  paint();
}
function startListening(){
  if(!SR){alert('बोलकर पढ़ना इस ब्राउज़र में नहीं चलता। Android के Chrome में खोलें।');return}
  try{if(!localStorage.getItem('rk_mic_ok')){
    if(!confirm('🎤 बच्चे की आवाज़ पहचानने के लिए फ़ोन की speech service (Google) इस्तेमाल होती है और माइक की अनुमति चाहिए। क्या आगे बढ़ें?'))return;
    localStorage.setItem('rk_mic_ok','1');
  }}catch(_){}
  stopSpeech();stopMedia();
  pos=0;emptyRuns=0;restartTimes=[];listening=true;lastProgress=lastHeard=Date.now();updateMic();startRec();
  clearInterval(stuckTimer);
  stuckTimer=setInterval(()=>{                       // 5 सेकंड कोई शब्द नहीं बना तो आगे वाले शब्द पर इशारा
    if(listening&&wordEls[pos]&&Date.now()-lastProgress>7000)wordEls[pos].classList.add('hint');
    if(listening&&Date.now()-lastHeard>120000){stopListening();$('micStatus').textContent='🔇 2 मिनट से आवाज़ नहीं आई, इसलिए माइक बंद किया। फिर पढ़ना हो तो 🎤 दबाएँ।'}
  },1000);
}
function stopListening(){
  const was=listening;listening=false;clearInterval(stuckTimer);
  if(rec){try{rec.abort()}catch(_){}rec=null}
  if(was&&$('micBtn'))updateMic();
}
function finishReading(){
  stopListening();wordEls.forEach(el=>{el.classList.add('done');el.classList.remove('cur','hint')});
  $('micStatus').textContent='🎉 शाबाश! तुमने पूरी कहानी पढ़ ली!';
}
if($('restartBtn'))$('restartBtn').onclick=()=>{pos=0;startPos={};restartChecked={};lastProgress=lastHeard=Date.now();paint();$('micStatus').textContent='🔄 फिर से शुरू! पहले शब्द से पढ़ो।'};
if($('micBtn')){
  if(!SR)$('micBtn').classList.add('hidden');
  $('micBtn').onclick=()=>listening?stopListening():startListening();
}


/* ============ 🎮 हर कहानी का Quiz अपने-आप बनता है ============ */
const QZ_STOP=new Set(['लेकिन','क्योंकि','उसने','उसके','उसकी','अपनी','अपने','अपना','तभी','हमेशा','सभी','वहाँ','यहाँ','बहुत','उन्होंने','उनकी','उनके','इसलिए','अचानक','कुछ','कोई','उन्हें','मेरी','मेरा','तुम्हारी','तुम्हारा','हमारी','हमारा','करने','करना','होता','होती','जाता','जाती','वाला','वाली','वाले','लगा','लगी','लगे','रहता','रहती','रहते','बोला','बोली','पूछा','कहा','फिर','सच-सच','आखिर','आख़िर','जैसे','जिससे','जिसे','सब','सबने','किसी','बाद','पहले','साथ','लिए']);
const QZ_WRONG_MORALS=['झूठ बोलना अच्छा है','दूसरों की चीज़ें रख लेनी चाहिए','मेहनत से बचना चाहिए','किसी की मदद नहीं करनी चाहिए','घमंड करना अच्छी बात है'];
let qz={qs:[],i:0,points:0,pick:null,locked:false,story:null};
const shuffleArr=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const isDev=w=>/[ऀ-ॿ]/.test(w);
const goodWord=w=>w&&isDev(w)&&Array.from(w).length>=4&&!QZ_STOP.has(w);
function getMoral(text){const m=(text||'').match(/सीख\s*[:：]\s*([^\n]+)/);return m?m[1].trim().replace(/[.।\s]+$/,''):null}
const plainTok=t=>!/[-–—]/.test(t);
function uniqueWords(text){return [...new Set((text||'').split(/\s+/).filter(plainTok).map(cleanWord).filter(goodWord))]}

function buildQuiz(story){
  const qs=[],others=stories.filter(x=>x.id!==story.id);
  // 1) कहानी का नाम
  const wrongTitles=shuffleArr([...new Set(others.map(o=>o.title).filter(t=>t&&t!==story.title))]).slice(0,3);
  if(wrongTitles.length>=1)qs.push({kind:'title',q:'इस कहानी का नाम क्या है?',opts:shuffleArr([story.title,...wrongTitles]),ans:story.title,exp:'कहानी का नाम “'+story.title+'” है।',hint:'कहानी के सबसे ऊपर लिखा नाम याद करो।'});
  // 2) सीख
  const moral=getMoral(story.text);
  let moralQ=null;
  if(moral){
    let wrong=[...new Set(others.map(o=>getMoral(o.text)).filter(m=>m&&m!==moral))];wrong=shuffleArr(wrong).slice(0,3);
    for(const g of shuffleArr(QZ_WRONG_MORALS)){if(wrong.length>=3)break;wrong.push(g)}
    moralQ={kind:'moral',q:'इस कहानी से हमें क्या सीख मिलती है?',opts:shuffleArr([moral,...wrong]),ans:moral,exp:'कहानी की सीख: '+moral+'।',hint:'कहानी के आख़िर में लिखी सीख पढ़ो।'};
  }
  // 3) खाली जगह भरो (वाक्यों से)
  const body=(story.text||'').replace(/सीख\s*[:：][^\n]*/g,'');
  const sents=body.split(/(?<=[।!?][”’"']?|\n)/).map(x=>x.trim()).filter(x=>{const n=x.split(/\s+/).length,q1=(x.match(/“/g)||[]).length,q2=(x.match(/”/g)||[]).length;return n>=5&&n<=26&&q1===q2});   // अधूरे उद्धरण वाले वाक्य छोड़ो
  const pool=[...new Set([...uniqueWords(body),...others.flatMap(o=>uniqueWords(o.text))])];
  const want=5-qs.length-(moralQ?1:0);
  const order=shuffleArr(sents.map((x,i)=>i)),made=[];
  for(const si of order){
    if(made.length>=want)break;
    const sent=sents[si],toks=sent.split(/\s+/);
    const cands=toks.map((t,i)=>({t,i,w:cleanWord(t)})).filter(c=>plainTok(c.t)&&goodWord(c.w)&&c.t.includes(c.w));
    if(!cands.length)continue;
    const c=cands[Math.floor(Math.random()*cands.length)];
    const inSent=new Set(toks.map(cleanWord));
    const stem=x=>Array.from(x).slice(0,3).join('');
    const dis=shuffleArr(pool.filter(w=>w!==c.w&&!inSent.has(w)&&stem(w)!==stem(c.w)))
      .sort((a,b)=>Math.abs(Array.from(a).length-Array.from(c.w).length)-Math.abs(Array.from(b).length-Array.from(c.w).length)).slice(0,3);
    if(dis.length<3)continue;
    const blanked=toks.map((t,i)=>i===c.i?t.replace(c.w,'_____'):t).join(' ');
    made.push({si,item:{kind:'cloze',q:'खाली जगह भरो:\n'+blanked,opts:shuffleArr([c.w,...dis]),ans:c.w,exp:'सही वाक्य: '+sent,hint:'वाक्य को ध्यान से पढ़ो। सही शब्द “'+Array.from(c.w)[0]+'” से शुरू होता है।'}});
  }
  made.sort((a,b)=>a.si-b.si).forEach(m=>qs.push(m.item));
  if(moralQ)qs.push(moralQ);
  return qs;
}

function qzShow(){
  const item=qz.qs[qz.i],n=qz.qs.length;
  qz.pick=null;qz.locked=false;
  $('qzCount').textContent='सवाल '+(qz.i+1)+' / '+n;$('qzScore').textContent='⭐ '+qz.points+' अंक';
  $('qzBar').style.width=(qz.i/n*100)+'%';$('qzQ').textContent=item.q;
  const box=$('qzOpts');box.textContent='';
  item.opts.forEach((txt,k)=>{
    const b=document.createElement('button');b.className='opt';b.textContent=['A','B','C','D'][k]+'. '+txt;
    b.onclick=()=>{if(qz.locked)return;qz.pick=k;[...box.children].forEach((x,j)=>x.classList.toggle('sel',j===k));$('qzCheck').disabled=false};
    box.appendChild(b);
  });
  $('qzFeedback').classList.add('hidden');$('qzCheck').classList.remove('hidden');$('qzCheck').disabled=true;$('qzNext').classList.add('hidden');
  $('qzGame').classList.remove('hidden');$('qzResult').classList.add('hidden');
}
function startQuiz(storyId){
  const s=stories.find(x=>x.id===String(storyId||currentId));if(!s)return;
  stopSpeech();stopMedia();
  const qs=buildQuiz(s);
  qz={qs,i:0,points:0,pick:null,locked:false,story:s};
  $('qzTitle').textContent='🎮 '+s.title;
  show('quiz');
  if(qs.length<2){
    $('qzGame').classList.add('hidden');$('qzResult').classList.remove('hidden');
    $('qzFinal').textContent='😅';$('qzMsg').textContent='इस कहानी का quiz अभी नहीं बन पाया (कहानी बहुत छोटी है)। दूसरी कहानी आज़माओ!';
    return;
  }
  qzShow();
}
$('qzCheck').onclick=()=>{
  if(qz.pick===null||qz.locked)return;qz.locked=true;
  const item=qz.qs[qz.i],box=$('qzOpts'),right=item.opts.indexOf(item.ans);
  [...box.children].forEach((b,k)=>{b.disabled=true;if(k===right)b.classList.add('good');if(k===qz.pick&&k!==right)b.classList.add('bad')});
  const ok=qz.pick===right;if(ok)qz.points++;
  $('qzFeedback').textContent=ok?'शाबाश! ⭐ सही जवाब। '+item.exp:'कोई बात नहीं! 😊 '+item.exp+'\nसंकेत: '+item.hint;
  $('qzFeedback').classList.remove('hidden');$('qzScore').textContent='⭐ '+qz.points+' अंक';
  $('qzBar').style.width=((qz.i+1)/qz.qs.length*100)+'%';
  $('qzCheck').classList.add('hidden');$('qzNext').classList.remove('hidden');
  $('qzNext').textContent=qz.i===qz.qs.length-1?'नतीजा देखें 🏆':'अगला सवाल →';
};
$('qzNext').onclick=()=>{
  if(qz.i<qz.qs.length-1){qz.i++;qzShow();return}
  const n=qz.qs.length;$('qzGame').classList.add('hidden');$('qzResult').classList.remove('hidden');
  $('qzFinal').textContent=qz.points+' / '+n;
  $('qzMsg').textContent=qz.points===n?'कमाल! पूरे अंक! 🏆':qz.points>=n*0.6?'बहुत बढ़िया! कहानी फिर पढ़कर दोबारा खेलो। ⭐':'अच्छी कोशिश! कहानी फिर पढ़कर एक बार और खेलो। 😊';
};
$('qzAgain').onclick=()=>startQuiz(qz.story&&qz.story.id);   // नए सवाल बनते हैं
$('qzReadBtn').onclick=()=>{if(qz.story)openStory(qz.story.id)};
$('qzBackBtn').onclick=()=>show('home');
$('quizBtn').onclick=()=>startQuiz(currentId);

/* ---------- शुरुआत ---------- */
(async()=>{
  setAdminUI();
  const st=$('adminStatus');
  if(st){
    st.innerHTML=(configured?'✅ config.js भरा हुआ है':'❌ config.js अभी खाली है — उसमें Supabase URL, key और email भरें')+'<br>'+(window.supabase?'✅ Supabase चालू':'❌ Supabase library load नहीं हुई (इंटरनेट जाँचें)');
  }
  if(!configured){$('cards').innerHTML='<p>Setup बाकी है। config.js में Supabase URL, Publishable key और Admin email भरने के बाद वेबसाइट चलने लगेगी।</p>';return}
  if(!window.supabase){if(!loadFromCache())$('cards').innerHTML='<p>Supabase library load नहीं हुई। इंटरनेट कनेक्शन जाँचें।</p>';return}
  supabaseClient=window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY);
  supabaseClient.auth.onAuthStateChange(event=>{
    if(event==='SIGNED_OUT'&&isAdmin){isAdmin=false;setAdminUI();if(!$('editor').classList.contains('hidden'))show('home')}
  });
  try{
    const {data}=await supabaseClient.auth.getSession();
    if(data?.session){
      const ok=await checkIsAdmin(data.session.user.id);
      if(ok){isAdmin=true;setAdminUI()}
      else if(ok===false)await supabaseClient.auth.signOut();
    }
  }catch(err){console.error(err)}
  await loadStories();
  window.addEventListener('online',()=>loadStories());
  if((location.hash==='#admin'||document.body.dataset.admin)&&!isAdmin)openLogin();
})();
