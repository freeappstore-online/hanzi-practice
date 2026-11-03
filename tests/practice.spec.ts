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
  await expect(page.getByRole('status').filter({hasText:'Character complete!'})).toBeVisible()
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
  await expect(page.getByRole('status').filter({hasText:'Character complete!'})).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading',{name:'Your first 40 characters'})).toBeVisible()
})
test('animation does not save practice and remains usable after resizing', async ({page}) => {
  await page.goto('/')
  await page.getByRole('button',{name:'Watch strokes'}).click()
  await expect(page.getByRole('status').filter({hasText:'Your turn.'})).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('hanzi-practice:progress:v1'))).toBeNull()
  await page.setViewportSize({width:568,height:320})
  await page.getByRole('button',{name:'Start practice',exact:true}).click()
  await draw(page,'一')
  await expect(page.getByRole('status').filter({hasText:'Character complete!'})).toBeVisible()
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
  await expect(page.getByRole('status').filter({hasText:'Character complete!'})).toBeVisible()
})
