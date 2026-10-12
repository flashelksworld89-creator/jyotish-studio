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
async function init(){try{verifyNavamsa();validateRelationshipModel();swe=new SwissEphemeris(); await swe.init(); swe.setSiderealMode(SiderealMode.Lahiri); $('status').textContent='Calculation engine ready. Enter birth details and generate.'; $('calculate').disabled=false}catch(e){$('status').textContent='Ephemeris failed to load: '+e.message;$('status').classList.add('error');$('calculate').disabled=true}}
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
const asc=swe.calculateHouses(jd,Number(form.lat),Number(form.lon),HouseSystem.Placidus).ascendant;if(!Number.isFinite(asc))throw Error('Ascendant calculation failed');positions.Asc=mod(asc-ay);
const relationships=relationshipModel(positions);
return {positions,relationships,ayanamsa:ay,dt,jd,form}}
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
$('dasha-year').addEventListener('change',()=>{if(mostRecentChart)renderDasha(mostRecentChart)});
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
function renderStrengthFoundation(data){
 const el=$('strength-foundation');if(!el)return;
 const p=data.positions;
 const classical=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
 const rows=classical.map(n=>{
  const d1=planetCondition(n,p),d9=navamsaDignity(n,p[n]);
  const separation=n==='Sun'?null:angularSeparation(p[n],p.Sun);
  const combustion=n==='Sun'?'Not applicable':(separation<=COMBUST_ORBS[n]?'Possible proximity flag ('+separation.toFixed(2)+'°)':'Outside screening threshold ('+separation.toFixed(2)+'°)');
  return '<tr><td>'+esc(n)+'</td><td>'+esc(d1)+'</td><td>'+esc(d9)+'</td><td>'+esc(combustion)+'</td></tr>';
 });
 el.innerHTML='<p class="subtle">Strength evidence currently covers D1/D9 sign dignity and broad angular Sun proximity. <b>Shadbala is not calculated.</b> A classical Shadbala total requires Sthana, Dig, Kala, Cheshta, Naisargika, and Drik Bala with appropriate subdivisions, astronomical inputs and normalization.</p><table class="positions-table"><thead><tr><th>Planet</th><th>D1 sign</th><th>D9 sign</th><th>Sun proximity</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>';
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
if($('relationship-audit')){$('relationship-audit').innerHTML='<p><b>Shared relationship calculations:</b> '+relationships.conjunctions.length+' same-sign pairs · '+relationships.parashari.length+' directional Parashari sign aspects · '+relationships.jaimini.length+' directional Jaimini sign aspects.</p><p>Whole-sign houses from sidereal ascendant. Computed aspects indicate sign relationships; they do not by themselves establish strength, orb or a yoga. Nadi-inspired sign-connection analysis is provided separately and is not interchangeable with graha drishti.</p>';}
const results=yogas(p,relationships);for(const y of results)y.review=yogaConditionReview(y,p,relationships);$('yogas').classList.remove('placeholder');$('yogas').innerHTML=results.length?'<p class="subtle">'+results.length+' possible combinations found. These are initial detections, not final strength judgments.</p>'+results.map(y=>'<article class="yoga"><span class="yoga-category">'+esc(y.category)+'</span><h3>'+esc(y.title)+'</h3><p>'+esc(y.reading)+'</p><small><b>Calculation evidence:</b> '+esc(y.proof)+'</small><small class="yoga-caveat"><b>Qualification:</b> '+esc(y.caveat)+'</small><small class="yoga-review"><b>Assessment:</b> '+esc(y.review.status)+'<br><b>Dignity:</b> '+esc(y.review.dignity.join('; ')||'Not applicable')+'<br><b>Support:</b> '+esc(y.review.positive.join('; ')||'None identified by implemented rules')+'<br><b>Cautions:</b> '+esc(y.review.cautions.join('; ')||'None identified by implemented rules')+'<br><b>Received aspects:</b> '+esc(y.review.unassessed.join('; ')||'No additional indicators')+'<br><b>Cancellation:</b> '+esc(y.review.cancellation)+'</small>'+(y.qualifiers?.length?'<small><b>Condition indicators:</b> '+esc(y.qualifiers.join('; '))+'</small>':'')+(y.otherSystems?.length?'<small><b>Other systems (not yoga proof):</b> '+esc(y.otherSystems.join(' '))+'</small>':'')+'</article>').join(''):'<p class="subtle">None of the currently implemented yoga conditions were detected. This does not mean the natal chart has no yogas.</p>'}
$('birth').addEventListener('submit',e=>{e.preventDefault();$('status').classList.remove('error');try{if(!swe)throw Error('Ephemeris has not initialized');if(selectedLocation?.timezone&&!manuallyEditedOffset){try{refreshOffset()}catch(err){locationStatus.textContent='Automatic UTC lookup failed. Enter the UTC offset manually.'}}const v=Object.fromEntries(new FormData(e.currentTarget).entries());if(v.lat===''||v.lon===''||v.offset===''||!Number.isFinite(Number(v.lat))||!Number.isFinite(Number(v.lon))||!Number.isFinite(Number(v.offset)))throw Error('Please select a city or enter latitude, longitude and UTC offset manually.');const data=chart(v);render(data);$('status').textContent='Calculated successfully · '+data.dt.toISOString()+' · all dates in displayed dashas are UTC calendar dates.'}catch(err){console.error(err);$('status').classList.add('error');$('status').textContent='Calculation error: '+err.message}});
init();