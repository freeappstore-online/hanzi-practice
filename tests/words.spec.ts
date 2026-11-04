import {test,expect} from '@playwright/test'
import {openLibrary,openItem,setFilters,draw} from './helpers'

test('two visible phone tiles save one word, two character attempts, and a whole-word review',async({page})=>{
  test.setTimeout(60000)
  await page.setViewportSize({width:320,height:740});await openItem(page,'妈妈',true)
  await page.getByRole('button',{name:'Autoplay',exact:true}).click()
  const a=(await page.getByTestId('writing-tile-0').boundingBox())!,b=(await page.getByTestId('writing-tile-1').boundingBox())!
  expect(Math.abs(a.y-b.y)).toBeLessThan(2);expect(b.x).toBeGreaterThan(a.x+a.width)
  await page.screenshot({path:'/tmp/hanzi-unified-word-mobile.png',fullPage:true})
  await draw(page,'妈',0)
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('hanzi-practice:words:v1')||'{}').counts?.['妈妈']??0)).toBe(0)
  await draw(page,'妈',1)
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('hanzi-practice:words:v1')||'{}').counts?.['妈妈'])).toBe(1)
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('hanzi-practice:progress:v1')||'[]').filter((a:any)=>a.character==='妈').length)).toBe(2)
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('hanzi-practice:review:v1')||'{}')['妈妈'].completed)).toBe(true)
  await page.getByRole('button',{name:'Back to filters'}).click();await page.reload()
  await expect(page.getByTestId('item-word:妈妈').getByLabel('1 completed practices')).toBeVisible()
})
test('characters and words share one queue, one mode, and automatic advancement',async({page})=>{
  await openLibrary(page);await setFilters(page,{'Content':['Characters','Words'],'Tone pattern':['Tone 1','1·5'],'Topic':['People & family']})
  await page.getByPlaceholder('Search characters or words').fill('mā')
  // Search covers pinyin and English; topic and tone narrow this to 妈 + 妈妈.
  await expect(page.getByRole('button',{name:'Practice 2 matching items'})).toBeVisible()
  await page.getByRole('button',{name:'Practice 妈',exact:true}).click()
  await page.getByRole('switch',{name:'From memory'}).click()
  await draw(page,'妈')
  await expect(page.getByRole('combobox',{name:'Practice item'})).toHaveValue('word:妈妈')
  await expect(page.getByRole('button',{name:'Pronounce word from memory'})).toHaveText('??')
  await expect(page.getByTestId('writing-tile-1')).toBeVisible()
  expect(await page.getByRole('combobox',{name:'Practice item'}).locator('option').count()).toBe(2)
})
test('word mistakes and hints survive abandoning a session without adding a word tick',async({page})=>{
  await openItem(page,'妈妈',true)
  await page.getByRole('button',{name:'Hint',exact:true}).click()
  await draw(page,'妈',0)
  await page.getByRole('button',{name:'Back to filters'}).click()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('hanzi-practice:words:v1')||'{}').counts?.['妈妈']??0)).toBe(0)
  const review=await page.evaluate(()=>JSON.parse(localStorage.getItem('hanzi-practice:review:v1')||'{}')['妈妈'])
  expect(review.hints).toBe(1);expect(review.completed).toBe(false)
  await page.goto('/review');await setFilters(page,{'Content':['Words']})
  await expect(page.getByRole('button',{name:'Practice 1 matching items'})).toBeVisible()
  await page.getByRole('button',{name:'Practice 妈妈',exact:true}).click()
  await expect(page.getByRole('switch',{name:'From memory'})).toHaveAttribute('aria-checked','true')
})
test('whole-word playback follows profile preferences and works with both writing tiles offline',async({page,context})=>{
  test.setTimeout(90000)
  await openItem(page,'学生',true)
  await page.evaluate(async()=>{await navigator.serviceWorker.ready})
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true);await page.reload()
  await expect(page.getByRole('img',{name:'Writing area 1 for 学',exact:true})).toHaveAttribute('aria-disabled','false')
  await expect(page.getByRole('img',{name:'Writing area 2 for 生',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Pronounce word 学生',exact:true}).click()
  const audio=page.locator('audio').first()
  await expect(audio).toHaveAttribute('src','/audio/v2/words/5b66-751f.mp3')
  await expect.poll(()=>audio.evaluate((el:HTMLAudioElement)=>el.currentTime)).toBeGreaterThan(0)
})
test('all dimensions can start a group; incomplete next-word navigation does not increment counts',async({page})=>{
  await page.goto('/words');await setFilters(page,{'Topic':['Food & drink'],'HSK':['HSK 1'],'Audio':['Human audio']})
  for(const dimension of ['kind','hsk','topic','type','tone','audio','strokes','set','status']){
    await page.getByRole('combobox',{name:'Group by'}).selectOption(dimension)
    await expect(page.getByRole('button',{name:/^Practice group /}).first()).toBeVisible()
  }
  await page.getByRole('combobox',{name:'Group by'}).selectOption('audio')
  await page.getByRole('button',{name:'Practice group Human audio'}).click()
  for(const word of ['水果','鸡蛋','牛奶']){await page.getByRole('button',{name:'Next item'}).click();await expect(page.getByRole('combobox',{name:'Practice item'})).toHaveValue(`word:${word}`)}
  await expect(page.getByRole('button',{name:'Next item'})).toBeDisabled()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('hanzi-practice:words:v1')||'{}').counts??{})).toEqual({})
})

test('completion merges stored word counters with a stale tab instead of erasing either history',async({page})=>{
  await openLibrary(page)
  await page.evaluate(()=>localStorage.setItem('hanzi-practice:words:v1',JSON.stringify({counts:{妈妈:2,学生:4}})))
  await openItem(page,'妈妈',true)
  // Simulate a competing storage write before its storage event reaches this tab.
  await page.evaluate(()=>localStorage.setItem('hanzi-practice:words:v1',JSON.stringify({counts:{学生:5}})))
  await draw(page,'妈',0);await draw(page,'妈',1)
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('hanzi-practice:words:v1')||'{}').counts)).toEqual({妈妈:3,学生:5})
})
