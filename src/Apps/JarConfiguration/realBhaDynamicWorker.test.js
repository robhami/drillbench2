jest.mock('../../engineering/research/realBhaDynamicComparison',()=>({runRealBhaDynamic:jest.fn(()=>({valid:true,metrics:{}}))}));
jest.mock('../../engineering/research/realBhaSkeemComparison',()=>({runRealBhaSkeem:jest.fn(()=>({valid:true,metrics:{peakTensileN:123}}))}));

test('Skeem worker dispatch uses local loading and stroke without the assumed contact model',()=>{
  const original=global.onmessage,post=jest.spyOn(global,'postMessage').mockImplementation(()=>{});
  try { jest.isolateModules(()=>{
    const {runRealBhaDynamic}=require('../../engineering/research/realBhaDynamicComparison');
    const {runRealBhaSkeem}=require('../../engineering/research/realBhaSkeemComparison');
    require('./realBhaDynamicWorker');
    global.onmessage({data:{model:'non-uniform-skeem',cases:[{candidateId:'reference',jarCentreFt:641.83,movementFt:0,bha:{rows:[]}}],scenarios:[{name:'Base',patch:{}}],settings:{localTensionLbf:185000,strokeIn:7.5},request:{jarIndex:0}}});
    expect(runRealBhaSkeem).toHaveBeenCalledWith({bha:{rows:[]},jarIndex:0,settings:{localTensionLbf:185000,strokeIn:7.5}});
    expect(runRealBhaDynamic).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith({row:expect.objectContaining({candidateId:'reference',jarCentreFt:641.83,movementFt:0,isReference:true,geometryValid:true,structuralMappingValid:true,valid:true,metrics:{peakTensileN:123}})});
    expect(post).toHaveBeenLastCalledWith({complete:true});
  }); } finally {post.mockRestore();global.onmessage=original;}
});

test('research worker accepts 25 sequential cases and rejects excessive batch workloads',()=>{
  const original=global.onmessage,post=jest.spyOn(global,'postMessage').mockImplementation(()=>{});
  try{
    jest.isolateModules(()=>{
      const {runRealBhaDynamic}=require('../../engineering/research/realBhaDynamicComparison');
      require('./realBhaDynamicWorker');
      const cases=Array.from({length:25},(_,i)=>({movementFt:i,bha:{rows:[]}})),scenario={name:'Base',patch:{}};
      global.onmessage({data:{cases,scenarios:[scenario],settings:{},request:{}}});
      expect(runRealBhaDynamic).toHaveBeenCalledTimes(25);expect(post).toHaveBeenLastCalledWith({complete:true});
      post.mockClear();runRealBhaDynamic.mockClear();
      for(const data of [{cases:[...cases,cases[0]],scenarios:[scenario]},{cases,scenarios:[scenario,scenario,scenario]},{cases:[],scenarios:[scenario]}]){
        global.onmessage({data});expect(post).toHaveBeenLastCalledWith({error:expect.stringContaining('safeguards')});
      }
      expect(runRealBhaDynamic).not.toHaveBeenCalled();
    });
  }finally{post.mockRestore();global.onmessage=original;}
});
