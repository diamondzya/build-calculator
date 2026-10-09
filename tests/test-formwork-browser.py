from playwright.sync_api import sync_playwright
from pathlib import Path
import json, subprocess
P=Path(__file__).resolve().parents[1]
O=P/'tests'/'test-output';O.mkdir(exist_ok=True)
html=(P/'index.html').read_text()
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+ (P/'style.css').read_text()+'</style>')
for src in ['assets/jspdf.umd.min.js','calc-engine.js','script.js','project-sheets.js','icons.js']:
 html=html.replace(f'<script src="{src}"></script>','<script>'+(P/src).read_text().replace('</script>','<\\/script>')+'</script>')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':930},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.evaluate('''() => {const vals={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return vals[k]??null},setItem(k,v){vals[k]=String(v)},removeItem(k){delete vals[k]}}});}''')
 page.set_content(html,wait_until='load')
 page.click('#btn-start')
 page.click('.module-btn[data-module="formwork"]')
 assert page.locator('#form-formwork').is_visible()
 assert page.locator('#form-joist-spacing').input_value()=='40'
 # 2 square meters manually means 1 plywood; 2.5 means two.
 page.select_option('#form-type','area')
 assert page.is_visible('#form-area-group') and not page.is_visible('#form-dimensions')
 page.fill('#form-area','2')
 page.click('#form-formwork .calc-btn')
 assert '1 whole sheet' in page.locator('#result-body').inner_text(),page.locator('#result-body').inner_text()
 page.fill('#form-area','2.5')
 page.click('#form-formwork .calc-btn')
 assert '2 whole sheet' in page.locator('#result-body').inner_text()
 page.fill('#line-item-name','Manual 2.5 m² phenolic')
 assert page.locator('#btn-add-project').is_visible()
 page.click('#btn-add-project')
 # Slab actual 4 x 2 m, 40 cm centers, braces every 2m
 page.select_option('#form-type','slab')
 assert page.is_visible('#form-dimensions') and page.is_visible('#form-framing-group')
 page.fill('#form-length','4');page.fill('#form-width','2')
 page.select_option('#form-plywood','3/4')
 page.select_option('#form-lumber','2x3x10');page.select_option('#form-brace-lumber','2x2x12')
 page.select_option('#form-nail-size','3-concrete')
 assert page.locator('#form-nail-gram').input_value()=='8.5'
 page.click('#form-formwork .calc-btn')
 result=page.locator('#result-body').inner_text()
 assert '8 m²' in result and '4 whole sheet' in result and '6 stations' in result and '2 braces' in result, result
 page.fill('#line-item-name','Slab Porma S1')
 page.click('#btn-add-project')
 # Column, beam, footing and scaffold switch normally and are supported
 page.select_option('#form-type','column');assert page.is_visible('#form-height-group')
 page.fill('#form-length','3');page.fill('#form-width','.3');page.fill('#form-height','.4')
 page.fill('#line-item-name','Poste Form C1');page.click('#btn-add-project')
 page.select_option('#form-type','beam');page.fill('#form-length','4');page.fill('#form-width','.3');page.fill('#form-height','.5')
 page.fill('#line-item-name','Beam Form B1');page.click('#btn-add-project')
 page.select_option('#form-type','footing');page.fill('#form-length','2');page.fill('#form-width','2');page.fill('#form-height','.4')
 page.fill('#line-item-name','Footing Form F1');page.click('#btn-add-project')
 page.select_option('#form-type','scaffolding');page.fill('#form-length','4');page.fill('#form-width','2')
 page.fill('#line-item-name','Scaffold Platform Takeoff');page.click('#btn-add-project')
 page.click('.nav-btn[data-view="projects"]')
 assert page.locator('.sheet-line').count()==6
 assert page.locator('.sheet-section').count()==6
 summary=page.locator('#project-summary-lines').inner_text()
 assert 'Phenolic plywood 1/2' in summary and 'Phenolic plywood 3/4' in summary
 assert 'Coco lumber 2×3×10' in summary and 'Coco lumber 2×2×12' in summary,summary
 assert 'Formwork nails' in summary
 page.locator('.sheet-rate-input[data-price-key="phenolic-3/4-2.44"]').fill('1200')
 page.locator('.sheet-rate-input[data-price-key="phenolic-3/4-2.44"]').dispatch_event('change')
 assert page.locator('.sheet-rate-input[data-price-key="phenolic-3/4-2.44"]').input_value()=='1200'
 page.screenshot(path=str(O/'v4-formwork-desktop.png'),full_page=True)
 # Edit formwork without duplicate
 page.locator('.sheet-section').filter(has_text='04 — Palapag').locator('.sheet-edit').first.click()
 assert page.locator('#form-formwork').is_visible()
 assert page.locator('#form-width').input_value()=='2'
 page.fill('#form-length','5');page.click('#btn-add-project')
 page.click('.nav-btn[data-view="projects"]');assert page.locator('.sheet-line').count()==6
 # Backup JSON + PDF includes all materials and sections.
 with page.expect_download() as i: page.click('#project-pdf')
 pdf=O/'v4-formwork-project.pdf';i.value.save_as(pdf)
 assert pdf.stat().st_size>5000
 import fitz
 d=fitz.open(pdf);txt=' '.join(pg.get_text() for pg in d)
 assert 'CONSOLIDATED MATERIAL SUMMARY' in txt
 assert 'Phenolic plywood' in txt and 'Coco lumber' in txt and len(d)>=6,(len(d),txt[-1000:])
 page.click('.nav-btn[data-view="saved"]')
 with page.expect_download() as i:page.click('#btn-export-backup')
 backup=O/'v4-formwork-backup.json';i.value.save_as(backup)
 saved=json.loads(backup.read_text())
 assert saved['version']==4 and len(saved['projects'][0]['items'])==6
 assert any(it['module']=='formwork' for it in saved['projects'][0]['items'])
 # Verify normal legacy v3 calculator is still available
 page.click('.nav-btn[data-view="calculators"]');page.click('.module-btn[data-module="steel"]')
 page.click('#form-steel .calc-btn')
 assert 'Steel' in page.locator('#result-panel').inner_text()
 page.set_viewport_size({'width':375,'height':812})
 page.click('.module-btn[data-module="formwork"]')
 page.screenshot(path=str(O/'v4-formwork-mobile.png'),full_page=True)
 x=page.evaluate('document.documentElement.scrollWidth-window.innerWidth')
 assert x<=5,f'Mobile overflows horizontally by {x}px'
 assert not errors,errors
 print('PASS: Formwork browser: manual 2m²=1 sheet / 2.5m²=2, slab joists 40cm, braces 2m, all section types, materials and prices, edit, PDF, backup, prior steel calculator, mobile.')
 print('PDF pages:',len(d),'page JS errors:',errors,'mobile overflow:',x)
 browser.close()
