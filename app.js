/* ============ शब्द पर टैप = बोलकर सुनाओ  +  बोलकर पढ़ें = शब्द highlight (karaoke) & TTS ============ */
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

// ---- Robust TTS & Paragraph State Management ----
let speechState = 'stopped'; // 'stopped', 'playing', 'paused'
let speechChunks = [];
let currentChunkIdx = 0;
let isProgrammaticStop = false;

function chunkText(t,max=160){
  const parts=t.split(/(?<=[।.!?\n])\s*/).filter(Boolean),out=[];let cur='';
  for(const p of parts){
    if((cur+' '+p).length>max&&cur){out.push(cur);cur=p}else cur=cur?cur+' '+p:p;
  }
  if(cur)out.push(cur);
  return out;
}

function buildSpeechChunks(text){
  speechChunks = [];
  const rawChunks = chunkText(text, 160);
  let currentWordIdx = 0;
  rawChunks.forEach(chunkStr=>{
    const chunkWords = chunkStr.split(/\s+/).filter(Boolean);
    const startIndex = currentWordIdx;
    const endIndex = Math.min(wordEls.length - 1, currentWordIdx + chunkWords.length - 1);
    currentWordIdx = endIndex + 1;
    speechChunks.push({
      text: chunkStr,
      startIndex: startIndex,
      endIndex: endIndex
    });
  });
}

function updateTTSButtons(){
  const speakBtn = $('speakBtn');
  const pauseBtn = $('pauseBtn');
  const resumeBtn = $('resumeBtn');
  const stopBtn = $('stopBtn');
  const restartBtn = $('restartBtn');
  if(!speakBtn) return;

  if(speechState === 'playing'){
    speakBtn.textContent = '🔊 पढ़ रहा है...';
    if(pauseBtn) pauseBtn.classList.remove('hidden');
    if(resumeBtn) resumeBtn.classList.add('hidden');
    if(stopBtn) stopBtn.classList.remove('hidden');
    if(restartBtn) restartBtn.classList.remove('hidden');
  } else if(speechState === 'paused'){
    speakBtn.textContent = '🔊 कहानी सुनें';
    if(pauseBtn) pauseBtn.classList.add('hidden');
    if(resumeBtn) resumeBtn.classList.remove('hidden');
    if(stopBtn) stopBtn.classList.remove('hidden');
    if(restartBtn) restartBtn.classList.remove('hidden');
  } else {
    speakBtn.textContent = '🔊 कहानी सुनें';
    if(pauseBtn) pauseBtn.classList.remove('hidden');
    if(resumeBtn) resumeBtn.classList.add('hidden');
    if(stopBtn) stopBtn.classList.remove('hidden');
    if(restartBtn) restartBtn.classList.add('hidden');
  }
}

function stopSpeech(){
  speechState = 'stopped';
  currentChunkIdx = 0;
  pos = 0;
  paint();
  if('speechSynthesis' in window){
    isProgrammaticStop = true;
    window.speechSynthesis.cancel();
    setTimeout(()=>{isProgrammaticStop = false;}, 100);
  }
  updateTTSButtons();
}

function pauseSpeech(){
  if(speechState !== 'playing') return;
  speechState = 'paused';
  if('speechSynthesis' in window){
    isProgrammaticStop = true;
    window.speechSynthesis.cancel(); // Safe fallback for mobile browsers where native pause/resume fails
    setTimeout(()=>{isProgrammaticStop = false;}, 100);
  }
  updateTTSButtons();
}

function resumeSpeech(){
  if(speechState !== 'paused'){
    if(speechState === 'stopped') startTTS(0);
    return;
  }
  speechState = 'playing';
  startTTS(currentChunkIdx);
}

function jumpToWordIndex(wordIdx){
  stopSpeech();
  let targetChunk = 0;
  for(let i=0; i<speechChunks.length; i++){
    if(wordIdx >= speechChunks[i].startIndex && wordIdx <= speechChunks[i].endIndex){
      targetChunk = i;
      break;
    } else if(wordIdx < speechChunks[i].startIndex){
      targetChunk = Math.max(0, i - 1);
      break;
    } else {
      targetChunk = i;
    }
  }
  currentChunkIdx = targetChunk;
  pos = speechChunks[targetChunk] ? speechChunks[targetChunk].startIndex : wordIdx;
  paint();
  startTTS(currentChunkIdx);
}

function startTTS(chunkIndex=0){
  const s = stories.find(x => x.id === currentId); if(!s) return;
  if(!('speechSynthesis' in window)){alert('इस ब्राउज़र में आवाज़ उपलब्ध नहीं है।');return}
  if(speechState === 'stopped' || speechState === 'paused') stopMedia();

  speechState = 'playing';
  currentChunkIdx = chunkIndex;
  updateTTSButtons();

  const voices = speechSynthesis.getVoices();
  const hi = voices.find(v => /^hi(-|_|$)/i.test(v.lang)) || voices.find(v => /hi/i.test(v.lang));

  if(chunkIndex >= speechChunks.length){
    stopSpeech();
    return;
  }

  const chunk = speechChunks[chunkIndex];
  pos = chunk.startIndex;
  paint();

  const u = new SpeechSynthesisUtterance(chunk.text);
  u.lang = 'hi-IN'; u.rate = .88; u.pitch = 1.05;
  if(hi) u.voice = hi;

  let warned = false;
  u.onend = ()=>{
    if(isProgrammaticStop) return;
    if(speechState === 'playing'){
      currentChunkIdx++;
      if(currentChunkIdx < speechChunks.length){
        startTTS(currentChunkIdx);
      } else {
        stopSpeech();
      }
    }
  };
  u.onerror = e=>{
    if(e.error === 'canceled' || e.error === 'interrupted' || isProgrammaticStop || warned) return;
    warned = true;
  };

  speechSynthesis.speak(u);
}

function speak(){
  if(speechState === 'paused'){
    resumeSpeech();
  } else if(speechState === 'playing'){
    stopSpeech();
    startTTS(0);
  } else {
    startTTS(0);
  }
}

function buildWords(text){
  const box=$('readText');box.textContent='';wordEls=[];wordNorm=[];pos=0;
  
  // Paragraphs support
  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
  paragraphs.forEach((paraText, pIndex)=>{
    const pEl = document.createElement('div');
    pEl.className = 'story-paragraph';
    pEl.style.marginBottom = '14px';
    
    // Paragraph click -> start reading from this paragraph
    pEl.addEventListener('click', (e)=>{
      if(e.target.closest('.w')) return; // handled by word tap
      const firstWord = pEl.querySelector('.w');
      if(firstWord){
        const idx = parseInt(firstWord.dataset.i, 10);
        jumpToWordIndex(idx);
      }
    });

    paraText.split(/(\s+)/).forEach(tok=>{
      if(!tok)return;
      if(/^\s+$/.test(tok)){pEl.appendChild(document.createTextNode(tok));return}
      const sp=document.createElement('span');sp.className='w';sp.textContent=tok;sp.dataset.i=wordEls.length;sp.dataset.para=pIndex;
      pEl.appendChild(sp);wordEls.push(sp);wordNorm.push(norm(tok));
    });
    box.appendChild(pEl);
  });

  buildSpeechChunks(text);
  $('micStatus').textContent=SR?'💡 अटक जाओ तो किसी शब्द पर टैप करो — वो बोलकर सुनाएगा।':'💡 किसी शब्द पर टैप करो — वो बोलकर सुनाएगा।';
}
function paint(){
  wordEls.forEach((el,i)=>{el.classList.toggle('done',i<pos);el.classList.toggle('cur',(speechState==='playing'||listening)&&i===pos);if(i!==pos)el.classList.remove('hint')});
  const c=wordEls[pos];if((speechState==='playing'||listening)&&c&&c.scrollIntoView){const r=c.getBoundingClientRect();if(r.top<80||r.bottom>innerHeight-80)c.scrollIntoView({block:'center',behavior:'smooth'})}
}

// ---- टैप करके शब्द सुनना
function speakWord(raw){
  if(!('speechSynthesis'in window)){alert('इस ब्राउज़र में आवाज़ उपलब्ध नहीं है।');return}
  const w=cleanWord(raw);if(!w)return;
  const wasPlaying = (speechState === 'playing');
  const wasListening=listening;
  if(wasPlaying) pauseSpeech();
  if(wasListening&&rec){tapSpeaking=true;try{rec.abort()}catch(_){}}
  
  const u=new SpeechSynthesisUtterance(w);u.lang='hi-IN';u.rate=.65;u.pitch=1.05;
  const hi=speechSynthesis.getVoices().find(v=>/^hi(-|_|$)/i.test(v.lang));if(hi)u.voice=hi;
  const done=()=>{
    tapSpeaking=false;
    if(wasPlaying) resumeSpeech();
    if(wasListening&&listening) startRec();
  };
  u.onend=done;u.onerror=done;
  speechSynthesis.speak(u);
}
$('readText').addEventListener('click',e=>{
  const el=e.target.closest&&e.target.closest('.w');if(!el)return;
  el.classList.add('tapped');setTimeout(()=>el.classList.remove('tapped'),900);
  speakWord(el.textContent);
});

// Button Event Handlers for TTS
if($('speakBtn')) $('speakBtn').onclick = speak;
if($('pauseBtn')) $('pauseBtn').onclick = pauseSpeech;
if($('resumeBtn')) $('resumeBtn').onclick = resumeSpeech;
if($('stopBtn')) $('stopBtn').onclick = stopSpeech;