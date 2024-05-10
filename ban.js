function handleNewChatMembers(bot, msg, exemptedNames) {
    const newMembers = msg.new_chat_members;
    const chatId = msg.chat.id; // ID của nhóm mà thành viên mới tham gia

    newMembers.forEach((newMember) => {
        const fullName = (newMember.first_name || '') + ' ' + (newMember.last_name || '');
        const username = newMember.username ? `@${newMember.username}` : '';
        const nameToDisplay = username || fullName;

        // Kiểm tra xem tên có nằm trong danh sách không bị ban hay không
        const isExempted = exemptedNames.some((exempted) => {
            const regex = new RegExp(exempted, 'i'); // So khớp không phân biệt chữ hoa/chữ thường
            return regex.test(fullName) || (username && regex.test(username));
        });

        if (!isExempted) {
            // Ban thành viên mới gia nhập
            bot.banChatMember(chatId, newMember.id)
                .then(() => {
                    console.log(`Đã ban thành viên ${nameToDisplay} từ nhóm ${chatId}`);

                    // Gửi tin nhắn thông báo
                    bot.sendMessage(chatId, `Đã kick thành viên ${nameToDisplay} vì không phải thành viên của quẩy team Hieu Gà. Để tránh lôi kéo lừa đảo mọi người hãy cẩn thận với những lời dụ dỗ`);

                    // Chờ 1 phút (60 giây) trước khi hủy ban
                    setTimeout(() => {
                        bot.unbanChatMember(chatId, newMember.id)
                            .then(() => {
                                console.log(`Đã hủy ban thành viên ${nameToDisplay} từ nhóm ${chatId}`);
                            })
                            .catch((error) => {
                                console.error('Lỗi khi hủy ban thành viên:', error);
                            });
                }, 60000); // Chờ 60 giây
                })
                .catch((error) => {
                    console.error('Lỗi khi ban thành viên:', error);
                });
        } else {
            console.log(`Bỏ qua ban thành viên ${nameToDisplay} do khớp với danh sách không bị ban`);
        }
    });
}

module.exports = handleNewChatMembers; // Xuất hàm xử lý để import vào index.js
