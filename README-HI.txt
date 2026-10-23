नन्ही कहानियाँ — शुरुआत कैसे करें

इस फ़ोल्डर में एक offline-friendly Hindi story app है:
- index.html: ऐप की स्क्रीन
- app.js: कहानियाँ, edit/save और Hindi voice narration
- manifest.json + sw.js: installable/offline web app support
- icon.svg: ऐप आइकन

महत्वपूर्ण:
1. ZIP को extract करें।
2. PWA की सही offline/install सुविधा के लिए इसे HTTPS hosting पर एक बार खोलना ज़रूरी है। केवल फ़ाइल को सीधे खोलने पर service worker काम नहीं करता।
3. इस ZIP को मुफ्त HTTPS hosting (जैसे GitHub Pages) पर publish करने के बाद Android Chrome में खोलें और menu से "Install app" या "Add to Home screen" चुनें।
4. पहली बार ऑनलाइन खोलें ताकि app files cache हो जाएँ। फिर app offline खुल सकता है।
5. Hindi voice फोन के Text-to-Speech engine पर निर्भर है। अगर offline Hindi voice नहीं है तो फोन की Settings में Text-to-Speech / Speech Services में Hindi voice डाउनलोड करें। कुछ फोन/ब्राउज़र में यह सुविधा अलग तरह से काम कर सकती है।
6. कहानियाँ फोन के browser storage में सेव होती हैं। ऐप का data clear करने से वे हट सकती हैं, इसलिए Backup बटन से JSON backup export करते रहें।
7. Backup JSON को Edit करने के लिए ऐप के अंदर Add/Edit विकल्प इस्तेमाल करें; Import से backup restore करें।

यह APK नहीं है; यह installable PWA है। Android APK में बदलने के लिए अलग packaging/signing step चाहिए।
