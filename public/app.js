const $=id=>document.getElementById(id);
const words=['nhớ','tươi vui','thân thiết','vui đùa'];
let role='',code='',teacherToken='',studentToken='',team=0,room=null,selected=[null,null,null],activeBlank=0,lastRound=0,pollBusy=false;
const show=(id,on=true)=>$(id).classList.toggle('hidden',!on);
const notice=msg=>{show('notice',!!msg);$('notice').textContent=msg||''};
const fmt=ms=>{const s=Math.max(0,Math.floor(ms/1000));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const url=()=>location.origin+location.pathname+'?role=student&room='+code;
async function api(action,payload={},method='POST'){
  const endpoint='/.netlify/functions/game?action='+encodeURIComponent(action)+(method==='GET'?'&code='+encodeURIComponent(code):'');
  const res=await fetch(endpoint,{method,headers:method==='POST'?{'Content-Type':'application/json'}:{},body:method==='POST'?JSON.stringify({code,...payload}):undefined,cache:'no-store'});
  let data;try{data=await res.json()}catch{throw Error('Không kết nối được máy chủ. Hãy kiểm tra game đã triển khai bằng Netlify chưa.')}if(!res.ok)throw Error(data.error||'Có lỗi xảy ra');return data;
}
function setRoute(nextRole,nextCode){role=nextRole;code=nextCode;const p=new URLSearchParams();p.set('role',role);p.set('room',code);history.replaceState(null,'',location.pathname+'?'+p);show('home',false);show('teacher',role==='teacher');show('student',role==='student');notice('');}
$('create').onclick=async()=>{try{$('create').disabled=true;const data=await api('create');teacherToken=data.teacherToken;localStorage.setItem('fish_teacher_'+data.code,teacherToken);setRoute('teacher',data.code);render(data.room)}catch(e){notice(e.message)}finally{$('create').disabled=false}};
$('student-entry').onclick=()=>show('join-entry',true);
$('go-room').onclick=()=>{const c=$('code-input').value.trim();if(!/^\d{6}$/.test(c))return notice('Nhập mã phòng gồm 6 chữ số.');setRoute('student',c);refresh()};
$('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(url());notice('Đã sao chép liên kết học sinh.')}catch{notice('Hãy sao chép liên kết ngay bên dưới mã QR.')}};
$('start').onclick=()=>teacherAction('start');$('finish').onclick=()=>teacherAction('finish');$('reset').onclick=()=>{if(confirm('Bắt đầu vòng mới? Đáp án và điểm của vòng hiện tại sẽ được xóa.'))teacherAction('reset')};
async function teacherAction(action,extra={}){try{const data=await api(action,{teacherToken,...extra});render(data.room);notice('')}catch(e){notice(e.message)}}
function qr(){const link=url();$('student-url').href=link;$('student-url').textContent=link; // QR is an image, students can also type the code if external image service is blocked.
$('qr').src='https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data='+encodeURIComponent(link);
$('qr').onerror=()=>{$('qr').alt='Không tải được QR. Học sinh có thể mở liên kết hoặc nhập mã phòng.'};}
function render(r){if(!r)return;room=r;const oldRound=lastRound;lastRound=r.round;
 if(role==='teacher'){renderTeacher(r);return;}
 if(role==='student'){renderStudent(r,oldRound)}
}
function renderTeacher(r){$('teacher-code').textContent=r.code;qr();$('teacher-state').textContent=({waiting:'Đang chờ',playing:'Đang thi',finished:'Đã công bố'})[r.status];
 $('start').disabled=r.status!=='waiting'||!r.joinedTeams.length;$('finish').disabled=r.status!=='playing';
 $('teacher-teams').innerHTML=Array.from({length:5},(_,i)=>{const n=i+1,joined=r.joinedTeams.includes(n),done=r.submittedTeams.includes(n),result=r.results.find(x=>x.team===n);return `<div class="team ${done?'done':joined?'joined':''}"><div class="icon">${['🐠','🐟','🐡','🐬','🐸'][i]}</div><strong>Nhóm ${n}</strong><small>${done?'✅ Đã nộp':joined?'🟢 Đã kết nối':'⚪ Chưa vào'}</small>${result?`<p><b>${result.score}/3 câu</b><br>${fmt(result.elapsedMs)}</p>`:''}${joined&&r.status==='waiting'?`<button class="secondary" data-remove="${n}">Xóa iPad</button>`:''}</div>`}).join('');
 document.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{if(confirm('Cho nhóm này chọn lại iPad?'))teacherAction('remove',{team:Number(el.dataset.remove)})});
 show('ranking-panel',r.status==='finished');if(r.status==='finished')$('ranking').innerHTML=r.ranking.length?r.ranking.map((x,i)=>`<div class="rank"><strong>${['🥇','🥈','🥉','⭐','⭐'][i]} Nhóm ${x.team}</strong><span>${x.score}/3 câu · ${fmt(x.elapsedMs)}</span></div>`).join(''):'Chưa có nhóm nộp bài.';
 updateClock();}
function renderStudent(r,oldRound){$('student-code').textContent=r.code;$('my-team').textContent=team?'Nhóm '+team:'Chưa chọn nhóm';$('student-state').textContent=({waiting:'Đang chờ',playing:'Đang thi',finished:'Kết thúc'})[r.status];
 if(team && oldRound && oldRound!==r.round){selected=[null,null,null];activeBlank=0}
 if(!team){show('team-picker');show('waiting',false);show('playing',false);show('submitted',false);show('student-finished',false);renderTeamPicker(r);return}
 if(!r.joinedTeams.includes(team)){team=0;studentToken='';localStorage.removeItem('fish_student_'+code);notice('Giáo viên đã đặt lại nhóm. Hãy chọn nhóm để tham gia.');renderStudent(r,oldRound);return}
 show('team-picker',false);const submitted=r.submittedTeams.includes(team);
 show('waiting',r.status==='waiting');show('playing',r.status==='playing'&&!submitted);show('submitted',r.status==='playing'&&submitted);show('student-finished',r.status==='finished');
 if(r.status==='finished'){const result=r.ranking.find(x=>x.team===team);$('student-result').textContent=result?`Nhóm ${team} đúng ${result.score}/3 câu, thời gian ${fmt(result.elapsedMs)}. Chúc mừng các em!`:'Nhóm chưa nộp bài. Chờ cô giáo mở vòng mới nhé!'}
 if(r.status==='playing'&&!submitted)renderExercise();updateClock();}
function renderTeamPicker(r){$('team-buttons').innerHTML=Array.from({length:5},(_,i)=>{const n=i+1,taken=r.joinedTeams.includes(n);return `<button class="team-choice ${taken?'taken':'primary'}" data-team="${n}" ${taken||r.status!=='waiting'?'disabled':''}>${['🐠','🐟','🐡','🐬','🐸'][i]} Nhóm ${n}<br><small>${taken?'Đã có iPad':'Chọn nhóm'}</small></button>`}).join('');document.querySelectorAll('[data-team]').forEach(b=>b.onclick=()=>join(Number(b.dataset.team)))}
async function join(n){try{const data=await api('join',{team:n});team=n;studentToken=data.studentToken;localStorage.setItem('fish_student_'+code,JSON.stringify({team,studentToken}));render(data.room);notice('')}catch(e){notice(e.message);refresh()}}
function renderExercise(){document.querySelectorAll('[data-blank]').forEach(b=>{const i=Number(b.dataset.blank);b.textContent=selected[i]||'Chọn từ…';b.classList.toggle('selected',i===activeBlank);b.onclick=()=>{activeBlank=i;renderExercise()}});
 $('word-bank').innerHTML=words.map(w=>`<button class="word ${selected.includes(w)?'used':''}" data-word="${w}" ${selected.includes(w)?'disabled':''}>${w}</button>`).join('');document.querySelectorAll('[data-word]').forEach(b=>b.onclick=()=>{const w=b.dataset.word;selected[activeBlank]=w;const next=selected.findIndex((x,i)=>!x&&i!==activeBlank);if(next>=0)activeBlank=next;renderExercise()});
 document.querySelectorAll('[data-blank]').forEach(b=>b.ondblclick=()=>{selected[Number(b.dataset.blank)]=null;renderExercise()});
 $('submit').disabled=selected.some(x=>!x);
}
$('submit').onclick=async()=>{if(selected.some(x=>!x))return notice('Hãy điền đủ 3 ô trống.');if(!confirm('Nhóm đã thống nhất đáp án và muốn nộp bài?'))return;try{$('submit').disabled=true;const data=await api('submit',{team,studentToken,answers:selected});render(data.room);notice('')}catch(e){notice(e.message)}finally{$('submit').disabled=false}};
function updateClock(){if(!room)return;const elapsed=room.startedAt?(room.endedAt||Date.now())-room.startedAt:0;if(role==='teacher')$('teacher-timer').textContent='⏱ '+fmt(elapsed);if(role==='student')$('student-timer').textContent='⏱ '+fmt(elapsed)}
async function refresh(){if(!role||!code||pollBusy)return;pollBusy=true;try{const data=await api('state',{},'GET');render(data.room);if($('notice').textContent.startsWith('Mất kết nối'))notice('')}catch(e){notice('Mất kết nối tạm thời: '+e.message)}finally{pollBusy=false}}
function init(){const p=new URLSearchParams(location.search),r=p.get('role'),c=p.get('room');if((r==='teacher'||r==='student')&&/^\d{6}$/.test(c||'')){setRoute(r,c);if(r==='teacher'){teacherToken=localStorage.getItem('fish_teacher_'+c)||'';if(!teacherToken){show('teacher',false);show('home');notice('Không có quyền giáo viên trên thiết bị này. Hãy tạo phòng mới từ màn hình chính.');role='';return}}
 if(r==='student'){try{const saved=JSON.parse(localStorage.getItem('fish_student_'+c)||'null');if(saved){team=saved.team;studentToken=saved.studentToken}}catch{}}refresh()}
setInterval(refresh,1500);setInterval(updateClock,250);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});}
init();
