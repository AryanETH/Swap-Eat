import * as data from './data.js';

const paths={
  swap:'M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4',
  pin:'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z M12 10h.01',
  search:'M21 21l-5-5m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  explore:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  inbox:'M4 4h16v16H4zM4 13h5l1 3h4l1-3h5',
  bag:'M4 8h16l1 13H3L4 8Zm4 2V6a4 4 0 0 1 8 0v4',
  plus:'M12 5v14M5 12h14',
  user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21a8 8 0 0 1 16 0',
  food:'M4 14h16m-15 0a7 7 0 0 1 14 0M2 18h20m-10-11V5',
  time:'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  arrow:'M4 12h15m-6-6 6 6-6 6',
  chevron:'m6 9 6 6 6-6'
};
const icon=(name)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[name]+'"/></svg>';
const $=(id)=>document.getElementById(id);
const escape=(value)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const areas=['Lalghati','Karond','Gandhi Nagar','Other'];
const categories=['Meals','Bakery','Produce'];
const modes=['Share','Swap','Deal'];
const nav=[['explore','Explore','explore'],['requests','Requests','inbox'],['listings','My listings','bag']];
const modeText={Share:'Free',Swap:'Swap',Deal:'Deal'};
const dialog=$('dialog');
const fmt=new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'});
const date=(value)=>fmt.format(new Date(value));
const labels={pending:'Pending',accepted:'Accepted',declined:'Declined',cancelled:'Cancelled',available:'Available',reserved:'Reserved',removed:'Withdrawn'};
let listings=[], requests=[], user=null, view='', area='All Bhopal', category='All', search='', sort='new', requestTab='sent', toastTimer, afterSignIn=null;
const find=(id)=>listings.find(l=>l.id===id);
const available=(item)=>item?.status==='available' && Date.parse(item.pickup)>Date.now();
const money=(item)=>item.mode==='Deal'?'₹'+item.price:modeText[item.mode];
const options=(items,val='')=>items.map(x=>'<option'+(x===val?' selected':'')+'>'+escape(x)+'</option>').join('');
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;toastTimer=setTimeout(()=>$('toast').textContent='',4200);}
function fail(e){
  return ({'auth/invalid-credential':'Email or password is incorrect.','auth/email-already-in-use':'An account already uses this email.','auth/weak-password':'Use a password with at least six characters.','auth/network-request-failed':'Connection failed. Try again.','permission-denied':'This action is unavailable or has already been completed.'}[e.code]) || (e.code?'Connection or service error. Try again.':e.message);
}
function media(item,extra=''){
  const photo=/^[\d-]+[a-f\d-]*$/i.test(item.photo||'')?'https://images.unsplash.com/photo-'+item.photo+'?auto=format&fit=crop&w=720&q=82':'';
  return '<div class="media '+extra+'">'+icon('food')+(photo?'<img alt="" loading="lazy" src="'+photo+'">':'')+'<span class="badge">'+escape(item.category)+'</span></div>';
}
function rowTitle(title,count=''){
  return '<div class="section-head"><h1>'+title+'</h1>'+count+'</div>';
}
function tabs(){
  const tabHtml=nav.map(([route,label,name])=>'<button data-route="'+route+'"'+(view===route?' aria-current="page"':'')+'>'+icon(name)+label+'</button>').join('');
  $('desktop').innerHTML=tabHtml;
  $('bottom').innerHTML=tabHtml+'<button data-action="post">'+icon('plus')+'List food</button>';
  $('location').innerHTML=icon('pin')+escape(area==='All Bhopal'?'Bhopal':area)+icon('chevron');
  $('account').innerHTML=icon('user')+' '+(data.isDemo?'Demo':user?'Account':'Sign in');
}
function explore(){
  $('main').innerHTML='<section class="hero"><div class="hero-image"></div><div class="hero-content"><div class="eyebrow"><span class="dot"></span>Bhopal food exchange</div><h1>Good food.<br><span>Better shared.</span></h1><button class="primary" data-action="post">'+icon('plus')+' List food</button></div></section>'+
  '<section id="market"><div class="section-head"><h2>Find food nearby</h2><span id="count" class="count"></span>'+(data.isDemo?'<button class="chip demo" data-action="demo">Demo mode</button>':'')+'</div>'+
  '<div class="filters"><label class="search">'+icon('search')+'<input type="search" id="search" aria-label="Search listings" placeholder="Search food or area"></label><select id="sort" aria-label="Sort listings"><option value="new">Newest</option><option value="soon">Pickup soon</option><option value="price">Lowest price</option></select></div>'+
  '<div class="chips" id="chips"></div><div id="results"></div></section>';
  $('search').value=search;
  $('search').oninput=e=>{search=e.target.value;results();};
  $('sort').value=sort;
  $('sort').onchange=e=>{sort=e.target.value;results();};
  results();
}
function results(){
  let items=listings.filter(item=>available(item)
    && (area==='All Bhopal'||area===item.area)
    && (category==='All'||category===item.category||category===item.mode)
    && [item.title,item.area,item.provider,item.ingredients].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const comparisons={new:(a,b)=>b.createdAt-a.createdAt,soon:(a,b)=>Date.parse(a.pickup)-Date.parse(b.pickup),price:(a,b)=>a.price-b.price};
  items.sort(comparisons[sort]);
  $('chips').innerHTML=['All',...categories,...modes].map(x=>'<button class="chip" data-filter="'+x+'" aria-pressed="'+(category===x)+'">'+x+'</button>').join('');
  $('count').textContent=items.length+' '+(items.length===1?'listing':'listings');
  $('results').innerHTML=items.length?'<div class="grid">'+items.map(item=>
    '<article class="card"><button class="card-open" data-item="'+escape(item.id)+'">'+media(item)+'<div class="card-body"><h3>'+escape(item.title)+'</h3><span class="line">'+icon('pin')+escape(item.area)+' · '+escape(item.provider)+'</span><div class="card-bottom"><span class="line">'+icon('time')+shortTime(item.pickup)+'</span><span class="price">'+money(item)+'</span></div></div></button></article>'
  ).join('')+'</div>':'<div class="empty">No available food matches your filters.</div>';
}
function shortTime(value){
  const pickup=new Date(value);
  const today=new Date().toDateString()===pickup.toDateString();
  return (today?'Today, ':pickup.toLocaleDateString('en-IN',{day:'numeric',month:'short'})+', ')+pickup.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'});
}
function noAccount(){return '<div class="empty"><button class="primary" data-action="auth">Sign in</button></div>';}
function myListings(){
  const own=user?listings.filter(l=>l.owner===user.uid && l.status!=='removed').sort((a,b)=>b.createdAt-a.createdAt):[];
  $('main').innerHTML=rowTitle('My listings','<button class="primary" data-action="post">+ List food</button>')+
    (!user?noAccount():own.length?own.map(item=>'<div class="row"><div><strong>'+escape(item.title)+'</strong><p class="muted">'+escape(item.area)+' · '+(item.status==='available'&&!available(item)?'Expired':labels[item.status])+'</p></div><div class="actions"><button class="secondary" data-item="'+escape(item.id)+'">View</button>'+(item.status==='available'?'<button class="danger" data-withdraw="'+escape(item.id)+'">Withdraw</button>':'')+'</div></div>').join(''):'<div class="empty">Your published listings will appear here.</div>');
}
function myRequests(){
  const received=requestTab==='received';
  const items=user?requests.filter(r=>r[received?'owner':'buyer']===user.uid).sort((a,b)=>b.createdAt-a.createdAt):[];
  $('main').innerHTML=rowTitle('Requests')+(!user?noAccount():'<div class="chips">'+['sent','received'].map(x=>'<button class="chip" aria-pressed="'+(requestTab===x)+'" data-tab="'+x+'">'+(x==='sent'?'Sent':'Received')+'</button>').join('')+'</div>'+
  (items.length?items.map(r=>{
    const listing=find(r.listing);
    const closed=r.status==='pending' && !available(listing);
    const status=closed?'Unavailable':labels[r.status];
    const id=escape(r.id);
    return '<div class="row"><div><strong>'+escape(r.title)+'</strong><p class="muted">'+date(r.pickup)+'</p>'+(r.message?'<p>'+escape(r.message)+'</p>':'')+(r.pickupNote?'<p><strong>Pickup</strong> '+escape(r.pickupNote)+'</p>':'')+'</div><div class="actions"><span class="badge">'+status+'</span>'+
    (r.status==='pending'?(received?(!closed?'<button class="primary" data-accept="'+id+'">Accept</button>':'')+'<button class="secondary" data-response="declined" data-id="'+id+'">Decline</button>':'<button class="secondary" data-response="cancelled" data-id="'+id+'">Cancel</button>'):'')+'</div></div>';
  }).join(''):'<div class="empty">No '+requestTab+' requests.</div>'));
}
function render(){
  tabs();
  if(view==='explore'){if($('results')) results();else explore();}
  else if(view==='listings') myListings();
  else myRequests();
}
function navigate(){
  const route=location.hash.slice(1);
  const next=nav.some(n=>n[0]===route)?route:'explore';
  if(next!==view){view=next; $('main').replaceChildren();window.scrollTo(0,0);}
  render();
}
function go(route){if(location.hash==='#'+route) navigate();else location.hash=route;}
function modal(title,html){
  $('modal').innerHTML='<div class="modal-head"><h2>'+escape(title)+'</h2><button class="close" data-action="close" aria-label="Close">×</button></div>'+html;
  if(!dialog.open) dialog.showModal();
}
function form(title,fields,submit,fn,extra=''){
  modal(title,'<form class="stack">'+fields+'<p class="error" role="alert"></p><button class="primary" type="submit">'+submit+'</button>'+extra+'</form>');
  const node=$('modal').querySelector('form');
  node.onsubmit=async e=>{
    e.preventDefault();
    const button=node.querySelector('button[type=submit]');
    button.disabled=true;
    node.querySelector('.error').textContent='';
    try {await fn(Object.fromEntries(new FormData(node)));}
    catch(err){node.querySelector('.error').textContent=fail(err);}
    finally{button.disabled=false;}
  };
}
function account(mode='signin'){
  if(data.isDemo){modal('Demo mode','<p class="muted">You can try listings and pickup requests here. Demo activity stays in this browser.</p>');return;}
  if(user){modal('Account','<div class="stack"><div class="detail">'+escape(user.email)+'</div><button class="secondary" data-action="logout">Sign out</button></div>');return;}
  const reset=mode==='reset', sign=mode==='signin';
  const title=reset?'Reset password':sign?'Sign in':'Create account';
  form(title,'<label>Email<input name="email" type="email" autocomplete="email" required></label>'+
  (reset?'':'<label>Password<input name="password" type="password" autocomplete="'+(sign?'current-password':'new-password')+'" minlength="6" required></label>'),
  reset?'Send reset link':title,async values=>{
    await data.authenticate(mode,values.email.trim(),values.password);
    if(!reset && afterSignIn){
      const next=afterSignIn;
      afterSignIn=null;
      user=data.signedInUser() || user;
      next();
      return;
    }
    dialog.close();
    toast(reset?'If this email has an account, a reset link will be sent.':'Signed in');
  },'<button type="button" class="secondary" data-auth="'+(sign?'signup':'signin')+'">'+(sign?'Create account':'Back to sign in')+'</button>'+(sign?'<button type="button" class="secondary" data-auth="reset">Forgot password?</button>':''));
}
function post(){
  if(!user){afterSignIn=post;account();return;}
  form('List food','<label>Food name<input name="title" required maxlength="70" placeholder="e.g. Vegetable biryani"></label>'+
  '<div class="pair"><label>Category<select name="category">'+options(categories)+'</select></label><label>Offer<select name="mode">'+options(modes)+'</select></label></div>'+
  '<div class="pair"><label>Neighbourhood<select name="area">'+options(areas,area)+'</select></label><label>Provider<select name="provider">'+options(['Community','Kitchen','Restaurant','Café','Store'])+'</select></label></div>'+
  '<div class="pair"><label>Servings<input type="number" name="servings" required min="1" max="100" step="1" value="1"></label><label id="priceField" hidden>Price in ₹<input type="number" name="price" min="1" max="10000" step="1" disabled></label></div>'+
  '<label>Pickup deadline<input type="datetime-local" name="pickup" required></label>'+
  '<label>Ingredients and allergens<textarea name="ingredients" maxlength="400" required rows="2" placeholder="List ingredients and known allergens"></textarea></label>',
  'Publish listing',async values=>{
    const pickup=new Date(values.pickup);
    if(!values.title.trim() || !values.ingredients.trim()) throw new Error('Enter a food name and ingredients.');
    if(!Number.isFinite(pickup.getTime())||pickup.getTime()<=Date.now()) throw new Error('Choose a future pickup deadline.');
    await data.publish({...values,title:values.title.trim(),ingredients:values.ingredients.trim(),servings:Number(values.servings),price:Number(values.price||0), pickup:pickup.toISOString(),pickupAt:pickup.getTime()});
    dialog.close();go('listings');toast('Listing published');
  });
  const node=$('modal').querySelector('form');
  node.elements.mode.onchange=()=>{
    const deal=node.elements.mode.value==='Deal';
    $('priceField').hidden=!deal;
    node.elements.price.disabled=!deal;
    node.elements.price.required=deal;
  };
}
function details(item){
  if(!item)return;
  const requested=requests.some(r=>r.listing===item.id && r.buyer===user?.uid);
  const call=available(item)&&item.owner!==user?.uid
    ? requested?'<span class="badge">Request sent</span>':'<button class="primary" data-request="'+escape(item.id)+'">'+(item.mode==='Swap'?'Offer a swap':'Request pickup')+'</button>'
    : '<span class="badge">'+(available(item)?'Your listing':'Unavailable')+'</span>';
  modal(item.title,media(item,'modal-photo')+'<div class="stack"><div class="line">'+icon('pin')+escape(item.area)+' · '+escape(item.provider)+'</div><div class="line">'+icon('time')+'Pickup by '+date(item.pickup)+'</div><div class="line">'+icon('food')+item.servings+' '+(item.servings===1?'serving':'servings')+' · '+money(item)+'</div><div><strong>Ingredients and allergens</strong><p class="detail">'+escape(item.ingredients)+'</p></div>'+call+'</div>');
}
function requestPickup(item){
  if(!item || !available(item))return toast('This listing is no longer available.');
  if(!user){afterSignIn=()=>requestPickup(find(item.id));account();return;}
  const swap=item.mode==='Swap';
  form(swap?'Offer a swap':'Request pickup','<span class="muted">'+escape(item.title)+' · '+escape(item.area)+'</span><label>'+ (swap?'What can you offer?':'Pickup note (optional)')+'<textarea name="message" rows="3" maxlength="350" '+(swap?'required':'')+'></textarea></label>','Send request',async values=>{
    const note=values.message.trim();
    if(swap&&!note)throw new Error('Enter what you can offer in return.');
    await data.request(item,note);
    dialog.close();requestTab='sent';go('requests');toast('Request sent');
  });
}
function accept(item){
  if(!item)return;
  form('Accept request','<label>Pickup instructions<textarea name="note" rows="3" maxlength="350" required placeholder="Public pickup point and time"></textarea></label>','Accept request',async values=>{
    if(!values.note.trim())throw new Error('Enter pickup instructions.');
    await data.respond(item,'accepted',values.note.trim());dialog.close();toast('Request accepted');
  });
}
document.addEventListener('click',async e=>{
  const btn=e.target.closest('button');
  if(!btn)return;
  const d=btn.dataset;
  try{
    if(btn.id==='account') account();
    if(btn.id==='location') form('Choose area','<label>Neighbourhood<select name="area">'+options(['All Bhopal',...areas],area)+'</select></label>','Apply',async values=>{area=values.area;dialog.close();go('explore');render();});
    if(d.route)go(d.route);
    if(d.filter){category=d.filter;results();$('chips').querySelector('[aria-pressed=true]')?.focus();}
    if(d.tab){requestTab=d.tab;myRequests();}
    if(d.item)details(find(d.item));
    if(d.request)requestPickup(find(d.request));
    if(d.auth)account(d.auth);
    if(d.accept)accept(requests.find(r=>r.id===d.accept));
    if(d.withdraw)form('Withdraw listing','<p class="muted">'+escape(find(d.withdraw)?.title)+'</p>','Withdraw listing',async()=>{await data.withdraw(d.withdraw);dialog.close();toast('Listing withdrawn');});
    if(d.response){
      btn.disabled=true;
      try{await data.respond(requests.find(r=>r.id===d.id),d.response);toast(labels[d.response]);}finally{btn.disabled=false;}
    }
    if(d.action==='demo'||d.action==='auth')account();
    if(d.action==='post')post();
    if(d.action==='close'){afterSignIn=null;dialog.close();}
    if(d.action==='logout'){await data.logout();dialog.close();toast('Signed out');}
  }catch(err){toast(fail(err));}
});
dialog.addEventListener('cancel',()=>{afterSignIn=null;});
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement)e.target.remove();},true);
document.querySelector('.logo').innerHTML=icon('swap');
window.addEventListener('hashchange',navigate);
navigate();
data.start((l,r)=>{listings=l;requests=r;render();},who=>{user=who;render();},err=>toast(fail(err)));
setInterval(()=>{if(view==='explore'&&!dialog.open)results();},60000);
