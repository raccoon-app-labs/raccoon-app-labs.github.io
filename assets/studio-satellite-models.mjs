// Editable miniature sculptures. All forms are solid XYZ voxels, not textures.
export const SATELLITE_ORDER=Object.freeze(['stories','keys','bloom','muropolis','neon','food','dokupit']);
const STEP=.09;
const palette={
  cream:[.961,.949,.878,0],paper:[1,.974,.91,0],violet:[.188,.149,.4,0],purple:[.478,.231,.98,.1],
  gold:[1,.78,.322,.16],mint:[.522,1,.812,.08],green:[.24,.62,.36,0],leaf:[.49,.76,.35,0],
  coral:[.94,.32,.25,0],terracotta:[.72,.22,.19,0],orange:[1,.55,.23,0],rose:[.96,.64,.7,0]
};

function sculpture(){
  const cells=new Map();
  const put=(x,y,z,material)=>{
    if(x>=-10&&x<=10&&y>=-10&&y<=10&&z>=-5&&z<=5)cells.set(`${x},${y},${z}`,material);
  };
  function volume(predicate,material){
    for(let x=-10;x<=10;x++)for(let y=-10;y<=10;y++)for(let z=-5;z<=5;z++)if(predicate(x,y,z))put(x,y,z,material);
  }
  function box(x0,x1,y0,y1,z0,z1,material){
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)put(x,y,z,material);
  }
  const ellipsoid=(cx,cy,cz,rx,ry,rz,material)=>volume((x,y,z)=>((x-cx)/rx)**2+((y-cy)/ry)**2+((z-cz)/rz)**2<=1,material);
  function finish(){
    const result=[];
    // Adjacent cells along Z share a closed prism. This keeps every side and
    // back while reducing the instancing budget for each tiny sculpture.
    for(let x=-10;x<=10;x++)for(let y=-10;y<=10;y++){
      let z=-5;
      while(z<=5){
        const material=cells.get(`${x},${y},${z}`);if(!material){z++;continue;}
        const first=z;while(z<5&&cells.get(`${x},${y},${z+1}`)===material)z++;
        const color=palette[material],grain=((((x*17+y*31+101)%9+9)%9)-4)*.005;
        result.push(x*STEP,y*STEP,(first+z)*STEP*.5,(z-first+1)*STEP*.98,
          ...color.slice(0,3).map(c=>Math.max(0,Math.min(1,c+grain))),color[3]);
        z++;
      }
    }
    return {voxels:new Float32Array(result),cell:STEP*.96};
  }
  return {put,volume,box,ellipsoid,finish};
}

function stories(s){
  // An open book: two raised page blocks, a bound back, a lower central fold.
  s.volume((x,y,z)=>Math.abs(x)<=9&&y>=-7&&y<=1+Math.floor(Math.abs(x)/3)&&z>=-3&&z<=1,'violet');
  s.volume((x,y,z)=>Math.abs(x)>=1&&Math.abs(x)<=8&&y>=-5&&y<=Math.floor(Math.abs(x)/3)&&z>=-1&&z<=3,'paper');
  s.box(0,0,-6,1,-2,3,'gold');
  for(const y of [-3,0]){s.box(-7,-2,y,y,4,4,'rose');s.box(2,7,y,y,4,4,'rose');}
  // The crescent is itself a complete extruded solid, including the back.
  s.volume((x,y,z)=>((x+4)/3.8)**2+((y-6)/3.8)**2+(z/1.7)**2<=1&&((x+2)/3.1)**2+((y-7)/3.1)**2>1,'gold');
  s.box(5,5,6,10,1,2,'gold');s.box(3,7,8,8,1,2,'gold');
}

function keys(s){
  // A porcelain Chinese-radical tile with the rabbit ears of Hanzi Keys.
  s.volume((x,y,z)=>Math.abs(x)<=7&&y>=-8&&y<=5&&z>=-3&&z<=2&&!(Math.abs(x)===7&&(y===-8||y===5)),'violet');
  s.volume((x,y,z)=>Math.abs(x)<=6&&y>=-7&&y<=4&&z>=-1&&z<=3,'cream');
  for(const x of [-4,4]){
    s.ellipsoid(x,7.2,0,1.7,3.2,2.1,'cream');
    s.box(x,x,6,9,2,3,'rose');
  }
  // 木: trunk, crossbar and two descending branches, raised above the tile.
  s.box(0,0,-5,3,4,5,'coral');s.box(-4,4,0,0,4,5,'coral');
  for(let i=1;i<=4;i++){s.box(-i,-i,-i,-i,4,5,'coral');s.box(i,i,-i,-i,4,5,'coral');}
}

function bloom(s){
  // A fully rounded flowerpot, leaves and a five-petal blossom.
  s.volume((x,y,z)=>y>=-8&&y<=-3&&(x*x+(z*1.5)**2)<=(4.1+(y+8)*.35)**2,'cream');
  s.volume((x,y,z)=>y===-3&&(x*x+(z*1.5)**2)<=6.2**2,'purple');
  s.box(-1,1,-2,5,-1,1,'green');
  s.ellipsoid(-3,0,0,3,1.8,2.1,'leaf');s.ellipsoid(3,1,-1,3,1.8,2.1,'mint');
  for(const [x,y] of [[-3,5],[0,8],[3,5],[-2,3],[2,3]])s.ellipsoid(x,y,0,2.8,2.8,2,'purple');
  s.ellipsoid(0,5,2,2,2,1.5,'gold');
  s.box(-1,1,-6,-5,4,4,'rose');
}

function muropolis(s){
  // A tiny inhabited cat cottage, with real walls and a complete gabled roof.
  s.box(-8,8,-9,-8,-4,4,'violet');s.box(-7,7,-7,2,-4,4,'cream');
  s.volume((x,y,z)=>y>=2&&y<=8&&Math.abs(x)<=9-(y-2)&&z>=-4&&z<=4,'orange');
  for(const x of [-6,6])s.volume((vx,y,z)=>y>=6&&y<=10&&Math.abs(vx-x)<=Math.max(0,2-Math.floor((y-6)/2))&&z>=-2&&z<=3,'orange');
  s.box(-2,2,-7,-3,5,5,'violet');s.box(-1,1,-6,-4,5,5,'mint');
  s.box(-5,-3,-1,1,5,5,'gold');s.box(3,5,-1,1,5,5,'gold');
  s.box(-3,-2,5,5,5,5,'violet');s.box(2,3,5,5,5,5,'violet');
  s.box(0,0,3,3,5,5,'terracotta');
}

function insidePolygon(x,y,points){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const [xi,yi]=points[i],[xj,yj]=points[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}

function neon(s){
  // A freestanding neon lightning sculpture. The two faces and sidewall are
  // solid geometry, with an inset luminous face and a dark violet depth.
  const outline=[[2.5,10.5],[-7.5,-1.5],[-1.5,-1.5],[-4.5,-10.5],[8.5,3.5],[2,3.5]];
  const hit=(x,y)=>insidePolygon(x,y,outline);
  s.volume((x,y,z)=>hit(x,y)&&z>=-3&&z<=3,'violet');
  s.volume((x,y,z)=>hit(x,y)&&hit(x-1,y)&&hit(x+1,y)&&hit(x,y-1)&&hit(x,y+1)&&z>=3&&z<=4,'mint');
  s.box(-8,-8,6,8,0,1,'gold');s.box(-9,-7,7,7,0,1,'gold');
}

function food(s){
  // A hollow orange bowl with a cream lip, full rear wall and visible contents.
  s.volume((x,y,z)=>{
    if(y<-8||y>0)return false;
    const r=Math.sqrt(x*x+(z*1.7)**2),outer=3.3+(y+8)*.72;
    return r<=outer&&(y<=-6||r>=outer-1.6);
  },'orange');
  s.volume((x,y,z)=>y>=0&&y<=1&&Math.sqrt(x*x+(z*1.7)**2)<=9.2&&Math.sqrt(x*x+(z*1.7)**2)>=7,'cream');
  s.ellipsoid(-3,1,-1,3.8,3,2.8,'green');s.ellipsoid(0,2,-2,2.7,3,2.5,'leaf');
  s.ellipsoid(3,2,2,3,3,2.2,'coral');s.ellipsoid(-1,1,3,2,2,1.6,'cream');
  s.box(2,4,5,5,1,2,'green');s.box(3,3,5,7,1,1,'green');
}

function dokupit(s){
  // A coral shopping basket with perforated walls, rim and a complete arch.
  s.box(-5,5,-8,-7,-4,4,'terracotta');
  s.volume((x,y,z)=>{
    if(y<-6||y>1)return false;
    const width=6+Math.floor((y+6)/3);
    if(Math.abs(x)>width||Math.abs(z)>4)return false;
    const wall=Math.abs(x)===width||Math.abs(z)===4;
    return wall&&(y%3===0||x%3===0||Math.abs(x)===width);
  },'coral');
  s.volume((x,y,z)=>y>=1&&y<=2&&Math.abs(x)<=8&&Math.abs(z)<=5&&(Math.abs(x)>=7||Math.abs(z)>=4),'cream');
  s.volume((x,y,z)=>y>=3&&y<=9&&Math.abs(z)<=1&&((x/6.2)**2+((y-3)/6.2)**2)<=1.18&&((x/6.2)**2+((y-3)/6.2)**2)>=.7,'cream');
  s.ellipsoid(-3,1,0,2.5,2.5,2.5,'leaf');s.ellipsoid(3,0,0,2.5,2.5,2.5,'gold');
}

const builders={stories,keys,bloom,muropolis,neon,food,dokupit};
export function buildSatelliteModel(name){
  if(!Object.hasOwn(builders,name))throw new RangeError('Unknown application miniature: '+name);
  const model=sculpture();builders[name](model);return model.finish();
}
