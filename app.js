const $ = id => document.getElementById(id);
let supabaseClient = null, stories = [], currentId = null, editingId = null, isAdmin = false, busy = false;
const config = window.APP_CONFIG || {};
const configured = config.SUPABASE_URL && !config.SUPABASE_URL.includes("PASTE_") &&
  config.SUPABASE_PUBLISHABLE_KEY && !config.SUPABASE_PUBLISHABLE_KEY.includes("PASTE_") &&
  config.ADMIN_EMAIL && !config.ADMIN_EMAIL.includes("PASTE_");

function esc(s){return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function show(section){['home','reader','editor'].forEach(id=>$(id).classList.toggle('hidden',id!==section));window.scrollTo({top:0,behavior:'smooth'})}
function setAdminUI(){document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',!isAdmin));$('adminLoginBtn').classList.toggle('hidden',isAdmin);$('adminLogoutBtn').classList.toggle('hidden',!isAdmin)}
function fromDb(row){return {id:String(row.id),title:row.title,text:row.content,emoji:'📖',category:'हिंदी कहानी'}}

async function checkIsAdmin(userId){
  const {data,error}=await supabaseClient.from('admins').select('user_id').eq('user_id',userId).maybeSingle();
  if(error){console.error(error);return null}
  return !!data;
}

async function loadStories(){
  $('cards').innerHTML='<p class="muted">कहानियाँ लोड हो रही हैं…</p>';
  if(!configured){$('cards').innerHTML='<p>वेबसाइट सेटअप पूरा नहीं हुआ है। Admin को config.js में Supabase की जानकारी भरनी होगी।</p>';return}
  const {data,error}=await supabaseClient.from('stories').select('id,title,content,created_at').order('created_at',{ascending:false});
  if(error){console.error(error);$('cards').innerHTML='<p>कहानियाँ लोड नहीं हुईं। इंटरनेट और Supabase की policies/table जाँचें।</p>';return}
  stories=(data||[]).map(fromDb);
  render();
}
function render(){
  $('count').textContent=stories.length+' कहानियाँ';
  if(!stories.length){$('cards').innerHTML='<p class="muted">अभी कोई कहानी नहीं है। Admin login करके पहली कहानी जोड़ सकता है।</p>';return}
  $('cards').innerHTML=stories.map(s=>`<button class="storycard" data-id="${esc(s.id)}"><span class="emoji">${esc(s.emoji)}</span><strong>${esc(s.title)}</strong><small>${esc(s.category)} · पढ़ें और सुनें →</small></button>`).join('');
  document.querySelectorAll('.storycard').forEach(b=>b.onclick=()=>openStory(b.dataset.id));
}
function openStory(id){const s=stories.find(x=>x.id===String(id));if(!s)return;currentId=s.id;$('readEmoji').textContent=s.emoji;$('readTitle').textContent=s.title;$('readMeta').textContent=s.category;$('readText').textContent=s.text;show('reader')}

/* ---------- आवाज़ (Text-to-Speech) ---------- */
function stopSpeech(){if('speechSynthesis'in window)window.speechSynthesis.cancel()}
// लंबी कहानी को छोटे टुकड़ों में बाँटते हैं, वरना कई मोबाइल ब्राउज़र बीच में आवाज़ बंद कर देते हैं
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
  stopSpeech();
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
function openEditor(id=null){
  if(!isAdmin){alert('कहानी बदलने के लिए Admin login ज़रूरी है।');return}
  stopSpeech();editingId=id?String(id):null;const s=stories.find(x=>x.id===editingId);
  $('editorHeading').textContent=s?'कहानी Edit करें':'नई कहानी जोड़ें';
  $('titleInput').value=s?.title||'';$('textInput').value=s?.text||'';$('deleteBtn').hidden=!s;show('editor');
}

/* ---------- Admin login (password छिपा हुआ रहता है) ---------- */
function openLogin(){
  if(!configured){alert('पहले config.js में Supabase Project URL, Publishable key और Admin email भरें।');return}
  $('loginEmail').value=config.ADMIN_EMAIL;$('loginPass').value='';$('loginErr').textContent='';
  $('loginModal').classList.remove('hidden');setTimeout(()=>$('loginPass').focus(),50);
}
function closeLogin(){$('loginModal').classList.add('hidden');$('loginPass').value=''}
$('adminLoginBtn').onclick=openLogin;
$('loginCancel').onclick=closeLogin;
$('loginModal').addEventListener('click',e=>{if(e.target.id==='loginModal')closeLogin()});
$('loginForm').onsubmit=async e=>{
  e.preventDefault();
  const password=$('loginPass').value;if(!password)return;
  const btn=$('loginSubmit');btn.disabled=true;btn.textContent='जाँच रहे हैं…';$('loginErr').textContent='';
  try{
    const {data,error}=await supabaseClient.auth.signInWithPassword({email:config.ADMIN_EMAIL,password});
    if(error){$('loginErr').textContent='Login नहीं हुआ। Password जाँचें और फिर कोशिश करें।';return}
    if((await checkIsAdmin(data.user.id))!==true){await supabaseClient.auth.signOut();$('loginErr').textContent='यह अकाउंट Admin नहीं है (admins table जाँचें)।';return}
    isAdmin=true;setAdminUI();closeLogin();await loadStories();
  }catch(err){console.error(err);$('loginErr').textContent='नेटवर्क की दिक्कत है। इंटरनेट जाँचकर फिर कोशिश करें।'}
  finally{btn.disabled=false;btn.textContent='Login'}
};
$('adminLogoutBtn').onclick=async()=>{await supabaseClient.auth.signOut();isAdmin=false;setAdminUI();show('home');await loadStories()};

$('allBtn').onclick=()=>{stopSpeech();show('home')};
$('addBtn').onclick=()=>openEditor();
$('backBtn').onclick=()=>{stopSpeech();show('home')};
$('cancelEditBtn').onclick=()=>currentId?show('reader'):show('home');
$('editCurrentBtn').onclick=()=>openEditor(currentId);
$('speakBtn').onclick=speak;
$('pauseBtn').onclick=()=>window.speechSynthesis&&window.speechSynthesis.pause();
$('resumeBtn').onclick=()=>window.speechSynthesis&&window.speechSynthesis.resume();
$('stopBtn').onclick=stopSpeech;

$('saveBtn').onclick=async()=>{
  if(!isAdmin){alert('Admin login ज़रूरी है।');return}
  if(busy)return;
  const title=$('titleInput').value.trim(),content=$('textInput').value.trim();
  if(!title||!content){alert('कहानी का नाम और टेक्स्ट ज़रूर भरें।');return}
  busy=true;$('saveBtn').disabled=true;
  try{
    let result,newId=editingId;
    if(editingId){
      result=await supabaseClient.from('stories').update({title,content}).eq('id',editingId).select('id');
      if(!result.error&&(!result.data||!result.data.length)){alert('सेव नहीं हुआ: permission नहीं मिली। Supabase की admin policies जाँचें।');return}
    }else{
      result=await supabaseClient.from('stories').insert({title,content}).select('id').single();
      if(!result.error)newId=String(result.data.id);
    }
    if(result.error){console.error(result.error);alert('कहानी सेव नहीं हुई। Database permissions जाँचें।');return}
    await loadStories();
    if(newId&&stories.some(s=>s.id===String(newId)))openStory(newId);else show('home');
  }catch(err){console.error(err);alert('नेटवर्क की दिक्कत है। फिर कोशिश करें।')}
  finally{busy=false;$('saveBtn').disabled=false}
};
$('deleteBtn').onclick=async()=>{
  if(!isAdmin||!editingId||busy)return;if(!confirm('क्या यह कहानी हटानी है?'))return;
  busy=true;
  try{
    const {data,error}=await supabaseClient.from('stories').delete().eq('id',editingId).select('id');
    if(error||!data||!data.length){alert('कहानी हट नहीं पाई। Admin permissions जाँचें।');return}
    currentId=null;editingId=null;await loadStories();show('home');
  }catch(err){console.error(err);alert('नेटवर्क की दिक्कत है। फिर कोशिश करें।')}
  finally{busy=false}
};

/* ---------- शुरुआत ---------- */
(async()=>{
  setAdminUI();
  if(!configured){$('cards').innerHTML='<p>Setup बाकी है। config.js में Supabase URL, Publishable key और Admin email भरने के बाद वेबसाइट चलने लगेगी।</p>';return}
  if(!window.supabase){$('cards').innerHTML='<p>Supabase library load नहीं हुई। इंटरनेट कनेक्शन जाँचें।</p>';return}
  supabaseClient=window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY);
  // Session खत्म/logout होने पर Admin बटन अपने-आप बंद हो जाएँ
  supabaseClient.auth.onAuthStateChange((event)=>{
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
})();
