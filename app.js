import { SwissEphemeris, Planet, LunarPoint, SiderealMode, CalculationFlag, HouseSystem } from '@swisseph/browser';
const Z=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const N=['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
const LORDS=['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'],YEARS=[7,20,6,10,7,18,16,19,17], RULERS=['Mars','Venus','Mercury','Moon','Sun','Mercury','Venus','Mars','Jupiter','Saturn','Saturn','Jupiter'];
const P=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu'], G={Sun:'☉',Moon:'☽',Mars:'♂',Mercury:'☿',Jupiter:'♃',Venus:'♀',Saturn:'♄',Rahu:'☊',Ketu:'☋',Asc:'Asc'};
const $=x=>document.getElementById(x),mod=x=>(x%360+360)%360,sign=x=>Math.floor(mod(x)/30), house=(a,b)=>((sign(a)-sign(b)+12)%12)+1,fmt=x=>Z[sign(x)]+' '+degreeWithinSign(x),nk=x=>N[Math.floor(mod(x)/(360/27))],date=x=>new Date(x).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});
const degreeWithinSign=x=>{const n=Math.round((mod(x)%30)*3600);return String(Math.floor(n/3600)).padStart(2,'0')+'° '+String(Math.floor((n%3600)/60)).padStart(2,'0')+'′ '+String(n%60).padStart(2,'0')+'″'};
const H=365.2425*86400000;
let swe;
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function init(){try{swe=new SwissEphemeris(); await swe.init(); swe.setSiderealMode(SiderealMode.Lahiri); $('status').textContent='Calculation engine ready. Enter birth details and generate.'; $('calculate').disabled=false}catch(e){$('status').textContent='Ephemeris failed to load: '+e.message;$('status').classList.add('error');$('calculate').disabled=true}}
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
function chart(form){const dt=times(form);if(!Number.isFinite(dt.getTime()))throw Error('Invalid date or time');const jd=swe.dateToJulianDay(dt); const ay=swe.getAyanamsaExUt(jd,CalculationFlag.MoshierEphemeris);if(!Number.isFinite(ay))throw Error('Ayanamsa calculation returned invalid data');const flags=CalculationFlag.MoshierEphemeris|CalculationFlag.Speed|CalculationFlag.Sidereal;
const bodies={Sun:Planet.Sun,Moon:Planet.Moon,Mars:Planet.Mars,Mercury:Planet.Mercury,Jupiter:Planet.Jupiter,Venus:Planet.Venus,Saturn:Planet.Saturn,Rahu:LunarPoint.MeanNode};
const positions={};for(const [name,b] of Object.entries(bodies)){const pos=swe.calculatePosition(jd,b,flags); if(!Number.isFinite(pos.longitude))throw Error(name+' coordinates unavailable'); positions[name]=mod(pos.longitude)}
positions.Ketu=mod(positions.Rahu+180);
const asc=swe.calculateHouses(jd,Number(form.lat),Number(form.lon),HouseSystem.Placidus).ascendant;if(!Number.isFinite(asc))throw Error('Ascendant calculation failed');positions.Asc=mod(asc-ay);
return {positions,ayanamsa:ay,dt,jd,form}}
function dasha(p,dt){const n=Math.floor(p.Moon/(360/27)),fraction=(p.Moon%(360/27))/(360/27); const first=n%9;let cursor=dt.getTime()-fraction*YEARS[first]*H;const rows=[];
for(let cycle=0;cycle<2;cycle++){for(let j=0;j<9;j++){const k=(first+j)%9,length=YEARS[k],start=cursor,end=start+length*H,ants=[];let sub=start;for(let a=0;a<9;a++){const ix=(k+a)%9,subLen=length*YEARS[ix]/120;ants.push({lord:LORDS[ix],start:sub,end:sub+subLen*H});sub+=subLen*H}rows.push({lord:LORDS[k],start,end,ants});cursor=end} if(cursor>Date.now()+130*H)break}
return rows.filter(x=>x.end>dt.getTime()-1)}
function yogas(p){const result=[],asc=p.Asc,h=n=>house(p[n],asc),same=(a,b)=>sign(p[a])===sign(p[b]),k=n=>[1,4,7,10].includes(h(n)),angular=(a,b)=>[1,4,7,10].includes(house(p[a],p[b]));
function add(title,proof,reading){result.push({title,proof,reading})}
if(angular('Jupiter','Moon'))add('Gaja Kesari Yoga','Jupiter occupies a kendra (1st, 4th, 7th, or 10th) from the Moon.','Traditionally associated with counsel, support and knowledge. Full judgment requires dignity, afflictions and strength.');
if(same('Sun','Mercury'))add('Budha Aditya Yoga','The Sun and Mercury occupy '+Z[sign(p.Sun)]+'.','Traditionally associated with learning, analysis and communication. Mercury combustion and strength have not been adjudicated.');
if(same('Moon','Mars')||house(p.Mars,p.Moon)===7)add('Chandra Mangala Yoga','Mars is '+(same('Moon','Mars')?'conjunct':'opposite')+' the Moon by whole sign.','Traditionally linked with practical drive and resource activity; condition and house ownership modify results.');
const own={Mars:[0,7],Mercury:[2,5],Jupiter:[8,11],Venus:[1,6],Saturn:[9,10]},exalt={Mars:9,Mercury:5,Jupiter:3,Venus:11,Saturn:6},named={Mars:'Ruchaka',Mercury:'Bhadra',Jupiter:'Hamsa',Venus:'Malavya',Saturn:'Shasha'};
for(const n of Object.keys(own)){if(k(n)&&(own[n].includes(sign(p[n]))||exalt[n]===sign(p[n])))add(named[n]+' Mahapurusha Yoga',n+' in '+Z[sign(p[n])]+', a '+(own[n].includes(sign(p[n]))?'rulership':'exaltation')+' sign, in house '+h(n)+'.','A classical kendra-and-dignity combination. Effects depend on additional strength and mitigating factors.')}
const nine=RULERS[(sign(asc)+8)%12],ten=RULERS[(sign(asc)+9)%12];
if(nine!==ten&&same(nine,ten))add('Dharma–Karma Adhipati association','9th lord '+nine+' and 10th lord '+ten+' are conjunct by sign in '+Z[sign(p[nine])]+'.','A traditional relationship between dharma and career lords. Other associations such as exchanges and aspects are not yet evaluated.');
return result}
function renderWheel(p){const names=Array.from({length:12},(_,i)=>Z[i]);const ascSign=sign(p.Asc);const ring=[];const cx=210,cy=210;
for(let i=0;i<12;i++){const start=(i*30-90)*Math.PI/180,end=((i+1)*30-90)*Math.PI/180;const x1=cx+192*Math.cos(start),y1=cy+192*Math.sin(start),x2=cx+192*Math.cos(end),y2=cy+192*Math.sin(end);ring.push('<path d="M210 210 L'+x1.toFixed(2)+' '+y1.toFixed(2)+' A192 192 0 0 1 '+x2.toFixed(2)+' '+y2.toFixed(2)+' Z" fill="'+(i%2?'#192737':'#122131')+'" stroke="#586071" stroke-width=".7"/>');
const angle=(i*30+15-90)*Math.PI/180,tx=cx+159*Math.cos(angle),ty=cy+159*Math.sin(angle);
ring.push('<text x="'+tx+'" y="'+ty+'" text-anchor="middle" fill="'+(i===0?'#f1cf91':'#9baec1')+'" font-size="12">'+Z[(ascSign+i)%12].slice(0,3)+' · '+(i+1)+'</text>');
const members=P.filter(n=>sign(p[n])===(ascSign+i));const rad=103;members.forEach((n,j)=>{const a=angle+((j-(members.length-1)/2)*0.11);const r=rad-(j%2)*17;ring.push('<text x="'+(cx+r*Math.cos(a)).toFixed(1)+'" y="'+(cy+r*Math.sin(a)).toFixed(1)+'" fill="#eac38d" font-size="16" text-anchor="middle">'+G[n]+'</text>')})}
ring.push('<circle cx="210" cy="210" r="47" fill="#0c1420" stroke="#89724f"/>','<text x="210" y="203" text-anchor="middle" font-size="12" fill="#9cacbe">ASC</text>','<text x="210" y="223" text-anchor="middle" font-size="15" fill="#eccc93">'+Z[ascSign]+'</text>');
$('wheel').innerHTML='<svg viewBox="0 0 420 420" role="img" aria-label="Whole-sign circular chart beginning with the ascendant sign">'+ring.join('')+'</svg>'}
function render(data){const {positions:p,dt,ayanamsa,form}=data;const ds=dasha(p,dt),now=Date.now(),current=ds.find(x=>x.start<=now&&now<x.end),sub=current?.ants.find(x=>x.start<=now&&now<x.end);
$('generated').textContent=esc(form.name)+' · '+date(dt.getTime())+' UTC '+dt.toISOString().slice(11,16);
const a=[['Ascendant',Z[sign(p.Asc)],degreeWithinSign(p.Asc)],['Moon sign',Z[sign(p.Moon)],degreeWithinSign(p.Moon)],['Birth nakshatra',nk(p.Moon),'Pada '+(Math.floor((p.Moon%(360/27))/(360/108))+1)],['Current daśā',current?current.lord:'Outside range',sub?sub.lord+' antardaśā':'—']];
$('highlights').innerHTML=a.map(([label,value,detail])=>'<div class="highlight"><label>'+esc(label)+'</label><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></div>').join('');
renderWheel(p);$('positions').innerHTML='<table class="positions-table"><thead><tr><th>Body</th><th>Position</th><th>House</th></tr></thead><tbody>'+['Asc',...P].map(n=>'<tr><td>'+G[n]+' '+n+'</td><td>'+fmt(p[n])+'</td><td>'+(n==='Asc'?'—':house(p[n],p.Asc))+'</td></tr>').join('')+'</tbody></table><p class="subtle">Lahiri ayanamsa: '+ayanamsa.toFixed(5)+'°. Mean Rahu (Ketu exactly opposite). Planet coordinates: Moshier fallback. Ascendant: tropical house calculation minus Lahiri offset.</p>';
$('dashas').classList.remove('placeholder');$('dashas').innerHTML=ds.map((r,i)=>'<details class="dasha-row '+(r.start<=now&&now<r.end?'current':'')+'" '+(r.start<=now&&now<r.end?'open':'')+'><summary class="dasha-head"><strong>'+r.lord+' <span class="badge">'+YEARS[LORDS.indexOf(r.lord)]+' yrs</span></strong><small>'+date(r.start)+' — '+date(r.end)+'</small></summary><div class="ad-list">'+r.ants.map(s=>'<div class="ad-row '+(s.start<=now&&now<s.end?'active':'')+'"><span>'+r.lord+' / '+s.lord+'</span><span>'+date(s.start)+' — '+date(s.end)+'</span></div>').join('')+'</div></details>').join('');
const results=yogas(p);$('yogas').classList.remove('placeholder');$('yogas').innerHTML=results.length?results.map(y=>'<article class="yoga"><h3>'+esc(y.title)+'</h3><p>'+esc(y.reading)+'</p><small>Rule evidence: '+esc(y.proof)+'</small></article>').join(''):'<p class="subtle">None of the currently implemented yoga conditions were detected. This does not mean the natal chart has no yogas.</p>'}
$('birth').addEventListener('submit',e=>{e.preventDefault();$('status').classList.remove('error');try{if(!swe)throw Error('Ephemeris has not initialized');if(selectedLocation?.timezone&&!manuallyEditedOffset){try{refreshOffset()}catch(err){locationStatus.textContent='Automatic UTC lookup failed. Enter the UTC offset manually.'}}const v=Object.fromEntries(new FormData(e.currentTarget).entries());if(v.lat===''||v.lon===''||v.offset===''||!Number.isFinite(Number(v.lat))||!Number.isFinite(Number(v.lon))||!Number.isFinite(Number(v.offset)))throw Error('Please select a city or enter latitude, longitude and UTC offset manually.');const data=chart(v);render(data);$('status').textContent='Calculated successfully · '+data.dt.toISOString()+' · all dates in displayed dashas are UTC calendar dates.'}catch(err){console.error(err);$('status').classList.add('error');$('status').textContent='Calculation error: '+err.message}});
init();