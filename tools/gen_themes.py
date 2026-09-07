import colorsys, io, json

def srgb(c):
    c/=255
    return c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
def lum(h):
    h=h.lstrip('#'); r,g,b=(int(h[i:i+2],16) for i in (0,2,4))
    return .2126*srgb(r)+.7152*srgb(g)+.0722*srgb(b)
def contrast(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb)
    return (hi+.05)/(lo+.05)
def to_hls(h):
    h=h.lstrip('#'); r,g,b=(int(h[i:i+2],16)/255 for i in (0,2,4))
    return colorsys.rgb_to_hls(r,g,b)
def to_hex(hh,l,s):
    r,g,b=colorsys.hls_to_rgb(hh%1,max(0,min(1,l)),max(0,min(1,s)))
    return '#%02x%02x%02x'%(round(r*255),round(g*255),round(b*255))

def deep(hx, target=4.5):
    """Затемняем, пока белый текст не станет читаемым."""
    h,l,s = to_hls(hx)
    while l > 0.03:
        if contrast(to_hex(h,l,s), '#ffffff') >= target: break
        l -= 0.01
    return to_hex(h,l,s)
def soft(hx, l=0.965, sm=0.55):
    h,_,s = to_hls(hx); return to_hex(h,l,s*sm)
def line(hx, l=0.86, sm=0.6):
    h,_,s = to_hls(hx); return to_hex(h,l,s*sm)
def tint(hx, l, s):
    h,_,_ = to_hls(hx); return to_hex(h,l,s)

def build(t):
    p,se,w,a = t['primary'], t['second'], t['warm'], t['accent']
    hue = to_hls(p)[0]
    v = {
      '--primary':p, '--primary-deep':t.get('primary_deep') or deep(p),
      '--primary-soft':t.get('primary_soft') or soft(p), '--primary-line':t.get('primary_line') or line(p),
      '--second':se, '--second-deep':t.get('second_deep') or deep(se),
      '--second-soft':t.get('second_soft') or soft(se), '--second-line':t.get('second_line') or line(se),
      '--warm':w, '--warm-deep':t.get('warm_deep') or deep(w),
      '--warm-soft':t.get('warm_soft') or soft(w), '--warm-line':t.get('warm_line') or line(w),
      '--accent':a, '--accent-deep':t.get('accent_deep') or deep(a),
      '--white':'#ffffff',
      '--page':t.get('page') or tint(p,0.995,0.35),
      '--surface':t.get('surface') or '#ffffff',
      '--line':t.get('line') or line(p,0.90,0.45),
      '--ink':t.get('ink') or tint(p,0.13,0.30),
      '--ink-soft':t.get('ink_soft') or tint(p,0.44,0.16),
      '--dark':t.get('dark') or tint(p,0.10,0.45),
      '--dark-2':t.get('dark2') or tint(p,0.19,0.45),
    }
    ink, dark, dark2 = v['--ink'], v['--dark'], v['--dark-2']
    if t['hero'] == 'dark':
        v.update({
          '--hero-bg': t.get('hero_bg') or 'linear-gradient(165deg, var(--dark-2), var(--dark) 60%)',
          '--hero-ink':'var(--white)',
          '--hero-ink-soft': t.get('hero_ink_soft') or tint(p,0.86,0.35),
          '--hero-mark':'var(--warm)',
          '--hero-glow-1': t.get('glow1') or 'rgba(%d, %d, %d, .5)'%tuple(int(p.lstrip('#')[i:i+2],16) for i in (0,2,4)),
          '--hero-glow-2': t.get('glow2') or 'rgba(%d, %d, %d, .42)'%tuple(int(se.lstrip('#')[i:i+2],16) for i in (0,2,4)),
          '--footer-ink': t.get('footer_ink') or tint(p,0.78,0.28),
          '--overlay': t.get('overlay') or 'rgba(%d, %d, %d, .93)'%tuple(int(dark.lstrip('#')[i:i+2],16) for i in (0,2,4)),
          '--chrome-bg': t.get('chrome') or 'rgba(255, 255, 255, .85)',
        })
    else:  # светлая шапка
        v.update({
          '--hero-bg': t.get('hero_bg') or 'linear-gradient(170deg, var(--primary-soft), var(--page) 48%, var(--warm-soft))',
          '--hero-ink':'var(--ink)',
          '--hero-ink-soft':'var(--ink-soft)',
          '--hero-mark': t.get('hero_mark') or 'var(--second-deep)',
          '--hero-glow-1': t.get('glow1') or 'rgba(%d, %d, %d, .45)'%tuple(int(a.lstrip('#')[i:i+2],16) for i in (0,2,4)),
          '--hero-glow-2': t.get('glow2') or 'rgba(%d, %d, %d, .5)'%tuple(int(p.lstrip('#')[i:i+2],16) for i in (0,2,4)),
          '--footer-ink': t.get('footer_ink') or tint(p,0.80,0.20),
          '--overlay': t.get('overlay') or 'rgba(%d, %d, %d, .94)'%tuple(int(dark.lstrip('#')[i:i+2],16) for i in (0,2,4)),
          '--chrome-bg': t.get('chrome') or 'rgba(255, 255, 255, .85)',
        })
    v.update({
      '--btn-bg': t.get('btn') or 'var(--primary-deep)',
      '--cta-bg': t.get('cta') or 'var(--warm)',
      '--cta-ink': t.get('cta_ink') or 'var(--ink)',
      '--label-bg': t.get('label') or 'var(--second-deep)',
      '--avatar-bg': t.get('avatar') or 'linear-gradient(135deg, var(--primary), var(--second))',
      '--cases-bg': t.get('cases') or 'linear-gradient(180deg, var(--warm-soft), var(--second-soft))',
    })
    return v
