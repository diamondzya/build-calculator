from playwright.sync_api import sync_playwright
from pathlib import Path
import json,fitz
base=Path(__file__).resolve().parents[1];out=base/'tests'/'test-output';out.mkdir(exist_ok=True)
html=(base/'index.html').read_text()
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+ (base/'style.css').read_text()+'</style>')
for src in ['assets/jspdf.umd.min.js','calc-engine.js','script.js','project-sheets.js','icons.js']:
 html=html.replace(f'<script src="{src}"></script>','<script>'+(base/src).read_text().replace('</script>','<\\/script>')+'</script>')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1320,'height':900},accept_downloads=True)
 page.set_default_timeout(10000)
 errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.evaluate('''() => {const data={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return data[k]??null},setItem(k,v){data[k]=String(v)},removeItem(k){delete data[k]}}});}''')
 page.set_content(html,wait_until='load')
 duplicate=page.evaluate('''() => {const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.filter((v,i)=>ids.indexOf(v)!==i)}''')
 assert not duplicate,duplicate
 page.click('#btn-start')
 # Book CHB sample 4×3 m, class B 10 cm
 page.click('.module-btn[data-module="chb"]')
 assert page.is_visible('#form-chb')
 assert '150 pcs' in page.locator('#result-body').inner_text(),page.locator('#result-body').inner_text()
 assert '7 bags' in page.locator('#result-body').inner_text()
 assert '0.522 m³' in page.locator('#result-body').inner_text()
 page.fill('#line-item-name','CHB wall — book illustration')
 page.click('#btn-add-project')
 page.select_option('#chb-thickness','15')
 assert '13 bags' in page.locator('#result-body').inner_text()
 page.select_option('#chb-thickness','10')
 # Plaster 24sqm 16mm class B => 5 bags, .384 m³ sand
 page.click('.module-btn[data-module="plaster"]')
 txt=page.locator('#result-body').inner_text()
 assert '24 m²' in txt and '5 bags' in txt and '0.384 m³' in txt,txt
 page.fill('#line-item-name','Palitada — two faces')
 page.click('#btn-add-project')
 # Stock lumber, 10 cuts at 1 m in 10-foot lumber -> 4 stock pcs
 page.click('.module-btn[data-module="lumber"]')
 page.fill('#lumber-length','1')
 assert '4 stock pcs' in page.locator('#result-body').inner_text(),page.locator('#result-body').inner_text()
 page.fill('#line-item-name','Coco lumber roof assembly')
 page.click('#btn-add-project')
 # Fajardo concrete 50 kg table
 page.click('.module-btn[data-module="concrete"]')
 page.select_option('#conc-mix','A')
 page.fill('#conc-length','1');page.fill('#conc-width','1');page.fill('#conc-height','1');page.select_option('#conc-waste','0')
 page.select_option('#conc-bag','50')
 txt=page.locator('#result-body').inner_text()
 assert '7 bags' in txt and '50 kg' in txt,txt
 page.fill('#line-item-name','50kg cement foundation')
 page.click('#btn-add-project')
 # Fajardo paint preset, per coat by texture; the UI should update rate.
 page.click('.module-btn[data-module="paint"]')
 page.select_option('#paint-surface','rough')
 assert page.input_value('#paint-coverage')=='7.5'
 page.select_option('#paint-surface','medium')
 assert page.input_value('#paint-coverage')=='8.75'
 page.select_option('#paint-surface','smooth')
 assert page.input_value('#paint-coverage')=='10'
 page.fill('#line-item-name','Paint smooth finish')
 page.click('#btn-add-project')
 page.click('.nav-btn[data-view="projects"]')
 assert page.locator('.sheet-line').count()==5
 summary=page.locator('#project-summary-lines').inner_text()
 for term in ['CHB 10×20×40','Cement (40 kg)','Cement (50 kg)','Coco lumber','Sand','Finish paint']:
  assert term in summary,(term,summary)
 qty=page.locator('.sheet-rate-input[data-price-key="cement-40"]').input_value()
 assert qty is not None
 # ensure round once in whole project: 6.264+4.608=10.872 => 11 bags
 cement_cell=page.locator('#project-summary-lines tr').filter(has_text='Cement (40 kg)').first.inner_text()
 assert '11 bags' in cement_cell,cement_cell
 page.screenshot(path=str(out/'v6-fajardo-project.png'),full_page=True)
 with page.expect_download() as d:page.click('#project-pdf')
 pdf=out/'v6-fajardo-report.pdf';d.value.save_as(pdf)
 doc=fitz.open(pdf);text='\n'.join(pg.get_text() for pg in doc)
 for term in ['CHB', 'Palitada', 'Coco Lumber','Cement (50 kg)','CONSOLIDATED MATERIAL SUMMARY']:
  assert term in text,(term,text[-1300:])
 assert len(doc)>=5,len(doc)
 page.click('.nav-btn[data-view="saved"]')
 with page.expect_download() as d:page.click('#btn-export-backup')
 backup=out/'v6-fajardo-backup.json';d.value.save_as(backup)
 data=json.loads(backup.read_text())
 assert data['version']==6 and len(data['projects'][0]['items'])==5
 for mod in ['chb','plaster','lumber','concrete','paint']:
  assert any(e['module']==mod for e in data['projects'][0]['items'])
 page.set_viewport_size({'width':375,'height':812})
 page.click('.nav-btn[data-view="calculators"]');page.click('.module-btn[data-module="chb"]')
 page.screenshot(path=str(out/'v6-fajardo-mobile.png'),full_page=True)
 width=page.evaluate('document.documentElement.scrollWidth-window.innerWidth')
 assert width<=5,width
 assert not errs,errs
 print('PASS: New Fajardo calculators and reference values, 50kg mix, paint presets, consolidated CHB/Plaster/Lumber project, PDF, backup and mobile.')
 print('PDF pages:',len(doc),'Mobile horizontal overflow:',width,'JS errors:',errs)
 browser.close()
