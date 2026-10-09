from playwright.sync_api import sync_playwright
import time, json
from pathlib import Path
base=Path(__file__).resolve().parents[1]
out=Path(__file__).resolve().parent / "test-output"
out.mkdir(parents=True, exist_ok=True)
html=(base/"index.html").read_text()
html=html.replace('<link rel="stylesheet" href="assets/fontawesome/css/all.min.css">','<style>'+(base/"assets/fontawesome/css/all.min.css").read_text()+'</style>')
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+(base/"style.css").read_text()+'</style>')
for name in ("assets/jspdf.umd.min.js","calc-engine.js","script.js"):
    html=html.replace('<script src="'+name+'"></script>','<script>'+(base/name).read_text().replace("</script>","<\\/script>")+'</script>')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':900}, accept_downloads=True)
 errs=[]
 page.on('pageerror',lambda e:errs.append(str(e)))
 page.evaluate("""() => {const obj = {}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return obj[k] ?? null;},setItem(k,v){obj[k]=String(v);},removeItem(k){delete obj[k];}}});}""")
 page.set_content(html,wait_until='load')
 page.click('#btn-start')
 assert page.is_visible('#form-steel')
 assert page.is_visible('#steel-tie-fields')
 assert not page.is_visible('#steel-grid-fields')
 page.click('#form-steel .calc-btn')
 assert 'Steel Requirement' in page.locator('#result-title').inner_text()
 assert '8 bars' in page.locator('#result-body').inner_text() or ('2 bars' in page.locator('#result-body').inner_text() and '6 bars' in page.locator('#result-body').inner_text())
 # invalid numerical input should hide stale prior result and show error
 page.locator('#steel-length').fill('0')
 assert not page.is_visible('#result-panel')
 assert page.is_visible('#calc-error')
 page.locator('#steel-length').fill('6')
 assert page.is_visible('#result-panel')
 # switch layout
 page.select_option('#steel-project', 'slab')
 assert page.is_visible('#steel-grid-fields')
 assert not page.is_visible('#steel-tie-fields')
 page.select_option('#steel-project', 'beam')
 # paint
 page.click('.module-btn[data-module="paint"]')
 assert 'Finish Cans to Buy' in page.locator('#result-body').inner_text()
 assert '6 cans' in page.locator('#result-body').inner_text()
 page.fill('#paint-openings','20')
 assert '5 cans' in page.locator('#result-body').inner_text()
 page.fill('#paint-openings','0')
 # tile
 page.click('.module-btn[data-module="tile"]')
 text=page.locator('#result-body').inner_text()
 assert '23 boxes' in text, text
 assert '7 bags' in text, text
 page.select_option('#tile-size','30x30')
 assert page.input_value('#tile-pcs-box')=='11'
 # nail
 page.click('.module-btn[data-module="nail"]')
 text=page.locator('#result-body').inner_text()
 assert '253 pcs' in text,text
 page.select_option('#nail-spacing','20')
 assert '289 pcs' in page.locator('#result-body').inner_text(),page.locator('#result-body').inner_text()  # (51*2+160)*1.1 = 289? adjust if needed
 # concrete
 page.click('.module-btn[data-module="concrete"]')
 text=page.locator('#result-body').inner_text()
 assert '12 bags' in text,text # 4 x3 x.1 ->1.2*1.05*9 = 12
 assert '0.63 m³' in text,text
 # cost
 page.click('.module-btn[data-module="cost"]')
 text=page.locator('#result-body').inner_text()
 assert 'Sand' in text and 'Gravel' in text and 'Tile adhesive' in text, text
 assert 'Grand Total' in text
 assert 'Missing price(s)' in page.locator('#result-note').inner_text()
 page.fill('#price-ties','200')
 page.fill('#price-sand','1000')
 page.fill('#price-gravel','1200')
 page.fill('#price-adhesive','350')
 page.fill('#price-grout','50')
 page.fill('#price-primer','500')
 page.fill('#cost-project-name','Test Project')
 page.fill('#price-labor','800')
 page.fill('#cost-workers','3')
 page.fill('#cost-days','2')
 page.fill('#cost-overhead','10')
 page.fill('#cost-contingency','5')
 text=page.locator('#result-body').inner_text()
 assert 'Test Project' in page.locator('#result-sub').inner_text()
 assert 'Contingency' in text
 page.screenshot(path=str(out/'test-cost-screen.png'), full_page=True)
 # save and reopen
 page.click('#btn-save')
 page.click('.nav-btn[data-view="saved"]')
 assert 'Test Project' in page.locator('.saved-card').first.inner_text()
 assert page.locator('.saved-card').first.locator('.act-restore').is_visible()
 page.locator('.saved-card').first.locator('.act-restore').click()
 assert page.is_visible('#form-cost')
 assert page.input_value('#cost-project-name')=='Test Project'
 # downloaded pdf
 with page.expect_download() as info:
  page.click('#btn-pdf')
 dl=info.value
 assert dl.suggested_filename.endswith('.pdf')
 dl.save_as(str(out/'test-export.pdf'))
 # backup and restore JSON workflow
 page.click('.nav-btn[data-view="saved"]')
 with page.expect_download() as backup_info:
  page.click('#btn-export-backup')
 backup_dl=backup_info.value
 backup_path=str(out/'test-backup.json')
 backup_dl.save_as(backup_path)
 backup_data=json.loads(Path(backup_path).read_text())
 assert backup_data['app']=='BuildCalc' and backup_data['saved']
 page.evaluate("() => localStorage.removeItem('buildcalc.saved.v1')")
 page.click('.nav-btn[data-view="home"]')
 page.click('.nav-btn[data-view="saved"]')
 assert page.locator('.saved-card').count()==0
 page.on('dialog', lambda d: d.accept())
 page.set_input_files('#backup-file',backup_path)
 page.wait_for_function("() => document.querySelectorAll('.saved-card').length > 0")
 assert page.locator('.saved-card').count()==1
 # safe saved rendering (malicious string from backup localStorage)
 page.evaluate("""() => {const l=JSON.parse(localStorage.getItem('buildcalc.saved.v1'));l[0].title='<img src=x onerror=alert(9)>'; localStorage.setItem('buildcalc.saved.v1',JSON.stringify(l));}""")
 page.click('.nav-btn[data-view="saved"]')
 assert page.locator('.saved-card img').count()==0
 assert '<img' in page.locator('.saved-card h4').first.inner_text()
 # mobile overflow check
 page.set_viewport_size({'width':375,'height':812})
 page.screenshot(path=str(out/'test-mobile-screen.png'), full_page=True)
 # page.reload()  # About:blank is a synthetic testing origin
 assert not errs, errs
 print('PASS: Browser flows (navigation, all calculations, validation, conditional forms, cost, save/reopen, PDF, backup/restore, HTML escaping, mobile).')
 print('PDF:', dl.suggested_filename)
 print('Page errors:',errs)
 browser.close()
