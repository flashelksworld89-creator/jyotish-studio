// Vercel serverless endpoint: secret stays in project environment, never client code.
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'AI reports are not configured. Set OPENAI_API_KEY in Vercel project environment settings.'});
 const contentLength=Number(req.headers['content-length']||0);
 if(contentLength>24000)return res.status(413).json({error:'Report input too large.'});
 const {topic,evidence,summary,timing}=req.body||{};
 if(typeof topic!=='string'||!Array.isArray(evidence)||evidence.length>40||!evidence.every(v=>typeof v==='string'&&v.length<500)||typeof summary!=='string'||typeof timing!=='string'||summary.length>1500||timing.length>1000)return res.status(400).json({error:'Invalid report input.'});
 const allowed=['Identity and direction','Career and work','Finances and resources','Relationships and partnership','Home and family','Learning and development'];
 if(!allowed.includes(topic))return res.status(400).json({error:'Unknown report topic.'});
 const instructions=[
 'You are a traditional Jyotish interpretation writer. You are not an ephemeris or calculator.',
 'Use ONLY the supplied natal calculation evidence. Do not invent placements, yogas, aspects, dignities, dasha dates, karakas or transits.',
 'Write 3-5 substantial paragraphs (roughly 280-420 words total) specifically interpreting the selected life topic: possible lived manifestations, supportive factors, obstacles, practical considerations, and how verified timing relates.',
 'Synthesize rulership, placement, sign dispositor and nakshatra ruler relationships. Explain what they could mean in daily life rather than simply restating positions.',
 'When evidence is insufficient for a claim, say so rather than imagining chart specifics. Never claim certainty, inevitable events or scientific validity.',
 'Do not diagnose health conditions, guarantee financial outcomes, or make claims about a particular person’s behavior.',
 'No markdown heading, no birth identity data, no bullet lists. Paragraph prose only.'
 ].join(' ');
 const request={model:process.env.OPENAI_MODEL||'gpt-4.1-mini',temperature:0.55,max_tokens:1100,messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify({topic,summary,timing,evidence})}]};
 try{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),24000);
  let response;try{response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(request),signal:controller.signal})}finally{clearTimeout(timer)}
  if(!response.ok){return res.status(502).json({error:'The AI provider could not generate a report ('+response.status+').'});}
  const json=await response.json();
  const report=json?.choices?.[0]?.message?.content;
  if(typeof report!=='string'||!report.trim())return res.status(502).json({error:'The AI provider returned an empty report.'});
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({report:report.slice(0,9000)});
 }catch(e){return res.status(502).json({error:e?.name==='AbortError'?'The AI request timed out.':'The AI service is temporarily unavailable.'})}
}
