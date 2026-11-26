const {test,expect,devices}=require('@playwright/test');
const fs=require('node:fs/promises');

async function click(page,id){await page.locator('#'+id).click();}
async function fill(page,id,val){const input=page.locator('#'+id);await input.fill(String(val));await input.press('Tab');}
async function choose(page,id,index){return page.locator('#'+id).selectOption({index});}
async function download(page,id){const [d]=await Promise.all([page.waitForEvent('download'),click(page,id)]);return {name:d.suggestedFilename(),data:await fs.readFile(await d.path())};}
async function project(page){const id=await page.locator('#save').isVisible()?'save':'save24';return JSON.parse((await download(page,id)).data);}
async function upload(page,obj){await page.locator('#file').setInputFiles({name:'qa.json',mimeType:'application/json',buffer:Buffer.from(typeof obj==='string'?obj:JSON.stringify(obj))});}
async function demo(page){await click(page,'demo24');await expect(page.locator('#actualTotal')).toHaveText(/24/);}
async function cue(page){await fill(page,'cueSeconds20',2);await fill(page,'cueName20','驗收起拍');await click(page,'addCue20');await expect(page.locator('#cues20')).toContainText('驗收起拍');}

test.beforeEach(async ({page})=>{await page.goto('/');await expect(page.locator('h1')).toContainText('v4.3');});
test('A01 模式切換、可見性與重開保留',async({page})=>{
 await expect(page.locator('#simpleModeBtn')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#instPanel')).toBeHidden();
 await click(page,'advancedModeBtn');await expect(page.locator('#instPanel')).toBeVisible();
 await page.reload();await expect(page.locator('#advancedModeBtn')).toHaveAttribute('aria-pressed','true');
 await click(page,'simpleModeBtn');await expect(page.locator('#instPanel')).toBeHidden();
});
test('A02 人員總數、分類與上限校驗',async({page})=>{
 await click(page,"advancedModeBtn");
 for(const [id,n] of Object.entries({targetBand:3,targetFlag:2,targetDrum:1,targetLead:1}))await fill(page,id,n);
 await click(page,'applyRoster');await expect(page.locator('#actualTotal')).toContainText('7');
 expect((await project(page)).people.map(x=>x.type).sort()).toEqual(['band','band','band','drum','flag','flag','lead']);
 await fill(page,'targetBand',401);await click(page,'applyRoster');await expect(page.locator('#toast')).toContainText('0～400');
 await expect(page.locator('#actualTotal')).toContainText('7');
});
test('A03 樂器細項套用與寫入作品',async({page})=>{
 await click(page,'advancedModeBtn');await fill(page,'inst_flute',5);await click(page,'applyInstruments');
 expect((await project(page)).people.filter(x=>x.instrument==='flute')).toHaveLength(5);
 await click(page,'syncInstruments');await expect(page.locator('#inst_flute')).toHaveValue('5');
});
test('A04 六種隊形、場地模式和自動排列',async({page})=>{
 await demo(page);await click(page,'advancedModeBtn');
 await page.locator('#mode').selectOption('parade');await expect(page.locator('#w')).toHaveValue('12');
 await page.locator('#mode').selectOption('field');await expect(page.locator('#w')).toHaveValue('40');
 const signatures=[];
 for(const shape of ['rows','line','v','circle','arc','diag']){
  await page.locator('[data-template="'+shape+'"]').click();
  const model=await project(page);const pos=model.scenes[0].pos;
  expect(Object.keys(pos)).toHaveLength(24);
  signatures.push(JSON.stringify(pos));
 }
 expect(new Set(signatures).size).toBe(6);
 await click(page,'autoArrange');await expect(page.locator('#svg [data-id]')).toHaveCount(24);
});
test('A05 單人拖曳及復原',async({page})=>{
 await demo(page);const node=page.locator('#svg [data-id]').first();await node.scrollIntoViewIfNeeded();
 const id=await node.getAttribute('data-id');const initial=(await project(page)).scenes[0].pos[id];
 await node.scrollIntoViewIfNeeded();const p=await node.locator('circle').last().boundingBox();
 await page.mouse.move(p.x+p.width/2,p.y+p.height/2);await page.mouse.down();
 await page.mouse.move(p.x+p.width/2+25,p.y+p.height/2+18,{steps:5});await page.mouse.up();
 const moved=(await project(page)).scenes[0].pos[id];expect(moved).not.toEqual(initial);
 await click(page,'undo27');expect((await project(page)).scenes[0].pos[id]).toEqual(initial);
});
test('A06 節拍、播放進度、暫停、續播與到下一段',async({page})=>{
 await demo(page);await click(page,'advancedModeBtn');await fill(page,'beats',4);await fill(page,'bpm',120);
 const a=await project(page);expect(a.bpm).toBe(120);expect(a.scenes[0].beats).toBe(4);
 await click(page,'play');await expect.poll(async()=>Number(await page.locator('#progress').inputValue())).toBeGreaterThan(40);
 await click(page,'play');const value=await page.locator('#progress').inputValue();
 await expect(page.locator('#play')).toContainText('繼續');
 await click(page,'play');await expect.poll(async()=>Number(await page.locator('#progress').inputValue())).toBeGreaterThan(Number(value));
 await expect(page.locator('#sceneTitle')).toContainText('第 2 段',{timeout:4000});
});
test('A07 JSON 下載再讀取保留音樂節點',async({page})=>{
 await demo(page);await click(page,'advancedModeBtn');await cue(page);
 const saved=await project(page);expect(saved.cues[0].name).toBe('驗收起拍');
 await page.reload();await upload(page,saved);
 await expect(page.locator('#actualTotal')).toContainText('24');
 await expect(page.locator('#cues20')).toContainText('驗收起拍');
});
test('A08 拒絕空段落匯入並保留原作品',async({page})=>{
 await demo(page);const saved=await project(page);
 await upload(page,{...saved,scenes:[]});await expect(page.locator('#toast')).toContainText('無法讀取');
 expect((await project(page)).scenes).toEqual(saved.scenes);
});
test('A09 本機自動備份恢復音樂節點',async({page})=>{
 await demo(page);await click(page,'advancedModeBtn');await cue(page);await click(page,"next");await click(page,"prev");
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('marchingBackup34')??'{}').cues?.[0]?.name??'')).toBe('驗收起拍');
 page.on('dialog',d=>d.accept());
 await page.reload();await page.getByRole('button',{name:/恢復上次編舞/}).click();
 await expect(page.locator('#actualTotal')).toContainText('24');
 expect((await project(page)).cues?.[0]?.name).toBe('驗收起拍');
});
test('A10 CSV、PNG 與可列印手冊 HTML 內容',async({page})=>{
 await demo(page);await click(page,'advancedModeBtn');
 const csv=await download(page,'exportcsv');
 expect(csv.data.toString().trim().split(/\r?\n/)).toHaveLength(49);
 expect(csv.data.toString()).toContain('段落,隊員編號');
 const png=await download(page,'exportpng');expect(png.data.subarray(1,4).toString()).toBe('PNG');
 const book=await download(page,'downloadBook');expect(book.data.toString()).toContain('排練手冊');
 expect(book.data.toString()).toContain('第 2 段');
});
test('A11 作品檔分享的桌面下載替代與網站連結',async({page,context})=>{
 await demo(page);
 await page.evaluate(()=>Object.defineProperty(navigator,'canShare',{configurable:true,value:undefined}));
 const d=await download(page,'shareWork26');expect(JSON.parse(d.data).people).toHaveLength(24);
 await expect(page.locator('#shareNote26')).toContainText('已下載作品');
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 const url=page.url();await click(page,'shareSite26');
 await expect(page.locator('#safeShareInput32')).toHaveValue(url);
 await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe(url);expect(page.url()).toBe(url);
});
test('A12 作品連結解碼還原隊形與音樂節點',async({page,context})=>{
 await demo(page);await click(page,'advancedModeBtn');await cue(page);
 const before=await project(page);await click(page,'shareLink33');
 await expect(page.locator('#shareResult33')).toContainText('#work33=');
 const dest=(await page.locator('#shareResult33').innerText()).match(/http[^\s]+/)[0];
 const receiver=await context.newPage();receiver.on('dialog',d=>d.accept());await receiver.goto(dest);
 await expect(receiver.locator('#actualTotal')).toContainText('24');
 const after=await project(receiver);expect(after.scenes).toEqual(before.scenes);expect(after.cues).toEqual(before.cues);
});
test('A13 QR 確認、取消及傳送目標（攔截，不外傳）',async({page})=>{
 await demo(page);let outbound;
 await page.route('https://api.qrserver.com/**',async route=>{outbound=route.request().url();await route.abort();});
 page.once('dialog',d=>d.dismiss());await click(page,'qr33');await expect(page.locator('#qrResult33 img')).toHaveCount(0);
 page.once('dialog',d=>d.accept());await click(page,'qr33');
 await expect(page.locator('#qrResult33 img')).toHaveAttribute('alt','作品 QR Code');
 await expect.poll(()=>outbound||'').toContain('api.qrserver.com');
 expect(new URL(outbound).searchParams.get('data')).toContain('#work33=');
});
test('A14 個人走位、分組安全與人物預演',async({page})=>{
 await demo(page);await click(page,'advancedModeBtn');
 await choose(page,'person27',1);await click(page,'route27');await expect(page.locator('#routeResult27')).toContainText('第 2 段');
 await click(page,'auditButton');await expect(page.locator('#audit')).not.toBeEmpty();
 await click(page,'safety20');await expect(page.locator('#safetyResult20')).toContainText(/最小|速度|碰撞/);
 await click(page,'showStage20');await expect(page.locator('#stage20')).toBeVisible();
 await choose(page,'camera20',1);
 const frame=await page.locator('#stage20').evaluate(x=>x.toDataURL());expect(frame.length).toBeGreaterThan(500);
 await click(page,'generate20');expect((await project(page)).scenes[0].motion.length).toBeGreaterThan(0);
});
for(const [name,options] of [['iPhone',devices['iPhone 13']],['iPad',devices['iPad (gen 7)']],['Mac',{viewport:{width:1440,height:900}}]]){
 test('A15 '+name+' 尺寸與主要操作',async({browser})=>{
  const context=await browser.newContext({...options,baseURL:'http://127.0.0.1:8843'});
  const page=await context.newPage();try{
   await page.goto('/');
   for (const selector of ['#demo24','#next24','[data-template="circle"]']) {
    const control=page.locator(selector);
    if(options.hasTouch) await control.tap(); else await control.click();
   }
   await expect(page.locator('#actualTotal')).toHaveText(/24/);
   await expect(page.locator('#svg [data-id]')).toHaveCount(24);
   const d=await project(page);expect(d.scenes).toHaveLength(3);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   expect(overflow).toBeLessThanOrEqual(1);
  }finally{await context.close();}
 });
}
test('A16 音樂檔載入、播放同步及暫停',async({page})=>{
 await demo(page);await click(page,'advancedModeBtn');await fill(page,'beats',8);
 const samples=8000*8, wav=Buffer.alloc(44+samples*2);
 wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
 wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
 wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);
 wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);
 await page.locator('#audioFile').setInputFiles({name:'local-qa.wav',mimeType:'audio/wav',buffer:wav});
 const audio=page.locator('#musicPlayer');await expect.poll(()=>audio.evaluate(x=>x.duration)).toBe(8);
 await click(page,'play');
 await expect.poll(()=>audio.evaluate(x=>x.currentTime)).toBeGreaterThan(.1);
 expect(await audio.evaluate(x=>x.paused)).toBe(false);
 await click(page,'play');await expect.poll(()=>audio.evaluate(x=>x.paused)).toBe(true);
});
test('A17 人物預演 WebM 實際輸出',async({page})=>{
 await demo(page);await click(page,'advancedModeBtn');await fill(page,'beats',4);
 await click(page,'next');await fill(page,'beats',4);await click(page,'prev');
 const d=await download(page,'exportVideo20');
 expect(d.name).toMatch(/\.webm$/);expect(d.data.subarray(0,4).toString('hex')).toBe('1a45dfa3');
 expect(d.data.length).toBeGreaterThan(500);
});
test('A18 單獨新增節點應觸發自動備份',async({page})=>{
 await demo(page);await click(page,'advancedModeBtn');
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('marchingBackup34')??'{}').people?.length||0)).toBe(24);
 await cue(page);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('marchingBackup34')??'{}').cues?.[0]?.name??''),{timeout:3500}).toBe('驗收起拍');
});
test('A19 慢速練習後匯出保留原設計 BPM',async({page})=>{
 await demo(page);await click(page,'advancedModeBtn');await fill(page,'bpm',160);
 await choose(page,'slow40',1);
 expect((await project(page)).bpm).toBe(160);
});
test('A20 播放到終點的座標與手動切到末段一致',async({page})=>{
 await demo(page);await click(page,'advancedModeBtn');await fill(page,'beats',4);
 const getPositions=()=>page.locator('#svg [data-id] circle').evaluateAll(nodes=>nodes.map(el=>[el.getAttribute('cx'),el.getAttribute('cy')]));
 const initial=await getPositions();
 await click(page,'play');await expect(page.locator('#progress')).toHaveValue('1000',{timeout:5000});
 const final=await getPositions();expect(final).not.toEqual(initial);
 await expect(page.locator('#sceneTitle')).toContainText('第 2 段');
 await click(page,'prev');
 expect(await getPositions()).toEqual(initial);
 await click(page,'next');await expect(page.locator('#sceneTitle')).toContainText('第 2 段');
 expect(await getPositions()).toEqual(final);
});

test('R01 三種還原途徑保留完整作品；無效作品不改動原件', async ({page, context}) => {
 await demo(page);
 await click(page,'advancedModeBtn');
 await fill(page,'bpm',156);
 await fill(page,'beats',20);
 await cue(page);
 await click(page,'generate20');
 const snapshot = await project(page);
 expect(snapshot.scenes[0].motion.length).toBeGreaterThan(0);
 const fields = ({version, ...model}) => model;
 const malformed = structuredClone(snapshot);
 malformed.scenes[1].pos[malformed.people[0].id].x = null;
 await upload(page, malformed);
 await expect(page.locator('#toast')).toContainText('無法讀取');
 expect(await project(page)).toEqual(snapshot);
 await upload(page, snapshot);
 await expect(page.locator('#toast')).toContainText('已開啟作品');
 expect(await project(page)).toEqual(snapshot);

 await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('marchingBackup34') ?? '{}').bpm)).toBe(156);
 page.on('dialog', dialog => dialog.accept());
 await page.reload();
 await page.getByRole('button',{name:/恢復上次編舞/}).click();
 expect(await project(page)).toEqual(snapshot);

 await click(page,'shareLink33');
 await expect(page.locator('#shareResult33')).toContainText('#work33=');
 const url = (await page.locator('#shareResult33').innerText()).match(/http[^\s]+/)[0];
 const receiver = await context.newPage();
 receiver.on('dialog', dialog => dialog.accept());
 await receiver.goto(url);
 await expect(receiver.locator('#actualTotal')).toContainText('24');
 expect(fields(await project(receiver))).toEqual(fields(snapshot));
 await receiver.close();
});

test('R02 刪除音樂節點更新本機備份', async ({page}) => {
 await demo(page);
 await click(page,'advancedModeBtn');
 await cue(page);
 const storedCues = () => page.evaluate(() => JSON.parse(localStorage.getItem('marchingBackup34') ?? '{}').cues);
 await expect.poll(storedCues).toEqual([{sec:2,name:'驗收起拍'}]);
 await click(page,'clearCues20');
 await expect.poll(storedCues).toEqual([]);
});
