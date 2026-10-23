const $ = id => document.getElementById(id);
let supabaseClient = null, stories = [], currentId = null, editingId = null, isAdmin = false, deferredPrompt = null;
const config = window.APP_CONFIG || {};
const configured = config.SUPABASE_URL && !config.SUPABASE_URL.includes("PASTE_") &&
  config.SUPABASE_PUBLISHABLE_KEY && !config.SUPABASE_PUBLISHABLE_KEY.includes("PASTE_") &&
  config.ADMIN_EMAIL && !config.ADMIN_EMAIL.includes("PASTE_");

function esc(s){return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function show(section){['home','reader','editor'].forEach(id=>$(id).classList.toggle('hidden',id!==section));window.scrollTo({top:0,behavior:'smooth'})}
function setAdminUI(){document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',!isAdmin));$('adminLoginBtn').classList.toggle('hidden',isAdmin);$('adminLogoutBtn').classList.toggle('hidden',!isAdmin)}
function fromDb(row){return {id:row.id,title:row.title,text:row.content,emoji:row.emoji||'📖',category:row.category||'हिंदी कहानी'}}
async function loadStories(){
  $('cards').innerHTML='<p class="muted">कहानियाँ लोड हो रही हैं…</p>';
  if(!configured){$('cards').innerHTML='<p>वेबसाइट सेटअप पूरा नहीं हुआ है। Admin को config.js में Supabase की जानकारी भरनी होगी।</p>';return}
  const {data,error}=await supabaseClient.from('stories').select('id,title,content,created_at').order('created_at',{ascending:false});
  if(error){console.error(error);$('cards').innerHTML='<p>कहानियाँ लोड नहीं हुईं। Supabase में policies और table की जाँच करें।</p>';return}
  stories=(data||[]).map(fromDb);
  render();
}
function render(){
  $('count').textContent=stories.length+' कहानियाँ';
  if(!stories.length){$('cards').innerHTML='<p class="muted">अभी कोई कहानी नहीं है। Admin login करके पहली कहानी जोड़ सकता है।</p>';return}
  $('cards').innerHTML=stories.map(s=>`<button class="storycard" data-id="${esc(s.id)}"><span class="emoji">${esc(s.emoji||'📖')}</span><strong>${esc(s.title)}</strong><small>${esc(s.category||'हिंदी कहानी')} · पढ़ें और सुनें →</small></button>`).join('');
  document.querySelectorAll('.storycard').forEach(b=>b.onclick=()=>openStory(b.dataset.id));
}
function openStory(id){const s=stories.find(x=>x.id===id);if(!s)return;currentId=id;$('readEmoji').textContent=s.emoji||'📖';$('readTitle').textContent=s.title;$('readMeta').textContent=s.category||'हिंदी कहानी';$('readText').textContent=s.text;show('reader')}
function stopSpeech(){if('speechSynthesis'in window)window.speechSynthesis.cancel()}
function speak(){const s=stories.find(x=>x.id===currentId);if(!s)return;if(!('speechSynthesis'in window)){alert('इस ब्राउज़र में आवाज़ उपलब्ध नहीं है।');return}stopSpeech();const u=new SpeechSynthesisUtterance(s.title+'. '+s.text);u.lang='hi-IN';u.rate=.88;u.pitch=1.05;const hi=speechSynthesis.getVoices().find(v=>/^hi(-|$)/i.test(v.lang));if(hi)u.voice=hi;u.onerror=()=>alert('Hindi voice उपलब्ध नहीं लग रही। डिवाइस की Text-to-Speech settings में Hindi voice देखें।');speechSynthesis.speak(u)}
async function openEditor(id=null){
 if(!isAdmin){alert('कहानी बदलने के लिए Admin login ज़रूरी है।');return}
 stopSpeech();editingId=id;const s=stories.find(x=>x.id===id);
 $('editorHeading').textContent=s?'कहानी Edit करें':'नई कहानी जोड़ें';$('titleInput').value=s?.title||'';$('emojiInput').value=s?.emoji||'📖';$('categoryInput').value=s?.category||'';$('textInput').value=s?.text||'';$('deleteBtn').hidden=!s;show('editor');
}
$('adminLoginBtn').onclick=async()=>{
 if(!configured){alert('पहले config.js में Supabase Project URL, Publishable key और Admin email भरें।');return}
 const password=prompt('Admin password डालें:');if(password===null)return;
 const {data,error}=await supabaseClient.auth.signInWithPassword({email:config.ADMIN_EMAIL,password});
 if(error){alert('Login नहीं हुआ। Password जाँचें और फिर कोशिश करें।');return}
 const {data:adminRow,error:adminErr}=await supabaseClient.from('admins').select('user_id').eq('user_id',data.user.id).maybeSingle();
 if(adminErr||!adminRow){await supabaseClient.auth.signOut();alert('यह अकाउंट Admin नहीं है।');return}
 isAdmin=true;setAdminUI();alert('Admin login सफल!');await loadStories();
};
$('adminLogoutBtn').onclick=async()=>{await supabaseClient.auth.signOut();isAdmin=false;setAdminUI();show('home');await loadStories()};
$('allBtn').onclick=()=>{stopSpeech();show('home')};$('addBtn').onclick=()=>openEditor();$('backBtn').onclick=()=>{stopSpeech();show('home')};$('cancelEditBtn').onclick=()=>currentId?show('reader'):show('home');$('editCurrentBtn').onclick=()=>openEditor(currentId);
$('speakBtn').onclick=speak;$('pauseBtn').onclick=()=>window.speechSynthesis&&window.speechSynthesis.pause();$('resumeBtn').onclick=()=>window.speechSynthesis&&window.speechSynthesis.resume();$('stopBtn').onclick=stopSpeech;
$('saveBtn').onclick=async()=>{
 if(!isAdmin){alert('Admin login ज़रूरी है।');return}
 const title=$('titleInput').value.trim(),content=$('textInput').value.trim();
 if(!title||!content){alert('कहानी का नाम और टेक्स्ट ज़रूर भरें।');return}
 const payload={title,content};
 let result;
 if(editingId) result=await supabaseClient.from('stories').update(payload).eq('id',editingId);
 else result=await supabaseClient.from('stories').insert(payload);
 if(result.error){console.error(result.error);alert('कहानी सेव नहीं हुई। Database permissions जाँचें।');return}
 currentId=editingId;await loadStories();
 if(!editingId){const latest=stories.find(s=>s.title===title);currentId=latest?.id||null}
 if(currentId)openStory(currentId);else show('home');
};
$('deleteBtn').onclick=async()=>{
 if(!isAdmin||!editingId)return;if(!confirm('क्या यह कहानी हटानी है?'))return;
 const {error}=await supabaseClient.from('stories').delete().eq('id',editingId);
 if(error){alert('कहानी हट नहीं पाई।');return}
 currentId=null;editingId=null;await loadStories();show('home');
};
$('allBtn').onclick=()=>{stopSpeech();show('home')};
(async()=>{
 setAdminUI();
 if(!configured){$('cards').innerHTML='<p>Setup बाकी है। config.js में Supabase URL, Publishable key और Admin email भरने के बाद वेबसाइट चलने लगेगी।</p>';return}
 if(!window.supabase){$('cards').innerHTML='<p>Supabase library load नहीं हुई। इंटरनेट कनेक्शन जाँचें।</p>';return}
 supabaseClient=window.supabase.createClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY);
 const {data}=await supabaseClient.auth.getSession();
 if(data?.session){
   const {data:adminRow}=await supabaseClient.from('admins').select('user_id').eq('user_id',data.session.user.id).maybeSingle();
   if(adminRow){isAdmin=true;setAdminUI()}
   else await supabaseClient.auth.signOut();
 }
 await loadStories();
})();
