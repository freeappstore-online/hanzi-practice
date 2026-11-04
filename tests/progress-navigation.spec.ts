import {test,expect} from '@playwright/test'
import {draw} from './helpers'

for(const mode of ['guided','recall'] as const)test(`repeating a ${mode} attempt preserves its mode and returns to Progress`,async({page})=>{
  await page.addInitScript(mode=>{
    if(localStorage.getItem('progress-navigation-seeded'))return
    localStorage.setItem('progress-navigation-seeded','yes')
    localStorage.setItem('hanzi-practice:progress:v1',JSON.stringify([{character:'一',mode,mistakes:0,hints:0,at:new Date().toISOString()}]))
    localStorage.setItem('hanzi-practice:study:v1',JSON.stringify({search:'妈妈',filters:mode==='guided'?{status:['status:due']}:{}}))
  },mode)
  await page.goto('/progress')
  await page.getByRole('button',{name:'Practice 一',exact:true}).click()
  await expect(page.getByRole('switch',{name:'From memory'})).toHaveAttribute('aria-checked',String(mode==='recall'))
  await expect(page.getByRole('combobox',{name:'Practice item'}).locator('option')).toHaveCount(1)
  await draw(page,'一')
  await expect(page.getByText('Practice complete.',{exact:true})).toBeVisible()
  await page.reload()
  await page.getByRole('button',{name:'Back to progress',exact:true}).click()
  await expect(page).toHaveURL(/\/progress$/)
  await expect(page.getByRole('heading',{name:'Progress',exact:true})).toBeVisible()
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('hanzi-practice:study:v1')!))
  expect(saved.search).toBe('妈妈')
})
