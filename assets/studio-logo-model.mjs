// Small, deterministic building blocks shared by the renderer and its tests.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function buildLogoVoxels(rgba,width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width>96||height>96||rgba.length!==width*height*4)throw new RangeError('Invalid logo sample');
  const result=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    // The mark is symmetric. Sample its clean left half to discard stray source
    // pixels outside the right cheek without changing the published image.
    const sampleX=Math.min(x,width-1-x),i=(y*width+sampleX)*4;
    if(rgba[i+3]<180)continue;
    const px=(x/(width-1)-.5)*2.4,py=(.53-y/(height-1))*2.4;
    const cream=rgba[i]>170&&rgba[i+1]>170,eye=!cream&&rgba[i]>65&&rgba[i+2]>125;
    const dome=Math.sqrt(Math.max(0,1-(px/1.16)**2-((py+.12)/1.05)**2));
    const muzzle=Math.exp(-((px/.35)**2+((py+.58)/.28)**2));
    const depth=.15+dome*.42+muzzle*.2;
    const grain=(((sampleX*17+y*31)%11)-5)*.007;
    const color=cream?[.96,.95,.88]:eye?[.48,.23,.98]:[.19,.15,.4];
    result.push(px,py,depth*.15,depth,...color.map(c=>clamp(c+grain,0,1)),eye?.32:0);
  }
  return new Float32Array(result);
}

export function logoScrollAngle(scrollY,sceneTop,sceneHeight,viewportHeight,reduced=false){
  if(reduced)return 0;
  const start=Math.max(0,sceneTop-viewportHeight*.72);
  const span=clamp(viewportHeight*.85+sceneHeight*.25,280,1000);
  return -.25+clamp((scrollY-start)/span,0,1)*1.55;
}

export function rotationMatrix(yaw,pitch){
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
  return new Float32Array([cy,0,-sy,sy*sx,cx,cy*sx,sy*cx,-sx,cy*cx]);
}

export function createSceneLoop({requestFrame,cancelFrame,render}){
  let frame=null,visible=true,hidden=false,closed=false,reduced=false;
  const active=()=>visible&&!hidden&&!closed;
  function cancel(){if(frame!==null)cancelFrame(frame);frame=null;}
  function invalidate(){if(frame===null&&active())frame=requestFrame(tick);}
  function tick(time){frame=null;if(!active())return;render(time);if(!reduced)invalidate();}
  function state(update){update();if(!active())cancel();else invalidate();}
  return {invalidate,setVisible:value=>state(()=>visible=value),setHidden:value=>state(()=>hidden=value),setClosed:value=>state(()=>closed=value),setReduced:value=>state(()=>reduced=value)};
}
