import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {parseAst} from 'rollup/parseAst';
test('standalone map editor keeps shape values, user map names and edit operations intact',async()=>{
 const source=await readFile(new URL('../public/maps/editor-ui.js',import.meta.url),'utf8');parseAst(source);const calls=[],elements={'saved-maps':{},'map-name':{value:'Meu mapa'},'add-object-type':{value:'cylinder'}};
 const system={listSavedMaps:()=>['Meu mapa'],saveToLocalStorage:n=>calls.push(['save',n]),addObject:o=>calls.push(['add',o]),moveSelected:(...a)=>calls.push(['move',...a])};let container;
 const ctx={system,window:{addEventListener(){}},document:{createElement:()=>container={classList:{toggle(){}}},body:{appendChild(){}},getElementById:id=>elements[id],addEventListener(){}}};
 const editor=vm.runInNewContext(source+';new MapEditorUI(system)',ctx);assert(container.innerHTML.includes('Map Editor'));assert(container.innerHTML.includes('<option value="box">Cube</option>'));assert(container.innerHTML.includes('onclick="mapEditor.undo()">Undo'));
 editor.save();editor.addPrimitive();editor.move(1,0,-1);assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['save','Meu mapa'],['add',{primitive:'cylinder',position:{x:0,y:0.5,z:0},name:'New cylinder'}],['move',1,0,-1]]);assert.equal(elements['saved-maps'].innerHTML,'Saved: Meu mapa');
});
