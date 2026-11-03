import {test,expect} from '@playwright/test'

test('tap-to-play pronunciation works, replays, and stops on character change', async ({page}) => {
  await page.goto('/')
  const player = page.locator('audio').first()
  await page.getByRole('button',{name:'Pronounce yī'}).click()
  await expect.poll(()=>player.evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
  await page.getByRole('button',{name:'Pronounce 一',exact:true}).click()
  await page.getByLabel('Choose a character').selectOption('二')
  await expect.poll(()=>player.evaluate((el:HTMLAudioElement)=>el.paused)).toBe(true)
  await page.getByRole('button',{name:'Pronounce èr'}).click()
  await expect.poll(()=>player.evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
})
test('pronunciation is available after an offline reload', async ({page,context}) => {
  await page.goto('/')
  await page.evaluate(async()=>{await navigator.serviceWorker.ready})
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await page.getByLabel('Study level',{exact:true}).selectOption('5')
  await page.getByRole('button',{name:'Pronounce qǐng'}).click()
  await expect.poll(()=>page.locator('audio').first().evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
})
test('a failed audio request shows a retryable error', async ({page}) => {
  let fail=true
  await page.route('**/audio/4e00.mp3', route => fail ? route.abort() : route.continue())
  await page.goto('/')
  await page.getByRole('button',{name:'Pronounce yī'}).click()
  await expect(page.getByRole('alert').filter({hasText:'Audio unavailable'})).toBeVisible()
  fail=false
  await page.getByRole('button',{name:'Pronounce yī'}).click()
  await expect.poll(()=>page.locator('audio').first().evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
  await expect(page.getByRole('alert').filter({hasText:'Audio unavailable'})).toHaveCount(0)
})
test('library playback never overlaps two voices', async ({page}) => {
  await page.goto('/characters')
  await page.getByRole('button',{name:'Pronounce yī',exact:true}).click()
  await page.getByRole('button',{name:'Pronounce èr',exact:true}).click()
  await expect.poll(()=>page.locator('audio').evaluateAll(elements=>elements.filter(el=>!(el as HTMLAudioElement).paused).length)).toBeLessThanOrEqual(1)
})
test('all 200 clips decode into non-silent browser audio', async ({page}) => {
  test.setTimeout(90000)
  await page.goto('/')
  const result=await page.evaluate(async()=>{
    const manifest=await (await fetch('/audio/manifest.json')).json()
    const context=new AudioContext()
    const bad:string[]=[]
    for (const clip of manifest.clips) {
      const response=await fetch('/audio/'+clip.file)
      const decoded=await context.decodeAudioData(await response.arrayBuffer())
      const samples=decoded.getChannelData(0)
      if(decoded.duration<.3 || decoded.duration>4 || !samples.some(x=>Math.abs(x)>.05)) bad.push(clip.file)
    }
    await context.close()
    return {count:manifest.clips.length,bad}
  })
  expect(result).toEqual({count:200,bad:[]})
})
