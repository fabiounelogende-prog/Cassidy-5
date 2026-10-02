const{createCanvas}=require("canvas"),fs=require("fs-extra"),path=require("path");
const NAME="grandprix",LAPS=6,PIT=18,REF=88,MX=6,GAINS=[600,350,200,80],TDM=100;
const ST={moteur:"Moteur",aero:"Aéro",pneus:"Pneus",freins:"Freins"};
const AL={moteur:"moteur",aero:"aero","aéro":"aero",pneus:"pneus",freins:"freins"};
const DEF={moteur:2,aero:2,pneus:2,freins:2,courses:0,victoires:0,podiums:0};
const RIV=[{nom:"R. Duval",code:"DUV",col:"#ff3b30"},{nom:"K. Tanaka",code:"TAN",col:"#ffd54a"},{nom:"M. Alvarez",code:"ALV",col:"#00d4ff"}];
const PAL=[["#ff2e93","#7c4dff"],["#00d4ff","#0057ff"],["#00ffb3","#00b0ff"],["#ffcc33","#ff6a3d"]];
const rnd=n=>Math.floor(Math.random()*n);
const fmt=t=>`${Math.floor(t/60)}:${(t%60).toFixed(1).padStart(4,"0")}`;
const bar=n=>"▰".repeat(n)+"▱".repeat(MX-n);
const rain=w=>w=="rain"?"🌧️ pluie":"☀️ sec";
const gd=async(u,id)=>{try{return(await u.get(id,"data"))||{}}catch{return{}}};
const getG=async(u,id)=>({...DEF,...((await gd(u,id)).gp||{})});
const setG=async(u,id,g)=>{try{const d=await gd(u,id);d.gp=g;await u.set(id,d,"data")}catch{}};
const cash=async(u,id)=>{try{return(await u.get(id,"money"))||0}catch{return 0}};
const pay=async(u,id,n)=>{try{await u.set(id,(await cash(u,id))+n,"money");return 1}catch{return 0}};
const nom=async(u,id)=>{try{return(await u.getName(id))||"Pilote"}catch{return"Pilote"}};

// ---------- Course ----------
const meteo=()=>{const m=[];let r=Math.random()<.25;for(let i=0;i<LAPS;i++){m.push(r?"rain":"dry");if(Math.random()<.25)r=!r}return m};
function creer(g,th,n){
const cars=[{nom:n,code:n.replace(/[^A-Za-z]/g,"").slice(0,3).toUpperCase()||"TOI",col:th.a,moteur:g.moteur,aero:g.aero,pneus:g.pneus,freins:g.freins}];
RIV.forEach(r=>cars.push({...r,moteur:2+rnd(3),aero:2+rnd(3),pneus:2+rnd(3),freins:2+rnd(3),agr:.25+Math.random()*.35}));
const m=meteo();
cars.forEach(c=>{c.tyre=100;c.type=m[0]=="rain"?"P":"S";c.total=0;c.best=null;c.last=null});
cars.map((c,i)=>[i,c.moteur*.8+c.aero*.6+Math.random()*3]).sort((a,b)=>b[1]-a[1]).forEach(([i],k)=>{cars[i].total=k*.6});
return{cars,meteo:m,lap:0,fl:null}}
const rang=E=>E.cars.map((c,i)=>i).sort((a,b)=>E.cars[a].total-E.cars[b].total);

// action : 1 attaque, 2 équilibré, 3 économie, 4 stand slicks, 5 stand pluie
function courir(E,c,a,w,log){
let m=a,pit=a>=4;
if(pit){m=2;c.total+=PIT;c.tyre=100;c.type=a==4?"S":"P";log.push(`🔧 ${c.nom} au stand (${c.type=="S"?"slicks":"pluie"}) +${PIT}s`)}
let t=90-c.moteur*.8-c.aero*.6+(m==1?-1.8:m==3?1.5:0)+Math.pow((100-c.tyre)/100,2)*14+(Math.random()-.5)*1.6;
if(c.type=="S"&&w=="rain")t+=8;
if(c.type=="P"&&w=="dry")t+=5;
let u=Math.max(4,(m==1?22:m==2?14:8)-c.pneus*1.2)+(c.type=="P"&&w=="dry"?6:0);
const r=(m==1?.06:.015)+(c.tyre<25?.1:0)+(c.type=="S"&&w=="rain"?.1:0)-c.freins*.008;
const crash=Math.random()<Math.max(.005,r);
if(crash){t+=20;u+=10;log.push(`💥 ${c.nom} part en tête-à-queue ! (+20s)`)}
c.tyre=Math.max(0,c.tyre-u);c.total+=t;c.last=t;
if(!crash&&!pit){if(c.best===null||t<c.best)c.best=t;if(!E.fl||t<E.fl.t)E.fl={i:E.cars.indexOf(c),t}}}
function bot(c,w,lap){
const v=w=="rain"?"P":"S";
if(c.type!=v&&Math.random()<.85)return v=="P"?5:4;
if(c.tyre<28&&lap<LAPS-1)return c.type=="P"?5:4;
const x=Math.random();return x<c.agr?1:x<c.agr+.5?2:3}

// ---------- Dessin ----------
const CT=[[.15,.75],[.12,.45],[.25,.2],[.45,.3],[.55,.12],[.8,.15],[.9,.4],[.72,.5],[.8,.7],[.6,.86],[.4,.7],[.28,.88]];
function circuit(bx,by,bw,bh){
const P=CT.map(([x,y])=>[bx+x*bw,by+y*bh]),n=P.length,pts=[];
for(let i=0;i<n;i++){const a=P[(i+n-1)%n],b=P[i],c=P[(i+1)%n],d=P[(i+2)%n];
for(let k=0;k<30;k++){const t=k/30,t2=t*t,t3=t2*t;
pts.push([0,1].map(j=>.5*(2*b[j]+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-d[j])*t2+(-a[j]+3*b[j]-3*c[j]+d[j])*t3)))}}
const cum=[0];
pts.forEach((p,i)=>{const q=pts[(i+1)%pts.length];cum.push(cum[i]+Math.hypot(q[0]-p[0],q[1]-p[1]))});
return{pts,cum,total:cum[pts.length]}}
function pointAt(T,f){
f=(f%1+1)%1;const d=f*T.total;let i=0;
while(i<T.pts.length-1&&T.cum[i+1]<d)i++;
const a=T.pts[i],b=T.pts[(i+1)%T.pts.length],u=(d-T.cum[i])/(T.cum[i+1]-T.cum[i]||1);
return{x:a[0]+(b[0]-a[0])*u,y:a[1]+(b[1]-a[1])*u,ang:Math.atan2(b[1]-a[1],b[0]-a[0])}}
function base(W,H,th,titre){
const x=createCanvas(W,H).getContext("2d");
let g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,th.bg);g.addColorStop(1,"#140a2e");
x.fillStyle=g;x.fillRect(0,0,W,H);
x.globalAlpha=.3;
[[W,0,th.a],[0,H,th.b]].forEach(([a,b,c])=>{g=x.createRadialGradient(a,b,10,a,b,480);g.addColorStop(0,c);g.addColorStop(1,"transparent");x.fillStyle=g;x.beginPath();x.arc(a,b,480,0,7);x.fill()});
x.globalAlpha=1;
x.strokeStyle=th.a;x.lineWidth=3;x.beginPath();x.roundRect(18,18,W-36,H-36,18);x.stroke();
x.textAlign="center";x.fillStyle="#fff";x.font="bold 46px Sans-Serif";x.shadowColor=th.a;x.shadowBlur=18;x.fillText(titre,W/2,88);x.shadowBlur=0;
return x}
function voiture(x,X,Y,a,col,me){
x.save();x.translate(X,Y);x.rotate(a);x.scale(1.25,1.25);
x.shadowColor=col;x.shadowBlur=me?16:6;
x.fillStyle="#111";[[-9,-9],[-9,5],[9,-9],[9,5]].forEach(([p,q])=>x.fillRect(p-4,q,8,4));
x.fillStyle=col;x.beginPath();x.roundRect(-14,-4,28,8,4);x.fill();
x.beginPath();x.moveTo(13,-3);x.lineTo(21,0);x.lineTo(13,3);x.fill();
x.fillRect(-17,-8,3,16);x.shadowBlur=0;
x.fillStyle="#222";x.fillRect(17,-9,3,18);
x.fillStyle="#fff";x.beginPath();x.arc(-1,0,2.5,0,7);x.fill();x.restore()}
function icone(x,X,Y,pl){
x.save();
if(!pl){x.fillStyle="#ffd54a";x.shadowColor="#ffd54a";x.shadowBlur=18;x.beginPath();x.arc(X,Y,16,0,7);x.fill()}
else{x.fillStyle="#9fb3d9";[[-10,0,12],[6,-6,15],[16,2,10]].forEach(([a,b,r])=>{x.beginPath();x.arc(X+a,Y+b,r,0,7);x.fill()});
x.strokeStyle="#3aa0ff";x.lineWidth=3;[-12,0,12].forEach(a=>{x.beginPath();x.moveTo(X+a,Y+16);x.lineTo(X+a-4,Y+26);x.stroke()})}
x.restore()}
function dessiner(S,th,titre,fin){
const W=800,H=1100,x=base(W,H,th,"GRAND PRIX"),o=rang(S),lead=S.cars[o[0]].total;
x.fillStyle=th.a;x.font="bold 26px Sans-Serif";x.fillText(titre,W/2,128);
const T=circuit(90,175,620,370),tr=()=>{x.beginPath();T.pts.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath()};
x.save();x.lineJoin="round";
x.strokeStyle="rgba(255,255,255,.18)";x.lineWidth=44;tr();x.stroke();
x.strokeStyle="#2a3350";x.lineWidth=36;tr();x.stroke();
x.strokeStyle="rgba(255,255,255,.3)";x.lineWidth=2;x.setLineDash([10,12]);tr();x.stroke();x.restore();
const s=pointAt(T,0),nx=-Math.sin(s.ang),ny=Math.cos(s.ang);
x.strokeStyle="#fff";x.lineWidth=5;x.beginPath();x.moveTo(s.x-nx*20,s.y-ny*20);x.lineTo(s.x+nx*20,s.y+ny*20);x.stroke();
[...o].reverse().forEach(ci=>{
const r=o.indexOf(ci),c=S.cars[ci],p=pointAt(T,1-(c.total-lead)/REF),f=(r%2?1:-1)*6,X=p.x-Math.sin(p.ang)*f,Y=p.y+Math.cos(p.ang)*f;
voiture(x,X,Y,p.ang,c.col,!ci);x.fillStyle="#fff";x.font="bold 13px Sans-Serif";x.fillText(c.code,X,Y-22)});
o.forEach((ci,r)=>{
const c=S.cars[ci],y=580+r*58,me=!ci,win=fin&&!r;
x.fillStyle=me?"rgba(255,255,255,.12)":"rgba(255,255,255,.06)";x.beginPath();x.roundRect(60,y,680,50,10);x.fill();
x.strokeStyle=win?"#ffd54a":me?th.a:"rgba(255,255,255,.1)";x.lineWidth=me||win?2.5:1;x.stroke();
x.fillStyle=c.col;x.fillRect(60,y+6,6,38);
x.fillStyle="#fff";x.font="bold 26px Sans-Serif";x.fillText(String(r+1),95,y+35);
x.textAlign="left";x.font="bold 22px Sans-Serif";const n=c.nom.slice(0,11);x.fillText(n,125,y+33);
if(me){const w=x.measureText(n).width;x.fillStyle=th.a;x.font="bold 14px Sans-Serif";x.fillText("TOI",133+w,y+32)}
x.fillStyle=th.sub;x.font="bold 20px Sans-Serif";x.fillText(r?`+${(c.total-lead).toFixed(1)}s`:fin?"VAINQUEUR":"LEADER",310,y+33);
x.fillStyle=c.type=="S"?"#ffd54a":"#3aa0ff";x.beginPath();x.arc(455,y+25,13,0,7);x.fill();
x.textAlign="center";x.fillStyle="#0a0e1a";x.font="bold 16px Sans-Serif";x.fillText(c.type,455,y+31);
x.fillStyle="rgba(255,255,255,.12)";x.fillRect(480,y+20,110,10);
x.fillStyle=c.tyre>55?"#00e08a":c.tyre>28?"#ffb020":"#ff3b30";x.fillRect(480,y+20,1.1*c.tyre,10);
x.textAlign="right";x.fillStyle=S.fl&&c.best===S.fl.t?"#c06eff":"#fff";x.font="bold 18px Sans-Serif";x.fillText(c.last!==null?fmt(c.last):"--",725,y+32);x.textAlign="center"});
x.fillStyle="rgba(0,0,0,.25)";x.beginPath();x.roundRect(60,830,680,190,14);x.fill();
x.fillStyle=th.sub;x.font="bold 16px Sans-Serif";x.fillText(fin?"COURSE":"TOUR",150,865);
x.fillStyle="#fff";x.font="bold 44px Sans-Serif";x.fillText(fin?"FINIE":`${S.lap+1}/${LAPS}`,150,920);
if(!fin){
icone(x,330,890,S.meteo[S.lap]=="rain");x.fillStyle=th.sub;x.font="bold 14px Sans-Serif";x.fillText("À COURIR",330,940);
if(S.lap+1<LAPS){icone(x,470,890,S.meteo[S.lap+1]=="rain");x.fillText("ENSUITE",470,940)}
x.fillStyle="#fff";x.font="bold 16px Sans-Serif";x.fillText("S slicks • P pluie",620,900);
x.font="bold 20px Sans-Serif";x.fillText("1 Attaque • 2 Équilibré • 3 Économie",W/2,976);x.fillText("4 Stand slicks • 5 Stand pluie",W/2,1004)
}else{
x.fillStyle="#fff";x.font="bold 24px Sans-Serif";x.fillText("Vainqueur : "+S.cars[o[0]].nom,520,905);
if(S.fl){x.fillStyle="#c06eff";x.font="bold 18px Sans-Serif";x.fillText(`Meilleur tour : ${S.cars[S.fl.i].nom} ${fmt(S.fl.t)}`,520,945)}}
x.fillStyle=th.sub;x.font="20px Sans-Serif";x.fillText(fin?"Relance la commande pour rejouer":"Réponds à l'image : 1 à 5",W/2,H-38);
return x.canvas.toBuffer("image/png")}
async function envoyer(api,tid,mid,body,buf,uid,etat){
const dir=path.join(__dirname,"cache");fs.ensureDirSync(dir);
const f=path.join(dir,`${NAME}_${uid}_${Date.now()}.png`);fs.writeFileSync(f,buf);
api.sendMessage({body,attachment:fs.createReadStream(f)},tid,(err,info)=>{
try{fs.unlinkSync(f)}catch{}
if(err||!etat||!info)return;
global.GoatBot.onReply.set(info.messageID,{commandName:NAME,messageID:info.messageID,...etat})},mid)}

module.exports={
config:{name:"grandprix",aliases:["gp","f1","voiture","cars","racing"],version:"1.0.0",author:"YourName",countDown:5,role:0,
shortDescription:"Grand Prix : stratégie, météo, stands, garage",
longDescription:"Course de 6 tours contre 3 pilotes IA : pneus, météo, stands. Gagne des pièces et améliore ta voiture.",
category:"game",
guide:"{pn} : lancer un Grand Prix\n{pn} garage : ta voiture\n{pn} upgrade <moteur|aero|pneus|freins>\nRéponds à l'image avec 1 à 5"},

onStart:async function({api,event,args,usersData}){
const{threadID:tid,messageID:mid,senderID:id}=event,sub=String(args&&args[0]||"").toLowerCase();
if(sub=="garage"){
const g=await getG(usersData,id),m=await cash(usersData,id);
return api.sendMessage(`🏎️ TON GARAGE\n\n${Object.keys(ST).map(k=>`🔧 ${ST[k]} ${bar(g[k])} ${g[k]}/${MX}${g[k]<MX?` — ${250*g[k]} 💰`:" — MAX"}`).join("\n")}\n\n💰 Solde : ${m}\n📊 Courses : ${g.courses} • Victoires : ${g.victoires} • Podiums : ${g.podiums}\n\n👉 upgrade <moteur|aero|pneus|freins>`,tid,mid)}
if(sub=="upgrade"||sub=="ameliorer"){
const k=AL[String(args[1]||"").toLowerCase()];
if(!k)return api.sendMessage("⚠️ Choisis : moteur, aero, pneus ou freins.",tid,mid);
const g=await getG(usersData,id);
if(g[k]>=MX)return api.sendMessage(`✅ ${ST[k]} est déjà au maximum.`,tid,mid);
const cout=250*g[k],m=await cash(usersData,id);
if(m<cout)return api.sendMessage(`💸 Il te faut ${cout} 💰 (tu as ${m}).`,tid,mid);
try{await usersData.set(id,m-cout,"money")}catch{return api.sendMessage("⚠️ Paiement impossible.",tid,mid)}
g[k]++;await setG(usersData,id,g);
return api.sendMessage(`✅ ${ST[k]} : niveau ${g[k]}/${MX} (-${cout} 💰)`,tid,mid)}
const th=(([a,b])=>({a,b,bg:"#0a0e1a",sub:"#a8b3cf"}))(PAL[rnd(PAL.length)]);
const n=await nom(usersData,id),S={...creer(await getG(usersData,id),th,n),owner:id,th};
const body=`🏎️ GRAND PRIX — ${LAPS} TOURS\n\n👤 ${n} vs ${RIV.map(r=>r.nom).join(", ")}\n🏁 Départ en P${rang(S).indexOf(0)+1} • ${rain(S.meteo[0])}\n\n1️⃣ Attaque : rapide, use les pneus, risque\n2️⃣ Équilibré\n3️⃣ Économie : lent, préserve les pneus\n4️⃣ Stand slicks • 5️⃣ Stand pluie (${PIT}s)\n\n💰 ${GAINS.join(" / ")} (+${TDM} meilleur tour)\n👉 Réponds à l'image pour le tour 1.`;
await envoyer(api,tid,mid,body,dessiner(S,th,"FEU VERT !",false),id,S)},

onReply:async function({api,event,Reply:S,usersData}){
const{threadID:tid,messageID:mid,senderID:id,body}=event;
if(id!==S.owner)return;
const t=String(body||"").toLowerCase().trim(),w=S.meteo[S.lap];
const a=/^[1-5]/.test(t)?+t[0]:/attaq/.test(t)?1:/quilib/.test(t)?2:/conom/.test(t)?3:/stand|pit/.test(t)?(w=="rain"?5:4):0;
if(!a)return api.sendMessage("⚠️ Réponds par 1 Attaque, 2 Équilibré, 3 Économie, 4 Stand slicks, 5 Stand pluie.",tid,mid);
global.GoatBot.onReply.delete(S.messageID);
const E={...S,cars:S.cars.map(c=>({...c}))},av=rang(S).indexOf(0),fl0=S.fl?S.fl.t:Infinity,log=[];
E.cars.forEach((c,i)=>courir(E,c,i?bot(c,w,S.lap):a,w,log));
E.lap=S.lap+1;
const o=rang(E),r=o.indexOf(0),fin=E.lap>=LAPS,d=av-r;
if(E.fl&&E.fl.t<fl0)log.push(`🟣 Meilleur tour : ${E.cars[E.fl.i].nom} (${fmt(E.fl.t)})`);
let msg=`🏁 TOUR ${E.lap}/${LAPS} — ${rain(w)}\n${log.length?log.join("\n")+"\n":""}⏱️ Ton tour : ${fmt(E.cars[0].last)} • P${r+1}${d>0?` (⬆️ +${d})`:d<0?` (⬇️ ${d})`:""}`,titre;
if(fin){
const prime=GAINS[r]+(E.fl&&E.fl.i==0?TDM:0),ok=await pay(usersData,id,prime),g=await getG(usersData,id);
g.courses++;if(r==0)g.victoires++;if(r<3)g.podiums++;await setG(usersData,id,g);
const lead=E.cars[o[0]].total;
titre=r==0?"VICTOIRE !":`ARRIVÉE — P${r+1}`;
msg+=`\n\n🏆 CLASSEMENT\n${o.map((c,k)=>`${["🥇","🥈","🥉","4️⃣"][k]} ${E.cars[c].nom} ${k?"+"+(E.cars[c].total-lead).toFixed(1)+"s":fmt(lead)}`).join("\n")}\n\n💰 Prime : +${prime}${ok?"":" (non crédité)"}\n🔧 Améliore-toi : upgrade moteur`}
else{
titre=`TOUR ${E.lap+1}/${LAPS}`;
msg+=`\n\n🛞 Pneus : ${Math.round(E.cars[0].tyre)}% (${E.cars[0].type=="S"?"slicks":"pluie"})\n➡️ Tour ${E.lap+1} : ${rain(E.meteo[E.lap])}${E.lap+1<LAPS?` • ensuite ${rain(E.meteo[E.lap+1])}`:""}`}
await envoyer(api,tid,mid,msg,dessiner(E,S.th,titre,fin),id,fin?null:E)}
};
