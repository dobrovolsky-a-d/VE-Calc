export function calculateVE(log,veOld){
  const r=veOld.rows,c=veOld.cols;
  const sum=Array.from({length:r},()=>Array(c).fill(0));
  const cnt=Array.from({length:r},()=>Array(c).fill(0));
  let valid=0;const used=new Set();

  log.forEach(p=>{
    let f=clamp(p.afr/p.afrTarget,0.85,1.15);
    const i=clamp(Math.floor(map(p.map,0,40,0,r-1)),0,r-1);
    const j=clamp(Math.floor(map(p.rpm,800,7000,0,c-1)),0,c-1);
    sum[i][j]+=f;cnt[i][j]++;valid++;used.add(i+":"+j);
  });

  const veNew=[],corr=[];
  for(let i=0;i<r;i++){
    veNew[i]=[];corr[i]=[];
    for(let j=0;j<c;j++){
      const a=cnt[i][j]?sum[i][j]/cnt[i][j]:1;
      veNew[i][j]=veOld.values[i][j]*a;
      corr[i][j]=(a-1)*100;
    }
  }

  return{
    VE_old:veOld.values,
    VE_new:smooth(veNew),
    Correction:corr,
    stats:{
      veRows:r,veCols:c,veCells:r*c,
      logRows:log.length,validLogRows:valid,usedCells:used.size
    }
  };
}

const clamp=(v,a,b)=>Math.min(Math.max(v,a),b);
const map=(v,a,b,c,d)=>(v-a)*(d-c)/(b-a)+c;

function smooth(m){
  const r=m.length,c=m[0].length,o=JSON.parse(JSON.stringify(m));
  for(let i=1;i<r-1;i++)
    for(let j=1;j<c-1;j++)
      o[i][j]=(m[i][j]+m[i-1][j]+m[i+1][j]+m[i][j-1]+m[i][j+1])/5;
  return o;
}
