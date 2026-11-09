export const LOGIN_FONTS = { sans: 'Arial, Helvetica, sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: '"Courier New", monospace', rounded: '"Trebuchet MS", Arial, sans-serif' } as const;
export type LoginFont = keyof typeof LOGIN_FONTS;
export type LoginPanel = { font: LoginFont; headingSize: number; bodySize: number; background: string; textColor: string; imageUrl: string };
export type LoginDesign = {
  version: 1;
  left: LoginPanel & { brand: string; logoUrl: string; eyebrow: string; headline: string; description: string; footer: string; accent: string };
  right: LoginPanel & { eyebrow: string; loginTitle: string; signupTitle: string; loginIntro: string; signupIntro: string; footer: string; loginButton: string; signupButton: string; googleLabel: string; buttonColor: string; buttonTextColor: string };
};
export const DEFAULT_LOGIN_DESIGN: LoginDesign = {
  version: 1,
  left: { font: 'sans', headingSize: 56, bodySize: 17, background: '#20263b', textColor: '#ffffff', imageUrl: '', brand: 'nakedapp', logoUrl: '', eyebrow: 'FOR THE PEOPLE WHO MAKE THE MUSIC.', headline: 'Find your people.\nFeel the music.', description: 'Artists, musicians, venues and the people who bring it all together.', footer: 'YOUR IDENTITY. YOUR CHOICE.', accent: '#d3fa77' },
  right: { font: 'sans', headingSize: 34, bodySize: 15, background: '#f5f4ef', textColor: '#171b29', imageUrl: '', eyebrow: 'NAKEDAPP · SIGN IN', loginTitle: 'Welcome back.', signupTitle: 'Create your account.', loginIntro: 'Your music. Your people. One account.', signupIntro: 'Join the artists, musicians and people who make it happen.', footer: 'Your account. Your music.', loginButton: 'Sign in', signupButton: 'Create account', googleLabel: 'Continue with Google', buttonColor: '#222940', buttonTextColor: '#ffffff' },
};
export function copyDefaultLoginDesign(): LoginDesign { return JSON.parse(JSON.stringify(DEFAULT_LOGIN_DESIGN)); }
export function parseLoginDesign(input: unknown, imageOrigin = 'https://nakedapp.up.railway.app'): LoginDesign {
  const fail = (): never => { throw new Error('Invalid login-screen settings'); };
  const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail();
  const root = object(input); if (root.version !== 1 || Object.keys(root).some(k => !['version', 'left', 'right'].includes(k))) fail();
  const result = copyDefaultLoginDesign();
  for (const side of ['left', 'right'] as const) {
    const source = object(root[side]); const target = result[side] as unknown as Record<string, unknown>;
    if (Object.keys(source).length !== Object.keys(target).length || Object.keys(source).some(k => !(k in target))) fail();
    for (const key of Object.keys(target)) {
      const value = source[key];
      if (key === 'font') { if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(LOGIN_FONTS, value)) fail(); }
      else if (key === 'headingSize' || key === 'bodySize') { if (typeof value !== 'number' || !Number.isInteger(value) || value < (key === 'headingSize' ? 24 : 12) || value > (key === 'headingSize' ? 64 : 22)) fail(); }
      else if (['background','textColor','accent','buttonColor','buttonTextColor'].includes(key)) { if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) fail(); }
      else if (key === 'imageUrl' || key === 'logoUrl') {
        if (typeof value !== 'string' || value.length > 250) fail();
        if (value) { let url: URL; try { url = new URL(value as string, imageOrigin); } catch { return fail(); }
          if (url.origin !== new URL(imageOrigin).origin || url.username || url.password || url.search || url.hash || !/^\/api\/files\/\d+$/.test(url.pathname)) fail(); }
      } else if (typeof value !== 'string' || value.length > (['headline','description','loginIntro','signupIntro'].includes(key) ? 500 : 160) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail();
      target[key] = value;
    }
  }
  return result;
}
