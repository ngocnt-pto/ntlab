"""Build the one-page Vietnamese keyboard/Telex printable. Requires ReportLab."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4

ROOT = Path(__file__).resolve().parents[1]
pdfmetrics.registerFont(TTFont('ArialVN', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialVNBold', 'C:/Windows/Fonts/arialbd.ttf'))
out = ROOT / 'assets' / 'huong-dan-go-may.pdf'
c = canvas.Canvas(str(out), pagesize=A4)
c.setTitle('Gõ Mây - Bảng Telex và sơ đồ 10 ngón')
c.setAuthor('Gõ Mây')
INK, BLUE, MUTED = '#172e57', '#2458d3', '#536987'
def text(x,y,value,size=10,color=INK,bold=False):
    c.setFont('ArialVNBold' if bold else 'ArialVN',size)
    c.setFillColor(HexColor(color)); c.drawString(x,y,value)
def box(x,y,w,h,fill,line='#d3ddec',radius=6):
    c.setFillColor(HexColor(fill)); c.setStrokeColor(HexColor(line))
    c.roundRect(x,y,w,h,radius,fill=1,stroke=1)

text(38,795,'GÕ MÂY / BẢNG NHỚ NHANH',9,BLUE,True)
text(38,757,'Đúng ngón. Đúng dấu. Tự tin gõ.',25,INK,True)
text(38,730,'In một tờ, đặt cạnh máy. Mỗi ngày luyện một chút, ưu tiên chính xác.',10,MUTED)
text(38,695,'01  BÀN PHÍM CÓ MỘT BẢN ĐỒ',10,BLUE,True)
colors = ['#fbe5e6','#fff0cb','#dff1e4','#dcecff','#ebe3fb']
groups = ['1qaz`0p;/\'[]\\-=','2wsx9ol.','3edc8ik,','45rtfgvb67yuhjnm',' ']
rows = [list('`1234567890-=')+['Xóa'],['Tab']+list('qwertyuiop[]')+['\\'],['Caps']+list("asdfghjkl;'")+['Enter'],['Shift']+list('zxcvbnm,./')+['Shift'],['Ctrl','Alt','Dấu cách','Alt','Ctrl']]
weights = [[1]*13+[1.7],[1.4]+[1]*12+[1.3],[1.7]+[1]*11+[2],[2.2]+[1]*10+[2.5],[1.5,1.5,8.2,1.5,1.5]]
for index,(row,ws) in enumerate(zip(rows,weights)):
    y=657-index*30; unit=(519-3*(len(row)-1))/sum(ws); x=38
    for label,weight in zip(row,ws):
        w=unit*weight; lower=' ' if label=='Dấu cách' else label
        group=next((i for i,letters in enumerate(groups) if lower in letters and len(lower)==1),None)
        box(x,y,w,25,colors[group] if group is not None else '#f0f4fa',radius=4)
        size=9 if len(label)==1 else 7
        c.setFont('ArialVNBold' if lower in ('f','j') else 'ArialVN',size)
        c.setFillColor(HexColor(INK)); c.drawCentredString(x+w/2,y+9,label.upper() if len(label)==1 else label)
        if lower in ('f','j'):
            c.setStrokeColor(HexColor(INK)); c.line(x+w/2-3,y+5,x+w/2+3,y+5)
        x+=w+3
for index,name in enumerate(['Ngón út','Áp út','Ngón giữa','Ngón trỏ','Ngón cái']):
    x=44+index*104; box(x,510,7,7,colors[index],radius=2); text(x+13,510,name,8,MUTED)
text(38,480,'Vị trí nghỉ: A S D F / J K L ;. Hai ngón trỏ tìm gờ nổi F và J.',10,INK,True)
text(38,461,'Gõ xong, đưa ngón về hàng cơ sở. Dấu cách dùng ngón cái.',9,MUTED)

text(38,424,'02  PHÂN CÔNG TỪNG NGÓN',10,BLUE,True)
box(38,384,519,23,'#edf3ff',radius=4)
text(50,392,'NGÓN',8,BLUE,True); text(204,392,'TAY TRÁI',8,BLUE,True); text(386,392,'TAY PHẢI',8,BLUE,True)
for index,(finger,left,right) in enumerate([('Ngón út','Q A Z','P ; /'),('Áp út','W S X','O L .'),('Ngón giữa','E D C','I K ,'),('Ngón trỏ','R T F G V B','Y U H J N M')]):
    y=364-index*23; text(50,y,finger,9); text(204,y,left,9); text(386,y,right,9)
text(38,263,'Chữ hoa: giữ Shift bằng ngón út tay đối diện với tay gõ chữ.',9,MUTED)

text(38,230,'03  TELEX: GHÉP CHỮ VÀ THÊM DẤU',10,BLUE,True)
items=[('aa','â'),('aw','ă'),('ee','ê'),('oo','ô'),('ow','ơ'),('uw','ư'),('dd','đ'),('s','sắc: á'),('f','huyền: à'),('r','hỏi: ả'),('x','ngã: ã'),('j','nặng: ạ')]
for index,(keys,result) in enumerate(items):
    x=38+(index%4)*132; y=181-(index//4)*33
    box(x,y,123,26,'#f3f6fc'); text(x+10,y+9,keys,10,BLUE,True); text(x+47,y+9,result,10)
text(38,82,'Ví dụ: dda = đa   /   laf = là   /   khas = khá   /   gox = gõ',10,INK,True)
text(38,62,'Bài văn bản: bật bộ gõ Unicode trên máy. Thêm dấu xong, nhấn cách để chốt từ.',8,MUTED)
text(38,29,'Gõ Mây - Tài liệu luyện tập cá nhân / Bố cục QWERTY thường dùng',7,MUTED)
c.showPage(); c.save()
print(out)
