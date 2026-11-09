import { getStore } from '@netlify/blobs';
import { randomBytes, randomInt } from 'node:crypto';

const store = () => getStore('fish-classroom-games');
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
const token = () => randomBytes(20).toString('hex');
const safe = x => typeof x === 'string' ? x.slice(0,100) : '';
const teams = [1,2,3,4,5];
const answer = ['thân thiết','nhớ','vui đùa'];
const blank = () => ({status:'waiting',startedAt:null,endedAt:null,teams:{},results:{},round:1});
async function read(code){return await store().get('room-'+code,{type:'json'});}
async function save(code,room){await store().setJSON('room-'+code,room);}
export default async (request) => {
  if(request.method==='OPTIONS') return json({ok:true});
  try{
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || '';
    let body={};
    if(request.method==='POST') {try{body=await request.json();}catch{return json({error:'Dữ liệu không hợp lệ.'},400);}}
    if(action==='create' && request.method==='POST'){
      let code, exists;
      do {code=String(randomInt(100000,999999));exists=await read(code);} while(exists);
      const teacherToken=token();
      const room={...blank(),code,teacherToken,createdAt:Date.now()};
      await save(code,room);
      return json({code,teacherToken,room:publicRoom(room)});
    }
    const code=safe((request.method==='GET'?url.searchParams.get('code'):body.code)||'');
    if(!/^\d{6}$/.test(code))return json({error:'Mã phòng gồm 6 chữ số.'},400);
    const room=await read(code);
    if(!room)return json({error:'Không tìm thấy phòng chơi.'},404);
    if(action==='state' && request.method==='GET')return json({room:publicRoom(room)});
    if(request.method!=='POST')return json({error:'Yêu cầu không hợp lệ.'},405);
    if(action==='join'){
      const team=Number(body.team);
      if(!teams.includes(team))return json({error:'Nhóm không hợp lệ.'},400);
      const existing=room.teams[team];
      if(existing && existing.token!==body.studentToken)return json({error:'Nhóm này đã có iPad tham gia. Hãy chọn nhóm khác.'},409);
      if(!existing && room.status!=='waiting')return json({error:'Vòng chơi đã bắt đầu. Hãy đợi vòng tiếp theo.'},409);
      const studentToken=existing?.token||token();
      room.teams[team]={token:studentToken,joinedAt:existing?.joinedAt||Date.now()};
      await save(code,room);
      return json({studentToken,room:publicRoom(room)});
    }
    const teacher=body.teacherToken===room.teacherToken && typeof body.teacherToken==='string';
    if(['start','finish','reset','remove'].includes(action) && !teacher)return json({error:'Chỉ giáo viên được điều khiển phòng.'},403);
    if(action==='start'){
      if(room.status!=='waiting')return json({error:'Vòng chơi không ở trạng thái chờ.'},409);
      if(Object.keys(room.teams).length===0)return json({error:'Chưa có nhóm nào tham gia.'},409);
      room.status='playing';room.startedAt=Date.now();room.endedAt=null;room.results={};
      await save(code,room);return json({room:publicRoom(room)});
    }
    if(action==='finish'){
      if(room.status!=='playing')return json({error:'Vòng chơi chưa bắt đầu.'},409);
      room.status='finished';room.endedAt=Date.now();await save(code,room);
      return json({room:publicRoom(room)});
    }
    if(action==='reset'){
      room.status='waiting';room.startedAt=null;room.endedAt=null;room.results={};room.round+=1;
      await save(code,room);return json({room:publicRoom(room)});
    }
    if(action==='remove'){
      const team=Number(body.team);
      if(!teams.includes(team))return json({error:'Nhóm không hợp lệ.'},400);
      delete room.teams[team];delete room.results[team];await save(code,room);
      return json({room:publicRoom(room)});
    }
    if(action==='submit'){
      const team=Number(body.team);
      if(!teams.includes(team)||!room.teams[team]||room.teams[team].token!==body.studentToken)return json({error:'iPad chưa được xác thực trong nhóm.'},403);
      if(room.status!=='playing')return json({error:'Vòng chơi đã kết thúc hoặc chưa bắt đầu.'},409);
      if(room.results[team])return json({error:'Nhóm đã nộp bài rồi.'},409);
      if(!Array.isArray(body.answers)||body.answers.length!==3||body.answers.some(x=>typeof x!=='string'))return json({error:'Cần chọn đủ 3 đáp án.'},400);
      const chosen=body.answers.map(safe);
      if(new Set(chosen).size!==3 || chosen.some(x=>!['nhớ','tươi vui','thân thiết','vui đùa'].includes(x)))return json({error:'Đáp án không hợp lệ.'},400);
      const score=chosen.reduce((s,a,i)=>s+(a===answer[i]?1:0),0);
      const submittedAt=Date.now();
      room.results[team]={answers:chosen,score,elapsedMs:Math.max(0,submittedAt-room.startedAt),submittedAt};
      await save(code,room);
      return json({room:publicRoom(room),result:room.results[team]});
    }
    return json({error:'Không nhận diện được thao tác.'},404);
  }catch(e){console.error(e);return json({error:'Máy chủ tạm thời không phản hồi. Vui lòng thử lại.'},500);}
};
function publicRoom(room){
  const {code,status,startedAt,endedAt,round,teams,results}=room;
  const ranking=Object.entries(results).map(([team,r])=>({team:Number(team),score:r.score,elapsedMs:r.elapsedMs,answers:r.answers})).sort((a,b)=>b.score-a.score||a.elapsedMs-b.elapsedMs);
  return {code,status,startedAt,endedAt,round,joinedTeams:Object.keys(teams).map(Number).sort((a,b)=>a-b),submittedTeams:Object.keys(results).map(Number),results:status==='finished'?ranking:ranking.map(({team,score,elapsedMs})=>({team,score,elapsedMs})),ranking:status==='finished'?ranking:[]};
}
