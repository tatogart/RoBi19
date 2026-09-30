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
  'Statistics': 'Статистика', 'Join Date': 'Дата регистрации', 'Place Visits': 'Посещения мест', 'Status': 'Статус',
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
  'Make your own clothes, faces and hats. They go on sale in the Catalog, and you get 70% of every sale.': 'Создавай свою одежду, лица и шляпы. Они появятся в каталоге, а тебе достанется 70% с каждой продажи.',
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
  'Badges': 'Значки', 'Badges saved': 'Значки сохранены', 'Verified': 'Подтверждён', 'Robis Staff': 'Команда Robis', 'Star Creator': 'Звёздный автор',
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
