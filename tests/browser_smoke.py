"""Run against localhost:8000: uv run --with playwright python tests/browser_smoke.py."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:8000')
    page.wait_for_selector('#mandalaSvg path')
    page.wait_for_timeout(900)
    fills = "Array.from(document.querySelectorAll('#mandalaSvg path')).map(p => p.style.fill || p.getAttribute('fill'))"
    page.click('#randomTabBtn')
    page.click('#generatePatternBtn')
    generated = page.evaluate(fills)
    page.click('#imageTabBtn')
    page.click('#randomTabBtn')
    assert page.evaluate(fills) == generated, 'Tab switch destroyed pattern'
    page.click('#drawTabBtn')
    page.click('#drawClear')
    blank = page.evaluate(fills)
    page.click('#drawUndo')
    assert page.evaluate(fills) == generated
    page.click('#drawRedo')
    assert page.evaluate(fills) == blank
    page.locator('#drawColors button').filter(has_text='red').first.click()
    points = page.evaluate("""() => Array.from(document.querySelectorAll('#mandalaSvg path'))
      .filter(p => ['#ffffff', 'rgb(255, 255, 255)'].includes(p.style.fill || p.getAttribute('fill')))
      .slice(100, 110).map(p => {const r = p.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})""")
    assert points
    page.mouse.move(points[0]['x'], points[0]['y'])
    page.mouse.down()
    for point in points[1:]:
        page.mouse.move(point['x'], point['y'])
    page.mouse.up()
    painted = page.evaluate(fills)
    assert painted != blank, 'Stroke did not paint'
    page.click('#drawUndo')
    assert page.evaluate(fills) == blank, 'Undo must undo the whole gesture'
    page.click('#drawRedo')
    assert page.evaluate(fills) == painted
    page.click('#imageTabBtn')
    page.set_input_files('#imageInput', 'test_images/test_01.png')
    page.wait_for_function("document.querySelector('#status').textContent.startsWith('Updated')")
    page.locator('#scaleInput').evaluate("e => {e.value = '1.5'; e.dispatchEvent(new Event('input'));}")
    page.click('#resetBtn')
    reset = page.evaluate(fills)
    page.wait_for_timeout(300)
    assert page.evaluate(fills) == reset, 'Pending image mapping overwrote reset'
    page.click('#drawTabBtn')
    assert page.locator('#drawUndo').is_disabled()
    assert not errors, errors
    browser.close()
    print('PASS: pattern preservation, drawing, stroke undo/redo, clear, image mapping, reset race, history invalidation')
