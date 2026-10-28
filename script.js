(function(){
  // Penyimpanan (localStorage dengan cadangan memori)
  var mem={};
  function get(k,def){try{var v=localStorage.getItem(k);return v?JSON.parse(v):def}catch(e){return k in mem?mem[k]:def}}
  function set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){mem[k]=v}}

  async function hash(s){
    try{
      var b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('absensir:'+s));
      return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0')}).join('');
    }catch(e){return 'plain:'+s}
  }

  var $=function(id){return document.getElementById(id)};
  var status='Hadir', timer=null;

  // Data awal: akun contoh
  async function seed(){
    var u=get('absensir_users',null);
    if(!u){u={'1001':{nis:'1001',name:'Ayu Lestari',kelas:'XI IPA 2',pass:await hash('siswa123')}};set('absensir_users',u)}
  }

  function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  function fmtDate(iso){var p=iso.split('-');return new Date(p[0],p[1]-1,p[2]).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

  // Tab login / daftar
  function tab(reg){
    $('fLogin').classList.toggle('hidden',reg);$('fReg').classList.toggle('hidden',!reg);
    $('tabLogin').setAttribute('aria-selected',!reg);$('tabReg').setAttribute('aria-selected',reg);
    say('authMsg','');
  }
  $('tabLogin').onclick=function(){tab(false)};
  $('tabReg').onclick=function(){tab(true)};
  function say(id,t,good){var e=$(id);e.textContent=t;e.classList.toggle('good',!!good)}

  // Daftar
  $('fReg').addEventListener('submit',async function(e){
    e.preventDefault();
    var name=$('rName').value.trim(),nis=$('rNis').value.trim(),kelas=$('rClass').value.trim(),pass=$('rPass').value;
    if(!name||!nis||!kelas||!pass)return say('authMsg','Lengkapi semua kolom.');
    if(!/^\d{3,15}$/.test(nis))return say('authMsg','NIS harus berupa angka (3–15 digit).');
    if(pass.length<6)return say('authMsg','Kata sandi minimal 6 karakter.');
    var users=get('absensir_users',{});
    if(users[nis])return say('authMsg','NIS ini sudah terdaftar. Silakan masuk.');
    users[nis]={nis:nis,name:name,kelas:kelas,pass:await hash(pass)};
    set('absensir_users',users);
    $('fReg').reset();tab(false);$('lNis').value=nis;
    say('authMsg','Akun dibuat. Masuk untuk mulai absen.',true);
  });

  // Login
  $('fLogin').addEventListener('submit',async function(e){
    e.preventDefault();
    var nis=$('lNis').value.trim(),pass=$('lPass').value;
    if(!nis||!pass)return say('authMsg','Isi NIS dan kata sandi.');
    var u=get('absensir_users',{})[nis];
    if(!u||u.pass!==await hash(pass))return say('authMsg','NIS atau kata sandi salah.');
    set('absensir_session',nis);
    $('fLogin').reset();say('authMsg','');
    showApp();
  });

  // Gerbang: halaman absen hanya bisa dibuka bila ada sesi login
  function currentUser(){
    var nis=get('absensir_session',null);
    return nis?get('absensir_users',{})[nis]||null:null;
  }
  function showApp(){
    var u=currentUser();
    if(!u){showAuth();return}
    $('auth').classList.add('hidden');$('app').classList.remove('hidden');
    $('uName').textContent=u.name;$('uClass').textContent='Kelas '+u.kelas+' · NIS '+u.nis;
    say('appMsg','');render();tick();
    clearInterval(timer);timer=setInterval(tick,1000);
  }
  function showAuth(){
    clearInterval(timer);
    $('app').classList.add('hidden');$('auth').classList.remove('hidden');
  }
  $('logout').onclick=function(){set('absensir_session',null);showAuth()};

  function tick(){
    var d=new Date();
    $('clock').textContent=d.toLocaleTimeString('id-ID',{hour12:false}).replace(/\./g,':');
    $('date').textContent=d.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  }

  // Pilihan status
  document.querySelectorAll('.choice').forEach(function(b){
    b.onclick=function(){
      status=b.dataset.s;
      document.querySelectorAll('.choice').forEach(function(x){x.setAttribute('aria-pressed',x===b)});
    };
  });

  // Kirim absen
  $('btnAbsen').onclick=function(){
    var u=currentUser();
    if(!u){showAuth();return}
    var all=get('absensir_att',{}),mine=all[u.nis]||[];
    if(mine.some(function(r){return r.date===today()}))return say('appMsg','Kamu sudah absen hari ini.');
    var now=new Date(),st=status;
    if(st==='Hadir'&&(now.getHours()>7||(now.getHours()===7&&now.getMinutes()>15)))st='Terlambat';
    mine.unshift({date:today(),time:now.toTimeString().slice(0,8),status:st});
    all[u.nis]=mine;set('absensir_att',all);
    say('appMsg','Absen tersimpan.',true);render();
  };

  function render(){
    var u=currentUser();if(!u)return;
    var mine=(get('absensir_att',{})[u.nis])||[];
    var t=mine.find(function(r){return r.date===today()});
    $('formAbsen').classList.toggle('hidden',!!t);
    var d=$('done');d.classList.toggle('hidden',!t);
    if(t)d.innerHTML='<div class="stamp">'+esc(t.status.toUpperCase())+'<small>Tercatat pukul '+esc(t.time)+'</small></div>';
    var c={Hadir:0,Terlambat:0,Izin:0,Sakit:0};
    mine.forEach(function(r){c[r.status]=(c[r.status]||0)+1});
    $('stat').innerHTML=Object.keys(c).map(function(k){return '<div><b class="'+k+'">'+c[k]+'</b><span>'+k+'</span></div>'}).join('');
    $('rows').innerHTML=mine.map(function(r){return '<tr><td>'+fmtDate(r.date)+'</td><td>'+esc(r.time)+'</td><td class="tag '+esc(r.status)+'">'+esc(r.status)+'</td></tr>'}).join('');
    $('empty').classList.toggle('hidden',mine.length>0);
  }

  // Tombol mata: tampilkan / sembunyikan kata sandi
  document.querySelectorAll('.eye').forEach(function(btn){
    btn.onclick=function(){
      var inp=btn.parentNode.querySelector('input');
      var show=inp.type==='password';
      inp.type=show?'text':'password';
      btn.setAttribute('aria-pressed',show);
      btn.setAttribute('aria-label',show?'Sembunyikan kata sandi':'Tampilkan kata sandi');
    };
  });

  seed().then(showApp);
})();
