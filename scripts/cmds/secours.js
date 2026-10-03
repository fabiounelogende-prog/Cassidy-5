const{createCanvas,loadImage}=require("canvas"),fs=require("fs-extra"),path=require("path"),axios=require("axios");
const DOSSIER=path.join(__dirname,"secours_data"),TZ="Africa/Kinshasa",MAXL=8;
const fp=t=>path.join(DOSSIER,`${t}.jpg`),pause=ms=>new Promise(r=>setTimeout(r,ms));
const PAL=[["#ff2e93","#7c4dff"],["#00d4ff","#0057ff"],["#00ffb3","#00b0ff"],["#ffcc33","#ff6a3d"],["#c06eff","#ff6ec7"]];
const theme=()=>{const[a,b]=PAL[Math.floor(Math.random()*PAL.length)];return{a,b,sub:"#9aa6c7"}};
const adminsBot=()=>(((global.GoatBot||{}).config||{}).adminBot||[]).map(String);
const clean=s=>String(s||"").replace(/[\u{1F000}-\u{1FFFF}\u{2190}-\u{2BFF}\uFE0F\u200D]/gu,"").trim();
const li=async u=>{try{return u?await loadImage(u):null}catch{return null}};
const nom=async(u,id)=>{try{return(await u.getName(id))||String(id)}catch{return String(id)}};
const photo=async(u,id)=>{try{return await li(await u.getAvatarUrl(id))}catch{return null}};
const dshort=()=>new Date().toLocaleString("fr-FR",{timeZone:TZ,day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
const ids=a=>(a||[]).map(x=>String(x.id||x));
const info=(api,t)=>new Promise(r=>api.getThreadInfo(t,(e,i)=>r(e?null:i)));
const setTitle=(api,t,n)=>new Promise(r=>api.setTitle(n,t,e=>r(!e)));
const setImg=(api,t)=>new Promise(r=>api.changeGroupImage(fs.createReadStream(fp(t)),t,e=>r(!e)));
const setAdm=(api,t,u,v)=>new Promise(r=>api.changeAdminStatus(t,u,v,e=>r(!e)));
async function adminsGroupe(api,td,t){
const i=await info(api,t);if(i&&i.adminIDs)return ids(i.adminIDs);
try{return ids(await td.get(t,"adminIDs"))}catch{return[]}}
async function autorise(api,td,t,u){
u=String(u);
if(adminsBot().includes(u)||u==String(api.getCurrentUserID()))return true;
return(await adminsGroupe(api,td,t)).includes(u)}
const charger=async(td,t)=>{try{return(await td.get(t,"data.secours"))||{}}catch{return{}}};
const sauver=async(td,t,d)=>{try{await td.set(t,d,"data.secours")}catch{}};
async function telecharger(url,t){fs.ensureDirSync(DOSSIER);const r=await axios.get(url,{responseType:"arraybuffer",timeout:20000});fs.writeFileSync(fp(t),Buffer.from(r.data))}
async function sauvegarder(api,t,d){
const i=await info(api,t);if(!i)return false;
d.titre=i.threadName||d.titre||"";
if(i.imageSrc){try{await telecharger(i.imageSrc,t)}catch{}}
return true}
async function restaurer(api,t,d){
const r={nom:null,photo:null};
if(d.titre)r.nom=await setTitle(api,t,d.titre);
if(fs.existsSync(fp(t)))r.photo=await setImg(api,t);
return r}
async function garde(api,t,{auteur,purge}){
const r={ajoutes:[],deja:[],absents:[],echecs:[],retires:[]};
const sur=new Set([...adminsBot(),String(api.getCurrentUserID())]);
let i=await info(api,t);if(!i)return null;
const mem=ids(i.participantIDs),adm=ids(i.adminIDs);
if(purge&&auteur&&!sur.has(auteur)&&adm.includes(auteur)){if(await setAdm(api,t,auteur,false))r.retires.push(auteur);await pause(600)}
for(const u of adminsBot()){
if(!mem.includes(u))r.absents.push(u);
else if(adm.includes(u))r.deja.push(u);
else{if(await setAdm(api,t,u,true))r.ajoutes.push(u);else r.echecs.push(u);await pause(600)}}
if(purge&&!r.echecs.length){
i=(await info(api,t))||i;
for(const u of ids(i.adminIDs))if(!sur.has(u)&&!r.retires.includes(u)){if(await setAdm(api,t,u,false))r.retires.push(u);await pause(600)}}
return r}
function wrap(x,t,w){
const o=[];
for(const p of String(t).split("\n")){let l="";
for(const wd of p.split(" ")){const c=l?l+" "+wd:wd;
if(x.measureText(c).width<=w){l=c;continue}
if(l)o.push(l);l=wd;
while(x.measureText(l).width>w){let i=l.length;while(i>1&&x.measureText(l.slice(0,i)).width>w)i--;o.push(l.slice(0,i));l=l.slice(i)}}
o.push(l)}
return o}
function circ(x,img,X,Y,r,txt){
x.save();x.beginPath();x.arc(X,Y,r,0,7);x.closePath();x.clip();
if(img)x.drawImage(img,X-r,Y-r,r*2,r*2);
else{x.fillStyle="#242b45";x.fillRect(X-r,Y-r,r*2,r*2);x.fillStyle="#c9d1ee";x.font=`bold ${r}px Sans-Serif`;x.textAlign="center";x.fillText((clean(txt)[0]||"?").toUpperCase(),X,Y+r*.35)}
x.restore()}
function ring(x,X,Y,r,th,w,col){
let c=col;
if(!c){c=x.createLinearGradient(X-r,Y-r,X+r,Y+r);c.addColorStop(0,th.a);c.addColorStop(1,th.b)}
x.save();x.strokeStyle=c;x.lineWidth=w;x.shadowColor=col||th.a;x.shadowBlur=14;x.beginPath();x.arc(X,Y,r,0,7);x.stroke();x.restore()}
function spaced(x,t,X,Y,sp){x.textAlign="left";for(const ch of t){x.fillText(ch,X,Y);X+=x.measureText(ch).width+sp}}
function fond(W,H,th){
const x=createCanvas(W,H).getContext("2d");
x.save();x.beginPath();x.roundRect(0,0,W,H,28);x.clip();
let g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,"#0b1020");g.addColorStop(1,"#171a38");
x.fillStyle=g;x.fillRect(0,0,W,H);
x.globalAlpha=.28;
[[0,0,th.a],[W,H,th.b]].forEach(([a,b,c])=>{g=x.createRadialGradient(a,b,10,a,b,520);g.addColorStop(0,c);g.addColorStop(1,"transparent");x.fillStyle=g;x.fillRect(0,0,W,H)});
x.globalAlpha=1;
g=x.createLinearGradient(0,0,W,0);g.addColorStop(0,th.a);g.addColorStop(1,th.b);
x.fillStyle=g;x.fillRect(0,0,W,6);
x.restore();
x.strokeStyle="rgba(255,255,255,0.12)";x.lineWidth=2;x.beginPath();x.roundRect(1,1,W-2,H-2,28);x.stroke();
return x}
const ligne=(x,y)=>{x.strokeStyle="rgba(255,255,255,0.1)";x.lineWidth=1;x.beginPath();x.moveTo(60,y);x.lineTo(740,y);x.stroke()};
function entete(x,th,titre,W){
x.fillStyle=th.a;x.font="bold 15px Sans-Serif";spaced(x,titre.toUpperCase(),60,66,3);
x.fillStyle=th.sub;x.font="15px Sans-Serif";x.textAlign="right";x.fillText(dshort(),W-60,66)}
function carte(o){
const th=o.th,W=800,P=60,m=createCanvas(10,10).getContext("2d");
m.font="30px Sans-Serif";
let L=wrap(m,clean(o.texte)||"...",650);
if(L.length>MAXL){L=L.slice(0,MAXL);L[MAXL-1]=L[MAXL-1].slice(0,-1)+"…"}
const y0=290,bh=L.length*44,y3=y0+bh+34,H=y3+190,x=fond(W,H,th);
entete(x,th,o.titre,W);
circ(x,o.img,P+60,150,54,o.nom);ring(x,0+P+60,150,62,th,4);
x.textAlign="left";x.fillStyle="#fff";x.font="bold 36px Sans-Serif";x.fillText(clean(o.nom).slice(0,20)||"Inconnu",P+146,146);
x.fillStyle=th.a;x.beginPath();x.arc(P+152,176,5,0,7);x.fill();
x.font="bold 15px Sans-Serif";spaced(x,o.badge,P+166,182,2.5);
ligne(x,250);
let g=x.createLinearGradient(0,y0,0,y0+bh);g.addColorStop(0,th.a);g.addColorStop(1,th.b);
x.fillStyle=g;x.beginPath();x.roundRect(P,y0+4,5,bh-8,3);x.fill();
x.fillStyle="#eef1ff";x.font="30px Sans-Serif";x.textAlign="left";
L.forEach((l,i)=>x.fillText(l,P+28,y0+32+i*44));
ligne(x,y3);
x.fillStyle="rgba(255,255,255,0.05)";x.beginPath();x.roundRect(P,y3+28,W-2*P,84,42);x.fill();
x.strokeStyle="rgba(255,255,255,0.08)";x.stroke();
circ(x,o.imgG,P+42,y3+70,30,o.grp);ring(x,P+42,y3+70,34,th,2.5);
x.fillStyle=th.sub;x.font="bold 13px Sans-Serif";spaced(x,o.gl,P+92,y3+60,2.5);
x.fillStyle="#fff";x.font="bold 26px Sans-Serif";x.textAlign="left";x.fillText(clean(o.grp).slice(0,28)||"Groupe",P+92,y3+94);
x.textAlign="center";x.fillStyle=th.sub;x.font="16px Sans-Serif";x.fillText(o.pied,W/2,y3+152);
return x.canvas.toBuffer("image/png")}
function statut(o){
const th=o.th,W=800,P=60,H=900,n=o.users.length,x=fond(W,H,th),d=o.d;
entete(x,th,"Secours · protection du groupe",W);
circ(x,o.g.im,P+60,150,54,o.g.n);ring(x,P+60,150,62,th,4);
x.textAlign="left";x.fillStyle="#fff";x.font="bold 34px Sans-Serif";x.fillText(clean(o.g.n).slice(0,22)||"Groupe",P+146,146);
x.fillStyle=th.sub;x.font="18px Sans-Serif";x.fillText(`${o.g.m} membres  •  ${o.g.a} admins`,P+146,180);
ligne(x,250);
const rows=[
["Nom du groupe",d.titre?"« "+d.titre+" »":"aucun nom enregistré",d.nom],
["Photo du groupe",fs.existsSync(fp(o.tid))?"photo enregistrée":"aucune photo enregistrée",d.photo],
["Admins du bot","remis admins s'ils sont retirés",d.admins],
["Mode strict","retire les autres admins en cas d'intrusion",d.admins&&d.purge!==false]];
rows.forEach(([t,s,on],i)=>{
const y=280+i*80;
x.fillStyle="rgba(255,255,255,0.05)";x.beginPath();x.roundRect(P,y,W-2*P,66,18);x.fill();
x.strokeStyle="rgba(255,255,255,0.08)";x.lineWidth=1;x.stroke();
const g=x.createLinearGradient(P+20,y+8,P+66,y+58);g.addColorStop(0,th.a);g.addColorStop(1,th.b);
x.fillStyle=g;x.beginPath();x.arc(P+43,y+33,24,0,7);x.fill();x.fillStyle="#fff";x.font="bold 22px Sans-Serif";x.textAlign="center";x.fillText("NPAS"[i],P+43,y+41);
x.textAlign="left";x.fillStyle="#fff";x.font="bold 22px Sans-Serif";x.fillText(t,P+86,y+31);
x.fillStyle=th.sub;x.font="15px Sans-Serif";x.fillText(clean(s).slice(0,44),P+86,y+53);
const c=on?"#00e08a":"#6b7599";
x.fillStyle=c;x.globalAlpha=.18;x.beginPath();x.roundRect(W-P-150,y+16,130,34,17);x.fill();x.globalAlpha=1;
x.strokeStyle=c;x.lineWidth=1.5;x.stroke();
x.textAlign="center";x.fillStyle=c;x.font="bold 14px Sans-Serif";x.fillText(on?"PROTÉGÉ":"INACTIF",W-P-85,y+38)});
ligne(x,620);
x.fillStyle=th.sub;x.font="bold 13px Sans-Serif";spaced(x,"ADMINS DU BOT",P,655,3);
if(!n){x.textAlign="center";x.fillStyle=th.sub;x.font="18px Sans-Serif";x.fillText("Aucun admin du bot dans la configuration",W/2,745)}
o.users.forEach((u,i)=>{
const X=W/2+(i-(n-1)/2)*108,Y=725,c=u.e=="admin"?"#00e08a":u.e=="non"?"#ffb020":"#5b6486";
x.globalAlpha=u.e=="absent"?.5:1;
circ(x,u.im,X,Y,34,u.n);ring(x,X,Y,38,th,3,c);
x.textAlign="center";x.fillStyle="#fff";x.font="bold 15px Sans-Serif";x.fillText(clean(u.n).slice(0,10)||"?",X,787);
x.fillStyle=c;x.font="bold 12px Sans-Serif";x.fillText(u.e=="admin"?"ADMIN":u.e=="non"?"PAS ADMIN":"ABSENT",X,806);
x.globalAlpha=1});
x.textAlign="center";x.fillStyle=th.sub;x.font="16px Sans-Serif";x.fillText("secours on tout  •  secours off  •  secours admin",W/2,H-46);
return x.canvas.toBuffer("image/png")}
async function statutBuf(api,t,td,us,d){
try{
const i=(await info(api,t))||{},adm=ids(i.adminIDs),mem=ids(i.participantIDs);
const users=await Promise.all(adminsBot().slice(0,6).map(async u=>({n:await nom(us,u),im:await photo(us,u),e:!mem.includes(u)?"absent":adm.includes(u)?"admin":"non"})));
return statut({th:theme(),d,users,tid:t,g:{n:i.threadName||"Groupe",im:await li(i.imageSrc),m:mem.length,a:adm.length}})
}catch(e){console.error("[secours] carte statut:",e.message);return null}}
async function alerte(api,t,us,uid,texte){
const n=await nom(us,uid);let buf=null;
try{const i=(await info(api,t))||{};buf=carte({th:theme(),titre:"Alerte sécurité",badge:"AUTEUR",nom:n,img:await photo(us,uid),texte,gl:"GROUPE PROTÉGÉ",grp:i.threadName||"Groupe",imgG:await li(i.imageSrc),pied:"Protection du groupe active"})}
catch(e){console.error("[secours] carte:",e.message)}
return send(api,t,`🚨 ALERTE SÉCURITÉ\n\n👤 ${n}\n${texte}`,buf)}
function send(api,t,body,buf,mid){
return new Promise(res=>{
let f=null;const m={body};
if(buf){try{fs.ensureDirSync(DOSSIER);f=path.join(DOSSIER,`c_${Date.now()}_${Math.floor(Math.random()*1e5)}.png`);fs.writeFileSync(f,buf);m.attachment=fs.createReadStream(f)}catch{f=null;delete m.attachment}}
api.sendMessage(m,t,e=>{
if(f)try{fs.unlinkSync(f)}catch{}
if(e&&m.attachment)return send(api,t,body,null,mid).then(res);
res(!e)},mid)})}
const noms=(us,l)=>Promise.all(l.map(u=>nom(us,u)));
module.exports={
config:{name:"secours",aliases:["sos","rescue"],version:"2.0.0",author:"YourName",countDown:5,role:0,
shortDescription:"Protège nom, photo et admins du groupe",
longDescription:"Protège le nom et la photo du groupe, remet les admins du bot admins s'ils sont retirés et, en mode strict, retire tous les autres admins.",
category:"group",
guide:"{pn} on|off [nom|photo|admin|purge|tout]\n{pn} admin [purge] | save | restore | status"},
onStart:async function({api,event,args,threadsData,usersData}){
const{threadID:tid,senderID:uid,messageID:mid}=event,ILL="❌ Infos du groupe illisibles, réessaie.";
const bot=async(t,card,d)=>send(api,tid,t,card?await statutBuf(api,tid,threadsData,usersData,d):null,mid);
if(!(await autorise(api,threadsData,tid,uid)))return send(api,tid,"⛔ Réservé aux admins du groupe et aux admins du bot.",null,mid);
let p="/";
try{p=((await threadsData.get(tid))||{}).data?.prefix||global.GoatBot.config.prefix||"/"}catch{}
const d=await charger(threadsData,tid);
const sub=(args[0]||"status").toLowerCase(),cible=(args[1]||"tout").toLowerCase(),T=(...a)=>a.includes(cible);
const fNom=T("nom","name","tout","all"),fPhoto=T("photo","avatar","image","tout","all"),fAdmin=T("admin","admins","tout","all"),fPurge=T("purge","strict","tout","all");
if(sub=="on"||sub=="off"){
if(!fNom&&!fPhoto&&!fAdmin&&!fPurge)return bot(`⚠️ Précise : ${p}secours ${sub} nom, photo, admin, purge ou tout.`,false,d);
const on=sub=="on";
if(on&&(fNom||fPhoto)&&!(await sauvegarder(api,tid,d)))return bot(ILL,false,d);
if(fNom)d.nom=on;
if(fPhoto)d.photo=on;
if(fAdmin){d.admins=on;if(on&&d.purge===undefined)d.purge=true}
if(fPurge){d.purge=on;if(on)d.admins=true}
await sauver(threadsData,tid,d);
let extra="";
if(on&&(fAdmin||fPurge)){
const r=await garde(api,tid,{});
if(r&&r.ajoutes.length)extra=`\n👑 ${r.ajoutes.length} admin(s) du bot ajouté(s) au groupe.`;
else if(r&&r.echecs.length)extra="\n⚠️ Je dois être admin du groupe pour ajouter les admins du bot."}
const l=[fNom&&"nom",fPhoto&&"photo",fAdmin&&"admins du bot",fPurge&&"mode strict"].filter(Boolean).join(" + ");
return bot(`${on?"🛡️ Protection activée":"🔓 Protection désactivée"} (${l}).${extra}`,true,d)}
if(sub=="admin"||sub=="admins"){
if(!adminsBot().length)return bot("⚠️ Aucun admin du bot dans la config (adminBot).",false,d);
const r=await garde(api,tid,{purge:cible=="purge"});
if(!r)return bot(ILL,false,d);
const l=["👑 Admins du bot → admins du groupe"];
for(const[t,a]of[["✅ Ajoutés",r.ajoutes],["☑️ Déjà admins",r.deja],["🧹 Retirés",r.retires],["❌ Échec (je dois être admin)",r.echecs]])if(a.length)l.push(`${t} : ${(await noms(usersData,a)).join(", ")}`);
if(r.absents.length)l.push(`👤 Absents du groupe : ${r.absents.length}`);
return bot(l.join("\n"),true,d)}
if(sub=="save"||sub=="sauver"){
if(!(await sauvegarder(api,tid,d)))return bot(ILL,false,d);
await sauver(threadsData,tid,d);
return bot("💾 Nom et photo enregistrés.",true,d)}
if(sub=="restore"||sub=="restaurer"||sub=="r"){
if(!d.titre&&!fs.existsSync(fp(tid)))return bot(`⚠️ Aucune sauvegarde : ${p}secours save`,false,d);
const r=await restaurer(api,tid,d),e=v=>v===null?"—":v?"✅":"❌";
return bot(`🛟 Nom ${e(r.nom)} • Photo ${e(r.photo)}${r.nom===false||r.photo===false?"\n⚠️ Je dois être admin du groupe.":""}`,true,d)}
return bot(`🛟 SECOURS\n${p}secours on|off [nom|photo|admin|purge|tout]\n${p}secours admin [purge]\n${p}secours save | restore`,true,d)},
onEvent:async function({api,event,threadsData,usersData}){
const{threadID:tid,logMessageType:ty,logMessageData:dt,author}=event;
if(!["log:thread-name","log:thread-image","log:thread-admins","log:subscribe"].includes(ty))return;
const me=String(api.getCurrentUserID()),d=await charger(threadsData,tid);
if(!d.nom&&!d.photo&&!d.admins)return;
if(ty=="log:subscribe"){
const add=((dt&&dt.addedParticipants)||[]).map(p=>String(p.userFbId||p.userID||p.id));
if(d.admins&&add.some(u=>adminsBot().includes(u))){await pause(2500);await garde(api,tid,{})}
return}
if(String(author)==me)return;
if(ty=="log:thread-admins"){
if(!d.admins||!dt)return;
const cible=String(dt.TARGET_ID),ev=dt.ADMIN_EVENT;
if(ev=="add_admin"&&cible==me){await garde(api,tid,{});return}
if(ev!="remove_admin"||!adminsBot().includes(cible)||adminsBot().includes(String(author)))return;
const cn=await nom(usersData,cible),r=await garde(api,tid,{auteur:String(author),purge:d.purge!==false});
const l=[`A retiré ${cn} (admin du bot) des admins du groupe.`];
if(!r)l.push("Infos du groupe illisibles.");
else if(r.echecs.length)l.push("Restauration impossible : je dois être admin du groupe.");
else{
if(r.ajoutes.length)l.push("Remis admin : "+(await noms(usersData,r.ajoutes)).join(", "));
if(r.retires.length)l.push("Admins retirés : "+(await noms(usersData,r.retires)).join(", "))}
return alerte(api,tid,usersData,author,l.join("\n"))}
const ok=await autorise(api,threadsData,tid,author);
if(ty=="log:thread-name"){
if(!d.nom)return;
if(ok){d.titre=(dt&&dt.name)||d.titre;return sauver(threadsData,tid,d)}
if(!d.titre)return;
const r=await setTitle(api,tid,d.titre);
return alerte(api,tid,usersData,author,"A changé le nom du groupe.\n"+(r?"Nom restauré : "+d.titre:"Restauration impossible : je dois être admin du groupe."))}
if(!d.photo)return;
if(ok){
try{if(dt&&dt.url)await telecharger(dt.url,tid);else{await pause(4000);const i=await info(api,tid);if(i&&i.imageSrc)await telecharger(i.imageSrc,tid)}}catch{}
return}
if(!fs.existsSync(fp(tid)))return;
const r=await setImg(api,tid);
return alerte(api,tid,usersData,author,"A changé la photo du groupe.\n"+(r?"Photo restaurée.":"Restauration impossible : je dois être admin du groupe."))}
};
