import { SwissEphemeris, Planet, LunarPoint, SiderealMode, CalculationFlag, HouseSystem } from '@swisseph/browser';
const Z=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const N=['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
const LORDS=['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'],YEARS=[7,20,6,10,7,18,16,19,17], RULERS=['Mars','Venus','Mercury','Moon','Sun','Mercury','Venus','Mars','Jupiter','Saturn','Saturn','Jupiter'];
const P=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu'], G={Sun:'☉',Moon:'☽',Mars:'♂',Mercury:'☿',Jupiter:'♃',Venus:'♀',Saturn:'♄',Rahu:'☊',Ketu:'☋',Asc:'Asc'};
const $=x=>document.getElementById(x),mod=x=>(x%360+360)%360,sign=x=>Math.floor(mod(x)/30), house=(a,b)=>((sign(a)-sign(b)+12)%12)+1,fmt=x=>Z[sign(x)]+' '+degreeWithinSign(x),nk=x=>N[Math.floor(mod(x)/(360/27))],date=x=>new Date(x).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});
const degreeWithinSign=x=>{const n=Math.floor((mod(x)%30)*3600+1e-8);return String(Math.floor(n/3600)).padStart(2,'0')+'° '+String(Math.floor((n%3600)/60)).padStart(2,'0')+'′ '+String(n%60).padStart(2,'0')+'″'};
const H=365.2425*86400000;
let swe;
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function init(){try{verifyNavamsa();verifyStrengthComponents();verifyVargaSubdivisions();validateRelationshipModel();swe=new SwissEphemeris(); await swe.init(); swe.setSiderealMode(SiderealMode.Lahiri); $('status').textContent='Calculation engine ready. Enter birth details and generate.'; $('calculate').disabled=false}catch(e){$('status').textContent='Ephemeris failed to load: '+e.message;$('status').classList.add('error');$('calculate').disabled=true}}
$('calculate').disabled=true;
let selectedLocation=null;
const placeInput=document.querySelector('[name="place"]'), latInput=document.querySelector('[name="lat"]'), lonInput=document.querySelector('[name="lon"]'), offsetInput=document.querySelector('[name="offset"]');
const locationStatus=$('location-status'),locationResults=$('location-results');
function clearLocation(){selectedLocation=null;manuallyEditedOffset=false;latInput.value='';lonInput.value='';offsetInput.value='';locationStatus.textContent='Choose a city from the search results to calculate accurate coordinates.';locationResults.innerHTML=''}
placeInput.addEventListener('input',clearLocation);
document.querySelector('[name="date"]').addEventListener('change',refreshOffset);
document.querySelector('[name="time"]').addEventListener('change',refreshOffset);
function offsetAt(zone,utcMs){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(utcMs));
  const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  const projected=Date.UTC(+v.year,+v.month-1,+v.day,+v.hour,+v.minute,+v.second);
  return Math.round((projected-Math.floor(utcMs/1000)*1000)/60000)/60;
}
let manuallyEditedOffset=false;
offsetInput.addEventListener('input',()=>{manuallyEditedOffset=true;locationStatus.textContent='Manual UTC offset selected: '+offsetInput.value+' hours.'});
function refreshOffset(){
  if(!selectedLocation?.timezone||manuallyEditedOffset)return;
  const [y,m,d]=document.querySelector('[name="date"]').value.split('-').map(Number);
  const [hr,min]=document.querySelector('[name="time"]').value.split(':').map(Number);
  if(!y||!m||!d||!Number.isFinite(hr)||!Number.isFinite(min))return;
  const local=Date.UTC(y,m-1,d,hr,min);
  let guess=local;for(let i=0;i<4;i++)guess=local-offsetAt(selectedLocation.timezone,guess)*3600000;
  const offset=offsetAt(selectedLocation.timezone,guess);
  if(!Number.isFinite(offset)||offset < -12||offset > 14)throw Error('Invalid timezone offset');
  offsetInput.value=String(offset);
  locationStatus.textContent='Selected: '+selectedLocation.label+' · '+selectedLocation.timezone+' · UTC '+(offset>=0?'+':'')+offset;
}
const states={'AL':'Alabama','AK':'Alaska','AZ':'Arizona','AR':'Arkansas','CA':'California','CO':'Colorado','CT':'Connecticut','DE':'Delaware','FL':'Florida','GA':'Georgia','HI':'Hawaii','ID':'Idaho','IL':'Illinois','IN':'Indiana','IA':'Iowa','KS':'Kansas','KY':'Kentucky','LA':'Louisiana','ME':'Maine','MD':'Maryland','MA':'Massachusetts','MI':'Michigan','MN':'Minnesota','MS':'Mississippi','MO':'Missouri','MT':'Montana','NE':'Nebraska','NV':'Nevada','NH':'New Hampshire','NJ':'New Jersey','NM':'New Mexico','NY':'New York','NC':'North Carolina','ND':'North Dakota','OH':'Ohio','OK':'Oklahoma','OR':'Oregon','PA':'Pennsylvania','RI':'Rhode Island','SC':'South Carolina','SD':'South Dakota','TN':'Tennessee','TX':'Texas','UT':'Utah','VT':'Vermont','VA':'Virginia','WA':'Washington','WV':'West Virginia','WI':'Wisconsin','WY':'Wyoming','DC':'District of Columbia'};
async function lookupPlace(){
  const query=placeInput.value.trim();
  const parts=query.split(',').map(p=>p.trim()).filter(Boolean);
  const city=parts[0],region=parts[1];
  if(!city){locationStatus.textContent='Enter a city and state.';return}
  const button=$('lookup');button.disabled=true;
  locationStatus.textContent='Finding coordinates and historical timezone…';
  locationResults.innerHTML='';
  try{
    const response=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(city)+'&count=100&language=en&format=json');
    if(!response.ok)throw Error('Geocoding HTTP '+response.status);
    const data=await response.json();
    let items=(data.results||[]).filter(x=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)&&x.timezone);
    if(region){
      const wanted=(states[region.toUpperCase()]||region).toLowerCase();
      items=items.filter(x=>[x.admin1,x.admin2,x.country,x.country_code].some(v=>v?.toLowerCase()===wanted));
    }
    if(!items.length)throw Error('No exact city/state match. Try the full state name or city alone.');
    const choose=item=>{
      const label=[item.name,item.admin1,item.country].filter(Boolean).join(', ');
      selectedLocation={label,timezone:item.timezone};
      manuallyEditedOffset=false;placeInput.value=label;
      latInput.value=String(item.latitude);lonInput.value=String(item.longitude);
      locationResults.innerHTML='';
      try{refreshOffset()}catch(err){locationStatus.textContent='Coordinates filled for '+label+'. UTC could not be determined: '+err.message}
    };
    if(items.length===1){choose(items[0]);return}
    locationStatus.textContent='Multiple matching places. Select the correct city:';
    for(const item of items.slice(0,12)){
      const option=document.createElement('button');option.type='button';option.className='place-option';
      option.textContent=[item.name,item.admin1,item.country].filter(Boolean).join(', ')+' — '+item.latitude.toFixed(4)+', '+item.longitude.toFixed(4);
      option.addEventListener('click',()=>choose(item));locationResults.appendChild(option);
    }
  }catch(err){locationStatus.textContent='Location lookup: '+err.message}
  finally{button.disabled=false}
}
$('lookup').addEventListener('click',lookupPlace);
placeInput.addEventListener('change',()=>{if(!selectedLocation&&placeInput.value.trim())lookupPlace()});
placeInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookupPlace()}});

function times(form){const [y,m,d]=form.date.split('-').map(Number),[hr,min]=form.time.split(':').map(Number); const offset=Number(form.offset);const ms=Date.UTC(y,m-1,d,hr,min)-offset*3600000;return new Date(ms)}
// Shared whole-sign chart relationships. These do not depend on interpretive schools.
const ASPECT_STEPS={Sun:[7],Moon:[7],Mars:[4,7,8],Mercury:[7],Jupiter:[5,7,9],Venus:[7],Saturn:[3,7,10]};
function relationshipModel(positions){
  const ascSign=sign(positions.Asc), planets={};
  for(const name of P){
    const longitude=mod(positions[name]),zodiac=sign(longitude);
    planets[name]={name,longitude,sign:zodiac,house:((zodiac-ascSign+12)%12)+1,
      nakshatra:nk(longitude),retrograde:false,
      ruledHouses:Array.from({length:12},(_,i)=>i+1).filter(i=>RULERS[(ascSign+i-1)%12]===name)};
  }
  const conjunctions=[],parashari=[],jaimini=[];
  for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++)
    if(planets[P[i]].sign===planets[P[j]].sign)
      conjunctions.push({a:P[i],b:P[j],sign:planets[P[i]].sign});
  for(const source of Object.keys(ASPECT_STEPS))for(const step of ASPECT_STEPS[source]){
    const destinationSign=(planets[source].sign+step-1)%12;
    parashari.push({source,step,targetSign:destinationSign,targetHouse:((destinationSign-ascSign+12)%12)+1,
      targets:P.filter(name=>name!==source&&planets[name].sign===destinationSign)});
  }
  const mode=z=>z%3===0?'movable':z%3===1?'fixed':'dual';
  for(let a=0;a<12;a++)for(let b=0;b<12;b++){
    const distance=(b-a+12)%12,am=mode(a),bm=mode(b);
    const matched=(am==='movable'&&bm==='fixed'&&distance!==1&&distance!==11)||
      (am==='fixed'&&bm==='movable'&&distance!==1&&distance!==11)||
      (am==='dual'&&bm==='dual'&&a!==b);
    if(matched)jaimini.push({fromSign:a,toSign:b,fromPlanets:P.filter(n=>planets[n].sign===a),toPlanets:P.filter(n=>planets[n].sign===b)});
  }
  return {ascSign,planets,conjunctions,parashari,jaimini};
}
function validateRelationshipModel(){
  const p={Asc:0,Sun:0,Moon:90,Mars:0,Mercury:45,Jupiter:120,Venus:210,Saturn:300,Rahu:60,Ketu:240};
  const r=relationshipModel(p);
  const marsFourth=r.parashari.find(a=>a.source==='Mars'&&a.step===4);
  const jupiterFifth=r.parashari.find(a=>a.source==='Jupiter'&&a.step===5);
  if(marsFourth.targetSign!==3||jupiterFifth.targetSign!==8||r.planets.Moon.house!==4)
    throw Error('Relationship model failed its whole-sign verification');
  if(!r.conjunctions.some(a=>a.a==='Sun'&&a.b==='Mars'))
    throw Error('Relationship conjunction verification failed');
  if(r.jaimini.some(a=>a.fromSign===0&&a.toSign===1)||!r.jaimini.some(a=>a.fromSign===0&&a.toSign===4))
    throw Error('Jaimini sign rule verification failed');
}
function chart(form){const dt=times(form);if(!Number.isFinite(dt.getTime()))throw Error('Invalid date or time');const jd=swe.dateToJulianDay(dt); const ay=swe.getAyanamsaExUt(jd,CalculationFlag.MoshierEphemeris);if(!Number.isFinite(ay))throw Error('Ayanamsa calculation returned invalid data');const flags=CalculationFlag.MoshierEphemeris|CalculationFlag.Speed|CalculationFlag.Sidereal;
const bodies={Sun:Planet.Sun,Moon:Planet.Moon,Mars:Planet.Mars,Mercury:Planet.Mercury,Jupiter:Planet.Jupiter,Venus:Planet.Venus,Saturn:Planet.Saturn,Rahu:LunarPoint.MeanNode};
const positions={};for(const [name,b] of Object.entries(bodies)){const pos=swe.calculatePosition(jd,b,flags); if(!Number.isFinite(pos.longitude))throw Error(name+' coordinates unavailable'); positions[name]=mod(pos.longitude)}
positions.Ketu=mod(positions.Rahu+180);
const angles=swe.calculateHouses(jd,Number(form.lat),Number(form.lon),HouseSystem.Placidus);const asc=angles.ascendant;if(!Number.isFinite(asc))throw Error('Ascendant calculation failed');positions.Asc=mod(asc-ay);
const relationships=relationshipModel(positions);
return {positions,relationships,mc:Number.isFinite(angles.mc)?mod(angles.mc-ay):null,ayanamsa:ay,dt,jd,form}}
const YOGINI_NAMES=['Mangala','Pingala','Dhanya','Bhramari','Bhadrika','Ulka','Siddha','Sankata'];
const YOGINI_RULERS=['Moon','Sun','Jupiter','Mars','Mercury','Saturn','Venus','Rahu'];
const YOGINI_YEARS=[1,2,3,4,5,6,7,8];
function dasha(p,dt,system='vimshottari',yearDays=365.2425,reference='janma'){
  const moon=mod(p.Moon), nakSpan=360/27, n=Math.min(26,Math.floor(moon/nakSpan));
  const elapsed=(moon-n*nakSpan)/nakSpan;
  const yogini=system==='yogini';
  const names=yogini?YOGINI_NAMES:LORDS, rulers=yogini?YOGINI_RULERS:LORDS;
  const years=yogini?YOGINI_YEARS:YEARS, total=yogini?36:120;
  const first=yogini?((n+1+3+7)%8):((n+(reference==='adhana'?7:0))%9);
  const yearMs=yearDays*86400000, birth=dt.getTime();
  let cursor=birth-elapsed*years[first]*yearMs;
  const rows=[];
  // Repeat the full classical cycle until at least 125 years after birth.
  for(let j=0;j<names.length*12&&cursor<birth+125*yearMs;j++){
    const k=(first+j)%names.length,length=years[k],start=cursor,end=start+length*yearMs,ants=[];
    let sub=start;
    for(let a=0;a<names.length;a++){
      const ix=(k+a)%names.length;
      const subEnd=a===names.length-1?end:sub+length*years[ix]/total*yearMs;
      ants.push({lord:names[ix],ruler:rulers[ix],start:sub,end:subEnd});
      sub=subEnd;
    }
    rows.push({lord:names[k],ruler:rulers[k],years:length,start,end,ants});
    cursor=end;
  }
  return rows.filter(r=>r.end>birth);
}
let mostRecentChart=null;
function renderDasha(data){
  const system=$('dasha-system').value,yearDays=Number($('dasha-year').value),reference=$('dasha-reference').value;
  $('vimshottari-reference-wrap').hidden=system==='yogini';
  const ds=dasha(data.positions,data.dt,system,yearDays,reference),now=Date.now();
  const current=ds.find(x=>x.start<=now&&now<x.end),sub=current?.ants.find(x=>x.start<=now&&now<x.end);
  const systemName=system==='yogini'?'Yogini (36 years)':(reference==='adhana'?'Adhana-reference Vimshottari (120 years)':'Vimshottari (120 years)');
  $('dasha-explanation').textContent=systemName+' · '+yearDays+' days per daśā year · Moon nakshatra at birth: '+nk(data.positions.Moon)+'. Opening period includes the remaining nakshatra balance. '+(system==='yogini'?'Yogini starting lord = remainder of (nakshatra number + 3) / 8.':(reference==='adhana'?'Adhana reference = eighth nakshatra inclusively from Janma ('+N[(Math.floor(mod(data.positions.Moon)/(360/27))+7)%27]+'). The prototype preserves the Moon’s intra-nakshatra elapsed fraction to set the opening balance; this is an explicitly chosen comparison convention, not an independently verified universal classical Adhana balance rule.':'Standard Vimshottari follows the nine planetary lords.'))+' Antardaśās are proportional divisions of each mahādaśā.';
  $('dashas').classList.remove('placeholder');
  $('dashas').innerHTML=ds.map(r=>'<details class="dasha-row '+(r.start<=now&&now<r.end?'current':'')+'" '+(r.start<=now&&now<r.end?'open':'')+'><summary class="dasha-head"><strong>'+esc(r.lord)+' <span class="badge">'+r.years+' yrs</span></strong><small>'+date(r.start)+' — '+date(r.end)+'</small></summary><div class="ad-list">'+r.ants.map(a=>'<div class="ad-row '+(a.start<=now&&now<a.end?'active':'')+'"><span>'+esc(r.lord)+' / '+esc(a.lord)+(system==='yogini'?' ('+esc(a.ruler)+')':'')+'</span><span>'+date(a.start)+' — '+date(a.end)+'</span></div>').join('')+'</div></details>').join('');
  const currentLabel=current?(system==='yogini'?current.lord+' ('+current.ruler+')':current.lord):'Outside range';
  const subLabel=sub?sub.lord+' antardaśā':'—';
  const highlights=$('highlights').querySelectorAll('.highlight');
  if(highlights.length>3){highlights[3].querySelector('strong').textContent=currentLabel;highlights[3].querySelector('small').textContent=subLabel}
}
$('dasha-system').addEventListener('change',()=>{if(mostRecentChart)renderDasha(mostRecentChart)});
$('dasha-year').addEventListener('change',()=>{if(mostRecentChart){renderDasha(mostRecentChart);renderNatalReport(mostRecentChart);renderPeriodReport(mostRecentChart)}});
$('dasha-reference').addEventListener('change',()=>{if(mostRecentChart)renderDasha(mostRecentChart)});
function yogas(p,relationships){
 const result=[],asc=p.Asc,hs=n=>house(p[n],asc),same=(a,b)=>sign(p[a])===sign(p[b]);
 const add=(category,title,proof,reading,caveat='Strength, aspects, combustion and cancellations have not been fully assessed.')=>result.push({category,title,proof,reading,caveat});
 const l=n=>RULERS[(sign(asc)+n-1)%12],inK=n=>[1,4,7,10].includes(hs(n)),inT=n=>[1,5,9].includes(hs(n));
 const relation=(a,b)=>same(a,b)||((sign(p[a])+6)%12===sign(p[b]));
 const exchange=(a,b)=>a!==b&&RULERS[sign(p[a])]===b&&RULERS[sign(p[b])]===a;
 if([1,4,7,10].includes(house(p.Jupiter,p.Moon)))add('Lunar','Gaja Kesari Yoga','Jupiter '+fmt(p.Jupiter)+' is in house '+house(p.Jupiter,p.Moon)+' from Moon '+fmt(p.Moon)+'.','Traditionally associated with wisdom, counsel and social support.');
 if(same('Sun','Mercury'))add('Solar','Budha Aditya Yoga','Sun '+fmt(p.Sun)+' and Mercury '+fmt(p.Mercury)+' share '+Z[sign(p.Sun)]+'.','Traditionally connected to learning, analysis and communication.','Mercury combustion and conjunction closeness require separate analysis.');
 if(same('Moon','Mars')||house(p.Mars,p.Moon)===7)add('Lunar','Chandra Mangala Yoga','Moon in house '+hs('Moon')+'; Mars in house '+hs('Mars')+'; conjunction/opposition by sign.','Traditionally associated with resourcefulness and material initiative.');
 const own={Mars:[0,7],Mercury:[2,5],Jupiter:[8,11],Venus:[1,6],Saturn:[9,10]},exalt={Mars:9,Mercury:5,Jupiter:3,Venus:11,Saturn:6},names={Mars:'Ruchaka',Mercury:'Bhadra',Jupiter:'Hamsa',Venus:'Malavya',Saturn:'Shasha'};
 for(const n of Object.keys(own))if(inK(n)&&(own[n].includes(sign(p[n]))||exalt[n]===sign(p[n])))add('Mahapurusha',names[n]+' Mahapurusha Yoga',n+' '+fmt(p[n])+' in natal house '+hs(n)+' ('+(own[n].includes(sign(p[n]))?'own':'exalted')+' sign).','Traditionally associated with the prominence of '+n+' qualities.');
 const nine=l(9),ten=l(10);
 if(nine!==ten&&(same(nine,ten)||exchange(nine,ten)))add('Raja','Dharma–Karma Adhipati Yoga','9th lord '+nine+' and 10th lord '+ten+' '+(same(nine,ten)?'conjoin in '+Z[sign(p[nine])]:'exchange their occupied signs')+'.','Traditionally connects fortune, purpose and professional responsibility.');
 for(const a of [1,5,9])for(const b of [1,4,7,10]){
   if(a===b)continue;
   const x=l(a),y=l(b);
   if(x!==y&&(same(x,y)||exchange(x,y)))add('Raja','Kendra–Trikona Raja Yoga ('+a+'th / '+b+'th)','House '+a+' lord '+x+' and house '+b+' lord '+y+' '+(same(x,y)?'occupy '+Z[sign(p[x])]+' together':'are in sign exchange')+'.','A potential connection of trinal and angular lordships.','This is a conjunction/exchange screening rule, not full Parashari aspect evaluation or a confirmed strong Raja Yoga.');
 }
 const second=l(2),eleventh=l(11);
 if(second!==eleventh&&(same(second,eleventh)||exchange(second,eleventh)))add('Dhana','2nd–11th Lord Dhana Yoga','2nd lord '+second+' and 11th lord '+eleventh+' '+(same(second,eleventh)?'share '+Z[sign(p[second])]:'exchange signs')+'.','A classical wealth-house connection; outcome depends on placement and dignity.');
 const sixth=l(6),eighth=l(8),twelfth=l(12);
 // Detailed Neecha Bhanga and Vipareeta screening runs below with explicit qualifying rules.
 const neighbors=(center,dist)=>P.filter(n=>!['Sun','Rahu','Ketu','Moon'].includes(n)&&house(p[n],p[center])===dist);
 const sunapha=neighbors('Moon',2),anapha=neighbors('Moon',12);
 if(sunapha.length)add('Lunar','Sunapha Yoga',sunapha.join(', ')+' in second sign from Moon.','Traditionally connected with self-earned resources and initiative.');
 if(anapha.length)add('Lunar','Anapha Yoga',anapha.join(', ')+' in twelfth sign from Moon.','Traditionally connected with independence and sustained effort.');
 if(sunapha.length&&anapha.length)add('Lunar','Durudhara Yoga','Planets on both sides of Moon: '+sunapha.join(', ')+' / '+anapha.join(', ')+'.','A traditional lunar support combination.');
 const occupied=n=>P.filter(q=>q!==n&&sign(p[q])===sign(p[n]));
 if(occupied('Moon').filter(n=>!['Rahu','Ketu'].includes(n)).length===0&&!sunapha.length&&!anapha.length&&!inK('Moon'))add('Lunar','Kemadruma screening indication','Moon has no sign conjunction and no qualifying planets in adjacent signs; Moon is not in a natal kendra.','Potential lunar isolation combination.','Kemadruma cancellation rules are extensive; do not treat this screening detection as a final yoga judgment.');
 // Two source-specific yoga screens; neither guarantees Raja Yoga fruition.
 const kendraFrom=(a,b)=>[1,4,7,10].includes(house(p[a],p[b]));
 const exaltLordForSign=z=>Object.keys(DIGNITY_SIGNS).find(n=>DIGNITY_SIGNS[n].exalt===z);
 for(const planet of ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn']){
   const z=sign(p[planet]),data=DIGNITY_SIGNS[planet];
   if(z!==data.debil)continue;
   const dispositor=RULERS[z],exaltLord=exaltLordForSign(z),checks=[];
   if(kendraFrom(dispositor,'Asc'))checks.push('Dispositor '+dispositor+' is in a kendra from Lagna (house '+hs(dispositor)+')');
   if(kendraFrom(dispositor,'Moon'))checks.push('Dispositor '+dispositor+' is in a kendra from Moon');
   if(exaltLord&&kendraFrom(exaltLord,'Asc'))checks.push('Planet exalted in '+Z[z]+' ('+exaltLord+') is angular from Lagna');
   if(exaltLord&&kendraFrom(exaltLord,'Moon'))checks.push('Planet exalted in '+Z[z]+' ('+exaltLord+') is angular from Moon');
   if(checks.length)add('Neecha Bhanga','Neecha Bhanga candidate — '+planet,
     planet+' '+fmt(p[planet])+' is debilitated. '+checks.join('; ')+'.',
     'Cancellation of debilitation is indicated by angular support under the selected Parashari screening rules.',
     'Cancellation of debilitation is not automatically Neecha Bhanga Raja Yoga. Other formulations, divisional strength and actual Raja Yoga conditions need separate judgment.');
 }
 const auspicious=new Set([1,5,9,10]);
 for(const [source,named] of [[6,'Harsha'],[8,'Sarala'],[12,'Vimala']]){
   const lord=l(source),target=hs(lord);if(![6,8,12].includes(target))continue;
   const others=Array.from({length:12},(_,i)=>i+1).filter(h=>l(h)===lord&&h!==source);
   const sameSign=P.filter(n=>n!==lord&&sign(p[n])===sign(p[lord])&&['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'].includes(n));
   const joinedBenefics=sameSign.filter(n=>['Jupiter','Venus','Mercury','Moon'].includes(n));
   const otherLordships=others.filter(n=>auspicious.has(n));
   const strict=target!==source&&!joinedBenefics.length&&!otherLordships.length;
   add('Vipareeta',named+' Yoga '+(strict?'candidate':'placement indicator'),
     source+'th lord '+lord+' is in house '+target+' ('+fmt(p[lord])+'). Other rulerships: '+(others.join(', ')||'none')+'. Same-sign classical planet associations: '+(sameSign.join(', ')||'none')+'.',
     strict?'Meets the implemented stricter dusthana placement and association screening; further chart-level confirmation remains necessary.':'Meets the broad dusthana placement rule, but is not confirmed under stricter variants.',
     (target===source?'Own-dusthana occupancy is not accepted by some stricter traditions. ':'')+
     (joinedBenefics.length?'Possible benefic conjunction: '+joinedBenefics.join(', ')+'. ':'')+
     (otherLordships.length?'Additional auspicious house lordship: '+otherLordships.join(', ')+'. ':'')+
     'Received aspects, strength, and lineage-specific exclusions still require assessment.');
 }
 // Additional conjunction, sign exchange, and directional graha drishti evidence.
 // Jaimini and Nadi connections are displayed as context only, never as automatic Parashari yogas.
 const graha=(a,b)=>relationships.parashari.find(x=>x.source===a&&x.targets.includes(b));
 const pairRules=(a,b)=>{
   if(a===b)return ['Same planetary lord'];
   const matches=[];
   if(same(a,b))matches.push('same-sign conjunction in '+Z[sign(p[a])]);
   if(exchange(a,b))matches.push('mutual sign exchange');
   if(graha(a,b))matches.push(a+' aspects '+b+' (Parashari '+graha(a,b).step+'th aspect)');
   if(graha(b,a))matches.push(b+' aspects '+a+' (Parashari '+graha(b,a).step+'th aspect)');
   return matches;
 };
 const seen=new Set(result.filter(y=>y.category==='Raja').map(y=>y.title));
 for(const a of [1,5,9])for(const b of [1,4,7,10]){
   if(a===b)continue;
   const x=l(a),y=l(b);if(x===y)continue;
   const rules=pairRules(x,y),name='Kendra–Trikona lord relationship ('+a+' / '+b+')';
   if(!rules.length||seen.has(name))continue;
   seen.add(name);
   add('Raja',name,'House '+a+' lord '+x+' ('+fmt(p[x])+') and house '+b+' lord '+y+' ('+fmt(p[y])+'): '+rules.join('; ')+'.','A candidate auspicious lordship connection involving trinal and angular houses.','Aspects are directional, not automatically mutual. Strength, benefic/malefic functional roles and yoga exceptions are unverified.');
 }
 const wealthPairs=[[2,5],[2,9],[2,11],[5,11],[9,11]];
 for(const [a,b] of wealthPairs){
   const x=l(a),y=l(b);if(x===y)continue;
   const evidence=pairRules(x,y);
   if(evidence.length)add('Dhana','Wealth lord relationship ('+a+' / '+b+')','House '+a+' lord '+x+' and house '+b+' lord '+y+': '+evidence.join('; ')+'.','Potential relationship between wealth and trinal or gain-related houses.','This screens for relations; no assessment of realization, lordship complications or financial outcomes.');
 }
 const marakaContacts=['Saturn','Mars','Rahu','Ketu'];
 for(const y of result){
   const proofText=y.proof;
   const mentioned=P.filter(n=>new RegExp('\\b'+n+'\\b').test(proofText));
   const notes=[];
   for(const n of mentioned){
     const dignity=planetCondition(n,p);
     if(dignity==='Debilitation sign')notes.push(n+' in debilitation sign');
     else if(dignity==='Exaltation sign')notes.push(n+' exalted');
     else if(dignity==='Own sign')notes.push(n+' in own sign');
     const contacts=marakaContacts.filter(m=>m!==n&&(same(m,n)||graha(m,n))).filter(m=>!mentioned.includes(m));
     if(contacts.length)notes.push(n+' contacted by '+contacts.join(', ')+' (screening only)');
   }
   const jaf=relationships.jaimini.filter(x=>x.fromPlanets.some(n=>mentioned.includes(n))&&x.toPlanets.some(n=>mentioned.includes(n)));
   const nad=nadiRelationships(p).filter(x=>mentioned.includes(x.a)&&mentioned.includes(x.b));
   y.qualifiers=notes;
   y.otherSystems=[
      ...(jaf.length?['Jaimini sign relationship also exists ('+jaf.length+' directed link(s)); not a Parashari yoga condition.']:[]),
      ...(nad.length?['Nadi-inspired sign connection also exists ('+nad.map(x=>NADI_TYPES[x.type]).join(', ')+'); contextual only.']:[])
   ];
 }
 return result;
}
function renderWheel(p){const names=Array.from({length:12},(_,i)=>Z[i]);const ascSign=sign(p.Asc);const ring=[];const cx=210,cy=210;
for(let i=0;i<12;i++){const start=(i*30-90)*Math.PI/180,end=((i+1)*30-90)*Math.PI/180;const x1=cx+192*Math.cos(start),y1=cy+192*Math.sin(start),x2=cx+192*Math.cos(end),y2=cy+192*Math.sin(end);ring.push('<path d="M210 210 L'+x1.toFixed(2)+' '+y1.toFixed(2)+' A192 192 0 0 1 '+x2.toFixed(2)+' '+y2.toFixed(2)+' Z" fill="'+(i%2?'#192737':'#122131')+'" stroke="#586071" stroke-width=".7"/>');
const angle=(i*30+15-90)*Math.PI/180,tx=cx+159*Math.cos(angle),ty=cy+159*Math.sin(angle);
ring.push('<text x="'+tx+'" y="'+ty+'" text-anchor="middle" fill="'+(i===0?'#f1cf91':'#9baec1')+'" font-size="12">'+Z[(ascSign+i)%12].slice(0,3)+' · '+(i+1)+'</text>');
const members=P.filter(n=>sign(p[n])===(ascSign+i));const rad=103;members.forEach((n,j)=>{const a=angle+((j-(members.length-1)/2)*0.11);const r=rad-(j%2)*17;ring.push('<text x="'+(cx+r*Math.cos(a)).toFixed(1)+'" y="'+(cy+r*Math.sin(a)).toFixed(1)+'" fill="#eac38d" font-size="16" text-anchor="middle">'+G[n]+'</text>')})}
ring.push('<circle cx="210" cy="210" r="47" fill="#0c1420" stroke="#89724f"/>','<text x="210" y="203" text-anchor="middle" font-size="12" fill="#9cacbe">ASC</text>','<text x="210" y="223" text-anchor="middle" font-size="15" fill="#eccc93">'+Z[ascSign]+'</text>');
$('wheel').innerHTML='<svg viewBox="0 0 420 420" role="img" aria-label="Whole-sign circular chart beginning with the ascendant sign">'+ring.join('')+'</svg>'}

const HOUSE_TOPICS=['identity, initiative and physical vitality','income, family resources and speech','effort, skills and communication','home, property and emotional foundations','education, creativity and children','work duties, competition and health routines','partnership, agreements and public dealings','shared resources, uncertainty and major transitions','learning, teachers, beliefs and long-distance opportunities','career, authority and public contribution','networks, income gains and ambitions','expenses, solitude, foreign ties and release'];
const PLANET_ACTIONS={Sun:'authority, visibility and decisions',Moon:'emotional responses, needs and public connection',Mars:'action, conflict management and technical initiative',Mercury:'analysis, negotiation and information exchange',Jupiter:'guidance, growth and judgment',Venus:'relationships, agreements, aesthetics and comfort',Saturn:'obligations, delays, limits and durable structures'};
const DIGNITY_SIGNS={Sun:{own:[4],exalt:0,debil:6},Moon:{own:[3],exalt:1,debil:7},Mars:{own:[0,7],exalt:9,debil:3},Mercury:{own:[2,5],exalt:5,debil:11},Jupiter:{own:[8,11],exalt:3,debil:9},Venus:{own:[1,6],exalt:11,debil:5},Saturn:{own:[9,10],exalt:6,debil:0}};
function planetCondition(n,p){
 const z=sign(p[n]),d=DIGNITY_SIGNS[n];
 if(!d)return 'Dignity not assessed';
 if(d.exalt===z)return 'Exaltation sign';
 if(d.debil===z)return 'Debilitation sign';
 if(d.own.includes(z))return 'Own sign';
 return 'Other sign (full dignity not calculated)';
}
function renderAspects(data){
 const {positions:p,relationships:r}=data, parent=$('aspects');
 if(!parent)return;
 const selected=$('aspect-planet').value;
 const selectedRows=r.parashari.filter(a=>selected==='all'||a.source===selected);
 const incoming=Object.fromEntries(Object.keys(ASPECT_STEPS).map(n=>[n,r.parashari.filter(a=>a.targets.includes(n)).map(a=>a.source)]));
 const cards=selectedRows.map(a=>{
   const sender=r.planets[a.source],rulers=sender.ruledHouses,receivers=a.targets;
   const ownership=rulers.length?rulers.map(h=>'house '+h+' ('+HOUSE_TOPICS[h-1]+')').join(' and '):'no classical natal house lordships';
   const targetText=receivers.length?receivers.map(n=>n+' ('+fmt(p[n])+', natal house '+r.planets[n].house+')').join('; '):'No classical planet occupies this sign';
   const group=receivers.length?'It also contacts '+receivers.map(n=>n+' and its topics of '+PLANET_ACTIONS[n]||n).join('; ')+'.':'With no planet in the receiving sign, the aspect acts on the house rather than a specific natal planet.';
   const conjunctions=r.conjunctions.filter(x=>x.a===a.source||x.b===a.source).map(x=>x.a===a.source?x.b:x.a);
   const cond=planetCondition(a.source,p);
   const interpretation=a.source+' occupies the '+sender.house+'th natal house in '+Z[sender.sign]+' ('+fmt(p[a.source])+') and rules '+ownership+'. Its '+a.step+(a.step===3?'rd':a.step===4?'th':a.step===5?'th':a.step===7?'th':a.step===8?'th':a.step===9?'th':'th')+' Parashari aspect reaches house '+a.targetHouse+' ('+HOUSE_TOPICS[a.targetHouse-1]+'). In this traditional reading, '+PLANET_ACTIONS[a.source]+' associated with its placement and ruled houses may shape matters of the receiving house. '+group;
   return '<article class="aspect-card"><div class="aspect-card-top"><strong>'+esc(a.source)+' → House '+a.targetHouse+'</strong><span>'+a.step+'th aspect · '+esc(Z[a.targetSign])+'</span></div><p class="aspect-positions"><b>Source:</b> '+esc(fmt(p[a.source]))+' · natal house '+sender.house+' · '+esc(cond)+'</p><p><b>Receiving planets:</b> '+esc(targetText)+'</p><p>'+esc(interpretation)+'</p><small><b>Further context:</b> '+esc(conjunctions.length?'Conjunct '+conjunctions.join(', ')+'. ':'No same-sign conjunction. ')+(incoming[a.source].length?'Aspected by '+incoming[a.source].join(', ')+'. ':'No other classical graha drishti detected on the source. ')+'Whole-sign directional aspects only; orb, shadbala, combustion and exact strength are not assessed.</small></article>';
 });
 parent.innerHTML='<p class="subtle">'+selectedRows.length+' directional aspects shown. Seven classical planets are aspect sources; Rahu/Ketu aspects vary by school and are not assumed here. A planet in the destination sign is listed separately from the aspected house.</p>'+cards.join('');
}
$('aspect-planet').addEventListener('change',()=>{if(mostRecentChart)renderAspects(mostRecentChart)});

const NADI_THEMES={Sun:'authority, visibility and leadership',Moon:'emotion, care and adaptability',Mars:'initiative, pressure and technical work',Mercury:'communication, calculation and commerce',Jupiter:'teaching, judgment and guidance',Venus:'relationships, aesthetics and comforts',Saturn:'responsibility, repetition and long-term duties',Rahu:'amplification, unusual ambitions and foreign influences',Ketu:'detachment, investigation and simplification'};
const NADI_TYPES={same:'Same-sign conjunction',trine:'Trinal sign connection',next:'Second-sign connection',previous:'Twelfth-sign connection'};
function nadiRelationships(p){
 const edges=[];
 for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){
   const a=P[i],b=P[j],forward=(sign(p[b])-sign(p[a])+12)%12;
   if(forward===0)edges.push({a,b,type:'same',direction:'mutual'});
   else if(forward===4||forward===8)edges.push({a,b,type:'trine',direction:'mutual'});
   else if(forward===1)edges.push({a,b,type:'next',direction:a+' → '+b});
   else if(forward===11)edges.push({a,b,type:'previous',direction:b+' → '+a});
 }
 return edges;
}
function nadiChains(edges){
 const graph=Object.fromEntries(P.map(n=>[n,new Set()]));
 for(const e of edges){graph[e.a].add(e.b);graph[e.b].add(e.a)}
 const visited=new Set(),components=[];
 for(const planet of P){
   if(visited.has(planet))continue;
   const todo=[planet],group=[];
   while(todo.length){const n=todo.pop();if(visited.has(n))continue;visited.add(n);group.push(n);for(const next of graph[n])if(!visited.has(next))todo.push(next)}
   if(group.length>1)components.push(group.sort((a,b)=>P.indexOf(a)-P.indexOf(b)));
 }
 return components.sort((a,b)=>b.length-a.length);
}
function renderNadi(data){
 const parent=$('nadi-results');if(!parent)return;
 const p=data.positions,edges=nadiRelationships(p),filter=$('nadi-planet').value,type=$('nadi-type').value;
 const matches=edges.filter(e=>(filter==='all'||e.a===filter||e.b===filter)&&(type==='all'||e.type===type));
 const chains=nadiChains(edges);
 const cards=matches.map(e=>{
   const first=fmt(p[e.a]),second=fmt(p[e.b]),h1=house(p[e.a],p.Asc),h2=house(p[e.b],p.Asc);
   const label=NADI_TYPES[e.type],relationship=e.type==='same'?'share the same sidereal sign':e.type==='trine'?'occupy signs separated by a trinal interval':'occupy neighboring signs';
   const direction=e.type==='same'||e.type==='trine'?'Two-way sign connection':'Directional sign sequence: '+e.direction;
   const reading=e.a+' ('+NADI_THEMES[e.a]+') and '+e.b+' ('+NADI_THEMES[e.b]+') '+relationship+'. In a Bhrigu Nandi Nadi-inspired reading, this links the topics of natal houses '+h1+' and '+h2+' through those planetary significations. The connection may be used as a hypothesis for interpretation; it does not establish an event or its timing.';
   return '<article class="nadi-card"><div class="aspect-card-top"><strong>'+esc(e.a)+' ↔ '+esc(e.b)+'</strong><span>'+esc(label)+'</span></div><p><b>Chart evidence:</b> '+esc(e.a+' '+first+' · house '+h1+'; '+e.b+' '+second+' · house '+h2)+'</p><p>'+esc(reading)+'</p><small>'+esc(direction)+'. Rule conventions vary among Nadi teachers; this implementation is an explicitly labeled comparative model, not an authoritative single-school reading.</small></article>';
 });
 const chainText=chains.length?chains.map((group,i)=>'<div class="nadi-chain"><b>Chain '+(i+1)+':</b> '+esc(group.join(' · '))+' <small>'+group.length+' connected planets through supported same-sign, trinal or adjacent-sign links; this is a connected network, not a demonstrated chronological event sequence.</small></div>').join(''):'<p class="subtle">No multi-planet chains were detected with the selected connection rules.</p>';
 parent.innerHTML='<p class="subtle">'+matches.length+' planetary pairs match the selected filters. Nodes Rahu and Ketu are included here as significators, unlike the seven classical Parashari aspect sources.</p>'+cards.join('')+(matches.length?'':'<p class="subtle">No relationships match this filter.</p>');
 $('nadi-chains').innerHTML=chainText;
}
$('nadi-planet').addEventListener('change',()=>{if(mostRecentChart)renderNadi(mostRecentChart)});
$('nadi-type').addEventListener('change',()=>{if(mostRecentChart)renderNadi(mostRecentChart)});

const KARAKA_NAMES=['Atmakaraka','Amatyakaraka','Bhratrikaraka','Matrikaraka','Putrakaraka','Gnatikaraka','Darakaraka'];
function charaKarakas(positions){
 // Seven-karaka scheme, using sidereal degrees within each sign; nodes excluded.
 const seven=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
 return seven.map(n=>({name:n,degree:mod(positions[n])%30}))
   .sort((a,b)=>b.degree-a.degree||seven.indexOf(a.name)-seven.indexOf(b.name))
   .map((item,i)=>({...item,role:KARAKA_NAMES[i]}));
}
function renderJaimini(data){
 const el=$('jaimini-results');if(!el)return;
 const p=data.positions,r=data.relationships,selected=$('jaimini-sign').value;
 const karakas=charaKarakas(p),roles=Object.fromEntries(karakas.map(k=>[k.name,k.role]));
 const signMode=z=>z%3===0?'movable':z%3===1?'fixed':'dual';
 const rows=r.jaimini.filter(a=>a.fromPlanets.length&&(selected==='all'||a.fromSign===Number(selected)));
 const relevant=rows.map(a=>{
  const sources=a.fromPlanets.map(n=>n+' ('+(roles[n]||'node')+')').join(', ');
  const recipients=a.toPlanets.length?a.toPlanets.map(n=>n+' ('+(roles[n]||'node')+', '+fmt(p[n])+')').join('; '):'No natal planet in this sign';
  const h=((a.toSign-sign(p.Asc)+12)%12)+1;
  const reading='Planets in '+Z[a.fromSign]+' influence '+Z[a.toSign]+' by Jaimini Rashi Drishti. This directs attention to natal house '+h+' ('+HOUSE_TOPICS[h-1]+') and '+(a.toPlanets.length?'the receiving planetary significations.':'the unoccupied receiving sign and its house lord.')+' Chara Karaka roles identify personal significators, not a prediction by themselves.';
  return '<article class="jaimini-card"><div class="aspect-card-top"><strong>'+esc(Z[a.fromSign])+' → '+esc(Z[a.toSign])+'</strong><span>'+signMode(a.fromSign)+' → '+signMode(a.toSign)+'</span></div><p><b>Source planets:</b> '+esc(sources)+'</p><p><b>Receiving planets:</b> '+esc(recipients)+'</p><p>'+esc(reading)+'</p><small>Sign aspect, not Parashari graha drishti. All planets in the source sign share this sign relationship. Node karaka assignments are excluded in the seven-karaka model.</small></article>';
 });
 $('jaimini-karakas').innerHTML=karakas.map(k=>'<div class="karaka-row"><b>'+esc(k.role)+'</b><span>'+esc(k.name)+' · '+esc(fmt(p[k.name]))+'</span></div>').join('')+'<p class="subtle">Seven-karaka convention: ranked by sidereal degrees traversed within each sign, highest to lowest. Ties use a stable ordering for display and should be reviewed manually.</p>';
 el.innerHTML='<p class="subtle">'+relevant.length+' directional sign aspects from occupied signs match this filter. Empty receiving signs are shown because Jaimini aspects operate between signs, not only planets.</p>'+(relevant.length?relevant.join(''):'<p class="subtle">No matching occupied source sign aspects.</p>');
}
$('jaimini-sign').addEventListener('change',()=>{if(mostRecentChart)renderJaimini(mostRecentChart)});

// Parashari Navamsa: movable signs begin with themselves, fixed from ninth, dual from fifth.
function navamsaSign(longitude){
 const z=sign(longitude),part=Math.min(8,Math.floor((mod(longitude)%30)/(30/9)));
 const first=(z+(z%3===0?0:z%3===1?8:4))%12;
 return (first+part)%12;
}
function verifyNavamsa(){
 const checks=[[0,0],[3.34,1],[30,9],[60,6],[120,0],[150,9],[359.9,11]];
 for(const [longitude,expected] of checks)if(navamsaSign(longitude)!==expected)throw Error('Navamsa calculation verification failed at '+longitude);
}
function navamsaDignity(n,longitude){
 const d=DIGNITY_SIGNS[n],z=navamsaSign(longitude);
 if(!d)return 'Not assessed';
 return d.exalt===z?'Exaltation sign':d.debil===z?'Debilitation sign':d.own.includes(z)?'Own sign':'Other sign';
}
function renderNavamsa(data){
 const p=data.positions,el=$('navamsa');if(!el)return;
 const asc9=navamsaSign(p.Asc);
 const bodies=['Asc','Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu'];
 const rows=bodies.map(n=>{
  const z=navamsaSign(p[n]),house9=(z-asc9+12)%12+1,dignity=n==='Asc'?'—':navamsaDignity(n,p[n]);
  const part=Math.min(8,Math.floor((mod(p[n])%30)/(30/9)));
  const d9Degree=((mod(p[n])%30)-(part*30/9))*9;
  return {name:n,z,house9,dignity,d9Degree};
 });
 const wheel=Array.from({length:12},(_,i)=>{
  const z=(asc9+i)%12,occupied=rows.filter(r=>r.z===z).map(r=>G[r.name]||r.name).join(' ');
  return '<div class="d9-house"><small>H'+(i+1)+' · '+esc(Z[z])+'</small><strong>'+esc(occupied||'—')+'</strong></div>';
 }).join('');
 el.innerHTML='<p class="subtle"><b>D9 Ascendant:</b> '+esc(Z[asc9])+'. Each D9 sign and degree comes from the sidereal D1 longitude using nine equal 3°20′ divisions per sign. Houses shown here use whole-sign houses from D9 ascendant; not independently timed house cusps.</p><div class="d9-grid">'+wheel+'</div><table class="positions-table"><thead><tr><th>Body</th><th>D9 zodiacal degree</th><th>House</th><th>D9 dignity</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.name)+'</td><td>'+esc(Z[r.z]+' '+degreeWithinSign(r.d9Degree))+'</td><td>'+r.house9+'</td><td>'+esc(r.dignity)+'</td></tr>').join('')+'</tbody></table>';
}
const EXALTATION_LONGITUDE={Sun:10,Moon:33,Mars:298,Mercury:165,Jupiter:95,Venus:357,Saturn:200};
const NATURAL_RANK={Sun:7,Moon:6,Venus:5,Jupiter:4,Mercury:3,Mars:2,Saturn:1};
function uchchaBala(n,longitude){
 const deb=mod(EXALTATION_LONGITUDE[n]+180),separation=angularSeparation(longitude,deb);
 return separation/3; // 0..60 virupas, angular distance from exact debilitation point
}
function naisargikaBala(n){return 60*NATURAL_RANK[n]/7}
function verifyStrengthComponents(){
 const fixed={Asc:0,Sun:0,Moon:30,Mars:60,Mercury:180,Jupiter:270,Venus:330,Saturn:45};
 if(kendradiBala('Sun',fixed)!==60||kendradiBala('Moon',fixed)!==30||kendradiBala('Mars',fixed)!==15)throw Error('Kendradi fixture failed');
 for(const n of Object.keys(EXALTATION_LONGITUDE)){
  if(Math.abs(uchchaBala(n,EXALTATION_LONGITUDE[n])-60)>1e-8 ||
     Math.abs(uchchaBala(n,mod(EXALTATION_LONGITUDE[n]+180)))>1e-8)
     throw Error('Uchcha Bala fixture failed for '+n);
 }
 if(Math.abs(digBala('Sun',{Sun:90,Asc:0},90)-60)>1e-8||Math.abs(digBala('Saturn',{Saturn:180,Asc:0},90)-60)>1e-8)throw Error('Dig Bala fixture failed');
 if(Math.abs(naisargikaBala('Saturn')-60/7)>1e-8)throw Error('Naisargika Bala fixture failed');
}
function digBala(n,p,mc){
 if(!Number.isFinite(mc))return null;
 const weakest=({Sun:mod(mc+180),Mars:mod(mc+180),Moon:mc,Venus:mc,Mercury:mod(p.Asc+180),Jupiter:mod(p.Asc+180),Saturn:p.Asc})[n];
 return angularSeparation(p[n],weakest)/3;
}
function kendradiBala(n,p){
 const h=house(p[n],p.Asc);
 return [1,4,7,10].includes(h)?60:[2,5,8,11].includes(h)?30:15;
}
function ojayugmaBala(n,p){
 const wantsEven=['Moon','Venus'].includes(n),match=z=>((z+1)%2===0)===wantsEven;
 return (match(sign(p[n]))?15:0)+(match(navamsaSign(p[n]))?15:0);
}
// Drekkana strength convention: male planets first 10°, neutral middle 10°, female final 10°.
function drekkanaBala(n,longitude){
 const decan=Math.min(2,Math.floor((mod(longitude)%30)/10));
 const target=['Sun','Mars','Jupiter'].includes(n)?0:['Mercury','Saturn'].includes(n)?1:2;
 return decan===target?15:0;
}
function classicalVargaSign(longitude,division){
 const z=sign(longitude),within=mod(longitude)%30;
 if(division===1)return z;
 if(division===9)return navamsaSign(longitude);
 if(division===2){ // Parashari Hora: odd signs Sun then Moon; even signs Moon then Sun.
  const sunHora=(z%2===0)?within<15:within>=15;
  return sunHora?4:3;
 }
 if(division===3)return (z+Math.min(2,Math.floor(within/10))*4)%12;
 if(division===7)return ((z%2===0?z:z+6)+Math.min(6,Math.floor(within/(30/7))))%12;
 if(division===12)return (z+Math.min(11,Math.floor(within/2.5)))%12;
 if(division===30){ // Classical Parashari unequal Trimsamsa portions.
  const odd=z%2===0;
  const edges=odd?[5,10,18,25,30]:[5,12,20,25,30];
  const signs=odd?[0,10,8,2,6]:[1,5,11,9,7];
  return signs[edges.findIndex(edge=>within<edge)];
 }
 throw Error('Unsupported varga D'+division);
}
const NATURAL_FRIENDS={Sun:['Moon','Mars','Jupiter'],Moon:['Sun','Mercury'],Mars:['Sun','Moon','Jupiter'],Mercury:['Sun','Venus'],Jupiter:['Sun','Moon','Mars'],Venus:['Mercury','Saturn'],Saturn:['Mercury','Venus']};
const NATURAL_ENEMIES={Sun:['Venus','Saturn'],Moon:[],Mars:['Mercury'],Mercury:['Moon'],Jupiter:['Mercury','Venus'],Venus:['Sun','Moon'],Saturn:['Sun','Moon','Mars']};
const MOOLATRIKONA={Sun:[4,0,20],Moon:[1,4,30],Mars:[0,0,12],Mercury:[5,16,20],Jupiter:[8,0,10],Venus:[6,0,15],Saturn:[10,0,20]};
const VARGA_SCORE={greatFriend:22.5,friend:15,neutral:7.5,enemy:3.75,greatEnemy:1.875};
function saptavargajaEntry(n,vargaSign,positions,division){
 const lord=RULERS[vargaSign];
 const [mSign,mStart,mEnd]=MOOLATRIKONA[n],deg=mod(positions[n])%30;
 if(division===1&&vargaSign===mSign&&deg>=mStart&&deg<mEnd)return {points:45,grade:'Moolatrikona (D1 degree band)'};
 if(lord===n)return {points:30,grade:'Own sign'};
 const natural=NATURAL_FRIENDS[n].includes(lord)?1:NATURAL_ENEMIES[n].includes(lord)?-1:0;
 // Temporary friendship is evaluated from natal D1 signs, including same-sign enemies.
 const step=house(positions[lord],positions[n]);
 const temporary=[2,3,4,10,11,12].includes(step)?1:-1;
 const compound=natural+temporary;
 const grade=compound===2?'greatFriend':compound===1?'friend':compound===0?'neutral':compound===-1?'enemy':'greatEnemy';
 return {points:VARGA_SCORE[grade],grade,signLord:lord};
}
function saptavargajaBala(n,positions){
 const entries=[1,2,3,7,9,12,30].map(division=>{
  const vargaSign=classicalVargaSign(positions[n],division);
  return {division,sign:vargaSign,...saptavargajaEntry(n,vargaSign,positions,division)};
 });
 return {entries,total:entries.reduce((sum,e)=>sum+e.points,0)};
}
function verifyVargaSubdivisions(){
 const planets=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
 const fixture={Sun:120,Moon:34,Mars:5,Mercury:166,Jupiter:245,Venus:190,Saturn:310};
 if(saptavargajaEntry('Mars',0,fixture,1).points!==45||saptavargajaEntry('Sun',4,fixture,9).points!==30)throw Error('Saptavargaja own and Moolatrikona score fixture failed');
 if(drekkanaBala('Sun',0)!==15||drekkanaBala('Mercury',15)!==15||drekkanaBala('Venus',25)!==15||drekkanaBala('Sun',25)!==0)throw Error('Drekkana Bala verification failed');
 for(const n of [1,2,3,7,9,12,30])for(const x of [0,4.999,5,14.999,15,29.999,30,179.99,359.99]){
  const result=classicalVargaSign(x,n);
  if(!Number.isInteger(result)||result<0||result>11)throw Error('D'+n+' placement verification failed');
 }
}
function renderStrengthFoundation(data){
 const el=$('strength-foundation');if(!el)return;
 const p=data.positions;
 const classical=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
 const rows=classical.map(n=>{
  const d1=planetCondition(n,p),d9=navamsaDignity(n,p[n]),dig=digBala(n,p,data.mc),sap=saptavargajaBala(n,p);
  const separation=n==='Sun'?null:angularSeparation(p[n],p.Sun);
  const combustion=n==='Sun'?'N/A':(separation<=COMBUST_ORBS[n]?'Proximity flag '+separation.toFixed(1)+'°':'No proximity flag');
  return '<tr><td>'+esc(n)+'</td><td>'+uchchaBala(n,p[n]).toFixed(2)+'</td><td>'+ojayugmaBala(n,p)+'</td><td>'+kendradiBala(n,p)+'</td><td>'+drekkanaBala(n,p[n])+'</td><td>'+sap.total.toFixed(2)+'</td><td>'+(dig===null?'N/A':dig.toFixed(2))+'</td><td>'+naisargikaBala(n).toFixed(2)+'</td><td>'+esc(d1)+' / '+esc(d9)+'</td><td>'+esc(combustion)+'</td></tr>';
 });
 const vargaDisplay='<details class="shadbala-status"><summary>Seven classical varga placements (D1/D2/D3/D7/D9/D12/D30)</summary><div class="varga-table-wrap"><table class="positions-table"><thead><tr><th>Planet</th>'+[1,2,3,7,9,12,30].map(k=>'<th>D'+k+'</th>').join('')+'</tr></thead><tbody>'+classical.map(n=>'<tr><td>'+esc(n)+'</td>'+saptavargajaBala(n,p).entries.map(e=>'<td>'+esc(Z[e.sign])+'<small> '+e.points.toFixed(2)+' V</small></td>').join('')+'</tr>').join('')+'</tbody></table></div><p class="subtle">Saptavargaja Bala uses natal D1 temporary friendship (2nd/3rd/4th/10th/11th/12th), directional natural friendship and compound dignity. Moolatrikona scores 45 only in its D1 degree band; other vargas in an own sign score 30. Points use the 22.5/15/7.5/3.75/1.875 Virupa convention. D2 and D30 use specified Parashari conventions.</p></details>';
 el.innerHTML='<p class="subtle"><b>Classical Shadbala: partial calculations only.</b> Values are in virupas (60 virupas = 1 rupa). Uchcha, Saptavargaja, Ojayugma, Kendradi and Drekkana are subdivisions of Sthana Bala, not the complete Sthana Bala. Naisargika Bala is one complete fixed component. No combined total or strength ranking is displayed because other components are missing.</p><table class="positions-table"><thead><tr><th>Planet</th><th>Uchcha</th><th>Ojayugma</th><th>Kendradi</th><th>Drekkana</th><th>Saptavargaja</th><th>Dig Bala</th><th>Naisargika</th><th>D1 / D9 dignity</th><th>Sun proximity</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>'+vargaDisplay+'<div class="shadbala-status"><strong>Component coverage</strong><p>Sthana Bala: Uchcha, Saptavargaja, Ojayugma, whole-sign Kendradi and Drekkana implemented as separate components; comparison to independent reference charts remains pending.</p><p>Dig Bala: calculated from true sidereal Ascendant/MC angles · Kala Bala: pending · Cheshta Bala: pending · Naisargika Bala: implemented · Drik Bala: pending.</p></div>';
}
const COMBUST_ORBS={Moon:12,Mars:17,Mercury:14,Jupiter:11,Venus:10,Saturn:15};
function angularSeparation(a,b){const d=Math.abs(mod(a)-mod(b));return Math.min(d,360-d)}
function yogaConditionReview(y,p,r){
 const participants=P.filter(n=>new RegExp('\\b'+n+'\\b').test(y.proof));
 const positive=[],cautions=[],unassessed=[];
 const dignity=[];
 for(const n of participants){
   if(n==='Rahu'||n==='Ketu')continue;
   const condition=planetCondition(n,p);
   dignity.push(n+': D1 '+condition+'; D9 '+Z[navamsaSign(p[n])]+' ('+navamsaDignity(n,p[n])+')');
   if(navamsaDignity(n,p[n])==='Own sign'||navamsaDignity(n,p[n])==='Exaltation sign')positive.push(n+' has supportive D9 sign dignity');
   if(navamsaDignity(n,p[n])==='Debilitation sign')cautions.push(n+' occupies D9 debilitation sign (does not by itself cancel a D1 yoga)');
   if(condition==='Exaltation sign'||condition==='Own sign')positive.push(n+' is '+condition.toLowerCase());
   if(condition==='Debilitation sign')cautions.push(n+' occupies its debilitation sign');
   if(n!=='Sun'&&COMBUST_ORBS[n]!==undefined){
     const d=angularSeparation(p[n],p.Sun);
     if(d<=COMBUST_ORBS[n])cautions.push(n+' is '+d.toFixed(2)+'° from Sun (within a broad combustion screening threshold)');
   }
   const incoming=r.parashari.filter(a=>a.targets.includes(n)).map(a=>a.source);
   if(incoming.length)unassessed.push(n+' receives whole-sign graha drishti from '+[...new Set(incoming)].join(', '));
 }
 if(y.title.includes('Kemadruma'))unassessed.push('Classical Kemadruma cancellation rules require additional independent testing');
 if(y.category==='Vipareeta')unassessed.push('Vipareeta-specific exclusions and additional associations are not fully evaluated');
 if(y.title.includes('Mahapurusha'))unassessed.push('Mahapurusha cancellation and full planetary strength conditions remain unassessed');
 return {participants,positive,cautions,dignity,unassessed,
  status:cautions.length?'Qualifying combination with caution flags':'Qualifying combination; strength undetermined',
  cancellation:'Not established — no complete cancellation rule set has been applied'};
}

const REPORT_TOPICS=[
 {title:'Identity and direction',houses:[1,5,9]},
 {title:'Career and work',houses:[10,6,2]},
 {title:'Finances and resources',houses:[2,11,5]},
 {title:'Relationships and partnership',houses:[7,4,11]},
 {title:'Home and family',houses:[4,2,12]},
 {title:'Learning and development',houses:[5,9,3]}
];
function buildNatalReport(data){
 const p=data.positions,r=data.relationships,ascSign=sign(p.Asc),l=h=>RULERS[(ascSign+h-1)%12];
 const yogasFound=yogas(p,r),now=Date.now(),period=dasha(p,data.dt,'vimshottari',Number($('dasha-year').value),'janma').find(x=>x.start<=now&&x.end>now);
 const sub=period?.ants.find(x=>x.start<=now&&x.end>now);
 const nakLord=n=>LORDS[Math.floor(mod(p[n])/(360/27))%9];
 const sections=REPORT_TOPICS.map(topic=>{
  const evidence=[],paragraphs=[],used=new Set(),sourceHouses=new Set(topic.houses);
  for(const h of topic.houses){
   const lord=l(h),place=house(p[lord],p.Asc),dispositor=RULERS[sign(p[lord])],lordNak=nakLord(lord),ruled=r.planets[lord]?.ruledHouses||[];
   evidence.push('House '+h+' lord '+lord+' at '+fmt(p[lord])+' in house '+place+' · '+nk(p[lord])+' · D9 '+Z[navamsaSign(p[lord])]);
   if(used.has(lord))continue;used.add(lord);
   const effects='The ruler of house '+h+' ('+HOUSE_TOPICS[h-1]+') occupies house '+place+' ('+HOUSE_TOPICS[place-1]+'). '+lord+' therefore joins these two areas through '+PLANET_ACTIONS[lord]+'.';
   const additional=ruled.filter(x=>x!==h).map(x=>'house '+x+' ('+HOUSE_TOPICS[x-1]+')').join(' and ');
   const pathway=dispositor===lord?'It occupies its own sign, making '+lord+' the final sign dispositor in this chain.':'Its sign dispositor '+dispositor+' occupies house '+house(p[dispositor],p.Asc)+', bringing '+HOUSE_TOPICS[house(p[dispositor],p.Asc)-1]+' into the interpretation.';
   const nakpath='In '+nk(p[lord])+' (nakshatra lord '+lordNak+'), the nakshatra ruler occupies house '+house(p[lordNak],p.Asc)+'.';
   const condition='D1 condition: '+planetCondition(lord,p).toLowerCase()+'; D9: '+navamsaDignity(lord,p[lord]).toLowerCase()+'.';
   paragraphs.push(effects+(additional?' The planet also rules '+additional+'.':'')+' '+pathway+' '+nakpath+' '+condition);
   evidence.push('Dispositor: '+dispositor+' '+fmt(p[dispositor])+' in house '+house(p[dispositor],p.Asc));
   evidence.push('Nakshatra lord: '+lordNak+' '+fmt(p[lordNak])+' in house '+house(p[lordNak],p.Asc));
  }
  const incoming=r.parashari.filter(a=>sourceHouses.has(a.targetHouse));
  if(incoming.length){
   const top=incoming.slice(0,3);
   paragraphs.push('Parashari aspects reach the relevant houses from '+top.map(a=>a.source+' ('+a.step+'th aspect to house '+a.targetHouse+')').join(', ')+'. These bring the natal agendas of the aspecting planets into the same topics, without proving a particular event.');
   evidence.push(...top.map(a=>a.source+' '+fmt(p[a.source])+' aspects house '+a.targetHouse));
  }
  const relevantYogas=yogasFound.filter(y=>topic.houses.some(h=>y.proof.includes('house '+h)||y.proof.includes(h+'th lord'))).slice(0,2);
  if(relevantYogas.length)paragraphs.push('The yoga screen identifies '+relevantYogas.map(y=>y.title).join(' and ')+'. Its strength and cancellation conditions remain subject to the separate yoga assessment.');
  if(period&&used.has(period.lord)){
   paragraphs.push('Timing emphasis: '+period.lord+' mahadasha is currently active and directly involves this report topic through its house lordship. '+(sub?'The '+sub.lord+' antardasha adds its house '+house(p[sub.lord],p.Asc)+' placement and natal rulerships to the period.':''));
  }else if(sub&&used.has(sub.lord)){
   paragraphs.push('Timing emphasis: the current '+sub.lord+' antardasha connects this subject to the active '+period.lord+' mahadasha; the outcome depends on both natal placements.');
  }
  return {title:topic.title,text:paragraphs.join(' '),evidence,yogas:relevantYogas.map(y=>y.title)};
 });
 const timing=period?'Current Janma Vimshottari: '+period.lord+' mahadasha ('+date(period.start)+' – '+date(period.end)+')'+(sub?'; '+sub.lord+' antardasha ('+date(sub.start)+' – '+date(sub.end)+')':'')+'. Dates use the selected year convention and are not independently reference-validated.':'No active period appears in the currently calculated Janma Vimshottari range.';
 return {sections,timing,summary:'Sidereal '+Z[ascSign]+' ascendant at '+fmt(p.Asc)+', with Moon at '+fmt(p.Moon)+' in '+nk(p.Moon)+'. These topic analyses combine natal house lordships, planetary dispositors, nakshatra rulers, aspects and selected yoga screening. They represent traditional interpretations, not established future outcomes.'};
}

function periodLordSynthesis(p,r,major,minor){
 const a=major.n,b=minor.n,notes=[],proof=[];
 if(a===b){notes.push('The same planet governs both levels, concentrating this period on its natal responsibilities in house '+major.h+'.');proof.push('Mahadasha and Antardasha share lord '+a);return {notes,proof}}
 const sa=sign(p[a]),sb=sign(p[b]);
 const ab=r.parashari.filter(x=>x.source===a&&x.targets.includes(b)),ba=r.parashari.filter(x=>x.source===b&&x.targets.includes(a));
 if(sa===sb){notes.push(a+' and '+b+' occupy the same sign, so their house rulerships are activated through a shared natal placement in house '+major.h+'.');proof.push('Same sign: '+Z[sa])}
 if(ab.length&&ba.length){notes.push('The period lords exchange directional planetary aspects, linking their natal rulerships in both directions.');proof.push('Mutual Parashari aspects: '+a+' → '+b+'; '+b+' → '+a)}
 else if(ab.length||ba.length){const from=ab.length?a:b,to=ab.length?b:a;notes.push(from+' aspects '+to+' by Parashari graha drishti, so one period ruler directly influences the natal placement of the other.');proof.push('Directional aspect '+from+' → '+to)}
 if(RULERS[sa]===b&&RULERS[sb]===a){notes.push('Their sign dispositors form a two-way exchange, reinforcing links between house '+major.h+' and house '+minor.h+'.');proof.push('Parivartana: '+a+' ↔ '+b)}
 else if(major.disp===minor.disp&&major.disp!==a&&major.disp!==b){notes.push('Both period lords answer to '+major.disp+' as their shared dispositor, concentrating their effects through natal house '+house(p[major.disp],p.Asc)+'.');proof.push('Shared dispositor: '+major.disp)}
 else{
  if(major.disp===b){notes.push(b+' disposits '+a+', giving the Antardasha ruler influence over the Mahadasha lord’s sign placement.');proof.push(b+' is dispositor of '+a)}
  if(minor.disp===a){notes.push(a+' disposits '+b+', making the Mahadasha lord the sign ruler of the Antardasha lord.');proof.push(a+' is dispositor of '+b)}
 }
 if(!notes.length){notes.push('The period rulers do not meet the implemented direct conjunction, exchange or graha-drishti screens. Interpret the two natal house agendas jointly without asserting a special yoga.');proof.push('Separate natal signs and no qualifying direct connection')}
 return {notes,proof};
}
function renderPeriodReport(data){
 const out=$('period-report');if(!out)return;
 const p=data.positions,r=data.relationships,raw=$('period-date').value;
 const time=Date.parse(raw+'T12:00:00Z');
 if(!Number.isFinite(time)){out.textContent='Choose a valid analysis date.';return}
 const yearDays=Number($('dasha-year').value);
 const periods=dasha(p,data.dt,'vimshottari',yearDays,'janma');
 const md=periods.find(x=>x.start<=time&&time<x.end);
 const ad=md?.ants.find(x=>x.start<=time&&time<x.end);
 if(!md||!ad){out.textContent='This date is outside the available Janma Vimshottari calculation range. Choose a date within the generated periods.';return}
 const lords=[md.lord,ad.lord],asc=sign(p.Asc);
 const rulership=n=>[...Array(12)].map((_,i)=>i+1).filter(h=>RULERS[(asc+h-1)%12]===n);
 const factors=lords.map((n,i)=>{
  const h=house(p[n],p.Asc),houses=rulership(n),disp=RULERS[sign(p[n])],nakr=LORDS[Math.floor(mod(p[n])/(360/27))%9];
  const influenced=r.parashari.filter(a=>a.source===n).map(a=>'house '+a.targetHouse);
  const incoming=r.parashari.filter(a=>a.targets.includes(n)).map(a=>a.source);
  return {n,role:i?'Antardasha':'Mahadasha',h,houses,disp,nakr,influenced:[...new Set(influenced)],incoming:[...new Set(incoming)],d1:planetCondition(n,p),d9:navamsaDignity(n,p[n])};
 });
 const joint=lords[0]===lords[1]?'Both levels are ruled by '+lords[0]+'.':sign(p[md.lord])===sign(p[ad.lord])?'The two period lords share a natal sign.':house(p[md.lord],p[ad.lord])===7?'The period lords occupy opposing natal signs.':'The period lords occupy houses '+factors[0].h+' and '+factors[1].h+'.';
 const synthesis=periodLordSynthesis(p,r,factors[0],factors[1]);
 const topics=REPORT_TOPICS.map(topic=>{
  const hits=factors.map(f=>({f,hits:f.houses.filter(x=>topic.houses.includes(x)),placement:topic.houses.includes(f.h),aspects:f.influenced.filter(x=>topic.houses.includes(Number(x.split(' ')[1])))}));
  const relevant=hits.some(v=>v.hits.length||v.placement||v.aspects.length);
  if(!relevant)return null;
  const reasons=hits.filter(v=>v.hits.length||v.placement||v.aspects.length).map(v=>{
   const f=v.f,links=[];
   if(v.hits.length)links.push('rules house '+v.hits.join(' and '));
   if(v.placement)links.push('occupies house '+f.h);
   if(v.aspects.length)links.push('aspects '+v.aspects.join(', '));
   return f.role+' '+f.n+' '+links.join(', ');
  });
  return {name:topic.title,text:'This period highlights '+topic.title.toLowerCase()+' because '+reasons.join('; ')+'. '+synthesis.notes.join(' ')+' This is an interpretive emphasis, not a guaranteed event.',reasons};
 }).filter(Boolean);
 out.innerHTML='<p class="report-timing"><b>'+esc(raw)+'</b> · '+esc(md.lord)+' Mahadasha ('+esc(date(md.start))+'–'+esc(date(md.end))+') · '+esc(ad.lord)+' Antardasha ('+esc(date(ad.start))+'–'+esc(date(ad.end))+')</p><p>'+esc(joint)+'</p><article class="report-section"><h3>Combined period interpretation</h3><p>'+esc(synthesis.notes.join(' '))+'</p><details><summary>Connection evidence</summary><ul>'+synthesis.proof.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></details></article>'+
 factors.map(f=>'<article class="report-section"><h3>'+esc(f.role+': '+f.n)+'</h3><p>'+esc(f.n)+' rules natal '+(f.houses.length?'house '+f.houses.join(' and '):'no assigned whole-sign house')+', and occupies house '+f.h+' in '+fmt(p[f.n])+'. Its sign dispositor '+f.disp+' occupies house '+house(p[f.disp],p.Asc)+'; its nakshatra lord '+f.nakr+' occupies house '+house(p[f.nakr],p.Asc)+'. D1 dignity: '+f.d1+'; D9 dignity: '+f.d9+'.</p><details><summary>Aspect and placement evidence</summary><p>Outgoing aspects: '+esc(f.influenced.join(', ')||'None identified')+'. Received aspects: '+esc(f.incoming.join(', ')||'None identified')+'.</p></details></article>').join('')+
 '<h3>Period topics</h3>'+(topics.length?topics.map(t=>'<article class="report-section"><h3>'+esc(t.name)+'</h3><p>'+esc(t.text)+'</p><details><summary>Calculation evidence</summary><ul>'+t.reasons.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></details></article>').join(''):'<p>No direct topic links were identified by the implemented rulership, occupancy and graha-drishti rules.</p>')+
 '<p class="subtle">Uses natal D1 placements and whole-sign aspects; no transits, event prediction, or complete Shadbala scoring is inferred. Dasha periods use the selected year-length convention. Traditional interpretations are not scientifically established forecasts.</p>';
}
$('period-date').value=new Date().toISOString().slice(0,10);
$('period-date').addEventListener('change',()=>{if(mostRecentChart)renderPeriodReport(mostRecentChart)});
$('run-period-report').addEventListener('click',()=>{if(mostRecentChart)renderPeriodReport(mostRecentChart)});
function renderNatalReport(data){
 const target=$('natal-report');if(!target)return;
 const report=buildNatalReport(data);
 target.innerHTML='<p>'+esc(report.summary)+'</p><p class="report-timing">'+esc(report.timing)+'</p>'+report.sections.map(section=>'<article class="report-section"><h3>'+esc(section.title)+'</h3><p>'+esc(section.text)+'</p><details><summary>View chart evidence</summary><ul>'+section.evidence.map(line=>'<li>'+esc(line)+'</li>').join('')+'</ul></details></article>').join('')+'<p class="subtle">Report basis: D1 whole-sign placements, Parashari aspect rules, D1/D9 dignity and selected yoga screening. D9 dignity is not used to assert cancellation; incomplete Shadbala components are excluded.</p>';
}
$('copy-natal-report').addEventListener('click',()=>{
 if(!mostRecentChart)return;
 const report=buildNatalReport(mostRecentChart);
 const nl=String.fromCharCode(10);
 const content=['JYOTISH STUDIO — NATAL ANALYSIS',report.summary,report.timing,...report.sections.map(x=>[x.title,x.text,'Evidence:',...x.evidence.map(v=>'- '+v)].join(nl)),'Traditional interpretive framework; not scientifically verified predictions.'].join(nl+nl);
 if(navigator.clipboard?.writeText){navigator.clipboard.writeText(content).then(()=>$('report-copy-status').textContent='Report copied.',()=>$('report-copy-status').textContent='Clipboard unavailable in this browser.');}
 else $('report-copy-status').textContent='Clipboard is unavailable in this browser.';
});
function render(data){const {positions:p,relationships,dt,ayanamsa,form}=data;const now=Date.now();mostRecentChart=data;
$('generated').textContent=esc(form.name)+' · '+date(dt.getTime())+' UTC '+dt.toISOString().slice(11,16);
const a=[['Ascendant',Z[sign(p.Asc)],degreeWithinSign(p.Asc)],['Moon sign',Z[sign(p.Moon)],degreeWithinSign(p.Moon)],['Birth nakshatra',nk(p.Moon),'Pada '+(Math.floor((p.Moon%(360/27))/(360/108))+1)],['Current daśā','—','Choose a system']];
$('highlights').innerHTML=a.map(([label,value,detail])=>'<div class="highlight"><label>'+esc(label)+'</label><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></div>').join('');
renderWheel(p);$('positions').innerHTML='<table class="positions-table"><thead><tr><th>Body</th><th>Position</th><th>House</th></tr></thead><tbody>'+['Asc',...P].map(n=>'<tr><td>'+G[n]+' '+n+'</td><td>'+fmt(p[n])+'</td><td>'+(n==='Asc'?'—':house(p[n],p.Asc))+'</td></tr>').join('')+'</tbody></table><p class="subtle">Lahiri ayanamsa: '+ayanamsa.toFixed(5)+'°. Mean Rahu (Ketu exactly opposite). Planet coordinates: Moshier fallback. Ascendant: tropical house calculation minus Lahiri offset.</p>';
renderDasha(data);
renderAspects(data);
renderNavamsa(data);
renderStrengthFoundation(data);
renderNadi(data);
renderJaimini(data);
renderNatalReport(data);
renderPeriodReport(data);
if($('relationship-audit')){$('relationship-audit').innerHTML='<p><b>Shared relationship calculations:</b> '+relationships.conjunctions.length+' same-sign pairs · '+relationships.parashari.length+' directional Parashari sign aspects · '+relationships.jaimini.length+' directional Jaimini sign aspects.</p><p>Whole-sign houses from sidereal ascendant. Computed aspects indicate sign relationships; they do not by themselves establish strength, orb or a yoga. Nadi-inspired sign-connection analysis is provided separately and is not interchangeable with graha drishti.</p>';}
const results=yogas(p,relationships);for(const y of results)y.review=yogaConditionReview(y,p,relationships);$('yogas').classList.remove('placeholder');$('yogas').innerHTML=results.length?'<p class="subtle">'+results.length+' possible combinations found. These are initial detections, not final strength judgments.</p>'+results.map(y=>'<article class="yoga"><span class="yoga-category">'+esc(y.category)+'</span><h3>'+esc(y.title)+'</h3><p>'+esc(y.reading)+'</p><small><b>Calculation evidence:</b> '+esc(y.proof)+'</small><small class="yoga-caveat"><b>Qualification:</b> '+esc(y.caveat)+'</small><small class="yoga-review"><b>Assessment:</b> '+esc(y.review.status)+'<br><b>Dignity:</b> '+esc(y.review.dignity.join('; ')||'Not applicable')+'<br><b>Support:</b> '+esc(y.review.positive.join('; ')||'None identified by implemented rules')+'<br><b>Cautions:</b> '+esc(y.review.cautions.join('; ')||'None identified by implemented rules')+'<br><b>Received aspects:</b> '+esc(y.review.unassessed.join('; ')||'No additional indicators')+'<br><b>Cancellation:</b> '+esc(y.review.cancellation)+'</small>'+(y.qualifiers?.length?'<small><b>Condition indicators:</b> '+esc(y.qualifiers.join('; '))+'</small>':'')+(y.otherSystems?.length?'<small><b>Other systems (not yoga proof):</b> '+esc(y.otherSystems.join(' '))+'</small>':'')+'</article>').join(''):'<p class="subtle">None of the currently implemented yoga conditions were detected. This does not mean the natal chart has no yogas.</p>'}
$('birth').addEventListener('submit',e=>{e.preventDefault();$('status').classList.remove('error');try{if(!swe)throw Error('Ephemeris has not initialized');if(selectedLocation?.timezone&&!manuallyEditedOffset){try{refreshOffset()}catch(err){locationStatus.textContent='Automatic UTC lookup failed. Enter the UTC offset manually.'}}const v=Object.fromEntries(new FormData(e.currentTarget).entries());if(v.lat===''||v.lon===''||v.offset===''||!Number.isFinite(Number(v.lat))||!Number.isFinite(Number(v.lon))||!Number.isFinite(Number(v.offset)))throw Error('Please select a city or enter latitude, longitude and UTC offset manually.');const data=chart(v);render(data);$('status').textContent='Calculated successfully · '+data.dt.toISOString()+' · all dates in displayed dashas are UTC calendar dates.'}catch(err){console.error(err);$('status').classList.add('error');$('status').textContent='Calculation error: '+err.message}});
init();