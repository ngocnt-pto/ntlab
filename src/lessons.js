(function(root) {
  const key = (title,text,output) => ({ title,text,output,mode:'keys' });
  const prose = (title,text,officeText) => ({ title,text,officeText,mode:'text' });
  const days = [
    ['Đúng ngón, ra chữ ngay','Một hàng phím, những từ đầu tiên.',[
      key('Một hàng phím, năm từ quen','da ga ha la sa','da · ga · ha · la · sa'),
      key('Tìm điểm tựa cho đôi tay','fj fj dk dk sl sl a; a; asdf jkl;'),
      key('Thử ghép dấu ngay hôm nay','dda laf khas','đa · là · khá')]],
    ['Vươn tay mà không lạc phím','Thêm E, I, R, U; trở về hàng cơ sở.',[
      key('Hai ngón giữa cùng vươn tay','de ki de ki ed ik de ki'),
      key('Ngón trỏ có thêm nhiệm vụ','fr ju fr ju ru ur fur jur'),
      key('Những từ mới dưới tay','ra di re ke la ga','Luyện phối hợp những phím vừa học')]],
    ['Tiếng Việt có dấu, thật gần','Khám phá hàng trên và các chữ có dấu.',[
      key('Mở rộng hàng phím trên','sw lo ft jy aq ;p qwer uiop'),
      key('Một phím nữa, một chữ mới','aa aw ee oo ow uw dd','â · ă · ê · ô · ơ · ư · đ'),
      key('Gõ những từ có dấu','laf gox ddas awn','là · gõ · đá · ăn')]],
    ['Làm chủ cả ba hàng phím','Thêm hàng dưới, nhớ đường đi từng ngón.',[
      key('Tay trái đi xuống','az sx dc fv gb az sx dc fv gb'),
      key('Tay phải cùng phối hợp','hn jm k, l. ;/ hn jm k, l. ;/'),
      key('Đôi tay gặp nhau','ban me con nha vui xinh','Luyện từ chưa dấu trước khi ghép Telex')]],
    ['Viết rõ ràng, đúng dấu câu','Chữ hoa, con số và dấu câu quen thuộc.',[
      key('Phối hợp Shift hai tay','Aa Ss Dd Ff Jj Kk Ll'),
      key('Những con số mỗi ngày','123 456 7890 10 20 30'),
      key('Đặt dấu đúng chỗ','Chao ban, hom nay ban khoe khong?')]],
    ['Telex thành phản xạ','Ghép chữ và đủ năm dấu thanh.',[
      key('Năm dấu, một nhịp gõ','as af ar ax aj','á · à · ả · ã · ạ'),
      key('Từ có dấu dưới đôi tay','mej bof car coor vux','mẹ · bò · cả · cổ · vũ'),
      key('Viết tên tiếng Việt','Tieengs Vieetj thaajt ddepj','Tiếng Việt thật đẹp')]],
    ['Câu tiếng Việt đầu tiên','Bật bộ gõ trên máy và thử câu ngắn.',[
      prose('Bắt đầu một ngày vui','Bé đi học. Mẹ đi làm. Cả nhà đều vui.','Tôi đến văn phòng. Một ngày làm việc mới bắt đầu.'),
      prose('Gõ chậm, giữ nhịp đều','Em tập gõ mỗi ngày. Chậm thôi, rồi sẽ quen.','Tôi gõ chậm để đúng hơn. Từng chút một, tay sẽ quen.'),
      prose('Nhìn câu chữ, nhớ vị trí','Đôi tay nhớ phím, đôi mắt nhìn câu chữ.','Tôi nhìn câu mẫu và để đôi tay tìm đúng phím.')]],
    ['Gõ để kể một câu chuyện','Bé kể chuyện; người lớn luyện thư từ.',[
      prose('Lời chào thật dễ thương','Chào bạn! Mình là Mây. Mình thích đọc sách và trồng cây.','Chào anh chị, tôi gửi tài liệu để mọi người cùng xem trước buổi họp.'),
      prose('Một lời nhắn ngắn','Chiều nay, chúng mình cùng ra sân chơi nhé!','Chiều nay mình trao đổi nhanh lúc 3 giờ nhé. Cảm ơn bạn!'),
      prose('Viết một lời cảm ơn','Cảm ơn bố mẹ đã giúp con học thêm điều mới.','Cảm ơn anh chị đã phản hồi. Tôi sẽ cập nhật bản hoàn chỉnh.')]],
    ['Giữ nhịp trong câu dài','Tăng độ dài, tiếp tục ưu tiên gõ đúng.',[
      prose('Chuyện nhỏ mỗi ngày','Sáng sớm, chú mèo nằm bên cửa sổ, nhìn những hạt nắng rơi trên thềm.','Tôi kiểm tra thư, sắp xếp công việc và dành thời gian cho nhiệm vụ quan trọng.'),
      prose('Kể rõ từng ý','Trong vườn có hoa hồng, cây xoài và một chiếc ghế nhỏ để em ngồi đọc sách.','Nhóm cần thống nhất nội dung, người phụ trách và thời hạn hoàn thành từng hạng mục.'),
      prose('Một đoạn liền mạch','Hôm nay trời trong xanh. Em mang sách ra sân, ngồi dưới tán cây và đọc một câu chuyện vui.','Tôi đã hoàn thành bản tổng hợp. Nhờ anh chị xem và góp ý trước chiều mai.')]],
    ['Đưa kỹ năng vào cuộc sống','Luyện lời nhắn, kế hoạch và công việc.',[
      prose('Nhắn một điều cần nhớ','Ngày mai lớp mình có buổi dã ngoại. Nhớ mang theo nước uống và một chiếc mũ nhé!','Chào bạn, mình đã gửi dự thảo qua email. Bạn xem và phản hồi giúp mình nhé.'),
      prose('Sắp xếp một kế hoạch','Buổi sáng em học bài, buổi chiều giúp mẹ tưới cây. Buổi tối, cả nhà cùng đọc sách.','Tuần này tôi sẽ rà soát số liệu, hoàn thiện báo cáo và chuẩn bị nội dung buổi họp.'),
      prose('Diễn đạt thật rõ ràng','Nếu chưa hiểu bài, em sẽ hỏi cô. Nếu gõ chưa đúng, em sẽ bình tĩnh làm lại.','Nếu cần thay đổi thời hạn, anh chị vui lòng báo trước để nhóm điều chỉnh kế hoạch.')]],
    ['Con số không làm khó bạn','Ngày tháng, thời gian và số lượng.',[
      key('Nhịp gõ chữ và số','Ngay 15 thang 10, luc 8:30.'),
      prose('Tính chuyện nhỏ','Lớp có 32 bạn, chia thành 4 nhóm. Mỗi nhóm trồng 3 cây nhỏ.','Cuộc họp bắt đầu lúc 9:00 và kết thúc lúc 10:30. Có 12 thành viên tham dự.'),
      prose('Một lịch hẹn rõ ràng','Hẹn bạn lúc 7 giờ sáng thứ Bảy. Chúng mình sẽ đọc 2 câu chuyện và vẽ 1 bức tranh.','Tôi xác nhận lịch hẹn lúc 14:00 ngày 20 tháng 10. Buổi trao đổi dự kiến kéo dài 45 phút.')]],
    ['Dấu câu, ký hiệu thật gọn','Luyện ký hiệu phổ biến và nhịp Shift.',[
      key('Dấu câu quen thuộc',', . ; : ? ! " ( )'),
      key('Một chút ký hiệu','email@demo.vn + 10 = 20 / 2'),
      key('Thử một dòng code','const ten = "May"; let so = 10;')]],
    ['Đọc trôi, gõ liền mạch','Đoạn văn dài hơn theo chủ đề bạn chọn.',[
      prose('Một câu chuyện nhỏ','Ngày xưa, có một hạt mầm nằm trong lòng đất. Mỗi ngày, hạt mầm uống một chút nước, đón một chút nắng. Rồi chiếc lá xanh đầu tiên vươn lên.','Kính gửi anh chị, tôi xin gửi bản tổng hợp công việc tuần này. Các hạng mục đã hoàn thành theo kế hoạch. Nhờ anh chị phản hồi để nhóm chuẩn bị cho giai đoạn tiếp theo.'),
      prose('Tập trung từng câu','Chú thỏ muốn học cách trồng rau. Lần đầu, chú quên tưới nước. Lần sau, chú ghi một lời nhắc. Nhờ kiên nhẫn, khu vườn ngày càng xanh tốt.','Buổi họp tập trung vào kết quả đã đạt được, vấn đề cần giải quyết và kế hoạch tuần tới. Mỗi thành viên chuẩn bị một bản cập nhật ngắn để trao đổi hiệu quả hơn.'),
      prose('Một ý, nhiều câu','Mỗi người có một nhịp học riêng. Có bạn làm được ngay, có bạn cần thêm thời gian. Điều đáng quý là chúng ta vẫn thử và tiến lên từng bước.','Khi viết một lời nhắn, tôi cố gắng nêu rõ mục đích, thông tin cần thiết và thời hạn phản hồi. Câu chữ ngắn gọn giúp người nhận dễ hiểu và xử lý thuận tiện hơn.')]],
    ['Ôn lại để vững tay hơn','Phối hợp phím, dấu thanh và câu chữ.',[
      key('Nhớ đường đi các ngón','qa ws ed rf tg yh uj ik ol p; az sx dc fv gb hn jm'),
      key('Ôn Telex đủ dấu','nghix kyx truowsc khi gox','nghĩ kỹ trước khi gõ'),
      prose('Giữ nhịp đến cuối','Hãy gõ chậm và đúng từng chữ. Khi đôi tay đã quen đường đi, bạn có thể tăng nhịp một chút. Đừng quên nghỉ ngơi và thả lỏng vai nhé.','Hãy dành vài phút để kiểm tra nội dung trước khi gửi. Một văn bản rõ ràng, đúng chính tả và đầy đủ thông tin giúp công việc thuận lợi hơn.')]],
    ['Nhìn lại hành trình của bạn','Ba bài tổng kết để tự so với lần đầu.',[
      key('Phối hợp cả bàn phím','The quick brown fox jumps over the lazy dog.'),
      prose('Gõ tiếng Việt tự tin','Hôm nay em tự tin hơn khi gõ tiếng Việt. Đôi tay biết tìm phím, đôi mắt biết nhìn câu chữ. Em sẽ tiếp tục luyện để giữ thói quen tốt.','Sau những buổi luyện, tôi chú ý hơn đến vị trí ngón tay và độ chính xác. Tôi sẽ tiếp tục thực hành với email và tài liệu hằng ngày.'),
      prose('Hoàn thành để bắt đầu mới','Mỗi kỹ năng bắt đầu từ một bước nhỏ. Bạn đã dành thời gian học hỏi, sửa lỗi và thử lại. Hãy lưu niềm vui hôm nay, rồi tiếp tục khám phá những điều mới nhé!','Gõ đúng và giữ nhịp đều là một kỹ năng có thể luyện tập. Tôi ghi nhận kết quả hôm nay để tự so sánh trong những lần tiếp theo. Hành trình vẫn tiếp tục.')]]
  ].map(([title,description,items],index) => ({ title,description,items,day:index+1 }));
  const lessons = days.flatMap(day => day.items.map((item,index) => ({ ...item,id:`day-${day.day}-${index+1}`,day:day.day,part:index+1,tier:day.day === 1 ? 'free' : 'plus',group:`Ngày ${day.day}`,description:day.description })));
  const api = { days,lessons,quick:{ id:'quick-test',title:'Gõ thử tiếng Việt',mode:'text',tier:'free',text:'Hôm nay tôi học gõ đúng để làm việc nhanh hơn.' } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GoMayCourse = api;
})(globalThis);
