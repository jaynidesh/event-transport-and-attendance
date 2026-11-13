const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const ts=require('typescript');const Module=require('node:module');
const filename=require('node:path').resolve('src/app/pages/dashboard/pull-refresh.ts');
const loaded=new Module(filename,module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
const {PullRefresh}=loaded.exports;
test('refresh requires a downward pull past threshold and resets on release',()=>{
 const pull=new PullRefresh();pull.start(10,100,true);pull.move(12,195);assert.equal(pull.release(),true);assert.equal(pull.distance,0);assert.equal(pull.release(),false);
});
test('short pulls, horizontal gestures, upward scrolling and disallowed starts never refresh',()=>{
 for(const [x,y,allowed] of [[0,40,true],[100,100,true],[0,-100,true],[0,120,false]]){
  const pull=new PullRefresh();pull.start(0,0,allowed);pull.move(x,y);assert.equal(pull.release(),false);
 }
});
test('cancellation clears the gesture',()=>{
 const pull=new PullRefresh();pull.start(0,0,true);pull.move(0,100);pull.cancel();assert.equal(pull.release(),false);
});
