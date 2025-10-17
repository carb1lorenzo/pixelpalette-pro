# color_engine.py - Python logic (Pyodide)
import math, json, random

def srgb_to_linear(c):
    c = c/255.0
    if c <= 0.04045:
        return c/12.92
    return ((c+0.055)/1.055)**2.4

def linear_to_srgb(c):
    if c <= 0.0031308:
        v = 12.92*c
    else:
        v = 1.055*(c**(1/2.4)) - 0.055
    return int(max(0,min(255, round(v*255))))

def rgb_to_oklab(r,g,b):
    rl, gl, bl = srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b)
    l = 0.4122214708*rl + 0.5363325363*gl + 0.0514459929*bl
    m = 0.2119034982*rl + 0.6806995451*gl + 0.1073969566*bl
    s = 0.0883024619*rl + 0.2817188376*gl + 0.6299787005*bl
    l_, m_, s_ = l**(1/3), m**(1/3), s**(1/3)
    L = 0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_
    a = 1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_
    b = 0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_
    return L,a,b

def oklab_to_rgb(L,a,b):
    l_ = L + 0.3963377774*a + 0.2158037573*b
    m_ = L - 0.1055613458*a - 0.0638541728*b
    s_ = L - 0.0894841775*a - 1.2914855480*b
    l = l_**3; m = m_**3; s = s_**3
    rl = +4.0767416621*l - 3.3077115913*m + 0.2309699292*s
    gl = -1.2684380046*l + 2.6097574011*m - 0.3413193965*s
    bl = -0.0041960863*l - 0.7034186147*m + 1.7076147010*s
    r = linear_to_srgb(rl); g = linear_to_srgb(gl); b = linear_to_srgb(bl)
    return [r,g,b]

def oklab_to_oklch(L,a,b):
    C = math.sqrt(a*a+b*b)
    h = (math.degrees(math.atan2(b,a)) + 360) % 360
    return L,C,h

def oklch_to_oklab(L,C,h):
    hr = math.radians(h)
    return L, C*math.cos(hr), C*math.sin(hr)

def rgb_to_oklch(rgb):
    L,a,b = rgb_to_oklab(*rgb)
    return [L, math.sqrt(a*a+b*b), (math.degrees(math.atan2(b,a))+360)%360]

def oklch_to_rgb(L,C,h):
    L,a,b = oklch_to_oklab(L,C,h)
    return oklab_to_rgb(L,a,b)

def extract_palette(width, height, k, iters, flat_rgba):
    pixels = []
    stride = 4*8
    for i in range(0, len(flat_rgba), stride):
        a = flat_rgba[i+3]
        if a < 16: continue
        pixels.append([flat_rgba[i], flat_rgba[i+1], flat_rgba[i+2]])
    if not pixels:
        return [[0,0,0]]
    centroids = [pixels[int(random.random()*len(pixels))][:] for _ in range(k)]
    assign = [0]*len(pixels)
    def dist2(p,c): 
        dr=p[0]-c[0]; dg=p[1]-c[1]; db=p[2]-c[2]; 
        return dr*dr+dg*dg+db*db
    for _ in range(iters):
        for i,p in enumerate(pixels):
            best,bd=0,1e12
            for ci,c in enumerate(centroids):
                d=dist2(p,c)
                if d<bd: best,bd=ci,d
            assign[i]=best
        sums=[[0,0,0,0] for _ in range(k)]
        for p,cidx in zip(pixels, assign):
            sums[cidx][0]+=p[0]; sums[cidx][1]+=p[1]; sums[cidx][2]+=p[2]; sums[cidx][3]+=1
        for ci in range(k):
            n=sums[ci][3] or 1
            centroids[ci]=[int(sums[ci][0]/n), int(sums[ci][1]/n), int(sums[ci][2]/n)]
    counts=[0]*k
    for a in assign: counts[a]+=1
    ranked = sorted(range(k), key=lambda i: counts[i], reverse=True)
    return [centroids[i] for i in ranked]

_XKCD = {
    "OCEAN BLUE":"#03719C","MINT":"#9FFFCB","SALMON":"#FF796C","MIDNIGHT BLUE":"#01153E",
    "LAVENDER":"#C79FEF","FOREST GREEN":"#06470C","GOLD":"#F2C14E","CHARCOAL":"#30343F",
    "BLUSH":"#F29CA3","TEAL":"#008E9B","SAND":"#ECDCB0","BRICK":"#B0413E","IVORY":"#FFF4E0",
    "SKY":"#7EC8E3","PLUM":"#6B3A75","OLIVE":"#808000","CORAL":"#FF6F61","COBALT":"#224C98"
}

def hex_to_rgb(h):
    h=h.lstrip('#')
    return [int(h[0:2],16),int(h[2:4],16),int(h[4:6],16)]

def dist_oklab(rgb1,rgb2):
    L1,a1,b1 = rgb_to_oklab(*rgb1)
    L2,a2,b2 = rgb_to_oklab(*rgb2)
    return (L1-L2)**2 + (a1-a2)**2 + (b1-b2)**2

def color_names(palette):
    names=[]
    for rgb in palette:
        best,bname=1e9,None
        for name, hx in _XKCD.items():
            d = dist_oklab(rgb, hex_to_rgb(hx))
            if d<best: best,bname=d,name
        names.append(bname.title())
    return names

def mood_for_palette(palette):
    oklchs=[rgb_to_oklch(p) for p in palette]
    Lavg = sum(L for L,_,_ in oklchs)/len(oklchs)
    Cavg = sum(C for _,C,_ in oklchs)/len(oklchs)
    warms = sum(1 for _,_,h in oklchs if 0<=h<=60 or 300<=h<=360)
    cools = len(oklchs)-warms
    if Cavg>0.12 and warms>cools: mood="Energica e calda"
    elif Cavg>0.12 and cools>=warms: mood="Vivace e moderna"
    elif Lavg>0.75: mood="Luminosa e pulita"
    elif Lavg<0.35: mood="Profonda e sofisticata"
    else: mood="Equilibrata e minimale"
    return mood

def smart_sort(palette):
    oklchs=[rgb_to_oklch(p) for p in palette]
    idxs=sorted(range(len(palette)), key=lambda i: (oklchs[i][2], oklchs[i][0]))
    return [palette[i] for i in idxs]

def clamp01(x): return 0 if x<0 else 1 if x>1 else x

def harmony_from_hex(hx, n=5):
    rgb = hex_to_rgb(hx)
    L,C,h = rgb_to_oklch(rgb)
    cols=[]
    hs = [(h)%360, (h+180)%360, (h+30)%360, (h-30)%360, (h+210)%360]
    for hh in hs[:n]:
        cols.append(oklch_to_rgb(L, max(0.04, C), hh))
    return cols

def ensure_contrast(fg, bg, target=0.5):
    Lf,Cf,hf = rgb_to_oklch(fg)
    Lb,_,_ = rgb_to_oklch(bg)
    if abs(Lf-Lb) >= target: return fg
    if Lb >= 0.5: Lf = max(0.0, Lb - target)
    else: Lf = min(1.0, Lb + target)
    return oklch_to_rgb(Lf, Cf, hf)

def build_theme(palette):
    pal = palette[:]
    if not pal: pal=[[124,92,255]]
    bg = [18,18,18]
    text = ensure_contrast([235,235,235], bg, 0.4)
    primary = pal[0]
    secondary = pal[1] if len(pal)>1 else [60,60,60]
    danger = [215,75,100]
    on_primary = ensure_contrast([255,255,255], primary, 0.45)
    on_secondary = ensure_contrast([255,255,255], secondary, 0.45)
    vars = {
        "surface": rgb_to_hex(bg),
        "text": rgb_to_hex(text),
        "primary": rgb_to_hex(primary),
        "on-primary": rgb_to_hex(on_primary),
        "secondary": rgb_to_hex(secondary),
        "on-secondary": rgb_to_hex(on_secondary),
        "danger": rgb_to_hex(danger),
        "on-danger": "#FFFFFF"
    }
    return {"variables": vars}

def rgb_to_hex(rgb):
    return "#%02X%02X%02X" % tuple(rgb)

def mix_hex(hx1, hx2, steps=5):
    a = hex_to_rgb(hx1); b = hex_to_rgb(hx2)
    L1,C1,h1 = rgb_to_oklch(a); L2,C2,h2 = rgb_to_oklch(b)
    res=[]
    for i in range(steps):
        t = i/(steps-1) if steps>1 else 0
        dh = ((h2-h1+540)%360)-180
        L = (1-t)*L1 + t*L2
        C = (1-t)*C1 + t*C2
        h = (h1 + t*dh) % 360
        res.append(oklch_to_rgb(L,C,h))
    return res

def palette_meta(palette):
    return {"names": color_names(palette), "mood": mood_for_palette(palette)}

def story_meta(palette):
    names = color_names(palette)
    mood = mood_for_palette(palette)
    title = names[0] if names else "Palette"
    return {"title": title, "mood": mood, "names": names}

_BRANDS = {
    "Coca-Cola":"#F40009",
    "Spotify":"#1DB954",
    "Twitter":"#1DA1F2",
    "IKEA":"#0058A3",
    "McDonald’s":"#FFC72C",
    "Starbucks":"#00754A",
    "Figma":"#F24E1E",
    "Netflix":"#E50914",
    "Pepsi":"#004B93",
    "Twitch":"#9146FF"
}

def nearest_brand(rgb):
    best=("N/A","#000000",1e9)
    for name,hx in _BRANDS.items():
        r2 = hex_to_rgb(hx)
        d = dist_oklab(rgb, r2)
        if d<best[2]:
            best=(name,hx,d)
    return {"brand": best[0], "hex": best[1]}

def brand_matches(palette):
    res=[]
    for rgb in palette:
        m = nearest_brand(rgb)
        res.append({"input": rgb, "brand": m["brand"], "hex": m["hex"]})
    return res
