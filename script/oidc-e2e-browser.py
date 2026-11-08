"""Local-only E2E. Run oidc-e2e-fixture.ts and a disposable local Nakedapp first.
The production-looking Nakedapp hostname is intercepted; NO production requests.
"""
from playwright.sync_api import sync_playwright, expect
from urllib.parse import urlsplit, parse_qs
import json, re, time
APP='https://nakedapp.up.railway.app'
LOCAL_APP='http://127.0.0.1:4195'
FARM='http://127.0.0.1:4194'
requests, errors = [], []
flow_states = []

def redirect_to_local(route):
    r=route.request; parsed=urlsplit(r.url)
    requests.append((parsed.netloc,parsed.path,r.method))
    if r.url.startswith(APP+'/'):
        headers=r.all_headers()
        headers['x-forwarded-proto']='https'  # Model the trusted HTTPS ingress.
        if r.is_navigation_request():
            headers['sec-fetch-mode']='navigate'
            headers['sec-fetch-dest']='document'
        headers.pop('if-none-match',None); headers.pop('if-modified-since',None)
        response=route.fetch(url=LOCAL_APP+r.url[len(APP):],headers=headers,max_redirects=0)
        if r.resource_type=='script' and 'text/html' in response.headers.get('content-type',''):
            print('Unexpected script MIME:',parsed.path,response.status,flush=True)
        if parsed.path in ('/api/auth/user','/api/profile'): print('App API status:',parsed.path,response.status,flush=True)
        if parsed.path.startswith('/api/auth/oidc/'):
            if parsed.path.endswith('/start'): flow_states.append(parse_qs(urlsplit(response.headers.get('location','')).query).get('state',[None])[0])
            if parsed.path.endswith('/callback'): print('Callback state matches start:',parse_qs(parsed.query).get('state',[None])[0]==flow_states[-1],flush=True)
            print('OIDC response:',parsed.path,response.status,'redirect:',urlsplit(response.headers.get('location','')).path,flush=True)
            if response.status>=400: print('Safe error:',response.text()[:160],flush=True)
        location=response.headers.get('location','')
        if location.startswith('/') and not location.startswith('//'): location=APP+location
        if response.status in (301,302,303,307,308) and location.startswith(APP+'/'):
            # Native redirect chains can bypass Playwright route interception.
            # New document navigation is intercepted, preserving the app cookie.
            reply_headers=dict(response.headers)
            for key in ('location','content-length','content-encoding'): reply_headers.pop(key,None)
            reply_headers['content-type']='text/html; charset=utf-8'
            return route.fulfill(status=200,headers=reply_headers,body='<script>location.replace('+json.dumps(location)+')</script>')
        return route.fulfill(response=response)
    if parsed.hostname=='127.0.0.1' and parsed.port in (4194,4195): return route.continue_()
    return route.abort()

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--host-resolver-rules=MAP * 127.0.0.1, EXCLUDE localhost'])
    for method in ('code','link'):
        ctx=browser.new_context(viewport={'width':390,'height':844})
        ctx.route('**/*',redirect_to_local)
        if hasattr(ctx,'route_web_socket'): ctx.route_web_socket('**/*',lambda ws:ws.close())
        p=ctx.new_page(); p.on('pageerror',lambda e:errors.append(str(e)))
        p.on('console',lambda m:print('Browser error:',m.text.split('?')[0][:250],flush=True) if m.type=='error' else None)
        p.goto(APP+'/login')
        expect(p.get_by_role('link',name='Sign in / Create account')).to_be_visible()
        p.get_by_role('link',name='Sign in / Create account').click()
        p.wait_for_url(re.compile(re.escape(FARM)+r'/nakedapp-auth/login\?'))
        expect(p.get_by_role('heading',name='Welcome back.')).to_be_visible()
        for width in (390,1280):
            p.set_viewport_size({'width':width,'height':900})
            assert p.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'Farm login overflow'
        p.get_by_role('link',name='Create an account').click()
        expect(p.get_by_role('heading',name='Your next good night starts here.')).to_be_visible()
        email=f'oidc-e2e-{method}-{int(time.time()*1000)}@example.test'
        p.get_by_label('Email address',exact=True).fill(email)
        p.get_by_label('Your name').fill('Local Test')
        if method=='code':
            p.get_by_role('button',name='Email me a code',exact=True).click()
            expect(p.get_by_label('Your six-digit code')).to_be_visible()
            mail=ctx.request.get(FARM+'/__test/mail').json()
            code=re.search(r'code is (\d{6})',next(m['text'] for m in reversed(mail) if m['to']==email)).group(1)
            p.get_by_label('Your six-digit code').fill(code)
            p.get_by_role('button',name='Verify & continue',exact=True).click()
        else:
            p.get_by_role('button',name='Send a sign-in link instead',exact=True).click()
            expect(p.get_by_role('status')).to_contain_text('Check your inbox')
            mail=ctx.request.get(FARM+'/__test/mail').json()
            link=re.search(r'http://\S+',next(m['text'] for m in reversed(mail) if m['to']==email)).group(0)
            assert link.startswith(FARM+'/nakedapp-auth/api/better-auth/magic-link/verify?')
            p.goto(link)
        p.wait_for_url(re.compile(re.escape(FARM)+r'/nakedapp-auth/consent\?'),timeout=15000)
        expect(p.get_by_role('heading',name='Connect to Nakedapp')).to_be_visible()
        p.get_by_role('button',name='Allow & continue',exact=True).click()
        try: p.wait_for_url(APP+'/profile',timeout=15000)
        except Exception:
            print('App cookie metadata:',[(c['name'],c['domain'],c['httpOnly'],c['secure']) for c in ctx.cookies(APP)],flush=True)
            raise RuntimeError('OIDC callback did not return to profile; inspect token-free response diagnostics') from None
        try: expect(p.get_by_role('heading',name='My profile')).to_be_visible()
        except Exception:
            print('Profile-page headings:',p.locator('h1,h2').all_text_contents(),flush=True)
            print('Authenticated API status:',p.evaluate("fetch('/api/auth/user').then(r=>r.status)"),flush=True)
            print('Page errors:',errors,flush=True)
            raise RuntimeError('Real profile page did not load; inspect app API status') from None
        user=p.evaluate("fetch('/api/auth/user').then(r=>r.json())")
        assert user['id'].startswith('farm-auth:') and user['role']=='user' and user['email']==email
        assert user['emailVerified'] is True
        expect(p.get_by_label('Username',exact=True)).to_be_visible()
        username=f'test{method}{int(time.time())}'
        p.get_by_label('Username',exact=True).fill(username)
        p.get_by_role('button',name='Save profile',exact=True).click()
        expect(p.get_by_role('status').first).to_contain_text('Profile saved')
        p.reload(); expect(p.get_by_label('Username',exact=True)).to_have_value(username)
        assert p.evaluate("localStorage.getItem('bearer_token')") is None
        cookies=ctx.cookies(APP)
        assert any(c['name']=='connect.sid' and c['httpOnly'] for c in cookies)
        assert not any('mvt-better-auth' in c['name'] for c in cookies),'No farm auth cookie at app'
        assert not any(host=='nakedapp.up.railway.app' and (path.startswith('/api/farm-auth/') or path.startswith('/api/better-auth/')) for host,path,_ in requests)
        assert p.evaluate("fetch('/api/admin/auth-dashboard').then(r=>r.status)")==403
        p.goto(APP+'/api/logout')
        p.wait_for_url(APP+'/')
        assert p.evaluate("fetch('/api/auth/user').then(r=>r.status)")==401
        p.goto('about:blank')
        ctx.unroute_all(behavior='ignoreErrors')
        ctx.close()
        print(f'PASS: real farm {method} signup + verification + consent -> OIDC -> real Nakedapp profile save/reload -> local logout',flush=True)
    assert not errors,errors
    browser.close()
print('PASS: local real-provider E2E, preserved per-account profile IDs, no farm tokens/cookies in Nakedapp, email mocked, production network blocked.')
