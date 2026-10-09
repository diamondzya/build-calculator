from playwright.sync_api import sync_playwright
from pathlib import Path
import json
base=Path(__file__).resolve().parents[1]
out=base/'tests'/'test-output';out.mkdir(parents=True,exist_ok=True)
html=(base/'index.html').read_text()
for name in ['style.css']:
    html=html.replace(f'<link rel="stylesheet" href="{name}">','<style>'+(base/name).read_text()+'</style>')
for name in ['assets/jspdf.umd.min.js','calc-engine.js','script.js','project-sheets.js','icons.js']:
    html=html.replace(f'<script src="{name}"></script>','<script>'+(base/name).read_text().replace('</script>','<\\/script>')+'</script>')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1380,'height':940},accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.evaluate('''() => {const values={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return values[k]??null;},setItem(k,v){values[k]=String(v);},removeItem(k){delete values[k];}}});}''')
    page.set_content(html,wait_until='load')
    page.click('#btn-start')
    page.select_option('#steel-project','column')
    assert page.is_visible('#steel-column-fields')
    page.fill('#steel-length','6')
    page.fill('#steel-width','0.3')
    page.fill('#steel-height','0.4')
    page.fill('#steel-excavation','1.5')
    page.fill('#steel-bottom-hook','0.4')
    page.fill('#steel-top-hook','0.2')
    page.fill('#steel-lap','0.6')
    page.select_option('#steel-stock','6')
    page.click('#form-steel .calc-btn')
    result=page.locator('#result-body').inner_text()
    assert '7.5 m' in result and '8 bars' in result, result
    assert '4 joints' in result and '51 pcs' in result, result
    assert 'Tie Wire' in result
    page.fill('#line-item-name','Poste C1 (with hukay)')
    page.click('#btn-add-project')
    page.click('.nav-btn[data-view="projects"]')
    assert 'Poste C1 (with hukay)' in page.locator('#project-details').inner_text()
    assert 'Panali' not in page.locator('#project-summary-lines').inner_text() or 'Tie wire' in page.locator('#project-summary-lines').inner_text()
    assert 'Tie wire' in page.locator('#project-summary-lines').inner_text()
    assert page.locator('.sheet-line').count()==1
    # Price variation per stock length and steel diameter; persists for this project.
    selector='.sheet-rate-input[data-price-key="main-12mm-6m"]'
    page.locator(selector).fill('425')
    page.locator(selector).dispatch_event('change')
    assert page.locator(selector).input_value()=='425'
    assert '₱3,400' in page.locator('#project-summary-lines').inner_text() # 8 bars * 425
    # Add foundation mesh to same project
    page.click('.nav-btn[data-view="calculators"]')
    page.select_option('#steel-project','footing')
    assert not page.is_visible('#steel-column-fields')
    page.fill('#steel-length','2')
    page.fill('#steel-width','2')
    page.fill('#steel-height','0.4')
    page.fill('#steel-elements','3')
    page.fill('#line-item-name','Footing F1 / 3 pieces')
    page.click('#btn-add-project')
    # Add matching concrete to same foundation section
    page.click('.module-btn[data-module="concrete"]')
    page.select_option('#conc-project','footing')
    page.fill('#conc-length','1.2')
    page.fill('#conc-width','1.2')
    page.fill('#conc-height','0.4')
    page.fill('#conc-count','3')
    page.fill('#line-item-name','Footing F1 Concrete')
    page.click('#btn-add-project')
    # Concrete column includes below-grade depth separately
    page.select_option('#conc-project','column')
    assert page.is_visible('#conc-below-fields')
    page.fill('#conc-length','0.3')
    page.fill('#conc-width','0.4')
    page.fill('#conc-height','3')
    page.fill('#conc-below','1.5')
    page.fill('#conc-count','2')
    assert '1.08 m³' in page.locator('#result-body').inner_text()
    page.fill('#line-item-name','Poste C1 Concrete')
    page.click('#btn-add-project')
    # Verify all 4 items aggregated and correctly grouped
    page.click('.nav-btn[data-view="projects"]')
    assert page.locator('.sheet-line').count()==4
    assert page.locator('.sheet-section').count()==2
    assert 'Footing F1 Concrete' in page.locator('#project-details').inner_text()
    assert 'Poste C1 Concrete' in page.locator('#project-details').inner_text()
    summary=page.locator('#project-summary-lines').inner_text()
    assert 'Cement (40 kg)' in summary and 'Sand' in summary and 'Gravel' in summary and 'Tie wire' in summary,summary
    page.screenshot(path=str(out/'v3-project-desktop.png'),full_page=True)
    # Edit existing entry, no duplicate
    page.locator('.sheet-section').filter(has_text='02 — Poste').locator('.sheet-edit').first.click()
    assert page.is_visible('#form-steel')
    assert page.input_value('#steel-excavation')=='1.5'
    page.fill('#steel-bottom-hook','0.5')
    page.click('#btn-add-project')
    page.click('.nav-btn[data-view="projects"]')
    assert page.locator('.sheet-line').count()==4
    # Cost calculation reads project rows (not last successful module only).
    page.click('#project-pricing')
    assert page.is_visible('#form-cost')
    assert page.input_value('#cost-source')=='project'
    body=page.locator('#result-body').inner_text()
    assert 'Tie wire' in body and 'Cement' in body and 'Main rebars' in body,body
    # PDF includes detailed pages and consolidated summary
    page.click('.nav-btn[data-view="projects"]')
    with page.expect_download() as dl_info:
        page.click('#project-pdf')
    dl=dl_info.value
    pdfpath=out/'BuildCalc-v3-project-report.pdf'; dl.save_as(pdfpath)
    assert pdfpath.stat().st_size>5000
    import fitz
    pdf=fitz.open(pdfpath)
    text='\n'.join(pg.get_text() for pg in pdf)
    assert len(pdf)>=3,len(pdf)
    assert 'Footing' in text and 'Column' in text and 'CONSOLIDATED MATERIAL SUMMARY' in text
    assert 'Tie wire' in text and 'Cement' in text
    pdf.close()
    # Full JSON project backup and recovery
    page.click('.nav-btn[data-view="saved"]')
    with page.expect_download() as backup_info:page.click('#btn-export-backup')
    backup=out/'v3-backup.json'; backup_info.value.save_as(str(backup))
    stored=json.loads(backup.read_text())
    assert stored['version']>=4 and stored['projects'][0]['items'] and stored['projects'][0]['priceOverrides']
    assert len(stored['projects'][0]['items'])==4
    page.evaluate("() => localStorage.removeItem('buildcalc.projects.v3')")
    page.click('.nav-btn[data-view="projects"]')
    assert page.locator('.sheet-line').count()==0
    page.on('dialog',lambda d:d.accept())
    page.set_input_files('#backup-file',str(backup))
    page.wait_for_function("() => document.querySelectorAll('.sheet-line').length === 4")
    assert page.locator('.sheet-rate-input[data-price-key="main-12mm-6m"]').input_value()=='425'
    # Mobile visual and overflow check
    page.set_viewport_size({'width':375,'height':812})
    page.screenshot(path=str(out/'v3-project-mobile.png'),full_page=True)
    sizes=page.evaluate('''() => ({scroll:document.documentElement.scrollWidth,viewport:innerWidth})''')
    assert sizes['scroll'] <= sizes['viewport']+1,sizes
    assert not errors,errors
    print('PASS: Multi-project sheet browser integration — FFL excavation, hooks/splicing, tie-wire, 6m bars, footing+column groups, editable prices, update without duplicate, costing, project PDF, JSON backup/restore, mobile layout.')
    print('PDF pages:',len(fitz.open(pdfpath)),'PDF size:',pdfpath.stat().st_size,'Mobile overflow:',sizes)
    print('Browser JS errors:',errors)
    browser.close()
