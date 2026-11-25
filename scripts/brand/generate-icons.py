"""Wolfari glyphs: 24-unit grid, three stacked layers so a tint never floods the artwork.
line  = ink strokes and ink details (takes the tint)
fill  = soft brand tints (takes the tint at low opacity)
spark = the compass-star accent (stays gold unless asked otherwise)"""
import os, sys, re
# Every colour is a token from src/shared/theme/foundation.json:
# ink, tealSoft, mint, sun, peach, route, ice, surface.
INK="#1F2A44"; SKY="#DCE9FF"; MINT="#D6F5E8"; SUN="#F6C445"; PEACH="#FFE0D4"; ROUTE="#12868B"; ICE="#E5F3FA"; WHITE="#FFFFFF"
def starpath(cx,cy,r):
    k=0.16*r
    return (f"M{cx:.2f} {cy-r:.2f}Q{cx+k:.2f} {cy-k:.2f} {cx+r:.2f} {cy:.2f}Q{cx+k:.2f} {cy+k:.2f} {cx:.2f} {cy+r:.2f}"
            f"Q{cx-k:.2f} {cy+k:.2f} {cx-r:.2f} {cy:.2f}Q{cx-k:.2f} {cy-k:.2f} {cx:.2f} {cy-r:.2f}Z")
# element: (layer, markup)
def L(m): return [("line",m)]
def F(tag, color, extra=""):  # filled shape outlined in ink -> fill layer + line layer
    return [("fill",f'<{tag} fill="{color}" stroke="none"{extra}/>'),("line",f'<{tag}{extra}/>')]
def Fonly(tag,color): return [("fill",f'<{tag} fill="{color}" stroke="none"/>')]
def S(cx,cy,r,outline=True,sw=1.0,dot=False,color=SUN):
    d=starpath(cx,cy,r); out=[("spark",f'<path d="{d}" fill="{color}" stroke="none"/>')]
    # The outline travels with the star, so the star can pop as one piece.
    if outline: out=[("spark",f'<path d="{d}" fill="{color}" stroke="{INK}" stroke-width="{sw}"/>')]
    if dot: out.append(("spark",f'<circle cx="{cx}" cy="{cy}" r="{r*0.2:.2f}" fill="{INK}" stroke="none"/>'))
    return out
def dot(cx,cy,r): return L(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{INK}" stroke="none"/>')
HEAD="M4.8 3.4L9.2 7.2Q12 6.4 14.8 7.2L19.2 3.4Q20.6 8 19.6 11.6L21 13L18.2 14Q16.2 19.8 12 20.8Q7.8 19.8 5.8 14L3 13L4.4 11.6Q3.4 8 4.8 3.4Z"
def wolf(fill=SKY, ears=True):
    e=Fonly(f'path d="{HEAD}"',fill)+Fonly('path d="M7 13.9Q12 12.2 17 13.9Q15.6 18.9 12 19.7Q8.4 18.9 7 13.9Z"',WHITE)
    if ears: e+=Fonly('path d="M6 6.1L8.1 8.1L6.4 9.9Z"',PEACH)+Fonly('path d="M18 6.1L15.9 8.1L17.6 9.9Z"',PEACH)
    e+=L(f'<path d="{HEAD}"/>')+L('<path d="M10.9 6.9q.1-1.9 2.1-2.2-.9.8-.5 2"/>')
    e+=dot(9.3,11.5,1.05)+dot(14.7,11.5,1.05)+L(f'<path d="M10.9 14.5h2.2L12 15.7Z" fill="{INK}" stroke-width="1.1"/>')
    return e
def group(elems, transform, sw):
    out={}
    for layer,m in elems: out.setdefault(layer,[]).append(m)
    return [(k,f'<g transform="{transform}" stroke-width="{sw}">{"".join(v)}</g>') for k,v in out.items()]
I={}
I["archive"]=F('rect x="3" y="4" width="18" height="5" rx="1.6"',MINT)+L('<path d="M4.6 9v8.6A2.4 2.4 0 0 0 7 20h10a2.4 2.4 0 0 0 2.4-2.4V9"/><path d="M10 13h4"/>')
I["arrow"]=L('<path d="M4 12h15"/><path d="m13.5 6.5 5.5 5.5-5.5 5.5"/>')
I["back"]=L('<path d="m15 5-7 7 7 7"/>')
I["bag"]=(L('<path d="M9 6V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8V6"/><rect x="4.5" y="6" width="15" height="15" rx="4.5"/>')
          +F('path d="M5.4 9.2Q12 7.4 18.6 9.2L12 14.4Z"',SKY)+S(12,14.6,2.4,outline=True)
          +L('<path d="M9 21v-2.6A1.6 1.6 0 0 1 10.6 16.8h2.8A1.6 1.6 0 0 1 15 18.4V21"/>'))
I["bell"]=F('path d="M5.8 16.6V11a6.2 6.2 0 0 1 12.4 0v5.6l1.5 1.7H4.3Z"',SKY)+L('<path d="M10 20.8a2.4 2.4 0 0 0 4 0"/>')+S(19.6,4.4,2.6)
I["calendar"]=(F('path d="M7.4 6.2 8.6 2.9 10.2 6.2Z"',PEACH)+F('path d="M13.8 6.2 15.4 2.9 16.6 6.2Z"',PEACH)
          +Fonly('path d="M3.5 10.6V9.7A3.5 3.5 0 0 1 7 6.2h10a3.5 3.5 0 0 1 3.5 3.5v.9Z"',MINT)
          +L('<rect x="3.5" y="6.2" width="17" height="14.8" rx="3.5"/><path d="M3.5 10.6h17"/>')+S(12,15.8,3.2,outline=True))
I["check"]=L('<path d="m5 12.5 4.5 4.5L19 7.5"/>')
I["chevron"]=L('<path d="m9 5 7 7-7 7"/>')
I["clock"]=L('<circle cx="12" cy="12" r="9.2"/><path d="M12 7v5.2l3.2 2.1"/>')
I["close"]=L('<path d="M6 6l12 12M18 6 6 18"/>')
I["compass"]=Fonly('circle cx="12" cy="12" r="9.4"',SKY)+L('<circle cx="12" cy="12" r="9.4"/>')+S(12,12,6.4,outline=True,sw=1.4,dot=True)
I["copy"]=L('<path d="M15.8 8V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7.3A2.5 2.5 0 0 0 6 15.8h2"/>')+F('rect x="8" y="8" width="12.5" height="12.5" rx="3"',SKY)
I["edit"]=F('path d="M4 20l1-4.6L15.6 4.8a2 2 0 0 1 2.8 0l.8.8a2 2 0 0 1 0 2.8L8.6 19Z"',MINT)+L('<path d="m13.8 6.6 3.6 3.6"/><path d="M13.5 20H20"/>')
EYE="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
I["eye"]=L(f'<path d="{EYE}"/>')+F('circle cx="12" cy="12" r="3.3"',SKY)+L(f'<path d="{starpath(12,12,1.7)}" fill="{INK}" stroke="none"/>')
I["eye-off"]=L(f'<path d="{EYE}"/>')+F('circle cx="12" cy="12" r="3.3"',SKY)+L('<path d="M4 3.5 20 20.5"/>')
I["file"]=L('<path d="M14 3H8a2.5 2.5 0 0 0-2.5 2.5v13A2.5 2.5 0 0 0 8 21h8a2.5 2.5 0 0 0 2.5-2.5V7.5Z"/>')+F('path d="M14 3v4.5h4.5Z"',PEACH)+L('<path d="M9 12.5h6M9 16h4"/>')
I["filter"]=L('<path d="M4 7h5.6M14.4 7H20M4 17h8.6M17.4 17H20"/>')+F('circle cx="12" cy="7" r="2.4"',SUN)+F('circle cx="15" cy="17" r="2.4"',MINT)
I["gear"]=L('<path d="M12 2.8l1.7 2.3 2.8-.6.6 2.8 2.5 1.4-1.1 2.6 1.1 2.6-2.5 1.4-.6 2.8-2.8-.6L12 21.2l-1.7-2.3-2.8.6-.6-2.8-2.5-1.4 1.1-2.6-1.1-2.6 2.5-1.4.6-2.8 2.8.6Z"/>')+F('circle cx="12" cy="12" r="3.1"',SKY)
I["link"]=L('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>')
I["lock"]=L('<path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>')+F('rect x="4.5" y="10" width="15" height="11" rx="3.2"',MINT)+dot(12,14.6,1.3)+L('<path d="M12 15.6v2"/>')
I["mail"]=Fonly('path d="M4.2 6.2 12 12.6l7.8-6.4Z"',SKY)+L('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.8 7 12 12.8 20.2 7"/>')+S(12,13,2.7,outline=True)
I["map"]=(Fonly('path d="m3 6 5.7-2.3 6.5 2.6L21 4v14l-5.8 2.3-6.5-2.6L3 20Z"',ICE)+L('<path d="m3 6 5.7-2.3 6.5 2.6L21 4v14l-5.8 2.3-6.5-2.6L3 20Z"/>')
          +L(f'<path d="M6 16.4c2-.8 2.6-3.6 5.4-3.8 2.4-.2 3.4-1.8 4.6-3.6" stroke="{ROUTE}" stroke-width="1.7" stroke-dasharray="0.1 2.6"/>')+S(17,7.4,2.5,outline=True,sw=1))
I["pin"]=F('path d="M12 21.2s-6.8-6.1-6.8-11.4a6.8 6.8 0 0 1 13.6 0c0 5.3-6.8 11.4-6.8 11.4Z"',SKY)+S(12,9.8,3.6,outline=True)
I["plane"]=F('path d="M3.5 13.5 7 12l2.2-5.6 1.9-.8.3 5.2 5-2.2c1.6-.7 3.5-.6 4.1.8.4 1-.3 2-1.9 2.7L6 17.6Z"',SKY)+L('<path d="M3.5 20.5h17"/>')
I["plus"]=L('<path d="M12 5v14M5 12h14"/>')
I["search"]=F('circle cx="10.8" cy="10.8" r="6.8"',SKY)+L('<path d="m16 16 4.5 4.5"/>')+S(9.2,9.2,2.6)
I["shirt"]=L('<path d="M8.6 3.5 3.5 6.2l1.8 4.3 2.2-.9v10.9h9V9.6l2.2.9 1.8-4.3-5.1-2.7"/>')+F('path d="M8.6 3.5Q12 5.4 15.4 3.5L12 9.6Z"',SKY)+S(12,9.9,2.1,outline=True,sw=1)
I["swap"]=L('<path d="M4 8h14.5"/><path d="m15 4.5 3.5 3.5-3.5 3.5"/><path d="M20 16H5.5"/><path d="m9 12.5-3.5 3.5 3.5 3.5"/>')
I["trip"]=(L('<path d="M9 7V5.2A1.7 1.7 0 0 1 10.7 3.5h2.6A1.7 1.7 0 0 1 15 5.2V7"/><rect x="3.5" y="7" width="17" height="13.5" rx="3.2"/><path d="M3.5 11h17"/>')
           +F('path d="M9.2 11h5.6L12 15.6Z"',SKY)+S(12,15.9,2.1,outline=True,sw=1))
I["user"]=wolf()
I["users"]=group(wolf(fill=MINT,ears=False),"translate(9 3.6) scale(.62)",2.9)+group(Fonly(f'path d="{HEAD}"',WHITE)+wolf(),"translate(-.4 5.8) scale(.74)",2.55)
I["wallet"]=L('<path d="M5 6.5 15.8 3.6a1.8 1.8 0 0 1 2.2 1.7v1.2"/><rect x="3" y="6.5" width="18" height="14" rx="3.2"/>')+F('path d="M21 11h-4a2.7 2.7 0 0 0 0 5.4h4Z"',MINT)+S(17.2,13.7,2,outline=False)

# ---- Status glyphs: a base object plus a small status badge in the bottom-right corner.
# The badge lives in the spark layer, so it keeps its colour (green / red / amber / teal)
# whenever the icon is tinted, and sits on top of the strokes.
OK_C=("#D6F5E8","#23784F"); FAIL_C=("#FDECE7","#C2361F"); WAIT_C=("#FFF0C2","#B7791F"); ADD_C=("#DCE9FF","#245CB8")
MARKS={"ok":"m15.9 18.1 1.5 1.5 2.8-3","fail":"M16.4 16.4l3.2 3.2M19.6 16.4l-3.2 3.2","wait":"M18 15.7V18l1.5 1","add":"M18 15.6v4.8M15.6 18h4.8"}
def badge(kind):
    bg,fg={"ok":OK_C,"fail":FAIL_C,"wait":WAIT_C,"add":ADD_C}[kind]
    return [("spark",f'<circle cx="18" cy="18" r="4.9" fill="{bg}" stroke="{INK}" stroke-width="1.3"/>'),
            ("spark",f'<path d="{MARKS[kind]}" fill="none" stroke="{fg}" stroke-width="1.7"/>')]
DISK="M5.5 3.5h9.4l3.6 3.6v11.4a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"
def disk(): return F(f'path d="{DISK}"',SKY)+L('<path d="M7.5 3.5v4h6v-4"/><path d="M7 20.5V15h7v5.5"/>')
CLOUD="M7 18.5h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5-.6A4.3 4.3 0 0 0 7 18.5Z"
def cloud(): return F(f'path d="{CLOUD}"',SKY)
RECEIPT="M5.5 3.5h13v17l-2.2-1.4-2.2 1.4-2.1-1.4-2.2 1.4-2.1-1.4-2.2 1.4Z"
def receipt(): return F(f'path d="{RECEIPT}"',MINT)+L('<path d="M8.5 8h7M8.5 11.5h5"/>')
BELL=F('path d="M5.8 16.6V11a6.2 6.2 0 0 1 12.4 0v5.6l1.5 1.7H4.3Z"',SKY)+L('<path d="M10 20.8a2.4 2.4 0 0 0 4 0"/>')
I["save-ok"]=disk()+badge("ok")
I["save-fail"]=disk()+badge("fail")
I["sync"]=L('<path d="M19.5 12a7.5 7.5 0 0 1-13 5.1"/><path d="M4.5 12a7.5 7.5 0 0 1 13-5.1"/><path d="M17.8 3.4v3.8H14"/><path d="M6.2 20.6v-3.8H10"/>')+S(12,12,3.4)
I["cloud-ok"]=cloud()+badge("ok")
I["offline"]=cloud()+L('<path d="M3.5 3.5l17 17"/>')
I["upload-fail"]=cloud()+L('<path d="M11 16.5V11m-2.3 2.2L11 10.9l2.3 2.3"/>')+badge("fail")
I["sent"]=F('path d="M20.5 3.5 3.5 10.6l6.6 2.8 2.8 6.6Z"',SKY)+L('<path d="M20.5 3.5 10.1 13.4"/>')+badge("ok")
I["copied"]=L('<path d="M15 7.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v6.5A2.5 2.5 0 0 0 6 15h1.5"/>')+F('rect x="7.5" y="7.5" width="11" height="11" rx="2.5"',SKY)+badge("ok")
I["deleted"]=L('<path d="M4 6.5h16"/><path d="M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7"/>')+F('path d="M6 6.5l.9 12.2a2 2 0 0 0 2 1.8h6.2a2 2 0 0 0 2-1.8L18 6.5Z"',PEACH)+L('<path d="M10 10.5v6M14 10.5v4"/>')+badge("ok")
I["pay-ok"]=receipt()+badge("ok")
I["pay-fail"]=receipt()+badge("fail")
I["pay-pending"]=receipt()+badge("wait")
I["invite"]=group(wolf(),"translate(-1 -1) scale(.8)",2.38)+badge("add")
I["reminder-ok"]=BELL+badge("ok")
I["denied"]=F('path d="M12 3.2 19 6v5.4c0 4.6-3 7.7-7 9.4-4-1.7-7-4.8-7-9.4V6Z"',SKY)+badge("fail")
I["empty"]=F('path d="M4 10.5h16v7.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18Z"',PEACH)+L('<path d="M4 10.5 6.5 6.5h11l2.5 4"/><path d="M9.5 14.5h5"/>')+S(12,3.6,2.3)

I["wolf"]=wolf()
I["star"]=S(12,12,10,outline=True,sw=1.2,dot=True)

# ---- More base glyphs (replace the generic clay set in forms, cards and popups).
I["camera"]=L('<path d="M8.3 6.5 9.6 4.4h4.8l1.3 2.1"/>')+F('rect x="3" y="6.5" width="18" height="13.5" rx="3.4"',PEACH)+F('circle cx="12" cy="13.2" r="3.6"',SKY)+S(12,13.2,1.6,outline=False)
I["car"]=(F('path d="M4 17.5v-4.2l1.9-4.6A2.4 2.4 0 0 1 8.1 7.2h7.8a2.4 2.4 0 0 1 2.2 1.5l1.9 4.6v4.2Z"',SKY)
          +L('<path d="M4 13.3h16"/>')+F('circle cx="7.8" cy="17.6" r="2"',WHITE)+F('circle cx="16.2" cy="17.6" r="2"',WHITE)+S(12,10.3,1.7,outline=False))
I["cup"]=F('path d="M4.5 9h12v6.5a4.5 4.5 0 0 1-4.5 4.5H9a4.5 4.5 0 0 1-4.5-4.5Z"',PEACH)+L('<path d="M16.5 10.5h1.2a2.6 2.6 0 0 1 0 5.2h-1.4"/><path d="M8 3.5v2.5M11 3.5v2.5M14 3.5v2.5"/>')
I["chevron-down"]=L('<path d="m5 9 7 7 7-7"/>')
I["phone"]=F('rect x="6" y="2.8" width="12" height="18.4" rx="3"',ICE)+L('<path d="M10.5 18h3"/>')+S(12,10.6,2.6)
I["heart"]=F('path d="M12 20.2s-8.2-4.8-8.2-10.5A4.2 4.2 0 0 1 12 7.8a4.2 4.2 0 0 1 8.2 1.9c0 5.7-8.2 10.5-8.2 10.5Z"',PEACH)+S(16.4,8.2,1.8,outline=False)
I["info"]=F('circle cx="12" cy="12" r="9.2"',SKY)+L('<path d="M12 11v6"/>')+dot(12,7.6,1.3)
I["locate"]=F('path d="M20.5 3.5 3.6 10.6l7.2 2.6 2.6 7.2Z"',SKY)+S(10.8,13.2,2,outline=True,sw=.9)
I["more"]=dot(5.5,12,1.6)+dot(12,12,1.6)+dot(18.5,12,1.6)
I["trend-down"]=L('<path d="m3 7 6.5 6.5 4-4L21 17"/><path d="M21 11.5V17h-5.5"/>')+S(9.5,13.5,2,outline=True,sw=.9)
I["tag"]=F('path d="M3.5 4.6v6.2a2 2 0 0 0 .6 1.4l8.4 8.4a2 2 0 0 0 2.8 0l5.6-5.6a2 2 0 0 0 0-2.8L12.5 3.8a2 2 0 0 0-1.4-.6H4.9a1.4 1.4 0 0 0-1.4 1.4Z"',MINT)+S(8.3,8.1,2,outline=True,sw=.9)
I["sign-out"]=L('<path d="M10 20.5H6.5a3 3 0 0 1-3-3v-11a3 3 0 0 1 3-3H10"/><path d="M9.5 12H21"/><path d="m17 8 4 4-4 4"/>')+Fonly('path d="M6.5 5.5h2v13h-2a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"',SKY)
I["sun"]=F('circle cx="12" cy="12" r="4.2"',PEACH)+L('<path d="M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.5 5.5l1.6 1.6M16.9 16.9l1.6 1.6M18.5 5.5l-1.6 1.6M7.1 16.9l-1.6 1.6"/>')+S(12,12,1.8,outline=False)
I["ticket"]=F('path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v2.2a2.4 2.4 0 0 0 0 4.6v2.2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-2.2a2.4 2.4 0 0 0 0-4.6Z"',SUN.replace("#F6C445","#FFF0C2"))+L('<path d="M15 6v2M15 11v2M15 16v2"/>')+S(9,12,2.3,outline=True,sw=.9)
I["trash"]=L('<path d="M3.5 6.5h17"/><path d="M9 6.5V4.8A1.6 1.6 0 0 1 10.6 3.2h2.8A1.6 1.6 0 0 1 15 4.8v1.7"/>')+F('path d="M5.5 6.5h13l-1 12.2a2.4 2.4 0 0 1-2.4 2.3H8.9a2.4 2.4 0 0 1-2.4-2.3Z"',PEACH)+L('<path d="M10 10.5v6.5M14 10.5v6.5"/>')

# ---- Wolfi glyphs: the head from wolf() with expressions, objects and accessories.
# Colour rules: the line layer stays monochrome ink; colours live in fill (soft) or spark (stars, tears).
BLUE="#5B8CFF"
def wolfx(eyes="dot", mouth=None, fill=SKY, ears=True, tuft=True, brows=None):
    e=Fonly(f'path d="{HEAD}"',fill)+Fonly('path d="M7 13.9Q12 12.2 17 13.9Q15.6 18.9 12 19.7Q8.4 18.9 7 13.9Z"',WHITE)
    if ears: e+=Fonly('path d="M6 6.1L8.1 8.1L6.4 9.9Z"',PEACH)+Fonly('path d="M18 6.1L15.9 8.1L17.6 9.9Z"',PEACH)
    e+=L(f'<path d="{HEAD}"/>')
    if tuft: e+=L('<path d="M10.9 6.9q.1-1.9 2.1-2.2-.9.8-.5 2"/>')
    arc=lambda x: f'<path d="M{x-1.25:.2f} 12.1q1.25-1.6 2.5 0" stroke-width="1.5"/>'
    shut=lambda x: f'<path d="M{x-1.2:.2f} 11.4q1.2 1 2.4 0" stroke-width="1.5"/>'
    for i,x in enumerate((9.3,14.7)):
        k=eyes if isinstance(eyes,str) else eyes[i]
        if k=="dot": e+=dot(x,11.5,1.05)
        elif k=="happy": e+=L(arc(x))
        elif k=="shut": e+=L(shut(x))
        elif k=="wide": e+=Fonly(f'circle cx="{x}" cy="11.4" r="1.7"',WHITE)+L(f'<circle cx="{x}" cy="11.4" r="1.7" stroke-width="1.2"/>')+dot(x,11.6,.8)
        elif k=="star": e+=S(x,11.3,2.1,outline=True,sw=.8)
    if brows=="sad": e+=L('<path d="M7.9 10.1 10.3 9.2M16.1 10.1 13.7 9.2" stroke-width="1.3"/>')
    e+=L(f'<path d="M10.9 14.5h2.2L12 15.7Z" fill="{INK}" stroke-width="1.1"/>')
    if mouth=="smile": e+=L('<path d="M10.5 16.7q1.5 1.3 3 0" stroke-width="1.3"/>')
    elif mouth=="open": e+=Fonly('path d="M10.5 16.4h3q-.3 2-1.5 2t-1.5-2Z"',PEACH)+L('<path d="M10.5 16.4h3q-.3 2-1.5 2t-1.5-2Z" stroke-width="1.2"/>')
    elif mouth=="o": e+=Fonly('circle cx="12" cy="17.3" r="1"',PEACH)+L('<circle cx="12" cy="17.3" r="1" stroke-width="1.2"/>')
    elif mouth=="frown": e+=L('<path d="M10.7 17.7q1.3-1.1 2.6 0" stroke-width="1.3"/>')
    return e
def corner(obj, **kw):  # small head top-left, object bottom-right
    return group(wolfx(**kw),"translate(-.6 -.8) scale(.74)",2.57)+obj
W={}
W["wolf-happy"]=wolfx("happy","open")
W["wolf-wink"]=wolfx(("dot","happy"),"smile")
W["wolf-surprised"]=wolfx("wide","o")
W["wolf-sad"]=wolfx("dot","frown",brows="sad")+[("spark",f'<path d="M16.4 13q-1 1.5-.5 2.2.5.5 1 0 .5-.7-.5-2.2Z" fill="{BLUE}" stroke="none"/>')]
W["wolf-starry"]=wolfx("star","open")
W["wolf-sleep"]=group(wolfx("shut","smile"),"translate(.5 3.4) scale(.84)",2.26)+L('<path d="M16.6 2.6h3l-3 3.5h3" stroke-width="1.5"/><path d="M20.5 .9h1.8l-1.8 2h1.8" stroke-width="1.2"/>')
W["wolf-map"]=corner(F('path d="m13 15.2 2.9-1.1 3.3 1.3 3.3-1.2v7.6l-3.3 1.2-3.3-1.3L13 22.8Z"',ICE)+L('<path d="M15.9 14.1v7.6M19.2 15.4v7.6" stroke-width="1.4"/>'))
W["wolf-bag"]=corner(L('<path d="M16.2 14.6v-.9a1.6 1.6 0 0 1 3.2 0v.9"/>')+F('rect x="13.8" y="14.6" width="8" height="8.4" rx="2.4"',SKY)+L('<path d="M15.6 19.4h4.4"/>')+S(17.8,17,1.4,sw=.8))
W["wolf-pin"]=corner(F('path d="M18 23s-4.2-3.7-4.2-6.9a4.2 4.2 0 0 1 8.4 0C22.2 19.3 18 23 18 23Z"',SKY)+S(18,16.2,2,sw=.9))
W["wolf-camera"]=corner(L('<path d="M15.6 15.2l.9-1.5h2.6l.9 1.5"/>')+F('rect x="13" y="15.2" width="9.8" height="7.2" rx="2"',PEACH)+F('circle cx="17.9" cy="18.8" r="2"',SKY))
W["wolf-search"]=corner(F('circle cx="17.2" cy="17.2" r="3.8"',SKY)+L('<path d="m20 20 2.6 2.6"/>')+S(17.2,17.2,1.6,sw=.8))
W["wolf-tent"]=corner(F('path d="M12.8 22.6 18 13.6l5.2 9Z"',MINT)+L('<path d="M16.3 22.6 18 18.4l1.7 4.2" stroke-width="1.5"/>'))
W["wolf-fund"]=corner(F('circle cx="17.9" cy="17.9" r="4.7"',MINT)+L('<circle cx="17.9" cy="17.9" r="2.9" stroke-width="1.2"/>')+S(17.9,17.9,1.6,outline=False))
W["wolf-chat"]=corner(F('path d="M14 13.8h7.5a1.6 1.6 0 0 1 1.6 1.6v4.4a1.6 1.6 0 0 1-1.6 1.6h-3.6l-2.9 2.1v-2.1H14a1.6 1.6 0 0 1-1.6-1.6v-4.4A1.6 1.6 0 0 1 14 13.8Z"',SKY)+dot(15.3,17.6,.75)+dot(17.75,17.6,.75)+dot(20.2,17.6,.75))
W["wolf-bell"]=corner(F('path d="M14.4 20.4v-3.6a3.6 3.6 0 0 1 7.2 0v3.6l.9 1H13.5Z"',SKY)+L('<path d="M17 22.9a1.2 1.2 0 0 0 2 0" stroke-width="1.5"/>')+S(22,13.4,1.5,outline=False))
W["wolf-heart"]=corner(F('path d="M18 22.8s-4.8-2.8-4.8-6.1a2.5 2.5 0 0 1 4.8-1 2.5 2.5 0 0 1 4.8 1c0 3.3-4.8 6.1-4.8 6.1Z"',PEACH))
HS="translate(1.44 2.9) scale(.88)"; HSW=2.16
W["wolf-crown"]=group(wolfx("dot","smile",tuft=False),HS,HSW)+F('path d="M8.6 6.9 8 2.6l2.4 1.9L12 1.7l1.6 2.8L16 2.6l-.6 4.3Z"',SKY)+S(12,5.1,1.3,outline=False)
W["wolf-party"]=group(wolfx("happy","open",tuft=False),HS,HSW)+F('path d="M10.2 7.4 13.4 1.7l3 5.1Q13.3 8.1 10.2 7.4Z"',MINT)+L('<path d="M11.6 5.1q1.8.4 3.4-.6" stroke-width="1.2"/>')+S(13.4,1.7,1.4,sw=.8)
W["wolf-cool"]=wolfx("dot","smile")+L(f'<path d="M6.8 10.2h4.6v1.5a2 2 0 0 1-2 2h-.6a2 2 0 0 1-2-2Z" fill="{INK}" stroke-width="1"/><path d="M12.6 10.2h4.6v1.5a2 2 0 0 1-2 2h-.6a2 2 0 0 1-2-2Z" fill="{INK}" stroke-width="1"/><path d="M11.4 10.8h1.2" stroke-width="1.2"/>')
W["wolf-bandana"]=(group(wolfx("dot","smile"),"translate(1.92 .2) scale(.84)",2.26)
    +[("fill",f'<defs><linearGradient id="bd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{BLUE}"/><stop offset="1" stop-color="#3CC9B0"/></linearGradient></defs><path d="M6.3 15.3Q12 18.3 17.7 15.3L12 22.8Z" fill="url(#bd)" stroke="none"/>')]
    +L('<path d="M6.3 15.3Q12 18.3 17.7 15.3L12 22.8Z" stroke-width="1.6"/>')+S(14.4,17.6,2.2,sw=.9))
W["wolf-pack"]=(group(wolfx(fill=MINT,ears=False,tuft=False),"translate(-.8 .6) scale(.56)",3.4)+group(wolfx(fill=MINT,ears=False,tuft=False),"translate(11.4 .6) scale(.56)",3.4)
    +group(Fonly(f'path d="{HEAD}"',WHITE)+wolfx("happy","smile"),"translate(3.6 6.6) scale(.7)",2.7))
I.update(W)

HDR='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F2A44" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
# Usage: python3 scripts/brand/generate-icons.py assets/brand/icons
out=sys.argv[1]
for sub in ("line","fill","spark"): os.makedirs(f"{out}/{sub}",exist_ok=True)
manifest={}
for k,elems in I.items():
    layers={}
    for layer,m in elems: layers.setdefault(layer,[]).append(m)
    order=["fill","line","spark"]  # spark last: stars and status badges sit on top
    # full colour composite keeps paint order as authored
    open(f"{out}/{k}.svg","w").write(HDR+"".join(m for l in order for m in layers.get(l,[]))+"</svg>\n")
    for layer in order:
        if layer in layers: open(f"{out}/{layer}/{k}.svg","w").write(HDR+"".join(layers[layer])+"</svg>\n")
    manifest[k]=[l for l in order if l in layers]
print(len(I))
