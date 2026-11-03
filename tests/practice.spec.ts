import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
async function draw(page: Page, character: string, touch = false) {
  const data = JSON.parse(readFileSync(`web/public/characters/${character}.json`,'utf8'))
  await page.getByRole('img', {name:/Writing area/}).scrollIntoViewIfNeeded()
  const box = (await page.getByRole('img', {name:/Writing area/}).boundingBox())!
  const scale = (box.width - 48) / 1024
  const client = touch ? await page.context().newCDPSession(page) : null
  for (const points of data.medians) {
    const coords = points.map(([x,y]: number[]) => ({x:box.x + 24 + x*scale,y:box.y + 24 + (900-y)*scale}))
    if (client) {
      await client.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[coords[0]]})
      for (const point of coords.slice(1)) await client.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[point]})
      await client.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]})
    } else {
      await page.mouse.move(coords[0].x,coords[0].y); await page.mouse.down()
      for (const point of coords.slice(1)) await page.mouse.move(point.x,point.y,{steps:3})
      await page.mouse.up()
    }
  }
}
test('real strokes complete once and persist after reload', async ({page}) => {
  await page.goto('/')
  await page.getByRole('button',{name:'Start practice',exact:true}).click()
  await draw(page,'一')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('hanzi-practice:progress:v1') || '[]').length)).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('hanzi-practice:progress:v1') || '[]').length)).toBe(1)
  await page.reload()
  await page.getByRole('link',{name:'Progress',exact:true}).click()
  await expect(page.getByText('Guided · 0 retries · 0 hints')).toBeVisible()
  await page.getByRole('link',{name:'Characters',exact:true}).click()
  await expect(page.getByLabel('1 completed practice',{exact:true})).toBeVisible()
})
test('incorrect direction is rejected and hint use is recorded', async ({page}) => {
  await page.goto('/')
  await page.getByRole('button',{name:'Start practice',exact:true}).click()
  const box = (await page.getByRole('img',{name:/Writing area/}).boundingBox())!
  await page.mouse.move(box.x+box.width-40,box.y+box.height/2)
  await page.mouse.down(); await page.mouse.move(box.x+40,box.y+box.height/2,{steps:20});await page.mouse.up()
  await expect(page.getByRole('status').filter({hasText:'Try stroke 1 again'})).toBeVisible()
  await page.getByRole('button',{name:'Hint',exact:true}).click()
  await draw(page,'一')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('hanzi-practice:progress:v1') || '[]')[0]?.hints)).toBe(1)
})
test('touch writing and recall work on a phone', async ({browser}) => {
  const context = await browser.newContext({viewport:{width:393,height:852},hasTouch:true,isMobile:true})
  const page = await context.newPage();await page.goto('/')
  await page.getByRole('switch',{name:'From memory',exact:true}).click()
  await expect(page.getByText('?',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Start practice',exact:true}).click()
  await draw(page,'一',true)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('hanzi-practice:progress:v1') || '[]')[0]?.mode)).toBe('recall')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await context.close()
})
test('library search, character selection, navigation and multi-stroke completion', async ({page}) => {
  await page.goto('/characters')
  await page.getByPlaceholder('Search characters').fill('shan')
  await page.getByRole('button',{name:'Practice 山, mountain'}).click()
  await expect(page.getByRole('button',{name:'Practice again',exact:true})).toBeEnabled()
  await expect(page.getByRole('link',{name:'Practice',exact:true})).toHaveAttribute('aria-current','page')
  await draw(page,'山')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('hanzi-practice:progress:v1') || '[]').length)).toBeGreaterThan(0)
  await page.goBack()
  await expect(page.getByRole('heading',{name:'Characters'})).toBeVisible()
})
test('animation does not save practice and remains usable after resizing', async ({page}) => {
  await page.goto('/')
  await page.getByRole('button',{name:'Watch strokes'}).click()
  await expect(page.getByRole('button',{name:'Start practice',exact:true})).toBeEnabled()
  expect(await page.evaluate(() => localStorage.getItem('hanzi-practice:progress:v1'))).toBeNull()
  await page.setViewportSize({width:568,height:320})
  await page.getByRole('button',{name:'Start practice',exact:true}).click()
  await draw(page,'一')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('hanzi-practice:progress:v1') || '[]').length)).toBeGreaterThan(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('offline reload can load a different bundled character', async ({page,context}) => {
  test.setTimeout(60000)
  await page.goto('/')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await page.getByLabel('Choose a character').selectOption('好')
  await expect(page.getByRole('button',{name:'Start practice',exact:true})).toBeEnabled()
  await expect(page.getByRole('progressbar',{name:'Stroke progress'})).toHaveAttribute('aria-valuemax','6')
  await page.getByLabel('Choose a character').selectOption('学')
  await page.getByTestId('translation').click()
  const image=page.getByRole('dialog',{name:'Word example'}).locator('img')
  await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.complete && img.naturalWidth>0)).toBe(true)
})
test('unavailable storage reports unsaved progress instead of crashing', async ({page}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(key,value) { if(key.startsWith('hanzi-practice:')) throw new DOMException('Full','QuotaExceededError'); original.call(this,key,value) }
  })
  await page.goto('/')
  await page.getByRole('button',{name:'Start practice',exact:true}).click();await draw(page,'一')
  await expect(page.getByRole('alert').filter({hasText:'Device storage is unavailable'})).toBeVisible()
  await page.getByRole('link',{name:'Progress',exact:true}).click()
  await expect(page.getByText('Guided · 0 retries · 0 hints')).toBeVisible()
})
test('all screens fit a 320px phone in light and dark mode', async ({page}) => {
  await page.setViewportSize({width:320,height:568})
  for (const path of ['/','/characters','/review','/progress','/about']) {
    await page.goto(path)
    await expect(page.getByRole('heading',{level:1})).toBeVisible()
    for (const theme of ['light','dark']) {
      await page.evaluate(theme => {document.documentElement.dataset.theme=theme}, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  }
})
test('failed character download has a working retry', async ({page}) => {
  let fail = true
  await page.route('**/characters/*.json', route => fail ? route.abort() : route.continue())
  await page.goto('/')
  await expect(page.getByRole('status').filter({hasText:'Could not load this character'})).toBeVisible()
  fail = false
  await page.getByRole('button',{name:'Retry loading'}).click()
  await expect(page.getByRole('button',{name:'Start practice',exact:true})).toBeEnabled()
  await page.getByRole('button',{name:'Start practice',exact:true}).click()
  await draw(page,'一')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('hanzi-practice:progress:v1') || '[]').length)).toBeGreaterThan(0)
})
test('completing characters advances and starts the next exercise automatically', async ({page}) => {
  await page.goto('/')
  await page.getByRole('button',{name:'Start practice',exact:true}).click()
  await draw(page,'一')
  await expect(page.getByLabel('Choose a character')).toHaveValue('二')
  await expect(page.getByRole('button',{name:'Practice again',exact:true})).toBeEnabled()
  await draw(page,'二')
  await expect(page.getByLabel('Choose a character')).toHaveValue('三')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('hanzi-practice:progress:v1') || '[]').map((a:{character:string})=>a.character).join(''))).toBe('一二')
})
test('automatic practice crosses a level boundary and stops at the end', async ({page}) => {
  test.setTimeout(60000)
  await page.goto('/')
  await page.getByLabel('Study level',{exact:true}).selectOption('5')
  await page.getByLabel('Choose a character').selectOption('出')
  await page.getByRole('button',{name:'Start practice',exact:true}).click();await draw(page,'出')
  await expect(page.getByLabel('Study level',{exact:true})).toHaveValue('6')
  await expect(page.getByLabel('Choose a character')).toHaveValue('头')
  await expect(page.getByRole('button',{name:'Practice again',exact:true})).toBeEnabled()
  await page.getByLabel('Study level',{exact:true}).selectOption('10')
  await page.getByLabel('Choose a character').selectOption('被')
  await page.getByRole('button',{name:'Start practice',exact:true}).click();await draw(page,'被')
  await expect(page.getByRole('status').filter({hasText:'End of the library'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Next character'})).toBeDisabled()
  await page.waitForTimeout(1700) // Past the advance deadline: the final character must not wrap.
  await expect(page.getByLabel('Choose a character')).toHaveValue('被')
})
test('automatic practice can be disabled and navigation cancels pending advances', async ({page}) => {
  await page.goto('/')
  await page.getByRole('button',{name:'Autoplay',exact:true}).click()
  await page.getByRole('button',{name:'Start practice',exact:true}).click();await draw(page,'一')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('hanzi-practice:progress:v1') || '[]').length)).toBeGreaterThan(0)
  await page.waitForTimeout(1700)
  await expect(page.getByLabel('Choose a character')).toHaveValue('一')
  await page.getByRole('button',{name:'Autoplay',exact:true}).evaluate(button => {
    (button as HTMLButtonElement).click()
    ;(document.querySelector('nav a[href="/characters"]') as HTMLAnchorElement).click()
  })
  await page.waitForTimeout(1700)
  await page.getByRole('link',{name:'Practice',exact:true}).click()
  await expect(page.getByLabel('Choose a character')).toHaveValue('一')
  await expect(page.getByRole('button',{name:'Start practice',exact:true})).toBeEnabled()
})
test('library levels filter the collection and show matching-size character details', async ({page}) => {
  await page.goto('/characters')
  await expect(page.getByRole('button',{name:/^Practice /})).toHaveCount(40)
  await page.getByLabel('Library level').selectOption('2')
  await page.getByPlaceholder('Search characters').fill('mother')
  await page.getByRole('button',{name:'Practice 妈, mother'}).click()
  await expect(page.getByLabel('Study level',{exact:true})).toHaveValue('2')
  await expect(page.getByLabel('Tone 1: high and level',{exact:true})).toBeVisible()
  const sizes=await Promise.all([
    page.getByTestId('reference-character'), page.getByTestId('pinyin'), page.getByTestId('translation'), page.getByLabel('Tone 1: high and level',{exact:true}),
  ].map(locator=>locator.evaluate(el=>getComputedStyle(el).fontSize)))
  expect(new Set(sizes).size).toBe(1)
  await page.getByLabel('Choose a character').selectOption('的')
  await expect(page.getByLabel('Tone 5: neutral',{exact:true})).toBeVisible()
})

test('the writing pad shrinks when rotating or resizing to a narrow phone', async ({page}) => {
  await page.goto('/')
  await page.getByLabel('Choose a character').selectOption('女')
  await page.setViewportSize({width:320,height:568})
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await expect(page.getByLabel('Tone 3: dip then rise',{exact:true})).toBeVisible()
  await page.getByLabel('Study level',{exact:true}).selectOption('5')
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})
test('tone control opens a guide to all four tones', async ({page}) => {
  await page.goto('/')
  await page.getByRole('button',{name:'Tone 1: high and level',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog.getByRole('heading',{name:'Mandarin tones'})).toBeVisible()
  for (const name of ['1. High and level · yī','2. Rising · rén','3. Dipping · hǎo','4. Falling · dà']) {
    await expect(dialog.getByRole('heading',{name,exact:true})).toBeVisible()
  }
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})
test('reopening restores the selected level, character, and autoplay setting', async ({page}) => {
  await page.goto('/')
  await page.getByLabel('Study level',{exact:true}).selectOption('4')
  await page.getByLabel('Choose a character').selectOption('字')
  await page.getByRole('button',{name:'Autoplay',exact:true}).click()
  await page.reload()
  await expect(page.getByLabel('Study level',{exact:true})).toHaveValue('4')
  await expect(page.getByLabel('Choose a character')).toHaveValue('字')
  await expect(page.getByRole('button',{name:'Autoplay',exact:true})).toHaveAttribute('aria-pressed','false')
  await page.getByRole('link',{name:'Characters',exact:true}).click()
  await expect(page.getByLabel('Library level')).toHaveValue('4')
})

test('mobile controls stay together and skipping continues an active exercise', async ({page}) => {
  await page.setViewportSize({width:320,height:568})
  await page.goto('/')
  const controls=page.getByRole('group',{name:'Practice controls'})
  await expect(controls).toBeVisible()
  const boxes=await controls.getByRole('button').evaluateAll(buttons=>buttons.map(button=>{
    const {top,width,height}=button.getBoundingClientRect()
    return {top,width,height}
  }))
  expect(boxes).toHaveLength(5)
  expect(new Set(boxes.map(box=>box.top)).size).toBe(1)
  expect(boxes.every(box=>box.width>=44 && box.height>=44)).toBe(true)
  await page.getByLabel('Study level',{exact:true}).selectOption('10')
  await page.getByRole('button',{name:'Start practice',exact:true}).click()
  await page.getByRole('button',{name:'Next character',exact:true}).click()
  await expect(page.getByLabel('Choose a character')).toHaveValue('森')
  await expect(page.getByRole('button',{name:'Practice again',exact:true})).toBeEnabled()
  await page.reload()
  await expect(page.getByLabel('Study level',{exact:true})).toHaveValue('10')
  await expect(page.getByLabel('Choose a character')).toHaveValue('森')
})

test.describe('preloading',()=>{
  test.use({serviceWorkers:'block'})
  test('preloads the next character, advances quickly, and saves silently', async ({page})=>{
    let requests=0
    await page.route('**/characters/*.json',async route=>{
      if(decodeURIComponent(new URL(route.request().url()).pathname).endsWith('/二.json')) {
        requests++
        await new Promise(resolve=>setTimeout(resolve,350))
      }
      await route.continue()
    })
    await page.addInitScript(()=>{
      const original=Storage.prototype.setItem
      Storage.prototype.setItem=function(key,value){
        if(key==='hanzi-practice:progress:v1') (window as any).completedAt=performance.now()
        original.call(this,key,value)
      }
      addEventListener('DOMContentLoaded',()=>{
        new MutationObserver(()=>{
          const w=window as any
          if(!w.advanceMs && w.completedAt && (document.querySelector('#character') as HTMLSelectElement)?.value==='二' && [...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')==='Practice again'&&!b.disabled)) w.advanceMs=performance.now()-w.completedAt
        }).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true})
      })
    })
    const prefetch=page.waitForResponse(r=>decodeURIComponent(new URL(r.url()).pathname).endsWith('/二.json'))
    await page.goto('/')
    await (await prefetch).finished()
    await page.getByRole('button',{name:'Start practice',exact:true}).click()
    await draw(page,'一')
    await expect(page.getByLabel('Choose a character')).toHaveValue('二')
    await expect.poll(()=>page.evaluate(()=>(window as any).advanceMs ?? null)).not.toBeNull()
    expect(await page.evaluate(()=>(window as any).advanceMs)).toBeLessThan(1000)
    expect(requests).toBe(1)
    await expect(page.getByText('Practice saved on this device.')).toHaveCount(0)
  })
  test('failed preloading is quiet and retried when the next character is needed',async({page})=>{
    let attempts=0
    await page.route('**/characters/*.json',async route=>{
      if(decodeURIComponent(new URL(route.request().url()).pathname).endsWith('/二.json') && ++attempts===1) {await route.abort();return}
      await route.continue()
    })
    await page.goto('/')
    await expect.poll(()=>attempts).toBe(1)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.getByRole('button',{name:'Start practice',exact:true}).click();await draw(page,'一')
    await expect(page.getByLabel('Choose a character')).toHaveValue('二')
    await expect(page.getByRole('button',{name:'Practice again',exact:true})).toBeEnabled()
    expect(attempts).toBe(2)
  })
})


test('abandoned retries and hints survive reload without adding a completion tick', async ({page}) => {
  await page.goto('/')
  await page.getByRole('button',{name:'Start practice',exact:true}).click()
  const box=(await page.getByRole('img',{name:/Writing area/}).boundingBox())!
  await page.mouse.move(box.x+box.width-40,box.y+box.height/2)
  await page.mouse.down(); await page.mouse.move(box.x+40,box.y+box.height/2,{steps:20}); await page.mouse.up()
  await expect(page.getByRole('status').filter({hasText:'Try stroke 1 again'})).toBeVisible()
  await page.getByRole('button',{name:'Hint',exact:true}).click()
  await page.reload()
  await page.getByRole('link',{name:'Review',exact:true}).click()
  await expect(page.getByText('1 retries · 1 hints · unfinished')).toBeVisible()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('hanzi-practice:progress:v1')||'[]').length)).toBe(0)
  await page.getByRole('link',{name:'Characters',exact:true}).click()
  await expect(page.getByLabel('1 completed practice',{exact:true})).toHaveCount(0)
})

test('review migrates old mistakes, prioritizes weak characters and advances through only the queue', async ({page}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('hanzi-practice:progress:v1')) localStorage.setItem('hanzi-practice:progress:v1',JSON.stringify([
      {character:'一',mode:'recall',mistakes:3,hints:0,at:'2026-01-01T00:00:00Z'},
      {character:'二',mode:'guided',mistakes:1,hints:0,at:'2026-01-01T00:00:01Z'}
    ]))
  })
  await page.goto('/review')
  await page.getByRole('button',{name:'Start review of 2 characters'}).click()
  await expect(page.getByRole('switch',{name:'From memory',exact:true})).toHaveAttribute('aria-checked','true')
  await expect(page.getByRole('button',{name:'Practice again',exact:true})).toBeEnabled()
  await expect(page.getByText('Review · 1/2',{exact:true})).toBeVisible()
  await draw(page,'一')
  await expect(page.getByRole('img',{name:/Writing area for 二/})).toBeVisible()
  await expect(page.getByText('Review · 2/2',{exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Hint',exact:true})).toBeEnabled()
  await draw(page,'二')
  await expect(page.getByRole('status').filter({hasText:'Review complete.'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Next character',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Back to review queue'}).click()
  await expect(page.getByText('All caught up',{exact:true})).toBeVisible()
  await page.reload()
  await expect(page.getByText('All caught up',{exact:true})).toBeVisible()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('hanzi-practice:review:v1')||'{}')['一'].totalMistakes)).toBe(3)
  await page.getByRole('link',{name:'Practice',exact:true}).click()
  await expect(page.getByLabel('Study level',{exact:true})).toBeVisible()
})

test('meaning opens an illustrated example on a small phone, and recall counts it as help', async ({page}) => {
  await page.setViewportSize({width:320,height:568})
  await page.goto('/')
  await page.getByLabel('Choose a character').selectOption('学')
  await page.getByRole('switch',{name:'From memory',exact:true}).click()
  await page.getByRole('button',{name:'Start practice',exact:true}).click()
  await page.getByTestId('translation').click()
  const dialog=page.getByRole('dialog',{name:'Word example'})
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('xué shēng',{exact:true})).toBeVisible()
  await expect(dialog.getByText('student',{exact:true})).toBeVisible()
  await expect.poll(()=>dialog.locator('img').evaluate((img:HTMLImageElement)=>img.complete && img.naturalWidth>0)).toBe(true)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'/tmp/hanzi-example-mobile.png'})
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('hanzi-practice:review:v1')||'{}')['学'].hints)).toBe(1)
})

test('a character review button starts the whole queue from that character', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('hanzi-practice:progress:v1',JSON.stringify([
    {character:'一',mode:'recall',mistakes:3,hints:0,at:'2026-01-01T00:00:00Z'},
    {character:'二',mode:'recall',mistakes:2,hints:0,at:'2026-01-01T00:00:01Z'},
    {character:'三',mode:'recall',mistakes:1,hints:0,at:'2026-01-01T00:00:02Z'}
  ])))
  await page.goto('/review')
  await page.getByRole('button',{name:'Review 二',exact:true}).click()
  for (const [index,character] of ['二','三','一'].entries()) {
    await expect(page.getByRole('img',{name:new RegExp(`Writing area for ${character}`)})).toBeVisible()
    await expect(page.getByText(`Review · ${index + 1}/3`,{exact:true})).toBeVisible()
    await expect(page.getByRole('button',{name:'Hint',exact:true})).toBeEnabled()
    await draw(page,character)
  }
  await expect(page.getByRole('status').filter({hasText:'Review complete.'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Next character',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Back to review queue'}).click()
  await expect(page.getByText('All caught up',{exact:true})).toBeVisible()
})
