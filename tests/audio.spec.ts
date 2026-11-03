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
  // Initial offline caching includes both recording and model libraries.
  test.setTimeout(90000)
  await page.goto('/')
  await page.evaluate(async()=>{await navigator.serviceWorker.ready})
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await page.getByLabel('Study level',{exact:true}).selectOption('10')
  await page.getByRole('button',{name:'Pronounce lín'}).click()
  await expect.poll(()=>page.locator('audio').first().evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
  await page.getByLabel('Study level',{exact:true}).selectOption('2')
  await page.getByLabel('Choose a character').selectOption('妈')
  await page.getByRole('button',{name:'Pronounce mā',exact:true}).click()
  await expect.poll(()=>page.locator('audio').first().evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
  await page.getByLabel('Study level',{exact:true}).selectOption('1')
  await page.getByLabel('Choose a character').selectOption('学')
  await page.getByTestId('translation').click()
  await page.getByRole('button',{name:'Pronounce word 学生',exact:true}).click()
  await expect.poll(()=>page.locator('audio').first().evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
})
test('a failed audio request shows a retryable error', async ({page}) => {
  await page.addInitScript(()=>localStorage.setItem('hanzi-practice:audio:v1',JSON.stringify({order:['recordings','kokoro','browser'],disabled:['kokoro','browser']})))
  let fail=true
  await page.route('**/audio/v2/4e00.mp3', route => fail ? route.abort() : route.continue())
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
test('all character and word clips decode into non-silent browser audio', async ({page}) => {
  test.setTimeout(90000)
  await page.goto('/')
  const result=await page.evaluate(async()=>{
    const manifest=await (await fetch('/audio/v2/manifest.json')).json()
    const context=new AudioContext()
    const bad:string[]=[]
    for (const clip of [...manifest.clips,...manifest.words]) {
      const response=await fetch('/audio/v2/'+clip.file)
      const decoded=await context.decodeAudioData(await response.arrayBuffer())
      const samples=decoded.getChannelData(0)
      if(decoded.duration<.3 || decoded.duration>(clip.kind==='word' ? 6 : 4) || !samples.some(x=>Math.abs(x)>.05)) bad.push(clip.file)
    }
    await context.close()
    return {count:manifest.clips.length+manifest.words.length,bad}
  })
  expect(result).toEqual({count:643,bad:[]})
})


test('word playback replays, stops on closing the popup, and returns to character audio',async({page})=>{
  await page.goto('/')
  await page.getByLabel('Study level',{exact:true}).selectOption('1')
  await page.getByLabel('Choose a character').selectOption('学')
  const player=page.locator('audio').first()
  await page.getByRole('button',{name:'Pronounce xué',exact:true}).click()
  await page.getByTestId('translation').click()
  await expect.poll(()=>player.evaluate((el:HTMLAudioElement)=>el.paused)).toBe(true)
  await page.getByRole('button',{name:'Pronounce word xué sheng',exact:true}).click()
  await expect(player).toHaveAttribute('src','/audio/v2/words/5b66-751f.mp3')
  await expect.poll(()=>player.evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
  await page.getByRole('button',{name:'Pronounce word 学生',exact:true}).click()
  await page.keyboard.press('Escape')
  await expect.poll(()=>player.evaluate((el:HTMLAudioElement)=>el.paused)).toBe(true)
  await page.getByRole('button',{name:'Pronounce xué',exact:true}).click()
  await expect(player).toHaveAttribute('src','/audio/v2/5b66.mp3')
  await expect.poll(()=>player.evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
})

test('word playback failure can be retried inside its popup',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('hanzi-practice:audio:v1',JSON.stringify({order:['recordings','kokoro','browser'],disabled:['kokoro','browser']})))
  let fail=true
  await page.route('**/audio/v2/words/5b66-751f.mp3',route=>fail ? route.abort() : route.continue())
  await page.goto('/')
  await page.getByLabel('Study level',{exact:true}).selectOption('1')
  await page.getByLabel('Choose a character').selectOption('学')
  await page.getByTestId('translation').click()
  const dialog=page.getByRole('dialog',{name:'Word example'})
  await dialog.getByRole('button',{name:'Pronounce word 学生',exact:true}).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  fail=false
  await dialog.getByRole('button',{name:'Pronounce word 学生',exact:true}).click()
  await expect.poll(()=>page.locator('audio').first().evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
  await expect(dialog.getByRole('alert')).toHaveCount(0)
})
