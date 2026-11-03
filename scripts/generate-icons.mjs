import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const browser = await chromium.launch()
const page = await browser.newPage({viewport:{width:512,height:512},deviceScaleFactor:1})
const svg=readFileSync('web/public/favicon.svg','utf8')
for(const [size,name] of [[512,'icon-512.png'],[192,'icon-192.png'],[180,'apple-touch-icon.png']]) {
  await page.setViewportSize({width:size,height:size})
  await page.setContent(`<body style="margin:0">${svg}</body>`)
  await page.screenshot({path:`web/public/${name}`})
}
await browser.close()
