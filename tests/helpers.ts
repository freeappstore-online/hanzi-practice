import {expect,type Page} from '@playwright/test'
import {readFileSync} from 'node:fs'
export async function openLibrary(page:Page) {
  await page.goto('/')
  await page.getByRole('button',{name:'Browse items',exact:true}).click()
}
export async function openItem(page:Page,text='一',search=false) {
  await openLibrary(page)
  const clear=page.getByRole('button',{name:'Clear filters',exact:true})
  if(await clear.count())await clear.click()
  if(search)await page.getByPlaceholder('Search characters or words').fill(text)
  await page.getByRole('button',{name:`Practice ${text}`,exact:true}).click()
  await expect(page.getByRole('combobox',{name:'Practice item'})).toBeVisible()
}
export async function setFilters(page:Page,values:Record<string,string[]>) {
  await page.getByRole('button',{name:'Browse items',exact:true}).click()
  await page.getByRole('button',{name:'Filters',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Practice filters'})
  for(const [dimension,labels] of Object.entries(values)){
    const details=dialog.locator('details').filter({has:page.locator('summary').filter({hasText:dimension})}).first()
    if(!await details.evaluate(el=>(el as HTMLDetailsElement).open))await details.locator('summary').click()
    for(const label of labels)await details.getByRole('checkbox',{name:label,exact:true}).check()
  }
  await dialog.getByRole('button',{name:/^Show \d/}).click()
}
export async function draw(page:Page,character:string,index=0,touch=false) {
  const tile=page.getByTestId(`writing-tile-${index}`).getByRole('img',{name:/Writing area/})
  await expect(tile).toHaveAttribute('aria-disabled','false')
  await tile.scrollIntoViewIfNeeded()
  const box=(await tile.boundingBox())!, count=await page.locator('[data-testid^="writing-tile-"]').count(),padding=count===1?24:12
  const scale=(box.width-padding*2)/1024
  const data=JSON.parse(readFileSync(`web/public/characters/${character}.json`,'utf8'))
  const client=touch?await page.context().newCDPSession(page):null
  for(const points of data.medians){
    const coords=points.map(([x,y]:number[])=>({x:box.x+padding+x*scale,y:box.y+padding+(900-y)*scale}))
    if(client){await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[coords[0]]});for(const point of coords.slice(1))await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
    else{await page.mouse.move(coords[0].x,coords[0].y);await page.mouse.down();for(const point of coords.slice(1))await page.mouse.move(point.x,point.y,{steps:3});await page.mouse.up()}
  }
  if(client)await client.detach()
}
