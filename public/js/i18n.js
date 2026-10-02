// Language (English / Русский) and theme (light / dark) for every page.
// The pages are written in English; in Russian this module swaps interface
// text on the fly (including text that appears later), while usernames, game
// and item names, chat and scripts stay as they are.

export const LANG = (() => {
  try {
    const saved = localStorage.getItem('robis.lang');
    if (saved === 'ru' || saved === 'en') return saved;
  } catch { /* private mode */ }
  return /^ru\b/i.test(navigator.language || '') ? 'ru' : 'en';
})();
export const THEME = (() => { try { return localStorage.getItem('robis.theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } })();

export function setLang(lang) { try { localStorage.setItem('robis.lang', lang); } catch { /* ignore */ } location.reload(); }
export function setTheme(theme) {
  try { localStorage.setItem('robis.theme', theme); } catch { /* ignore */ }
  document.documentElement.dataset.theme = theme;
}

document.documentElement.lang = LANG;
document.documentElement.dataset.theme = THEME;

// ---------------------------------------------------------------- dictionary
const RU = {
  // header, navigation, footer
  'Games': 'Игры', 'Catalog': 'Каталог', 'Create': 'Создать', 'Robits': 'Robits', 'Search': 'Поиск',
  'Home': 'Главная', 'Profile': 'Профиль', 'Messages': 'Сообщения', 'Friends': 'Друзья', 'Avatar': 'Аватар',
  'Inventory': 'Инвентарь', 'Blog': 'Блог', 'Events': 'События', 'More': 'Ещё', 'Menu': 'Меню',
  'Notifications': 'Уведомления', 'Settings': 'Настройки', 'Log In': 'Войти', 'Sign Up': 'Регистрация', 'Logout': 'Выйти',
  'My Profile': 'Мой профиль', 'Create / Develop': 'Создание игр', 'Robis Studio': 'Robis Studio', 'Robits & Builders Club': 'Robits и Builders Club',
  'Admin Panel': 'Админ-панель', 'ADMIN PANEL': 'АДМИН-ПАНЕЛЬ', 'Help': 'Помощь', 'Enter Admin Code': 'Ввести код админа',
  'Install Robis app': 'Установить приложение Robis', 'Install Robis': 'Установить Robis', 'Join a friend': 'Зайти к другу',
  'About Us': 'О нас', 'Parents': 'Родителям', 'Privacy': 'Конфиденциальность', 'For Parents': 'Родителям',
  '©2019 Robis. An open-source fan tribute to the 2019 era of user-generated game platforms. Not affiliated with Roblox Corporation.':
    '©2019 Robis. Фанатский проект с открытым кодом в честь игровых платформ 2019 года. Не связан с Roblox Corporation.',
  '©2019 Robis — an open-source fan tribute to 2019-era game platforms. Not affiliated with Roblox Corporation.':
    '©2019 Robis — фанатский проект с открытым кодом в честь игровых платформ 2019 года. Не связан с Roblox Corporation.',
  'Obby Week!': 'Неделя обби!', 'Toggle the player list': 'Список игроков',

  // landing
  'Build anything. Play everything. Hang out with friends.': 'Строй что угодно. Играй во всё. Общайся с друзьями.',
  'Robis is the place where millions of imaginary players come together to play games made by people just like you.':
    'Robis — место, где миллионы воображаемых игроков вместе играют в игры, созданные такими же людьми, как ты.',
  'Sign up and start having fun!': 'Зарегистрируйся и начинай веселиться!', 'Birthday': 'День рождения',
  'Month': 'Месяц', 'Day': 'День', 'Year': 'Год', 'Username': 'Имя пользователя', 'Password': 'Пароль',
  "Don't use your real name": 'Не используй настоящее имя', 'At least 6 characters': 'Минимум 6 символов', 'Gender (optional)': 'Пол (необязательно)',
  'By clicking Sign Up, you are agreeing to be awesome. This is a fan project — no real data leaves your computer.':
    'Нажимая «Регистрация», ты соглашаешься быть классным. Это фанатский проект — настоящие данные никуда не уходят.',
  'Robis on your devices': 'Robis на твоих устройствах', 'Browser': 'Браузер', 'Mobile': 'Телефон',
  'Play instantly in any modern browser — no plugin needed.': 'Играй сразу в любом современном браузере — без плагинов.',
  'A full editor with Explorer, Properties, Lua scripting and one-click publishing.': 'Полноценный редактор: Explorer, Properties, скрипты на Lua и публикация в один клик.',
  'Touch thumbstick and jump button for phones and tablets.': 'Джойстик и кнопка прыжка для телефонов и планшетов.',
  'Get Robis on your PC or phone': 'Установи Robis на ПК или телефон',
  'Install it like an app: its own icon and window, works offline and updates itself.': 'Устанавливается как приложение: свой значок и окно, работает без интернета и обновляется сам.',
  'Play online with friends': 'Играть онлайн с друзьями',
  'Robis — Play, Build and Create Games': 'Robis — играй, строй и создавай игры',
  January: 'Январь', February: 'Февраль', March: 'Март', April: 'Апрель', May: 'Май', June: 'Июнь', July: 'Июль',
  August: 'Август', September: 'Сентябрь', October: 'Октябрь', November: 'Ноябрь', December: 'Декабрь',

  // home
  'Your daily Robits are ready!': 'Ежедневные Robits готовы!', 'Log in every day to collect a free stipend.': 'Заходи каждый день и получай бесплатную выплату.',
  'Recommended For You': 'Рекомендуем тебе', 'See All': 'Все', 'You have no friends yet. Find some in the Friends tab!': 'У тебя пока нет друзей. Найди их во вкладке «Друзья»!',
  'Recently Played': 'Недавно сыгранные', 'My Friends': 'Мои друзья', 'Favorite Games': 'Избранные игры', 'Continue': 'Продолжить',

  // games
  'Popular': 'Популярные', 'Top Rated': 'Лучшие', 'Featured': 'Рекомендуемые', 'Recently Updated': 'Недавно обновлённые', 'Most Visited': 'Самые посещаемые',
  'Genre': 'Жанр', 'All': 'Все', 'Adventure': 'Приключения', 'Building': 'Строительство', 'Comedy': 'Комедия', 'Fighting': 'Сражения',
  'Horror': 'Ужасы', 'Medieval': 'Средневековье', 'Military': 'Военные', 'Naval': 'Морские', 'RPG': 'RPG', 'Sci-Fi': 'Фантастика',
  'Sports': 'Спорт', 'Town and City': 'Город', 'Western': 'Вестерн', 'FPS': 'Шутеры', 'No games found.': 'Игры не найдены.',
  'No games in this genre yet.': 'В этом жанре пока нет игр.', 'Playing': 'Играют', 'FEATURED': 'РЕКОМЕНДУЕМ',

  // game page
  'Play': 'Играть', 'Play with friends': 'Играть с друзьями', 'Favorite': 'В избранное', 'Like': 'Нравится', 'Dislike': 'Не нравится',
  'About': 'Описание', 'Servers': 'Серверы', 'Store': 'Магазин', 'Description': 'Описание', 'Created': 'Создана', 'Updated': 'Обновлена',
  'Visits': 'Посещения', 'Max Players': 'Макс. игроков', 'Edit in Studio': 'Открыть в Studio', 'Configure': 'Настроить',
  'There are no running servers. Press Play to start one!': 'Нет запущенных серверов. Нажми «Играть», чтобы запустить!',
  'Join': 'Войти', 'Recommended Games': 'Похожие игры', 'Private — only you can play this': 'Приватная — играть можешь только ты',
  'This game is unavailable.': 'Эта игра недоступна.', 'Badges': 'Значки', 'Invite Friends': 'Пригласить друзей',

  // catalog / item / avatar / inventory
  'Category': 'Категория', 'All Categories': 'Все категории', 'Accessories': 'Аксессуары', 'Clothing': 'Одежда', 'Hats': 'Шляпы',
  'Hair': 'Волосы', 'Faces': 'Лица', 'Shirts': 'Рубашки', 'Pants': 'Штаны', 'T-Shirts': 'Футболки', 'Gear': 'Снаряжение', 'Collectibles': 'Коллекционные',
  'Best Selling': 'Бестселлеры', 'Price (Low to High)': 'Цена ↑', 'Price (High to Low)': 'Цена ↓', 'Recent': 'Новые',
  'Search catalog': 'Поиск по каталогу', 'No items found.': 'Предметы не найдены.', 'Free': 'Бесплатно', 'Owned': 'Есть', 'LIMITED': 'ЛИМИТ',
  'Buy': 'Купить', 'Buy Now': 'Купить', 'Buy Item': 'Покупка предмета', 'Price': 'Цена', 'Type': 'Тип', 'Sold': 'Продано',
  'Purchase completed!': 'Покупка совершена!', '✓ You own this item': '✓ У тебя есть этот предмет', 'Wear it': 'Надеть',
  'Avatar Editor': 'Редактор аватара', 'Currently Wearing': 'Сейчас надето', 'Body Colors': 'Цвета тела', 'Head': 'Голова',
  'Torso': 'Торс', 'Left Arm': 'Левая рука', 'Right Arm': 'Правая рука', 'Left Leg': 'Левая нога', 'Right Leg': 'Правая нога',
  'Click a body part, then a color': 'Выбери часть тела, потом цвет', 'Apply to whole body': 'Покрасить всё тело', 'Drag to rotate': 'Потяни, чтобы повернуть',
  "You don't own any of these yet.": 'У тебя пока нет таких предметов.', 'Visit the Catalog': 'Открыть каталог', 'My Inventory': 'Мой инвентарь',
  'Hat': 'Шляпа', 'Face': 'Лицо', 'Shirt': 'Рубашка', 'T-Shirt': 'Футболка', 'Saved': 'Сохранено', 'Save': 'Сохранить',

  // profile / friends / messages
  'Edit Profile': 'Редактировать профиль', 'Edit': 'Изменить', 'Add Friend': 'Добавить в друзья', 'Unfriend': 'Удалить из друзей',
  'Request Sent': 'Заявка отправлена', 'Accept Request': 'Принять заявку', 'Accept': 'Принять', 'Ignore': 'Отклонить', 'Message': 'Написать',
  'Join Game': 'Присоединиться', 'Player Badges': 'Значки игрока', 'No badges yet.': 'Значков пока нет.', 'Creations': 'Творения',
  'Statistics': 'Статистика', 'Join Date': 'Дата регистрации', 'Place Visits': 'Посещения мест',
  'Tell people about yourself! Click Edit to write something.': 'Расскажи о себе! Нажми «Изменить», чтобы что-нибудь написать.',
  'No public games yet.': 'Публичных игр пока нет.', 'No favorites yet.': 'Избранного пока нет.', 'Online': 'В сети', 'Offline': 'Не в сети',
  'In Game': 'В игре', 'In Studio': 'В Studio', 'Requests': 'Заявки', 'Find Players': 'Найти игроков', 'No friends yet.': 'Друзей пока нет.',
  'No friend requests.': 'Заявок в друзья нет.', 'Search for players by username': 'Поиск игроков по имени', 'Friend added!': 'Друг добавлен!',
  'User not found.': 'Пользователь не найден.', 'Inbox': 'Входящие', 'Sent': 'Отправленные', 'Compose': 'Написать', 'New Message': 'Новое сообщение',
  'To': 'Кому', 'Subject': 'Тема', 'Send': 'Отправить', 'Reply': 'Ответить', 'No messages.': 'Сообщений нет.', 'Message sent!': 'Сообщение отправлено!',
  'Official': 'Официальный', 'Edit Avatar': 'Редактировать аватар', 'Previous usernames': 'Прошлые имена',

  // develop / studio shortcuts
  'My Games': 'Мои игры', 'Create New Game': 'Создать игру', 'Open Robis Studio': 'Открыть Robis Studio', 'Create & Open Studio': 'Создать и открыть Studio',
  'Template': 'Шаблон', 'Name': 'Название', 'Configure Game': 'Настройки игры', 'Delete this game': 'Удалить игру',
  'Build anything you can imagine with Robis Studio, script it with Lua, and share it with the world.':
    'Построй всё, что можешь представить, в Robis Studio, оживи это скриптами на Lua и поделись со всем миром.',
  'You haven\'t created any games yet. Click "Create New Game" to start!': 'Ты ещё не создал ни одной игры. Нажми «Создать игру», чтобы начать!',
  'Create Item': 'Создать предмет', 'My Items': 'Мои предметы', 'Create Item (BETA)': 'Создать предмет (БЕТА)', 'BETA': 'БЕТА',
  'Item creation is in BETA': 'Создание предметов в БЕТА-версии',
  'Right now only players with the Item Creator right can make items. Ask an admin of this Robis to give it to you in the Admin Panel.': 'Сейчас создавать предметы могут только игроки с правом «Создатель предметов». Попроси админа этого Robis выдать его в админ-панели.',
  'Make your own clothes, faces, hats and pets. They go on sale in the Catalog, and you get 70% of every sale.': 'Создавай свою одежду, лица, шляпы и питомцев. Они появятся в каталоге, а тебе достанется 70% с каждой продажи.',
  'Puppy': 'Щенок', 'Kitty': 'Котик', 'Bunny': 'Зайка', 'Penguin': 'Пингвин', 'Robot': 'Робот', 'Ghost': 'Призрак', 'Dragon': 'Дракон',
  'Pick an animal and paint it. Pets follow their owner in every game.': 'Выбери зверька и раскрась его. Питомцы ходят за хозяином во всех играх.',
  'Draw a face. It goes on the front of the head.': 'Нарисуй лицо. Оно будет спереди на голове.', 'Draw a picture. It goes on the front of the torso, over any shirt.': 'Нарисуй картинку. Она будет спереди на торсе, поверх рубашки.',
  'Draw with the mouse or your finger, or upload any picture. The grey squares mean see-through.': 'Рисуй мышкой или пальцем или загрузи любую картинку. Серые клетки — прозрачность.',
  'Small brush': 'Маленькая кисть', 'Medium brush': 'Средняя кисть', 'Big brush': 'Большая кисть', 'Huge brush': 'Огромная кисть', 'Eraser': 'Ластик', 'Upload picture': 'Загрузить картинку',
  'Pattern': 'Узор', 'Model': 'Модель', 'Main colour': 'Основной цвет', 'Second colour': 'Второй цвет', 'Preview': 'Предпросмотр', 'Item name': 'Название предмета',
  'Description (optional)': 'Описание (необязательно)', 'Price (R$)': 'Цена (R$)', 'Item created!': 'Предмет создан!', 'Item deleted': 'Предмет удалён',
  'BETA · made by a player': 'БЕТА · создано игроком', 'Delete my item': 'Удалить мой предмет', 'Delete (moderation)': 'Удалить (модерация)',
  'The name needs at least 3 characters.': 'Название должно быть не короче 3 символов.', 'Upload or draw a picture first.': 'Сначала нарисуй или загрузи картинку.', 'Pick a model.': 'Выбери модель.',
  'Plain': 'Однотонный', 'Stripes': 'Полоски', 'Plaid': 'Клетка', 'Camo': 'Камуфляж', 'Hoodie': 'Худи', 'Jeans': 'Джинсы', 'Suit': 'Костюм', 'Bc': 'BC',

  // robits / builders club
  'Robits are the currency of Robis. Spend them in the Catalog!': 'Robits — валюта Robis. Трать их в каталоге!',
  "Earn Robits with the daily stipend and from the admins. Robits and Builders Club can't be bought.":
    'Robits можно получить ежедневной выплатой и от админов. Купить Robits и Builders Club нельзя.',
  'Memberships are given out by the admins of this Robis.': 'Членство выдают админы этого Robis.', 'Your plan': 'Твой тариф',
  'Play every game': 'Все игры', 'Build in Robis Studio': 'Строй в Robis Studio', 'Everything in Classic': 'Всё из Classic',
  'Everything in BC': 'Всё из BC', 'Everything in TBC': 'Всё из TBC', 'Transactions': 'Операции', 'Date': 'Дата', 'Amount': 'Сумма',
  'No transactions yet.': 'Операций пока нет.',

  // admin
  'Players': 'Игроки', 'Search players': 'Поиск игроков', 'No players found.': 'Игроки не найдены.', 'Give Robits': 'Дать Robits',
  'Give all items': 'Дать все предметы', 'Make admin': 'Сделать админом', 'Remove admin': 'Снять админку', 'Ban': 'Бан', 'Unban': 'Разбан',
  'Give': 'Дать', 'Amount (negative to take away)': 'Сумма (минус — забрать)', 'Reason': 'Причина', 'Reason (optional)': 'Причина (необязательно)',
  'Length': 'Срок', 'Forever': 'Навсегда', 'Account only': 'Только аккаунт', 'Account + device and IP (no new accounts)': 'Аккаунт + устройство и IP (без новых аккаунтов)',
  'They will be logged out and kicked from any game.': 'Игрок выйдет из аккаунта и будет выкинут из игр.', 'Catalog items': 'Предметы каталога',
  'Robits in circulation': 'Robits в обороте', 'Playing now': 'Играют сейчас', 'Only admins can open this page.': 'Эту страницу могут открыть только админы.',
  'Edit together': 'Редактировать вместе', 'Team Create': 'Совместное создание', "It's dark in here... use your Flashlight (press 1).": 'Здесь темно... включи фонарик (клавиша 1).',
  'Pets': 'Питомцы', 'Pet': 'Питомец',
  'Groups': 'Группы', 'Group': 'Группа', 'Create Group': 'Создать группу', 'My Groups': 'Мои группы', 'Popular Groups': 'Популярные группы', 'Search groups': 'Поиск групп', 'Find Groups': 'Найти группы',
  'You are not in any groups yet. Join one below or create your own!': 'Ты пока не состоишь в группах. Вступи в группу ниже или создай свою!', 'No groups found.': 'Группы не найдены.',
  'Name': 'Название', 'What is your group about?': 'О чём твоя группа?', 'Emblem colour': 'Цвет эмблемы', 'Emblem symbol': 'Символ эмблемы', 'New members need approval': 'Новых участников нужно одобрять', 'Create': 'Создать', 'Free for admins.': 'Для админов бесплатно.',
  'Join Group': 'Вступить', 'Request to Join': 'Подать заявку', 'Request Pending': 'Заявка отправлена', 'Leave Group': 'Покинуть группу', 'Make Primary': 'Сделать основной', 'Show this group on your profile': 'Показывать эту группу в профиле',
  'Member': 'Участник', 'Members': 'Участники', 'Owner': 'Владелец', 'Approval needed': 'Нужно одобрение', 'Group Shout': 'Объявление группы', 'No shout yet.': 'Объявлений пока нет.', 'Shout': 'Объявить', 'Shout to everyone in the group': 'Объявление для всей группы',
  'Wall': 'Стена', 'Say something to the group': 'Напиши что-нибудь группе', 'Join the group to post on its wall.': 'Вступи в группу, чтобы писать на стене.', 'Log in and join the group to post on its wall.': 'Войди и вступи в группу, чтобы писать на стене.', 'Nothing on the wall yet.': 'На стене пока пусто.',
  'Make Member': 'Сделать участником', 'Make Admin': 'Сделать админом', 'Make Owner': 'Сделать владельцем', 'No join requests.': 'Заявок нет.', 'Delete Group': 'Удалить группу', 'Welcome to the group!': 'Добро пожаловать в группу!', 'Request sent!': 'Заявка отправлена!',
  'You left the group': 'Ты покинул(а) группу', 'Shown on your profile': 'Показывается в профиле', 'Shout posted': 'Объявление опубликовано', 'Role changed': 'Роль изменена', 'Ownership transferred': 'Группа передана', 'Removed': 'Удалён', 'Accepted': 'Принято', 'Group not found.': 'Группа не найдена.',
  'Not in any groups.': 'Не состоит в группах.', 'Primary': 'Основная', 'Robis Badges': 'Значки Robis', 'No Robis Badges yet.': 'Значков Robis пока нет.',
  'Administrator': 'Администратор', 'Runs this Robis.': 'Управляет этим Robis.', 'Welcome To The Club': 'Добро пожаловать в клуб', 'Has a Builders Club membership.': 'Состоит в Builders Club.', 'Veteran': 'Ветеран', 'Has been on Robis for a year.': 'На Robis уже год.',
  'Friendly': 'Дружелюбный', 'Has 5 friends.': 'Есть 5 друзей.', 'Friendship': 'Дружба', 'Has 20 friends.': 'Есть 20 друзей.', 'Builder': 'Строитель', 'Made a game.': 'Сделал(а) игру.', 'Homestead': 'Усадьба', 'Their places were visited 100 times.': 'Плейсы посетили 100 раз.',
  'Bricksmith': 'Кирпичных дел мастер', 'Their places were visited 1,000 times.': 'Плейсы посетили 1000 раз.', 'Item Designer': 'Дизайнер предметов', 'Made a catalog item.': 'Создал(а) предмет каталога.', 'Trader': 'Торговец', 'Completed a trade.': 'Завершил(а) обмен.',
  'Collector': 'Коллекционер', 'Owns a Limited item.': 'Владеет лимиткой.', 'Robit Tycoon': 'Магнат Robits', 'Has 10,000 Robits.': 'Имеет 10 000 Robits.', 'Badge Hunter': 'Охотник за значками', 'Earned 10 game badges.': 'Получил(а) 10 игровых значков.',
  'Group Founder': 'Основатель группы', 'Owns a group.': 'Владеет группой.', 'Combat Initiation': 'Боевое крещение', 'Knocked someone out in a battle game.': 'Победил(а) кого-то в боевой игре.', 'Warrior': 'Воин', 'Got 25 KOs in one battle.': '25 побед в одном бою.',
  'Creating a group costs R$100.': 'Создание группы стоит R$100.', 'A group with this name already exists.': 'Группа с таким названием уже есть.', 'Group names are 3 to 40 characters long.': 'Название группы — от 3 до 40 символов.',
  'Only the owner can delete the group.': 'Удалить группу может только владелец.', "The owner can't leave. Give the group to someone else or delete it.": 'Владелец не может уйти. Передай группу другому или удали её.',
  'You are driving! WASD / joystick to steer, Space or Jump to get out.': 'Ты за рулём! WASD / джойстик — руль, Пробел или прыжок — выйти.',
  'You can fly! Space / Jump: up, Q / ▼: down.': 'Ты летаешь! Пробел / прыжок — вверх, Q / ▼ — вниз.',
  'The race is on - you got a kart, go go go!': 'Гонка уже идёт — вот тебе карт, вперёд!',
  "Here's a new kart - keep racing!": 'Вот новый карт — гони дальше!',
  'Resellers': 'Перепродавцы', 'Best Price': 'Лучшая цена', 'Sell': 'Продать', 'Take off sale': 'Снять с продажи', 'On sale for': 'В продаже за', 'Your copy': 'Твоя копия',
  'Nobody is selling this item right now.': 'Сейчас никто не продаёт этот предмет.', 'Put on sale': 'Выставить', 'Your item is on sale!': 'Предмет выставлен на продажу!', 'Taken off sale': 'Снято с продажи',
  'Sold out': 'Распродано', 'Sold out — buy it from a reseller or get it in a trade.': 'Распродано — купи у перепродавца или получи обменом.',
  'Only Limited items can be sold by players.': 'Игроки могут продавать только лимитки.', 'You don\'t own this item.': 'У тебя нет этого предмета.', 'Enter a price of at least R$1.': 'Укажи цену от R$1.',
  'This item is no longer for sale.': 'Этот предмет больше не продаётся.', 'You can\'t buy your own item.': 'Нельзя купить свой же предмет.',
  'Online now': 'Сейчас онлайн', 'Playing now': 'Сейчас играют', 'New today': 'Новые за сутки', 'Banned': 'Забанены', 'Open trades': 'Открытые обмены', 'Items for sale': 'Предметов в продаже',
  'Announcement': 'Объявление', 'Message for every player (shown on every page and in games)': 'Сообщение для всех игроков (на всех страницах и в играх)', 'Post': 'Опубликовать', 'Remove': 'Убрать',
  'Announcement posted': 'Объявление опубликовано', 'Announcement removed': 'Объявление убрано', 'Blue': 'Синий', 'Green': 'Зелёный', 'Orange': 'Оранжевый', 'Red': 'Красный',
  'Admin Log': 'Журнал', 'Everyone': 'Все', 'Online': 'Онлайн', 'Staff': 'Команда', 'Manage': 'Управление', 'Account': 'Аккаунт', 'Economy': 'Экономика', 'Rights': 'Права', 'Moderation': 'Модерация',
  'Reset password': 'Сбросить пароль', 'Change username': 'Сменить ник', 'Log out everywhere': 'Выйти на всех устройствах', 'Kick from game': 'Выкинуть из игры', 'Kick': 'Выкинуть',
  'Recent transactions': 'Последние операции', 'Admin actions': 'Действия админов', 'Nothing yet.': 'Пока ничего.', 'Previously:': 'Раньше:', 'Ban reason:': 'Причина бана:',
  'Robits': 'Robits', 'Items': 'Предметы', 'Games': 'Игры', 'Trades': 'Обмены', 'Joined': 'Регистрация', 'Devices': 'Устройства', 'IPs': 'IP-адреса', 'Logged in on': 'Входов активно',
  'New password': 'Новый пароль', 'New password:': 'Новый пароль:', 'Leave empty for a random password': 'Оставь пустым для случайного пароля', 'Password reset': 'Пароль сброшен', 'Copy': 'Копировать', 'Copied': 'Скопировано',
  'The player is logged out everywhere. Give them the new password; they can change it later in Settings.': 'Игрок выйдет на всех устройствах. Передай ему новый пароль — потом он сможет сменить его в Настройках.',
  'Free for staff. The old name is shown on the profile.': 'Для команды бесплатно. Старый ник будет виден в профиле.', 'Username changed': 'Ник изменён',
  'They are removed from the game they are playing.': 'Игрок будет выкинут из игры, в которой сейчас находится.', 'This player is not in a game.': 'Этот игрок сейчас не в игре.',
  'Use Settings for your own account.': 'Для своего аккаунта используй Настройки.', 'Only admins can do that to an admin.': 'Это может сделать с админом только админ.',
  'Search games': 'Поиск игр', 'Feature': 'В рекомендуемые', 'Unfeature': 'Убрать из рекомендуемых', 'Featured': 'Рекомендуемая', 'Private': 'Закрытая', 'Game deleted': 'Игра удалена', 'No games found.': 'Игры не найдены.',
  'Limited items and items made by players. Open an item to change its Limited settings or see its owners.': 'Лимитки и предметы, созданные игроками. Открой предмет, чтобы изменить настройки лимитки или посмотреть владельцев.',
  'No items yet.': 'Предметов пока нет.', 'Filter by player or action': 'Фильтр по игроку или действию', 'Nothing here yet.': 'Здесь пока пусто.',
  'Made admin': 'Назначен админом', 'Removed admin': 'Снят с админа', 'Deleted account': 'Аккаунт удалён', 'Unbanned': 'Разбанен', 'Logged out everywhere': 'Выход на всех устройствах', 'Cleared announcement': 'Объявление убрано',
  'Gave all items': 'Выданы все предметы', 'Took all items': 'Забраны все предметы', 'Deleted game': 'Игра удалена',
  'Owners': 'Владельцы', 'Delete': 'Удалить', 'Banned players': 'Забанено', 'Serial number': 'Серийный номер', 'Delete account': 'Удалить аккаунт', 'Delete Account': 'Удаление аккаунта', 'Delete my account': 'Удалить мой аккаунт',
  'Delete your account forever?': 'Удалить твой аккаунт навсегда?', 'Delete your own account in Settings.': 'Свой аккаунт удаляй в Настройках.', 'Only admins can delete an admin.': 'Удалить админа может только админ.',
  'The account, its games, friends, messages and trades are deleted for good. This can\'t be undone.': 'Аккаунт, его игры, друзья, сообщения и обмены удаляются навсегда. Это нельзя отменить.',
  'This is not a device ban: the person can sign up again with a new account. To stop that, use Ban → Account + device and IP instead.': 'Это не бан по устройству: человек сможет зарегистрироваться заново. Чтобы этого не было, используй Бан → Аккаунт + устройство и IP.',
  'Your account, games, items, friends and messages are deleted for good. This can\'t be undone.': 'Твой аккаунт, игры, предметы, друзья и сообщения удалятся навсегда. Это нельзя отменить.',
  'This account has been deleted.': 'Этот аккаунт удалён.',
  'Limited Creator': 'Создатель лимиток', 'Limited Creator: make Limited items with a set stock': 'Создатель лимиток: лимитированные предметы с ограниченным тиражом',
  'Make it a Limited': 'Сделать лимиткой', 'Stock (how many can be sold)': 'Тираж (сколько можно продать)', 'Make Limited': 'Сделать лимиткой', 'Limited settings': 'Настройки лимитки',
  'Copies left for sale': 'Осталось в продаже', 'Make normal item': 'Сделать обычным', 'Limited saved': 'Лимитка сохранена', 'No longer Limited': 'Больше не лимитка',
  'A Limited has a set stock. When it sells out, players can only get it in a trade. Stock 0 takes it off sale right away.': 'У лимитки ограниченный тираж. Когда он закончится, предмет можно получить только обменом. Тираж 0 сразу снимает его с продажи.',
  'Sold out — you can still get it in a trade.': 'Распродано — его ещё можно получить обменом.',
  'Only players with the Limited Creator right can make Limited items.': 'Лимитки могут создавать только игроки с правом «Создатель лимиток».',
  'Players already own this Limited, so it can\'t be deleted.': 'Эту лимитку уже купили игроки, поэтому её нельзя удалить.',
  'Right now only players with the Item Creator or Limited Creator right can make items.': 'Сейчас создавать предметы могут только игроки с правом «Создатель предметов» или «Создатель лимиток».',
  'Trade': 'Обмен', 'Trades': 'Обмены', 'Trade Items': 'Обменяться', 'Trade Settings': 'Настройки обменов', 'Inbound': 'Входящие', 'Outbound': 'Исходящие', 'Completed': 'Завершённые', 'Inactive': 'Неактивные',
  'Pending': 'Ожидает', 'Declined': 'Отклонён', 'Cancelled': 'Отменён', 'Expired': 'Истёк', 'Failed': 'Не удался', 'Sent to you': 'Тебе', 'Sent by you': 'От тебя',
  'Items you will give': 'Ты отдашь', 'Items you will receive': 'Ты получишь', 'Plus': 'И ещё', 'Value:': 'Стоимость:', 'Accept': 'Принять', 'Decline': 'Отклонить', 'Cancel Trade': 'Отменить обмен', 'Close': 'Закрыть',
  'Trade completed!': 'Обмен завершён!', 'Trade declined': 'Обмен отклонён', 'Trade cancelled': 'Обмен отменён', 'Trade sent!': 'Предложение отправлено!', 'Make Offer': 'Предложить обмен',
  'Trade with': 'Обмен с', 'Your Inventory': 'Твой инвентарь', 'Their Inventory': 'Инвентарь игрока', 'Your Offer': 'Ты предлагаешь', 'Your Request': 'Ты просишь', 'Plus Robits': 'И ещё Robits', 'Plus Robits (you have': 'И ещё Robits (у тебя', 'No tradable items.': 'Нет предметов для обмена.',
  'Robits received in a trade have a 30% fee.': 'С Robits, полученных в обмене, берётся комиссия 30%.',
  'Up to 4 items on each side. Only items that cost Robits or are Limited can be traded. Robits received in a trade have a 30% fee.': 'До 4 предметов с каждой стороны. Обменивать можно только платные и лимитированные предметы. С Robits, полученных в обмене, берётся комиссия 30%.',
  'To start a trade, open a player\'s profile and press "Trade Items".': 'Чтобы начать обмен, открой профиль игрока и нажми «Обменяться».',
  'Trading': 'Обмены', 'Who can trade with me?': 'Кто может предлагать мне обмен?', 'Everyone': 'Все', 'No one': 'Никто', 'Saved': 'Сохранено',
  'Take items': 'Забрать предметы', 'Take all items': 'Забрать все предметы', 'This player has no items.': 'У игрока нет предметов.', 'Click an item to take it away. It is also removed from the avatar.': 'Нажми на предмет, чтобы забрать его. Он также снимается с аватара.',
  'You can\'t trade with yourself.': 'Нельзя обмениваться с самим собой.', 'Add at least one item to the trade.': 'Добавь в обмен хотя бы один предмет.', 'Both sides of a trade need something.': 'С обеих сторон обмена должно что-то быть.',
  'You can trade at most 4 items on each side.': 'Можно обменять не больше 4 предметов с каждой стороны.', 'One of the items can\'t be traded.': 'Один из предметов нельзя обменять.', 'This trade is no longer active.': 'Этот обмен уже неактивен.',
  'You have too many open trades. Wait for answers or cancel some.': 'У тебя слишком много открытых обменов. Дождись ответов или отмени часть.', 'You can add up to 4 items on each side.': 'Можно добавить до 4 предметов с каждой стороны.',
  'Badges': 'Значки', 'Badges saved': 'Значки сохранены', 'Verified': 'Подтверждён', 'Robis Staff': 'Команда Robis', 'Star Creator': 'Звёздный автор',
  'Partner': 'Партнёр', 'Moderator': 'Модератор', 'Developer': 'Разработчик', 'VIP': 'VIP', 'Video Creator': 'Видеоблогер', 'Champion': 'Чемпион',
  'Bug Hunter': 'Охотник за багами', 'Supporter': 'Поддерживает Robis', 'OG Player': 'Олд (OG)',
  'Partner (gold check)': 'Партнёр (золотая галочка)', 'Moderator (green shield)': 'Модератор (зелёный щит)', 'Developer (code)': 'Разработчик (код)',
  'VIP (crown)': 'VIP (корона)', 'Champion (trophy)': 'Чемпион (кубок)', 'Supporter (heart)': 'Поддержка (сердце)',
  'Earn Robits with the daily stipend, from promo codes and from the admins, or support Robis and buy some below.': 'Получай Robits ежедневной наградой, промокодами и от админов — или поддержи Robis и купи их ниже.',
  'Buy Robits': 'Купить Robits', 'Buy': 'Купить', 'Extend': 'Продлить', 'Popular': 'Популярное', 'Price in Telegram': 'Цена в Telegram',
  'Support Robis! Press Buy: we open ': 'Поддержи Robis! Нажми «Купить» — откроется ', ' in Telegram with a ready message. Pay there and you get your Robits.': ' в Telegram с готовым сообщением. Оплати там и получи свои Robits.',
  'Message copied - paste it in the Telegram chat': 'Сообщение скопировано — вставь его в чат Telegram',
  'Buy a membership through Telegram, get one from a promo code or from the admins.': 'Членство можно купить через Telegram, получить по промокоду или от админов.',
  'Builders Club': 'Builders Club', 'No membership': 'Без членства', 'Membership days (0 = forever)': 'Дней членства (0 = навсегда)',
  'Players type codes on the Promo Codes page. Each player can use a code once. A Builders Club code gives the plan for the set days, then the player goes back to their old plan.': 'Игроки вводят коды на странице «Промокоды». Каждый игрок может использовать код один раз. Код на Builders Club даёт тариф на указанные дни, потом у игрока возвращается старый тариф.',
  'Add Robits, an item or a membership.': 'Добавь Robits, предмет или членство.', 'forever': 'навсегда',
  'Donate prices': 'Цены доната', 'Save prices': 'Сохранить цены', 'Prices saved': 'Цены сохранены', 'That is not a Telegram username.': 'Это не ник в Telegram.',
  'Shown on the Robits page. "Buy" opens this Telegram account with a ready message; you give the Robits or the membership by hand (or with a promo code).': 'Показываются на странице Robits. «Купить» открывает этот Telegram с готовым сообщением; Robits или членство ты выдаёшь вручную (или промокодом).',
  'Store': 'Магазин', 'Game Passes': 'Геймпассы', '+ Create a Game Pass': '+ Создать геймпасс', 'Create a Game Pass': 'Создать геймпасс', 'Edit Game Pass': 'Изменить геймпасс',
  'Buy Game Pass': 'Купить геймпасс', 'Buy Now': 'Купить', '✓ Owned': '✓ Куплено', 'Owned': 'Куплено', 'This game has no game passes yet.': 'В этой игре пока нет геймпассов.',
  'You get 70% of every sale. Scripts can check passes with MarketplaceService:UserOwnsGamePassAsync(player.UserId, passId).': 'Тебе достаётся 70% с каждой продажи. Скрипты проверяют пассы через MarketplaceService:UserOwnsGamePassAsync(player.UserId, passId).',
  'Icon': 'Иконка', 'Colour': 'Цвет', 'Built-in perk (works without scripts)': 'Встроенный бонус (работает без скриптов)', 'On sale': 'В продаже',
  'What does it give?': 'Что он даёт?', 'No perk (use it in scripts)': 'Без бонуса (для скриптов)', 'Speed: run faster': 'Скорость: бегать быстрее', 'Super jump': 'Супер-прыжок', 'Flying': 'Полёт',
  'This pass is not for sale.': 'Этот пасс не продаётся.', 'You already own this pass.': 'У тебя уже есть этот пасс.', 'This pass is not available.': 'Этот пасс недоступен.',
  'Only the owner of this game can make passes.': 'Создавать пассы может только владелец игры.', 'A game can have up to 30 passes.': 'В игре может быть не больше 30 пассов.',
  'Players already bought this pass. Take it off sale instead.': 'Этот пасс уже покупали. Лучше сними его с продажи.',
  'Purchase complete': 'Покупка завершена', 'Purchase failed': 'Покупка не удалась', 'Loading...': 'Загрузка...',
  'Private Servers': 'Приватные серверы', 'Public servers': 'Публичные серверы', 'Private server': 'Приватный сервер', 'Private server invite': 'Приглашение на приватный сервер',
  'Let players buy private servers': 'Разрешить покупать приватные серверы', 'Price (R$ for 30 days, 0 = free)': 'Цена (R$ за 30 дней, 0 = бесплатно)',
  'Your game: private servers are free for you.': 'Это твоя игра: приватные серверы для тебя бесплатны.', 'Play with only the people you invite. Free!': 'Играй только с теми, кого пригласишь. Бесплатно!',
  'Create Private Server': 'Создать приватный сервер', 'Private server created!': 'Приватный сервер создан!', 'This game has no private servers.': 'В этой игре нет приватных серверов.',
  'Manage': 'Управление', 'Invite link': 'Ссылка-приглашение', 'New link': 'Новая ссылка', 'New link made': 'Ссылка обновлена', 'Rename': 'Переименовать', 'Renamed': 'Переименовано',
  'My friends can join without an invite': 'Мои друзья могут заходить без приглашения', 'Invite': 'Пригласить', 'Invited': 'Приглашён',
  'Renew 30 days': 'Продлить на 30 дней', 'Renewed': 'Продлено', 'Delete server': 'Удалить сервер', 'Never expires': 'Бессрочно', 'never expires': 'бессрочно', 'Yours · ': 'Твой · ', 'Join now': 'Зайти сейчас', 'Later': 'Позже',
  'This private server doesn\'t exist anymore.': 'Этого приватного сервера больше нет.', 'You are not invited to this private server.': 'Тебя не приглашали на этот приватный сервер.',
  'This private server has expired. Its owner can renew it on the game page.': 'Срок приватного сервера истёк. Владелец может продлить его на странице игры.',
  'This invite link is not valid anymore.': 'Эта ссылка-приглашение больше не работает.', 'This game has no private servers.': 'В этой игре нет приватных серверов.',
  'You can have up to 3 private servers per game.': 'Можно иметь не больше 3 приватных серверов в одной игре.', 'This private server is full.': 'Приватный сервер заполнен.',
  "A hub with portals to every game in the event. A golden token is hidden in each game (placed automatically, even in player games). Every token gives 15 R$; 8 prizes from the first token up to the Hunter's Golden Crown for all of them.": 'Хаб с порталами во все игры ивента. В каждой игре спрятан золотой токен (ставится автоматически, даже в играх игроков). За каждый токен 15 R$; 8 призов — от первого токена до Hunter\'s Golden Crown за все.',
  'The Hunt': 'The Hunt', 'Something is coming... Stay tuned!': 'Скоро что-то будет... Следи за новостями!',
  'Private preview: only admins can see the event right now': 'Закрытый предпросмотр: сейчас ивент видят только админы',
  'Find the golden token hidden in every game. Collect them all to win the grand prize!': 'Найди золотой токен, спрятанный в каждой игре. Собери все и получи главный приз!',
  'Play The Hunt': 'Играть в The Hunt', 'Prizes': 'Призы', '✓ Unlocked': '✓ Получено', 'Official': 'Официальная', 'Play again': 'Играть снова', 'Find the token': 'Найти токен',
  'No games in the event yet.': 'В ивенте пока нет игр.', 'Add games to The Hunt in the Admin Panel.': 'Добавь игры в The Hunt в админ-панели.',
  'Open for everyone': 'Открыть для всех', ' (off: only admins can see the page, play the hub and find tokens)': ' (выкл: страницу, хаб и токены видят только админы)',
  'Open the event page': 'Открыть страницу ивента', 'Hub game': 'Игра-хаб', 'Official games': 'Официальные игры', 'Most popular player games to add': 'Сколько популярных игр игроков добавить',
  'The Hunt is open for everyone!': 'The Hunt открыт для всех!', 'Saved (still private)': 'Сохранено (пока приватно)', 'Player games: between 0 and 20.': 'Игр игроков: от 0 до 20.',
  "A hub with portals to every game in the event. A golden token is hidden in each game (placed automatically, even in player games); half of the tokens win the Hunt Dragon, all of them the Hunter's Golden Crown.": 'Хаб с порталами во все игры ивента. В каждой игре спрятан золотой токен (ставится автоматически, даже в играх игроков); за половину токенов — Hunt Dragon, за все — Hunter\'s Golden Crown.',
  'The Hunt: a golden token is hidden somewhere in this game. Find it!': 'The Hunt: где-то в этой игре спрятан золотой токен. Найди его!',
  'This item is not for sale.': 'Этот предмет не продаётся.', 'Teleporting...': 'Телепортация...', 'Taking you to the next game.': 'Переносим тебя в следующую игру.',
  'TOKEN FOUND!': 'ТОКЕН НАЙДЕН!', 'The Hunter': 'Охотник', 'Found every token in The Hunt.': 'Нашёл все токены в The Hunt.',
  'Gift Cards': 'Подарочные карты', 'GIFT CARD': 'ПОДАРОЧНАЯ КАРТА', 'Buy a gift card': 'Купить подарочную карту', 'Your gift card': 'Твоя подарочная карта',
  'Give Robits or Builders Club to a friend. Buy a card with your Robits (a gift card costs 50% more than it gives) and get its code right away, or buy it in Telegram.': 'Подари другу Robits или Builders Club. Купи карту за свои Robits (карта стоит на 50% больше, чем даёт) и сразу получи код — или купи её в Telegram.',
  'Give this code to a friend. It works once.': 'Отдай этот код другу. Он срабатывает один раз.', 'Copy code': 'Скопировать код', 'Copy link': 'Скопировать ссылку', 'Done': 'Готово',
  'My gift cards': 'Мои подарочные карты', 'Card': 'Карта', 'Not used yet': 'Ещё не активирована', 'Buy in Telegram': 'Купить в Telegram',
  'Builders Club · 30 days': 'Builders Club · 30 дней', 'Unknown gift card.': 'Неизвестная карта.', 'You have 20 unused gift cards. Give some away first!': 'У тебя 20 неиспользованных карт. Сначала подари какие-нибудь!',
  'Tokens for a player': 'Токены игрока', 'Show': 'Показать', 'Give all tokens': 'Выдать все токены', 'Take all tokens': 'Забрать все токены',
  'Click a game to give or take its token.': 'Нажми на игру, чтобы выдать или забрать её токен.', 'Give this token': 'Выдать этот токен', 'Take this token': 'Забрать этот токен',
  'Give or take tokens by hand. Given tokens bring their 15 R$ and unlock prizes like found ones; taking tokens keeps the prizes.': 'Выдавай и забирай токены вручную. Выданные токены дают свои 15 R$ и открывают призы, как найденные; если забрать токены, призы останутся.',
  'That game is not in The Hunt.': 'Этой игры нет в The Hunt.',
  'Promo Codes': 'Промокоды', 'Enter code': 'Введи код', 'Redeem': 'Активировать', 'Code redeemed!': 'Код активирован!', 'New in your inventory:': 'Новое в инвентаре:',
  'You already own everything this code gives.': 'У тебя уже есть всё, что даёт этот код.',
  'Got a code from the admins, an event or a video? Type it here to get Robits, Builders Club and free items.': 'Есть код от админов, с ивента или из видео? Введи его здесь и получи Robits, Builders Club и бесплатные предметы.',
  "Each code works once per player. Codes don't care about upper or lower case.": 'Каждый код работает один раз для каждого игрока. Регистр букв не важен.',
  'Have a promo code? Redeem it here': 'Есть промокод? Активируй его здесь',
  'That code is not valid.': 'Такого кода нет.', 'You already used this code.': 'Ты уже использовал этот код.', 'This code has expired.': 'Срок действия кода истёк.',
  'This code has been used up.': 'Этот код уже закончился.', 'Too many wrong codes. Try again in a few minutes.': 'Слишком много неверных кодов. Попробуй через несколько минут.',
  'Make promo codes': 'Создать промокоды', 'Players type codes on the Promo Codes page. Each player can use a code once.': 'Игроки вводят коды на странице «Промокоды». Каждый игрок может использовать код один раз.',
  'How many codes': 'Сколько кодов', 'Uses per code (0 = no limit)': 'Активаций на код (0 = без лимита)', 'Expires in days (0 = never)': 'Срок в днях (0 = бессрочно)',
  'Custom code (optional)': 'Свой код (необязательно)', 'Note (only staff see it)': 'Заметка (видят только админы)',
  'Search items to add (name)': 'Найди предметы (по названию)', 'Generate': 'Сгенерировать', 'All codes': 'Все коды', 'Copy all': 'Скопировать все',
  'Code': 'Код', 'Gives': 'Даёт', 'Used': 'Активаций', 'Expires': 'Истекает', 'Never': 'Никогда', 'Turn on': 'Включить', 'Turn off': 'Выключить',
  'No codes yet.': 'Кодов пока нет.', 'Code made': 'Код создан', 'Up to 10 items per code.': 'Не больше 10 предметов на код.',
  'active': 'активен', 'off': 'выключен', 'expired': 'истёк', 'used up': 'закончился',
  'Add Robits or at least one item.': 'Добавь Robits или хотя бы один предмет.', 'That code already exists.': 'Такой код уже есть.',
  'A code is 3-30 letters, digits or dashes.': 'Код — это 3–30 латинских букв, цифр или дефисов.',
  'Give a badge': 'Выдать значок', 'Give': 'Выдать', 'Player name': 'Ник игрока', 'With badges': 'Со значками', 'Nobody has it yet.': 'Пока ни у кого нет.',
  'Take away': 'Забрать', 'No player with that name.': 'Нет игрока с таким ником.',
  'Badges show next to the name everywhere: profile, games, chat and the player list. Pick a badge, type a name and press Give.': 'Значки видны рядом с ником везде: в профиле, играх, чате и списке игроков. Выбери значок, впиши ник и нажми «Выдать».',
  'Verified (blue check)': 'Подтверждён (синяя галочка)', 'Robis icon (official / staff)': 'Иконка Robis (официальный / команда)',
  'Badges are shown next to the name everywhere: profile, games, chat and the player list.': 'Значки показываются рядом с ником везде: в профиле, играх, чате и списке игроков.',
  'Permissions': 'Права', 'Permissions saved': 'Права сохранены', 'Moderator': 'Модератор', 'Economy': 'Экономика', 'Item Creator': 'Создатель предметов', 'Curator': 'Куратор',
  'Admins have every right. Give other players only what they need.': 'У админов есть все права. Давай игрокам только то, что им нужно.',
  'Moderator: ban, kick and mute players': 'Модератор: банить, кикать и отключать чат игрокам',
  'Economy: give Robits, items and Builders Club': 'Экономика: выдавать Robits, предметы и Builders Club',
  'Item Creator (BETA): make catalog items': 'Создатель предметов (БЕТА): делать предметы для каталога',
  'Game Curator: feature games on the front page': 'Куратор игр: выбирать рекомендуемые игры',
  'Feature this game': 'Добавить в рекомендуемые', 'Remove from Featured': 'Убрать из рекомендуемых', 'Game featured!': 'Игра в рекомендуемых!', 'Removed from Featured': 'Убрано из рекомендуемых',
  "You don't have permission to do that.": 'У тебя нет прав на это.', 'Only admins can ban other staff.': 'Банить других модераторов могут только админы.', 'Banned': 'Забанен', 'Device ban': 'Бан устройства',

  // blog / help / 404
  'Robis Blog': 'Блог Robis', 'Help & About': 'Помощь и о проекте', 'About Robis': 'О Robis', 'Controls': 'Управление',
  'Page cannot be found or no longer exists': 'Страница не найдена или больше не существует', 'Return Home': 'На главную',
  'Go to Previous Page': 'Назад', '404 — Oof!': '404 — Уф!',

  // dialogs, toasts
  'OK': 'OK', 'Cancel': 'Отмена', 'Close': 'Закрыть', 'Leave': 'Выйти', 'Reconnect': 'Переподключиться', 'Try again': 'Попробовать снова',
  'Activate': 'Активировать', 'Admin Code': 'Код админа', 'Only the owner of this Robis has the admin code.': 'Код админа есть только у владельца этого Robis.',
  'You are now an admin!': 'Теперь ты админ!', 'Robis is now loading. Get ready to play!': 'Robis загружается. Приготовься играть!',
  'Starting the Robis Player...': 'Запускаем Robis Player...', 'Robis was updated!': 'Robis обновился!',
  'Robis was updated. The new version starts when you leave the game.': 'Robis обновился. Новая версия запустится, когда выйдешь из игры.',
  'Robis is already installed on this device.': 'Robis уже установлен на этом устройстве.',
  'Robis is installed! Open it from your desktop or home screen.': 'Robis установлен! Открой его с рабочего стола или главного экрана.',
  'Install Robis like an app: it gets its own icon and window, works offline and updates itself.':
    'Установи Robis как приложение: у него будет свой значок и окно, он работает без интернета и обновляется сам.',
  'Room code': 'Код комнаты', 'Share': 'Поделиться', 'Waiting for friends...': 'Ждём друзей...', 'Opening room...': 'Открываем комнату...',

  // game HUD
  'Resume Game': 'Продолжить', 'Reset Character': 'Возродиться', 'Leave Game': 'Выйти из игры', 'Game menu': 'Меню игры',
  'To chat click here or press "/" key': 'Чтобы написать, нажми здесь или клавишу «/»', 'Tap here to chat': 'Нажми, чтобы написать',
  'Chat (try /e dance, /e wave, /e cheer)': 'Чат (попробуй /e dance, /e wave, /e cheer)', 'Chat': 'Чат', 'Fullscreen': 'Полный экран',
  'Rotate your device for a better view': 'Поверни устройство для лучшего обзора', 'Developer Console': 'Консоль разработчика',
  'Server Lua or :commands (owners and admins)': 'Серверный Lua или :команды (владельцы и админы)', 'Disconnected': 'Отключено',
  'Unable to join': 'Не удалось войти', 'Walk (or arrow keys)': 'Ходить (или стрелки)', 'Jump': 'Прыжок', 'Rotate the camera': 'Вращать камеру',
  'Zoom in / out (all the way in = first person)': 'Приблизить / отдалить (до упора — вид от первого лица)', 'Toggle Shift Lock': 'Shift Lock',
  'Reset character (from the menu)': 'Возродиться (через меню)', 'Developer console (game owners)': 'Консоль разработчика (владельцы игры)',
  'Right mouse': 'Правая кнопка мыши', 'Mouse wheel': 'Колесо мыши', 'Space': 'Пробел', 'Menu (Esc)': 'Меню (Esc)', 'Shift Lock (Shift)': 'Shift Lock (Shift)',
  'Loading...': 'Загрузка...', 'Connecting to server...': 'Подключение к серверу...', 'Joining game...': 'Вход в игру...',
  'Chat & Party': 'Чат и компания', 'Tip:': 'Совет:',
  'Invite': 'Пригласить', 'Invite friends': 'Пригласить друзей', 'Invited!': 'Приглашён!', 'Could not load friends.': 'Не удалось загрузить друзей.', 'You can only invite friends.': 'Приглашать можно только друзей.',

  // server messages
  'Come back tomorrow for more Robits!': 'Приходи завтра за новыми Robits!', 'Incorrect password.': 'Неверный пароль.',
  'Incorrect username or password.': 'Неверное имя пользователя или пароль.', 'This username is already in use.': 'Это имя уже занято.',
  'Password cannot be your username.': 'Пароль не может совпадать с именем.', 'Password must be at least 6 characters.': 'Пароль должен быть не короче 6 символов.',
  'Usernames can be 3 to 20 characters long, letters, numbers and at most one underscore.': 'Имя: от 3 до 20 символов, латинские буквы, цифры и не больше одного подчёркивания.',
  'That is already your username.': 'Это уже твоё имя.', 'Wrong admin code.': 'Неверный код админа.', 'You already own this item.': 'У тебя уже есть этот предмет.',
  'This item is sold out.': 'Этот предмет распродан.', 'You must be logged in.': 'Нужно войти в аккаунт.', 'Already friends': 'Вы уже друзья',
  'Game not found': 'Игра не найдена', 'Item not found': 'Предмет не найден', 'Item not found.': 'Предмет не найден.', 'User not found': 'Пользователь не найден',
  'Admins only.': 'Только для админов.', 'Message is empty': 'Сообщение пустое', 'Recipient not found': 'Получатель не найден',
  'You must be logged in to play.': 'Чтобы играть, нужно войти в аккаунт.', 'This game is private.': 'Это приватная игра.',
  'Too many attempts. Try again later.': 'Слишком много попыток. Попробуй позже.',
  'You have been banned.': 'Ты забанен.', 'This ban is permanent.': 'Бан навсегда.',

  // in-game menu
  '(you)': '(ты)', 'Camera Sensitivity': 'Чувствительность камеры', 'Volume': 'Громкость', 'Graphics Quality': 'Качество графики',
  'Low': 'Низкое', 'Medium': 'Среднее', 'High': 'Высокое', 'Shift Lock Switch': 'Переключатель Shift Lock', 'On': 'Вкл', 'Off': 'Выкл',
  'Show FPS': 'Показывать FPS', 'Move': 'Движение', 'W A S D / Arrow keys': 'W A S D / стрелки', 'Rotate camera': 'Поворот камеры',
  'Hold right mouse button': 'Зажми правую кнопку мыши', 'Zoom': 'Приближение', 'Mouse wheel, I / O': 'Колесо мыши, I / O', 'Player list': 'Список игроков',
  'Developer console': 'Консоль разработчика', 'Are you sure you want to reset your character?': 'Точно возродиться?', 'Reset': 'Возродиться',
  "Don't Reset": 'Не надо', 'Are you sure you want to leave the game?': 'Точно выйти из игры?', "Don't Leave": 'Остаться',
  '/   (emotes: /e dance, /e dance2, /e dance3, /e wave, /e point, /e cheer, /e laugh)': '/   (эмоции: /e dance, /e dance2, /e dance3, /e wave, /e point, /e cheer, /e laugh)',
  'By': 'Автор:', 'Explore': 'Обзор', 'Clear': 'Очистить', 'Nothing here yet.': 'Здесь пока ничего нет.', 'English': 'English',

  // robits page, transactions
  'Classic': 'Classic', 'BC hard hat badge': 'Значок-каска BC', 'TBC badge': 'Значок TBC', 'OBC badge': 'Значок OBC',
  'Admin bonus': 'Бонус админа', 'Admin bonus removed': 'Бонус админа снят', 'Daily stipend': 'Ежедневная выплата', 'Free Robits removed': 'Бесплатные Robits забраны',

  // help page
  'Robis is an open-source, non-commercial tribute to the 2019 era of user-generated game platforms. It includes a website, a multiplayer 3D client, a Lua scripting engine and Robis Studio — all running from a single Node.js server.':
    'Robis — некоммерческий проект с открытым кодом в честь игровых платформ 2019 года. В нём есть сайт, многопользовательский 3D-клиент, движок скриптов на Lua и Robis Studio — и всё это работает на одном сервере Node.js.',
  'Robis is a fan project and is not affiliated with, endorsed by, or connected to Roblox Corporation.': 'Robis — фанатский проект, он не связан с Roblox Corporation и не одобрен ею.',
  'Chat is filtered and there are no real-money purchases — Robits are imaginary: you earn them with the daily stipend, and only admins can give out more. Everything runs on the computer where the server is installed.':
    'Чат фильтруется, а покупок за настоящие деньги нет: Robits вымышленные — их дают ежедневной выплатой, а больше могут выдать только админы. Всё работает на компьютере, где установлен сервер.',
  'Accounts and games are stored in a local JSON database (the data/ folder). Nothing is sent to third parties.': 'Аккаунты и игры хранятся в локальной базе JSON (папка data/). Ничего не передаётся третьим лицам.',

  // blog
  'Create your own items (BETA)': 'Создавай свои предметы (БЕТА)',
  'Players with the Item Creator right can now design T-shirts and faces (draw them or upload a picture), shirts, pants, hats and hair. Your creations go on sale in the Catalog and you get 70% of every sale. Find it on the Create page!':
    'Игроки с правом «Создатель предметов» теперь могут делать футболки и лица (нарисовать или загрузить картинку), рубашки, штаны, шляпы и причёски. Твои творения продаются в каталоге, а тебе достаётся 70% с каждой продажи. Ищи на странице «Создать»!',
  'Invite friends to your game': 'Приглашай друзей в свою игру',
  'Open the menu in any game, go to Players and press Invite Friends. Your friends get a popup with a Join button wherever they are on Robis.':
    'Открой меню в любой игре, перейди в «Игроки» и нажми «Пригласить друзей». Друзья увидят приглашение с кнопкой «Войти», где бы они ни были на Robis.',
  'Dark Theme and Russian': 'Тёмная тема и русский язык',
  'Robis now has a Dark Theme — easy on the eyes at night — and speaks Russian! Change both in Settings.': 'В Robis появилась тёмная тема — глазам ночью легче — и русский язык! Всё это меняется в настройках.',
  'See which friends are online from any page with the new Chat & Party bar in the bottom right corner. Jump straight into their game with one click.':
    'Смотри, кто из друзей в сети, с любой страницы — новая панель «Чат и компания» в правом нижнем углу. Заходи к ним в игру в один клик.',
  'New places: Minigame Mania, Happy Home and more': 'Новые места: Minigame Mania, Happy Home и другие',
  'Survive random minigames, hang out at the classic family home or ride the Ferris wheel at the Robis Theme Park. Freeze Tag, Capture the Flag and King of the Hill are waiting for you and your friends too.':
    'Выживай в случайных мини-играх, тусуйся в классическом семейном доме или катайся на колесе обозрения в Robis Theme Park. А ещё тебя и друзей ждут Freeze Tag, Capture the Flag и King of the Hill.',
  'Robis Studio gets a Command Bar': 'В Robis Studio появилась командная строка',
  'Test sessions now come with a Lua command bar. Type any code while your game is running and see the result in the Output window instantly. Happy scripting!':
    'Во время теста теперь есть командная строка Lua. Пиши любой код, пока игра запущена, и сразу смотри результат в окне Output. Удачного скриптинга!',
  'Introducing DataStores': 'Встречайте DataStores',
  'Your games can now remember players between sessions. Use DataStoreService:GetDataStore() to save stages, coins, wins — anything JSON-friendly. Mega Fun Obby already uses it to save your progress.':
    'Теперь игры могут запоминать игроков между сессиями. Используй DataStoreService:GetDataStore(), чтобы сохранять этапы, монеты, победы — всё, что умещается в JSON. Mega Fun Obby уже так сохраняет прогресс.',
  'TweenService is here': 'Пришёл TweenService',
  'Smoothly animate any property of any part with TweenService:Create(part, TweenInfo.new(...), {Position = ...}):Play(). Moving platforms have never been easier.':
    'Плавно анимируй любое свойство любой детали: TweenService:Create(part, TweenInfo.new(...), {Position = ...}):Play(). Двигающиеся платформы ещё никогда не были такими простыми.',
  'The Catalog has Limiteds': 'В каталоге появились лимитки',
  'Collectible items like the Sparkle Time Halo and the Dominator of Robis are now available — but only while supplies last!': 'Коллекционные предметы вроде Sparkle Time Halo и Dominator of Robis уже в продаже — но только пока не разобрали!',
  'Welcome to Robis!': 'Добро пожаловать в Robis!',
  'Robis is a place to play games made by the community and to build your own. Grab Robis Studio from the Create page and make something amazing.':
    'Robis — место, где можно играть в игры от сообщества и строить свои. Открой Robis Studio на странице «Создать» и сделай что-нибудь потрясающее.',

  // settings page
  'Account Info': 'Аккаунт', 'Appearance': 'Внешний вид', 'Language': 'Язык', 'Theme': 'Тема', 'Light': 'Светлая', 'Dark': 'Тёмная',
  'Change Username': 'Сменить имя', 'New username': 'Новое имя', 'Change': 'Сменить', 'Username changed!': 'Имя изменено!',
  'Security': 'Безопасность', 'Change Password': 'Сменить пароль', 'Current password': 'Текущий пароль', 'New password': 'Новый пароль',
  'Password changed!': 'Пароль изменён!', 'Account Settings': 'Настройки аккаунта', 'Free for admins': 'бесплатно для админов',
};

// Patterns for text with numbers and names in it.
const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100; const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};
const UNITS = { minute: ['минуту', 'минуты', 'минут'], hour: ['час', 'часа', 'часов'], day: ['день', 'дня', 'дней'], second: ['секунду', 'секунды', 'секунд'] };
const ago = (n, u) => `${n} ${plural(+n, ...UNITS[u])} назад`;
const RU_PATTERNS = [
  [/^(.+) - Robis$/, (m, a) => `${tr(a)} - Robis`],
  [/^— (.+)$/, (m, a) => `— ${tr(a)}`],
  [/^Tip: (.+)$/, (m, a) => `Совет: ${({
    'Press / to chat.': 'Нажми /, чтобы написать в чат.', 'Try /e dance in the chat!': 'Напиши в чат /e dance!', 'Press Shift to toggle Shift Lock.': 'Shift включает Shift Lock.',
    'Press Esc to open the menu.': 'Esc открывает меню.', 'Make your own games with Robis Studio.': 'Создавай свои игры в Robis Studio.',
    'Invite friends from the Esc menu → Players.': 'Приглашай друзей: Esc → Игроки.', 'Collect your daily Robits on the Home page.': 'Забирай ежедневные Robits на главной.',
    'Right-click and drag to turn the camera.': 'Зажми правую кнопку мыши, чтобы вращать камеру.', 'Walk into a truss to climb it.': 'Подойди к ферме, чтобы залезть по ней.',
  })[a] || a}`],
  [/^(\w+) (\d{4})$/, (m, a, b) => (RU[a] ? `${RU[a]} ${b}` : m)],
  [/^R\$ ([\d,]+) · (\d+) items · (\d+) games · joined (.+)$/, (m, a, b, c, d) => `R$ ${a} · предметов: ${b} · игр: ${c} · с нами ${tr(d)}`],
  [/^Purchased (.+) from (.+)$/, (m, a, b) => `Куплено: ${a} у ${b}`],
  [/^Sold (.+) to (.+)$/, (m, a, b) => `Продано: ${a} игроку ${b}`],
  [/^(Purchased|Sold) (.+)$/, (m, a, b) => `${a === 'Sold' ? 'Продано' : 'Куплено'}: ${b}`],
  [/^Gift from (.+)$/, (m, a) => `Подарок от ${a}`],
  [/^Username changed to (.+)$/, (m, a) => `Имя изменено на ${a}`],
  [/^Hello, (.+)!$/, (m, a) => `Привет, ${a}!`],
  [/^Collect (?:daily )?R\$(\d+)$/, (m, a) => `Получить R$${a}`],
  [/^Daily R\$(\d+)$/, (m, a) => `Ежедневно R$${a}`],
  [/^(Friends|Players|Requests) \((\d+)\)$/, (m, a, b) => `${tr(a)} (${b})`],
  [/^(\d+) (minute|hour|day|second)s? ago$/, (m, a, b) => ago(a, b)],
  [/^Last online (\d+) (minute|hour|day|second)s? ago$/, (m, a, b) => `Был(а) в сети ${ago(a, b)}`],
  [/^Last online just now$/, () => 'Был(а) в сети только что'],
  [/^just now$/, () => 'только что'],
  [/^Welcome to (.+)! Press \/ to chat\.$/, (m, a) => `Добро пожаловать в ${a}! Нажми /, чтобы написать в чат.`],
  [/^By (.+)$/, (m, a) => `Автор: ${a}`],
  [/^Insert (.+)$/, (m, a) => `Вставить: ${a}`],
  [/^(\d+) players?$/, (m, a) => `${a} ${plural(+a, 'игрок', 'игрока', 'игроков')}`],
  [/^(\d+) of (\d+) players$/, (m, a, b) => `${a} из ${b} игроков`],
  [/^You have no (inbound|outbound|completed|inactive) trades\.$/, (m, a) => `Нет ${({ inbound: 'входящих', outbound: 'исходящих', completed: 'завершённых', inactive: 'неактивных' })[a]} обменов.`],
  [/^(Sent to you|Sent by you) · (.+)$/, (m, a, b) => `${tr(a)} · ${tr(b)}`],
  [/^Trade with (.+) \(after 30% fee\)$/, (m, a) => `Обмен с ${a} (после комиссии 30%)`],
  [/^Trade with (.+)$/, (m, a) => `Обмен с ${a}`],
  [/^Take items from (.+)$/, (m, a) => `Забрать предметы у ${a}`],
  [/^Take (.+) from (.+)\?$/, (m, a, b) => `Забрать ${a} у ${b}?`],
  [/^Take ALL items from (.+)\?$/, (m, a) => `Забрать ВСЕ предметы у ${a}?`],
  [/^Badge (\w+) given$/, (m, a) => `Значок ${a} выдан`],
  [/^Badge (\w+) taken away$/, (m, a) => `Значок ${a} забран`],
  [/^Create \(R\$ ([\d,]+)\)$/, (m, a) => `Создать (R$ ${a})`],
  [/^Play with only the people you invite\. R\$ ([\d,]+) for (\d+) days\.$/, (m, a, b) => `Играй только с теми, кого пригласишь. R$ ${a} на ${b} дней.`],
  [/^Buy for R\$ (\d+)$/, (m, a) => `Купить за R$ ${a}`],
  [/^Your balance: R\$ (\d+)$/, (m, a) => `Твой баланс: R$ ${a}`],
  [/^You bought (.+)! Your balance: R\$ (\d+)\.$/, (m, a, b) => `Ты купил ${a}! Баланс: R$ ${b}.`],
  [/^You bought (.+)!$/, (m, a) => `Ты купил ${a}!`],
  [/^You need (\d+) more Robits to buy this pass\.$/, (m, a) => `Не хватает ${a} Robits для покупки этого пасса.`],
  [/^You need (\d+) more Robits for a private server\.$/, (m, a) => `Не хватает ${a} Robits для приватного сервера.`],
  [/^([\d,]+) sold( · off sale)?$/, (m, a, b) => `Продано: ${a}${b ? ' · не в продаже' : ''}`],
  [/^Game pass created \(ID (\d+)\)$/, (m, a) => `Геймпасс создан (ID ${a})`],
  [/^Pass ID for scripts: (\d+)$/, (m, a) => `ID пасса для скриптов: ${a}`],
  [/^(\d+) playing$/, (m, a) => `Играют: ${a}`],
  [/^Invited players \((\d+)\)$/, (m, a) => `Приглашённые (${a})`],
  [/^Expires (.+)$/, (m, a) => `Истекает ${a}`],
  [/^You are on the private server "(.+)"\.$/, (m, a) => `Ты на приватном сервере «${a}».`],
  [/^You were invited to "(.+)" by (.+)\.$/, (m, a, b) => `${b} приглашает тебя на «${a}».`],
  [/^(\d+) \/ (\d+) tokens$/, (m, a, b) => `${a} / ${b} токенов`],
  [/^Every token gives R\$ (\d+), and (\d+) prizes are waiting along the way\.$/, (m, a, b) => `За каждый токен R$ ${a}, а по пути ждут ${b} призов.`],
  [/^Find (\d+) tokens?$/, (m, a) => `Найди токенов: ${a}`],
  [/^Find (\d+) tokens$/, (m, a) => `Найди ${a} токенов`],
  [/^(\d+) players found tokens$/, (m, a) => `Нашли токены: ${a}`],
  [/^In the event now \((\d+)\)$/, (m, a) => `Сейчас в ивенте (${a})`],
  [/^The Hunt: you already found the token in this game \((\d+)\/(\d+)\)\.$/, (m, a, b) => `The Hunt: ты уже нашёл токен в этой игре (${a}/${b}).`],
  [/^The Hunt: token found! (\d+)\/(\d+)(?: - you won (.+)!)?$/, (m, a, b, c) => `The Hunt: токен найден! ${a}/${b}` + (c ? ` — ты выиграл ${c}!` : '')],
  [/^You won: (.+)!$/, (m, a) => `Твой приз: ${a}!`],
  [/^Welcome to The Hunt! Find the golden token hidden in every game\. You have (\d+) of (\d+)\.$/, (m, a, b) => `Добро пожаловать в The Hunt! Найди золотой токен в каждой игре. У тебя ${a} из ${b}.`],
  [/^Teleporting to (.+)\.\.\.$/, (m, a) => `Телепорт в ${a}...`],
  [/^Buy for R\$ ([\d,]+)$/, (m, a) => `Купить за R$ ${a}`],
  [/^Buy · (.+)$/, (m, a) => `Купить · ${a}`],
  [/^Redeemed by (.+)$/, (m, a) => `Активировал ${a}`],
  [/^Gift card: (.+)$/, (m, a) => `Подарочная карта: ${a}`],
  [/^(.+) for R\$ ([\d,]+)\. You get a code: give it to a friend and they redeem it on the Promo Codes page\.$/, (m, a, b) => `${a} за R$ ${b}. Ты получишь код: отдай его другу, он активирует его на странице «Промокоды».`],
  [/^You need (\d+) more Robits for this gift card\.$/, (m, a) => `Не хватает ${a} Robits для этой карты.`],
  [/^Done! Prizes: (.+)$/, (m, a) => `Готово! Призы: ${a}`],
  [/^Your plan until (.+)$/, (m, a) => `Твой тариф до ${a}`],
  [/^until (.+)$/, (m, a) => `до ${a}`],
  [/^You already have (.+) or better\.$/, (m, a) => `У тебя уже есть ${a} или лучше.`],
  [/^Write to @(\w+) in Telegram$/, (m, a) => `Напиши @${a} в Telegram`],
  [/^((?:Turbo |Outrageous )?Builders Club) ended$/, (m, a) => `${a}: срок закончился`],
  [/^New codes \((\d+)\)$/, (m, a) => `Новые коды (${a})`],
  [/^(\d+) codes made$/, (m, a) => `Создано кодов: ${a}`],
  [/^Promo code ([A-Z0-9-]+)(.*)$/, (m, a, b) => `Промокод ${a}${b}`],
  [/^(.+) given to (.+)$/, (m, a, b) => `${a}: выдан игроку ${b}`],
  [/^(.+) already has this badge\.$/, (m, a) => `У ${a} уже есть этот значок.`],
  [/^All items taken from (.+)$/, (m, a) => `Все предметы забраны у ${a}`],
  [/^(.+) taken from (.+)$/, (m, a, b) => `${a}: забрано у ${b}`],
  [/^(.+) removed by (.+)$/, (m, a, b) => `${a}: забрал(а) ${b}`],
  [/^(.+) isn't accepting trades from you\.$/, (m, a) => `${a} не принимает от тебя обмены.`],
  [/^(.+) already owns? (.+)\.$/, (m, a, b) => `${a === 'You' ? 'У тебя уже есть' : 'У ' + a + ' уже есть'} ${b}.`],
  [/^(.+) no longer owns (.+)\.$/, (m, a, b) => `У ${a} больше нет ${b}.`],
  [/^(.+) doesn't have enough Robits\.$/, (m, a) => `У ${a} не хватает Robits.`],
  [/^The trade could not be completed: (.+)$/, (m, a) => `Обмен не удался: ${tr(a)}`],
  [/^([\d,]+) of ([\d,]+) remaining$/, (m, a, b) => `Осталось ${a} из ${b}`],
  [/^([\d,]+) remaining$/, (m, a) => `Осталось: ${a}`],
  [/^The stock must be between (\d+) and ([\d,]+)\.$/, (m, a, b) => `Тираж должен быть от ${a} до ${b}.`],
  [/^(\d[\d,]*) members?$/, (m, a) => `${a} ${plural(+a.replace(/,/g, ''), 'участник', 'участника', 'участников')}`],
  [/^Members \((\d+)\)$/, (m, a) => `Участники (${a})`],
  [/^Requests \((\d+)\)$/, (m, a) => `Заявки (${a})`],
  [/^Created (.+)$/, (m, a) => `Создана ${tr(a)}`],
  [/^Give the group to (.+)\? You will become an admin\.$/, (m, a) => `Передать группу ${a}? Ты станешь админом.`],
  [/^Remove (.+) from the group\?$/, (m, a) => `Удалить ${a} из группы?`],
  [/^Created the group (.+)$/, (m, a) => `Создана группа ${a}`],
  [/^Your word is: (.+)$/, (m, a) => `Твоё слово: ${a}`],
  [/^Graphics lowered to (\w+) to keep the game smooth \(change it in the menu\)\.$/, (m, a) => `Графика снижена до «${tr(a)}», чтобы игра не тормозила (можно изменить в меню).`],
  [/^Lap (\d+)\/(\d+) - lap time ([\d.]+)s$/, (m, a, b, c) => `Круг ${a}/${b} — время круга ${c} с`],
  [/^Team Create$/, () => 'Совместное создание'],
  [/^You will get R\$([\d,]+) \(30% marketplace fee\)\.$/, (m, a) => `Ты получишь R$${a} (комиссия площадки 30%).`],
  [/^Sell your copy( #\d+)? to another player\.$/, (m, a) => `Продай свою копию${a || ''} другому игроку.`],
  [/^Sell (.+)$/, (m, a) => `Продать ${a}`],
  [/^Showing now · posted by (.+) (\d+ \w+ ago|just now)$/, (m, a, b) => `Показывается сейчас · опубликовал(а) ${a} ${tr(b)}`],
  [/^Reset password for (.+)$/, (m, a) => `Сброс пароля: ${a}`],
  [/^Change username of (.+)$/, (m, a) => `Сменить ник: ${a}`],
  [/^Kick (.+)\?$/, (m, a) => `Выкинуть ${a}?`],
  [/^(.+) was kicked$/, (m, a) => `${a} выкинут из игры`],
  [/^(.+) was logged out$/, (m, a) => `${a} разлогинен`],
  [/^(.+) now owns every item$/, (m, a) => `У ${a} теперь все предметы`],
  [/^Delete the game (.+)\? This can't be undone\.$/, (m, a) => `Удалить игру ${a}? Это нельзя отменить.`],
  [/^([\d,]+) owners · ([\d,]+) for sale$/, (m, a, b) => `владельцев: ${a} · в продаже: ${b}`],
  [/^([\d,]+) left$/, (m, a) => `осталось ${a}`],
  [/^Robits ([+-]?\d+)$/, (m, a) => `Robits ${a}`],
  [/^Membership: (.+)$/, (m, a) => `Членство: ${a}`],
  [/^Gave item: (.+)$/, (m, a) => `Выдан предмет: ${a}`],
  [/^Took item: (.+)$/, (m, a) => `Забран предмет: ${a}`],
  [/^Badges: (.+)$/, (m, a) => `Значки: ${a}`],
  [/^Permissions: (.+)$/, (m, a) => `Права: ${a}`],
  [/^Banned \((.+?)\)(?:: (.+))?$/, (m, a, b) => `Бан (${a.replace('forever', 'навсегда').replace('device + IP', 'устройство + IP')})${b ? ': ' + b : ''}`],
  [/^Renamed to (.+)$/, (m, a) => `Ник изменён на ${a}`],
  [/^Kicked from game(?:: (.+))?$/, (m, a) => `Выкинут из игры${a ? ': ' + a : ''}`],
  [/^Announcement: (.+)$/, (m, a) => `Объявление: ${a}`],
  [/^Delete (.+)\?$/, (m, a) => `Удалить ${a}?`],
  [/^(.+) was deleted$/, (m, a) => `${a} удалён`],
  [/^Deleted the account (.+)$/, (m, a) => `Удалён аккаунт ${a}`],
  [/^Badges for (.+)$/, (m, a) => `Значки: ${a}`],
  [/^Permissions for (.+)$/, (m, a) => `Права: ${a}`],
  [/^Ban (.+)\?$/, (m, a) => `Забанить ${a}?`],
  [/^Robits for (.+)$/, (m, a) => `Robits для ${a}`],
  [/^(.+) was banned$/, (m, a) => `${a} забанен`],
  [/^(.+) was unbanned$/, (m, a) => `${a} разбанен`],
  [/^\+(\d[\d,]*) Robits!$/, (m, a) => `+${a} Robits!`],
  [/^You were kicked from this game: (.+) \(Error Code: 267\)$/, (m, a) => `Тебя выкинули из игры: ${a} (Код ошибки: 267)`],
  [/^Lost connection to the game server, please reconnect \(Error Code: 277\)$/, () => 'Потеряно соединение с сервером игры, переподключись (Код ошибки: 277)'],
  [/^Changing your username costs (.+)\. Your old username is shown on your profile\.$/, (m, a) => `${a === 'Free for admins' ? 'Для админов смена имени бесплатна' : 'Смена имени стоит ' + a}. Старое имя будет видно в профиле.`],
  [/^You need R\$([\d,]+) to change your username\.$/, (m, a) => `Для смены имени нужно R$${a}.`],
  [/^Too many attempts\. Try again in (\d+) min\.$/, (m, a) => `Слишком много попыток. Попробуй через ${a} мин.`],
  [/^This account has been banned\.(.*)$/, (m, a) => `Этот аккаунт забанен.${a.replace(' Reason: ', ' Причина: ').replace(' This ban is permanent.', ' Бан навсегда.').replace(' Until ', ' До ')}`],
  [/^You have been banned\.(.*)$/, (m, a) => `Ты забанен.${a.replace(' Reason: ', ' Причина: ').replace(' This ban is permanent.', ' Бан навсегда.').replace(' Until ', ' До ')}`],
  [/^(.+) invited you to play (.+)$/, (m, a, b) => `${a} приглашает тебя в ${b}`],
];

export function tr(text) {
  if (LANG !== 'ru') return text;
  const t = text.trim();
  if (!t) return text;
  let out = RU[t];
  if (out === undefined) {
    for (const [re, fn] of RU_PATTERNS) {
      const m = re.exec(t);
      if (m) { out = fn(...m); break; }
    }
  }
  if (out === undefined) return text;
  return text.replace(t, out);
}

// ---------------------------------------------------------------- DOM translator
// Skips user content: chat, console output, code, inputs the player types in.
const SKIP = 'script,style,textarea,code,pre,.CodeMirror,.chat .line:not(.system),.dc-log,.no-i18n,[translate="no"],.output-panel,.bubble';
const ATTRS = ['placeholder', 'title', 'aria-label'];

function translateNode(node) {
  if (node.nodeType === 3) {
    const p = node.parentElement;
    if (!p || p.closest(SKIP)) return;
    const v = node.nodeValue;
    if (!/[A-Za-z]/.test(v)) return;
    const n = tr(v);
    if (n !== v) node.nodeValue = n;
    return;
  }
  if (node.nodeType !== 1) return;
  const skipped = node.closest(SKIP);
  if (skipped && !(skipped === node && (node.tagName === 'TEXTAREA' || node.tagName === 'INPUT'))) return;
  for (const a of ATTRS) {
    const v = node.getAttribute(a);
    if (v && /[A-Za-z]/.test(v)) { const n = tr(v); if (n !== v) node.setAttribute(a, n); }
  }
  if (skipped) return;
  for (const c of node.childNodes) translateNode(c);
}

if (LANG === 'ru') {
  const start = () => {
    translateNode(document.body);
    document.title = tr(document.title);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') translateNode(m.target);
        else if (m.type === 'attributes') translateNode(m.target);
        else for (const n of m.addedNodes) translateNode(n);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    new MutationObserver(() => { const t = tr(document.title); if (t !== document.title) document.title = t; })
      .observe(document.querySelector('title') || document.head, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
}
