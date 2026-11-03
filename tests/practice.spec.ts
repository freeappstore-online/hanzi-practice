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
  await page.getByRole('button',{name:'From memory',exact:true}).click()
  await expect(page.getByText('?',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Start practice',exact:true}).click()
  await draw(page,'一',true)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('hanzi-practice:progress:v1') || '[]')[0]?.mode)).toBe('recall')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await context.close()
})
test('library search, character selection, navigation and multi-stroke completion', async ({page}) => {
  await page.goto('/characters')
  await page.getByPlaceholder('Search characters, pinyin, or meaning').fill('shan')
  await page.getByRole('button',{name:'Practice 山, mountain'}).click()
  await page.getByRole('button',{name:'Start practice',exact:true}).click()
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
  await page.goto('/')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await page.getByLabel('Choose a character').selectOption('好')
  await expect(page.getByRole('button',{name:'Start practice',exact:true})).toBeEnabled()
  await expect(page.getByText('6 strokes',{exact:true})).toBeVisible()
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
  for (const path of ['/','/characters','/progress','/about']) {
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
  await page.goto('/')
  await page.getByLabel('Study level',{exact:true}).selectOption('2')
  await page.getByLabel('Choose a character').selectOption('半')
  await page.getByRole('button',{name:'Start practice',exact:true}).click();await draw(page,'半')
  await expect(page.getByLabel('Study level',{exact:true})).toHaveValue('3')
  await expect(page.getByLabel('Choose a character')).toHaveValue('米')
  await expect(page.getByRole('button',{name:'Practice again',exact:true})).toBeEnabled()
  await page.getByLabel('Study level',{exact:true}).selectOption('5')
  await page.getByLabel('Choose a character').selectOption('出')
  await page.getByRole('button',{name:'Start practice',exact:true}).click();await draw(page,'出')
  await expect(page.getByRole('status').filter({hasText:'End of the library'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Next character →'})).toBeDisabled()
  await page.waitForTimeout(1700) // Past the advance deadline: the final character must not wrap.
  await expect(page.getByLabel('Choose a character')).toHaveValue('出')
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
  await page.getByPlaceholder('Search characters, pinyin, or meaning').fill('mother')
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
          if(!w.advanceMs && w.completedAt && (document.querySelector('#character') as HTMLSelectElement)?.value==='二' && [...document.querySelectorAll('button')].some(b=>b.textContent==='Practice again'&&!b.disabled)) w.advanceMs=performance.now()-w.completedAt
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
