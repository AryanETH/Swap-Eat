const radians = degrees => degrees * Math.PI / 180;
export function distance(a,b){
  const h = Math.sin(radians(b.lat-a.lat)/2)**2 +
    Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(radians(b.lng-a.lng)/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));
}

export function createMap(element, center, zoom){
  if(!window.L) throw new Error('Map is unavailable. Try reloading.');
  const map=L.map(element,{scrollWheelZoom:false}).setView([center.lat,center.lng],zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  return map;
}

export async function encodePhotos(files){
  const selected=Array.from(files);
  if(selected.length>3) throw new Error('Choose up to three photos.');
  return Promise.all(selected.map(async file=>{
    if(!file.type.startsWith('image/') || file.size>20*1024*1024)
      throw new Error('Choose image files under 20 MB each.');
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();
      image.src=url;
      await image.decode().catch(()=>{throw new Error('Use a browser-supported photo, such as JPEG, PNG or WebP.');});
      const canvas=document.createElement('canvas');
      const context=canvas.getContext('2d');
      for(const limit of [960,720,480,320,200]){
        const scale=Math.min(1,limit/Math.max(image.width,image.height));
        canvas.width=Math.max(1,Math.round(image.width*scale));
        canvas.height=Math.max(1,Math.round(image.height*scale));
        context.fillStyle='white';
        context.fillRect(0,0,canvas.width,canvas.height);
        context.drawImage(image,0,0,canvas.width,canvas.height);
        const output=canvas.toDataURL('image/jpeg',.72);
        if(output.length<=120000)return output;
      }
      throw new Error('This photo could not be compressed. Choose another one.');
    }finally{ URL.revokeObjectURL(url); }
  }));
}
