import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync('index.html','utf8');const bootstrap=html.match(/<script>([\s\S]*?)<\/script>/)[1];
for(const [saved,system,expected] of [['light',true,'light'],['dark',false,'dark'],[null,true,'dark'],[null,false,'light'],['invalid',false,'light']]){const root={dataset:{},classList:{toggle(name,on){this.dark=on},add(){this.dark=true}}};vm.runInNewContext(bootstrap,{localStorage:{getItem:()=>saved},matchMedia:()=>({matches:system}),document:{documentElement:root}});assert.equal(root.dataset.theme,expected);assert.equal(root.classList.dark,expected==='dark')}
function lum(hex){const rgb=hex.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}
for(const [foreground,background] of [['#252527','#f5f3f8'],['#6c657b','#ffffff'],['#f5f2fa','#252527'],['#aaa1b8','#252527'],['#ffffff','#4f32ef'],['#ffffff','#7253f2']]){const l=[lum(foreground),lum(background)].sort((a,b)=>b-a);assert.ok((l[0]+.05)/(l[1]+.05)>=4.5)}
console.log('Passed 5 initial-theme scenarios and 6 text contrast checks.');
