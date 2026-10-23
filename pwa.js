// Mobile app jaisa install option
(function(){
  const btn=document.getElementById('installBtn'),help=document.getElementById('installHelp');
  const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  if(standalone)return; // pehle se app ki tarah khula hai
  let deferred=null;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;btn.classList.remove('hidden')});
  btn.onclick=async()=>{
    if(!deferred)return;
    deferred.prompt();
    try{await deferred.userChoice}catch(_){}
    deferred=null;btn.classList.add('hidden');
  };
  window.addEventListener('appinstalled',()=>{btn.classList.add('hidden');help.classList.add('hidden')});
  // iPhone (Safari) mein automatic install button nahi aata, isliye guide dikhate hain
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  if(isIOS){help.innerHTML='📱 iPhone: Safari mein <b>Share</b> दबाएँ → <b>Add to Home Screen</b>';help.classList.remove('hidden')}
  // Android: agar 6 second tak install button na aaye (WhatsApp/Instagram ke andar kholne par aisa hota hai)
  if(!isIOS){
    setTimeout(()=>{
      if(deferred||!btn.classList.contains('hidden'))return;
      const inApp=/FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)/i.test(navigator.userAgent);
      help.innerHTML=inApp?'📲 App install करने के लिए इस पेज को <b>Chrome</b> में खोलें, फिर menu (⋮) → <b>Install app</b>':'📲 Install button न दिखे तो Chrome menu (⋮) → <b>Install app</b> / <b>Add to Home screen</b>';
      help.classList.remove('hidden');
    },6000);
  }
  if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.error));
  }
})();
