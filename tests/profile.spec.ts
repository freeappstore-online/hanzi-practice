import {test,expect,type Page} from '@playwright/test'
const key='hanzi-practice:audio:v1'
async function mockSpeech(page:Page, options:{voices?:boolean; fail?:boolean; throws?:boolean; delay?:number}={}) {
  await page.addInitScript(options=>{
    const events=new EventTarget()
    const w=window as any
    w.speechCalls=[];w.speechCancels=0
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class {text:string;voice=null;lang='';onstart=null;onend=null;onerror=null;constructor(text:string){this.text=text}}})
    let timer:ReturnType<typeof setTimeout>
    const voices=options.voices===false ? [] : [
      {name:'Cantonese',lang:'zh-yue',localService:true},
      {name:'English',lang:'en-US',localService:true},
      {name:'Mandarin',lang:'zh-CN',localService:true},
    ]
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
      getVoices:()=>voices,
      addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),
      cancel:()=>{clearTimeout(timer);w.speechCancels++},
      speak:(u:any)=>{if(options.throws)throw new Error('Speech service unavailable');w.speechCalls.push({text:u.text,lang:u.lang,voice:u.voice?.name});timer=setTimeout(()=>{
        if(options.fail)u.onerror?.({error:'synthesis-failed'})
        else {u.onstart?.();timer=setTimeout(()=>u.onend?.(),1000)}
      },options.delay ?? 0)},
    }})
  },options)
}
test('avatar opens a compact profile; source order persists and changes offline playback',async({page,context})=>{
  // Initial offline caching includes both recording and model libraries.
  test.setTimeout(90000)
  await page.setViewportSize({width:320,height:720})
  await page.goto('/')
  await page.getByRole('button',{name:'Profile',exact:true}).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading',{name:'Profile',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible()
  const order=page.getByRole('list',{name:'Audio fallback order'})
  expect(await order.locator('li').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-source')))).toEqual(['recordings','kokoro','browser'])
  await page.getByRole('button',{name:'Move Kokoro model up',exact:true}).click()
  await expect(order.locator('li').first()).toHaveAttribute('data-source','kokoro')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'/tmp/hanzi-profile-mobile.png',fullPage:true})
  await page.reload()
  await expect(order.locator('li').first()).toHaveAttribute('data-source','kokoro')
  await page.getByRole('button',{name:'Preview pronunciation'}).click()
  await expect(page.getByRole('status').filter({hasText:'Playing: Kokoro model'})).toBeVisible()
  await page.evaluate(async()=>{await navigator.serviceWorker.ready})
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.goto('/')
  await page.getByRole('button',{name:'Pronounce yī',exact:true}).click()
  const player=page.locator('audio').first()
  await expect(player).toHaveAttribute('src','/audio/kokoro/4e00.mp3')
  await expect.poll(()=>player.evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
})
test('failed recording falls back to the actual model clip',async({page})=>{
  await page.route('**/audio/v2/4e00.mp3',route=>route.abort())
  await page.goto('/')
  await page.getByRole('button',{name:'Pronounce yī',exact:true}).click()
  await expect(page.locator('audio').first()).toHaveAttribute('src','/audio/kokoro/4e00.mp3')
  await expect.poll(()=>page.locator('audio').first().evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
})
test('browser is the last fallback, speaks Hanzi in Mandarin, and cancels on navigation',async({page})=>{
  await mockSpeech(page)
  await page.route('**/audio/**/*.mp3',route=>route.abort())
  await page.goto('/')
  await page.getByRole('button',{name:'Pronounce yī',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>(window as any).speechCalls)).toEqual([{text:'一',lang:'zh-CN',voice:'Mandarin'}])
  await page.getByRole('button',{name:'Profile',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>(window as any).speechCancels)).toBeGreaterThan(0)
})
test('browser can be moved first; synthesis failure falls back to recordings',async({page})=>{
  await mockSpeech(page,{fail:true})
  await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({order:['browser','recordings','kokoro'],disabled:[]})),key)
  await page.goto('/')
  await page.getByRole('button',{name:'Pronounce yī',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>(window as any).speechCalls.length)).toBe(1)
  await expect.poll(()=>page.locator('audio').first().evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
  await expect(page.locator('audio').first()).toHaveAttribute('src','/audio/v2/4e00.mp3')
})
test('a word without a recording skips missing files and uses browser speech',async({page})=>{
  await mockSpeech(page)
  await page.goto('/')
  await page.getByTestId('translation').first().click()
  await page.getByRole('button',{name:'Pronounce word 一个',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>(window as any).speechCalls[0]?.text)).toBe('一个')
  await page.keyboard.press('Escape')
  await expect.poll(()=>page.evaluate(()=>(window as any).speechCancels)).toBeGreaterThan(0)
})
test('an unavailable Mandarin voice falls back and disabled sources are skipped',async({page})=>{
  await mockSpeech(page,{voices:false})
  await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({order:['browser','kokoro','recordings'],disabled:['kokoro']})),key)
  await page.goto('/')
  await page.getByRole('button',{name:'Pronounce yī',exact:true}).click()
  await expect.poll(()=>page.locator('audio').first().evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
  await expect(page.locator('audio').first()).toHaveAttribute('src','/audio/v2/4e00.mp3')
  expect(await page.evaluate(()=>(window as any).speechCalls)).toEqual([])
})
test('changing character cancels pending fallback and prevents stale speech',async({page})=>{
  await mockSpeech(page)
  await page.route('**/audio/v2/4e00.mp3',async route=>{await new Promise(r=>setTimeout(r,700));await route.abort()})
  await page.route('**/audio/kokoro/*.mp3',route=>route.abort())
  await page.goto('/')
  await page.getByRole('button',{name:'Pronounce yī',exact:true}).click()
  await page.getByRole('button',{name:'Practice 二',exact:true}).click()
  await page.waitForTimeout(1200)
  expect(await page.evaluate(()=>(window as any).speechCalls)).toEqual([])
})

test('a synchronous speech service error falls through to a human recording',async({page})=>{
  await mockSpeech(page,{throws:true})
  await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({order:['browser','recordings','kokoro'],disabled:[]})),key)
  await page.goto('/')
  await page.getByRole('button',{name:'Pronounce yī',exact:true}).click()
  await expect(page.locator('audio').first()).toHaveAttribute('src','/audio/v2/4e00.mp3')
  await expect.poll(()=>page.locator('audio').first().evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
})
