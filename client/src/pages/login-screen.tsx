import { useEffect, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { LOGIN_FONTS, copyDefaultLoginDesign, type LoginDesign } from '@shared/login-design';

type DesignState = { draft: LoginDesign; published: LoginDesign };
const textFields = {
  left: { brand: 'Brand name', eyebrow: 'Small heading', headline: 'Headline', description: 'Description', footer: 'Footer' },
  right: { eyebrow: 'Small heading', loginTitle: 'Sign-in heading', signupTitle: 'Sign-up heading', loginIntro: 'Sign-in description', signupIntro: 'Sign-up description', loginButton: 'Sign-in button', signupButton: 'Sign-up button', googleLabel: 'Google button label', footer: 'Footer' },
};
const colorFields = { left: { background: 'Background', textColor: 'Text', accent: 'Accent' }, right: { background: 'Background', textColor: 'Text', buttonColor: 'Buttons', buttonTextColor: 'Button text' } };
export default function LoginScreenEditor() {
  const { user, isAdmin, isLoading } = useAuth();
  const { data, error, isLoading: loadingDesign } = useQuery<DesignState>({ queryKey: ['/api/admin/login-design'], enabled: isAdmin, staleTime: 0 });
  const [design, setDesign] = useState<LoginDesign | null>(null);
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [page, setPage] = useState<'login' | 'signup'>('signup');
  const [mobile, setMobile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { if (data && !design) setDesign(data.draft); }, [data, design]);
  const update = (key: string, value: string | number) => {
    setDesign(current => current ? { ...current, [side]: { ...current[side], [key]: value } } : current);
    setMessage('');
  };
  async function save(action: 'draft' | 'publish') {
    if (!design || busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await apiRequest('PUT', '/api/admin/login-design', { action, design });
      const result = await response.json();
      queryClient.setQueryData<DesignState>(['/api/admin/login-design'], current => ({ draft: result.design, published: action === 'publish' ? result.design : current!.published }));
      setMessage(action === 'publish' ? 'Published. The farm applies updates within about one minute once Ferris deploys the renderer.' : 'Draft saved. The live login screen has not changed.');
    } catch { setMessage('Could not save. Your changes are still here; please try again.'); }
    finally { setBusy(false); }
  }
  async function upload(file: File | undefined, key: 'imageUrl' | 'logoUrl') {
    if (!file || busy) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) { setMessage('Choose a JPG, PNG, WebP or GIF up to 5 MB.'); return; }
    setBusy(true); setMessage('');
    try {
      const body = new FormData(); body.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', credentials: 'include', body });
      if (!response.ok) throw new Error();
      const result = await response.json(); update(key, result.url); setMessage('Image uploaded. Save draft or publish to apply it.');
    } catch { setMessage('Upload failed. Please try again.'); }
    finally { setBusy(false); }
  }
  if (isLoading) return <div className="p-6">Loading…</div>;
  if (!user || !isAdmin) return <div className="p-6"><h1>Admin access required</h1><Link href="/login">Sign in</Link></div>;
  if (error) return <div className="p-6">Cannot load the design. <button onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/login-design'] })}>Retry</button></div>;
  if (!design || loadingDesign) return <div className="p-6">Loading design…</div>;
  const left = design.left, right = design.right;
  const panelStyle = (panel: typeof left | typeof right): CSSProperties => ({ fontFamily: LOGIN_FONTS[panel.font], backgroundColor: panel.background, color: panel.textColor, backgroundImage: panel.imageUrl ? `url("${panel.imageUrl}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', fontSize: panel.bodySize });
  const dirty = JSON.stringify(design) !== JSON.stringify(data?.draft);
  return <main className="mx-auto max-w-7xl p-4 md:p-6 pb-28" data-testid="login-screen-editor">
    <Link href="/admin"><Button variant="outline" size="sm">Back to Admin</Button></Link>
    <h1 className="text-2xl font-bold mt-4">Login screen</h1>
    <p className="text-sm text-muted-foreground mt-1 mb-4">Edit each panel independently. These settings change appearance only, not authentication or permissions. Fonts are built-in system presets.</p>
    <div className="flex flex-wrap gap-2 mb-3">
      <Button disabled={busy} variant="outline" onClick={() => save('draft')}>Save draft</Button>
      <Button disabled={busy} onClick={() => save('publish')}>Publish</Button>
      <Button disabled={busy} variant="outline" onClick={() => { setDesign(copyDefaultLoginDesign()); setMessage('Defaults restored in the editor. Publish to change the live screen.'); }}>Restore defaults</Button>
      <span className="text-xs self-center text-muted-foreground">{dirty ? 'Unsaved changes' : 'Saved draft'} · {JSON.stringify(design) === JSON.stringify(data?.published) ? 'Matches published design' : 'Not yet published'}</span>
    </div>
    <p role="status" className="text-sm mb-4" aria-live="polite">{message}</p>
    <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-4">
      <Card className="p-4 min-w-0">
        <div className="flex gap-2 mb-4">{(['left', 'right'] as const).map(s => <Button key={s} variant={side === s ? 'default' : 'outline'} size="sm" onClick={() => setSide(s)}>{s === 'left' ? 'Left panel' : 'Right panel'}</Button>)}</div>
        <fieldset disabled={busy} className="space-y-4">
          {Object.entries(textFields[side]).map(([key, label]) => <label className="block text-sm" key={key}>{label}<textarea aria-label={label} className="mt-1 flex min-h-10 w-full rounded-md border bg-background px-3 py-2 text-sm" rows={['headline', 'description', 'loginIntro', 'signupIntro'].includes(key) ? 3 : 1} maxLength={['headline', 'description', 'loginIntro', 'signupIntro'].includes(key) ? 500 : 160} value={String((design[side] as unknown as Record<string, unknown>)[key])} onChange={e => update(key, e.target.value)} /></label>)}
          <label className="block text-sm">Font<select aria-label="Font" className="w-full border rounded-md p-2 mt-1 bg-background" value={design[side].font} onChange={e => update('font', e.target.value)}>{Object.keys(LOGIN_FONTS).map(font => <option key={font} value={font}>{font}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">{(['headingSize', 'bodySize'] as const).map(key => <label key={key} className="text-sm">{key === 'headingSize' ? 'Heading size' : 'Body size'}<Input type="number" min={key === 'headingSize' ? 24 : 12} max={key === 'headingSize' ? 64 : 22} value={design[side][key]} onChange={e => update(key, Number(e.target.value))} /></label>)}</div>
          <div className="grid grid-cols-2 gap-3">{Object.entries(colorFields[side]).map(([key, label]) => <label key={key} className="text-sm">{label}<Input type="color" aria-label={label + ' colour'} value={String((design[side] as unknown as Record<string, unknown>)[key])} onChange={e => update(key, e.target.value)} /></label>)}</div>
          {(['imageUrl', ...(side === 'left' ? ['logoUrl'] : [])] as ('imageUrl' | 'logoUrl')[]).map(key => <div key={side + key}><label className="block text-sm">{key === 'logoUrl' ? 'Logo upload' : 'Background image upload'}<Input type="file" className="mt-1" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => { void upload(e.target.files?.[0], key); e.target.value = ''; }} /></label>{(design[side] as unknown as Record<string, unknown>)[key] ? <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => update(key, '')}>Remove {key === 'logoUrl' ? 'logo' : 'image'}</Button> : null}</div>)}
          <p className="text-xs text-muted-foreground">Uploaded images are public design assets. Do not upload private information. JPG, PNG, WebP or GIF, up to 5 MB.</p>
        </fieldset>
      </Card>
      <Card className="p-3 min-w-0 self-start">
        <div className="flex flex-wrap gap-2 mb-3">{(['login', 'signup'] as const).map(p => <Button key={p} size="sm" variant={page === p ? 'default' : 'outline'} onClick={() => setPage(p)}>{p === 'login' ? 'Sign-in preview' : 'Sign-up preview'}</Button>)}<Button size="sm" variant="outline" onClick={() => setMobile(!mobile)}>{mobile ? 'Desktop preview' : 'Mobile preview'}</Button></div>
        <p className="text-xs text-muted-foreground mb-2">Design preview only. Google is shown for styling; availability depends on farm configuration. Form controls do not submit.</p>
        <div className="max-w-full mx-auto overflow-hidden border rounded-md" style={{ width: mobile ? 390 : '100%' }} data-testid="login-design-preview">
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '46% 54%', minHeight: mobile ? undefined : 540 }}>
            <aside style={{ ...panelStyle(left), padding: mobile ? 24 : 28, display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>
              {left.logoUrl ? <img src={left.logoUrl} alt={left.brand} style={{ maxWidth: 180, maxHeight: 64, objectFit: 'contain', alignSelf: 'flex-start' }} /> : <strong style={{ fontSize: 30 }}>{left.brand}</strong>}
              <div style={{ margin: mobile ? undefined : 'auto 0' }}><p style={{ color: left.accent, fontSize: 10, letterSpacing: 1 }}>{left.eyebrow}</p><h2 style={{ fontSize: mobile ? Math.min(left.headingSize, 34) : left.headingSize, lineHeight: 1.1, whiteSpace: 'pre-line', overflowWrap: 'anywhere', margin: '20px 0' }}>{left.headline}</h2><p style={{ whiteSpace: 'pre-line' }}>{left.description}</p></div>
              {!mobile && <p style={{ fontSize: 10 }}>{left.footer}</p>}
            </aside>
            <section style={{ ...panelStyle(right), padding: mobile ? 24 : 28, minWidth: 0 }}>
              <p style={{ fontSize: 10, letterSpacing: 1 }}>{right.eyebrow}</p>
              <h2 style={{ fontSize: mobile ? Math.min(right.headingSize, 30) : right.headingSize, lineHeight: 1.15, overflowWrap: 'anywhere', margin: '16px 0' }}>{page === 'signup' ? right.signupTitle : right.loginTitle}</h2>
              <p style={{ whiteSpace: 'pre-line', marginBottom: 20 }}>{page === 'signup' ? right.signupIntro : right.loginIntro}</p>
              <div className="text-center border rounded-md p-3 bg-white text-black">G · {right.googleLabel}</div><p className="text-center text-xs my-3">or with email</p>
              {['Your name', 'Email address', 'Password'].filter(label => page === 'signup' || label !== 'Your name').map(label => <div className="my-3" key={label}><p className="text-xs font-bold mb-2">{label}</p><div className="h-10 border rounded-md bg-white" /></div>)}
              <div className="text-center rounded-md p-3 mt-4" style={{ background: right.buttonColor, color: right.buttonTextColor }}>{page === 'signup' ? right.signupButton : right.loginButton}</div>
              <p className="text-xs text-center mt-5">{page === 'signup' ? 'Already have an account? Sign in' : 'New around here? Create an account'}</p><p style={{ fontSize: 11, marginTop: 28 }}>{right.footer}</p>
            </section>
          </div>
        </div>
      </Card>
    </div>
  </main>;
}
