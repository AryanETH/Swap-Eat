import {firebaseConfig} from './firebase-config.js';

export const isDemo = !firebaseConfig;
const demoItems = [
  ['Veg biryani','Meals','Share','Lalghati',4,0,'1546833999-b9f581a1996d'],
  ['Grilled veggie sandwiches','Meals','Swap','Karond',3,0,'1528735602780-2552fd46c7af'],
  ['Fresh sourdough loaf','Bakery','Deal','Gandhi Nagar',2,65,'1509440159596-0249088772ff'],
  ['Market-fresh bananas','Produce','Share','Karond',6,0,'1571771894821-ce9b6c11b08e'],
  ['Mixed garden greens','Produce','Swap','Lalghati',3,0,'1512621776951-a57141f2eefd'],
  ['Chocolate muffins','Bakery','Deal','Gandhi Nagar',5,40,'1607958996333-41aef7caefaa']
];
const hour = 3600000;
const freshDemo = () => ({listings: demoItems.map(([title, category, mode, area, servings, price, photo], i) => ({
  id:'sample-'+i,title,category,mode,area,servings,price,photo,owner:'sample',provider:i%2?'Kitchen':'Community',
  pickup:new Date(Date.now()+(3+i)*hour).toISOString(),createdAt:Date.now()-i*60000,
  ingredients:['Rice, vegetables, spices','Wheat bread, vegetables, cheese','Wheat flour, yeast, salt','Bananas','Mixed leafy greens','Wheat, milk, eggs, cocoa'][i],
  status:'available'
})), requests:[]});
function demoRead(){
  try { return JSON.parse(localStorage.getItem('swap-eat-demo-v1')) || freshDemo(); }
  catch { return freshDemo(); }
}
let cache = isDemo ? demoRead() : null;
const emit = () => listener?.(cache.listings, cache.requests);
function demoSave(){
  try { localStorage.setItem('swap-eat-demo-v1', JSON.stringify(cache)); } catch {}
  emit();
}
let listener, report, authListener, auth, db, A, F, stopRequests = [];
let currentUser = isDemo ? {uid:'demo', email:'Preview account'} : null;
let activeRequests = {sent:[],received:[]};
let liveListings = [];
let initialization;
const list = (name) => F.collection(db,name);
const ref = (name,id) => F.doc(db,name,id);
function liveEmit(){ listener?.(liveListings, [...activeRequests.sent,...activeRequests.received]); }

export function start(onData,onUser,onError){
  listener=onData; report=onError; authListener=onUser;
  if(isDemo){ emit(); authListener(currentUser); return; }
  initialization = connect();
  initialization.catch(report);
}
async function connect(){
  const cdn='https://www.gstatic.com/firebasejs/11.10.0/';
  const [app, authModule, firestore] = await Promise.all([
    import(cdn+'firebase-app.js'),import(cdn+'firebase-auth.js'),import(cdn+'firebase-firestore.js')
  ]);
  A=authModule;
  F=firestore;
  const project=app.initializeApp(firebaseConfig);
  auth=A.getAuth(project);
  db=F.getFirestore(project);
  F.onSnapshot(list('listings'),snap=>{
    liveListings=snap.docs.map(d=>({...d.data(),id:d.id}));
    liveEmit();
  },report);
  A.onAuthStateChanged(auth, user=>{
    stopRequests.forEach(stop=>stop());
    stopRequests=[];
    currentUser=user;
    activeRequests={sent:[],received:[]};
    authListener(user);
    liveEmit();
    if(!user) return;
    for(const [key,field] of [['sent','buyer'],['received','owner']]){
      const query=F.query(list('requests'),F.where(field,'==',user.uid));
      stopRequests.push(F.onSnapshot(query,snap=>{
        activeRequests[key]=snap.docs.map(d=>({...d.data(),id:d.id}));
        liveEmit();
      },report));
    }
  },report);
}
export async function authenticate(mode,email,password,name){
  await initialization;
  if(mode==='reset') return A.sendPasswordResetEmail(auth,email);
  if(mode==='google') return A.signInWithPopup(auth,new A.GoogleAuthProvider());
  if(mode==='signup'){
    const result=await A.createUserWithEmailAndPassword(auth,email,password);
    await A.updateProfile(result.user,{displayName:name});
    return result;
  }
  return A.signInWithEmailAndPassword(auth,email,password);
}
export async function updateName(name){
  await initialization;
  await A.updateProfile(auth.currentUser,{displayName:name});
}
export async function getProfile(){
  const snapshot=await F.getDoc(ref('profiles',currentUser.uid));
  return snapshot.exists()?snapshot.data():null;
}
export async function saveProfile(name,phone){
  phone=phone.trim();
  if(!/^[+0-9 ()-]{7,20}$/.test(phone))throw new Error('Enter a valid phone number.');
  await F.setDoc(ref('profiles',currentUser.uid),{name,phone});
  await A.updateProfile(auth.currentUser,{displayName:name});
}
export async function logout(){ await initialization; return A.signOut(auth); }
export function signedInUser(){ return auth?.currentUser; }
export async function publish(values){
  const {photos=[],...details}=values;
  const entry={...details,photoCount:photos.length,owner:currentUser.uid,status:'available',createdAt:Date.now()};
  if(!isDemo){
    const listingRef=F.doc(list('listings'));
    const batch=F.writeBatch(db);
    batch.set(listingRef,entry);
    if(photos.length) batch.set(F.doc(listingRef,'media','photos'),{photos});
    return batch.commit();
  }
  entry.photos=photos;
  cache.listings.unshift({...entry,id:crypto.randomUUID()});
  demoSave();
}
export async function getPhotos(item){
  if(isDemo || !item.photoCount) return item.photos || [];
  const snapshot=await F.getDoc(F.doc(ref('listings',item.id),'media','photos'));
  return snapshot.exists()?snapshot.data().photos:[];
}
export async function request(item,message,buyerPhone){
  const id=item.id+'_'+currentUser.uid;
  const entry={listing:item.id,title:item.title,owner:item.owner,buyer:currentUser.uid,pickup:item.pickup,message,status:'pending',createdAt:Date.now()};
  if(isDemo){
    if(cache.requests.some(r=>r.id===id)) throw new Error('You already requested this listing.');
    cache.requests.unshift({...entry,id});
    demoSave();
    return;
  }
  return F.runTransaction(db,async tx=>{
    const listingRef=ref('listings',item.id);
    const requestRef=ref('requests',id);
    const listingSnap=await tx.get(listingRef);
    if(!listingSnap.exists() || listingSnap.data().status!=='available' ||
       Date.parse(listingSnap.data().pickup)<=Date.now()) throw new Error('This listing is no longer available.');
    tx.set(requestRef,entry);
    tx.set(F.doc(requestRef,'contacts',currentUser.uid),{phone:buyerPhone});
  });
}
export async function respond(item,status,pickupNote='',ownerPhone=''){
  const update={status,pickupNote};
  if(isDemo){
    if(status==='accepted') cache.listings.find(l=>l.id===item.listing).status='reserved';
    Object.assign(cache.requests.find(r=>r.id===item.id),update);
    demoSave();
    return;
  }
  return F.runTransaction(db,async tx=>{
    const requestRef=ref('requests',item.id);
    const original=await tx.get(requestRef);
    if(!original.exists() || original.data().status!=='pending') throw new Error('This request is already closed.');
    if(status==='accepted'){
      const listingRef=ref('listings',item.listing);
      const listingSnap=await tx.get(listingRef);
      if(!listingSnap.exists() || listingSnap.data().status!=='available' ||
         Date.parse(listingSnap.data().pickup)<=Date.now()) throw new Error('This listing is no longer available.');
      tx.update(listingRef,{status:'reserved',acceptedRequest:item.id});
      tx.set(F.doc(requestRef,'contacts',currentUser.uid),{phone:ownerPhone});
    }
    tx.update(requestRef,update);
  });
}
export async function withdraw(id){
  if(!isDemo) return F.updateDoc(ref('listings',id),{status:'removed'});
  cache.listings.find(l=>l.id===id).status='removed';
  demoSave();
}

export async function release(item){
  return F.runTransaction(db,async tx=>{
    const requestRef=ref('requests',item.id);
    const listingRef=ref('listings',item.listing);
    const requestSnap=await tx.get(requestRef);
    const listingSnap=await tx.get(listingRef);
    if(!requestSnap.exists() || requestSnap.data().status!=='accepted' ||
       !listingSnap.exists() || listingSnap.data().acceptedRequest!==item.id)
      throw new Error('This request is already closed.');
    tx.update(requestRef,{status:'declined',pickupNote:''});
    tx.update(listingRef,{status:'available',acceptedRequest:F.deleteField()});
  });
}

export async function matchedPhone(item){
  const other=currentUser.uid===item.owner?item.buyer:item.owner;
  const snapshot=await F.getDoc(F.doc(ref('requests',item.id),'contacts',other));
  return snapshot.exists()?snapshot.data().phone:'';
}

const expiring = new Set();
export function expireListings(items){
  if(isDemo || !db)return;
  for(const item of items){
    if(!['available','reserved'].includes(item.status) || !(item.pickupAt<=Date.now()) || expiring.has(item.id)) continue;
    expiring.add(item.id);
    F.updateDoc(ref('listings',item.id),{status:'expired'})
      .catch(()=>{}).finally(()=>expiring.delete(item.id));
  }
}
