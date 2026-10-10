import type { Locale } from '../store/settingsStore'

// UI text in every supported language, under flat keys like "button.run".
// Step explanations (src/engine/explain.ts) and the example C code are not translated yet.
// "{name}" is a placeholder that useTranslation fills in.
const en = {
  'nav.playground': 'Playground',
  'nav.examples': 'Examples',
  'nav.learn': 'Learn',
  'settings.language': 'Language',
  'settings.toDark': 'Switch to dark theme',
  'settings.toLight': 'Switch to light theme',

  'button.run': 'Run',
  'button.reset': 'Reset',
  'button.previous': 'Previous',
  'button.next': 'Next',
  'button.autoPlay': 'Auto Play',
  'button.pause': 'Pause',

  'editor.language': 'Programming language',

  'panel.execution': 'Execution',
  'panel.variables': 'Variables',
  'panel.console': 'Console',
  'panel.loop': 'Loop',
  'panel.array': 'Array',
  'execution.stepOf': 'Step {current} of {total}',
  'loop.iterationOf': 'Iteration {current} of {total}',
  'console.empty': 'No output yet',
  'error.unsupported': 'Not supported yet: {construct}',
  'error.codeError': 'There is a problem in your code',
  'error.line': 'line {line}',

  'examples.meta': '{lines} lines · {steps} steps',
  'examples.loaded': 'Loaded',
  'example.sum.title': 'Sum of Array Elements',
  'example.sum.tag': 'Arrays',
  'example.max.title': 'Find the Maximum',
  'example.max.tag': 'Conditions',
  'example.factorial.title': 'Factorial',
  'example.factorial.tag': 'Loops',
  'example.user.title': 'Your Code',

  'learn.title': 'How CodeVision works',
  // In the two paragraphs below, the word printf is shown in the code font.
  'learn.p1':
    'CodeVision runs a short C program one step at a time. Start from one of the Examples, or type or paste your own program into the Playground editor and press Run. Each step is one line: the editor highlights it and the Execution panel explains what it did in plain language.',
  'learn.p2':
    'Variables that changed on the current step are outlined in blue. When a program walks through an array, the array view marks the element in use and the loop tracker counts iterations. Anything printed with printf appears in the console. Use Next and Previous to go at your own pace, or Auto Play to step automatically.',
  'learn.p3':
    "CodeVision understands a small part of C: int and float variables, one-dimensional arrays, if / else, for and while loops, functions and printf. If your program uses something outside that, Run shows a message naming the line and what isn't supported yet.",
}

export type TranslationKey = keyof typeof en

const uz: Record<TranslationKey, string> = {
  'nav.playground': 'Maydon',
  'nav.examples': 'Misollar',
  'nav.learn': "O'rganish",
  'settings.language': 'Til',
  'settings.toDark': "Tungi mavzuga o'tish",
  'settings.toLight': "Kunduzgi mavzuga o'tish",

  'button.run': 'Ishga tushirish',
  'button.reset': 'Qaytarish',
  'button.previous': 'Oldingi',
  'button.next': 'Keyingi',
  'button.autoPlay': 'Avto ijro',
  'button.pause': 'Pauza',

  'editor.language': 'Dasturlash tili',

  'panel.execution': 'Bajarilish',
  'panel.variables': "O'zgaruvchilar",
  'panel.console': 'Konsol',
  'panel.loop': 'Sikl',
  'panel.array': 'Massiv',
  'execution.stepOf': '{total} tadan {current}-qadam',
  'loop.iterationOf': '{total} tadan {current}-takrorlanish',
  'console.empty': "Hozircha natija yo'q",
  'error.unsupported': "Hali qo'llab-quvvatlanmaydi: {construct}",
  'error.codeError': 'Kodingizda xatolik bor',
  'error.line': '{line}-qator',

  'examples.meta': '{lines} qator · {steps} qadam',
  'examples.loaded': 'Yuklangan',
  'example.sum.title': "Massiv elementlari yig'indisi",
  'example.sum.tag': 'Massivlar',
  'example.max.title': 'Eng kattasini topish',
  'example.max.tag': 'Shartlar',
  'example.factorial.title': 'Faktorial',
  'example.factorial.tag': 'Sikllar',
  'example.user.title': 'Sizning kodingiz',

  'learn.title': 'CodeVision qanday ishlaydi',
  'learn.p1':
    "CodeVision qisqa C dasturini qadamma-qadam bajaradi. Misollardan birini tanlang yoki o'z dasturingizni Maydon muharririga yozing yoki joylang va Ishga tushirish tugmasini bosing. Har bir qadam bitta qator: muharrir uni ajratib ko'rsatadi, Bajarilish paneli esa u nima qilganini oddiy tilda tushuntiradi.",
  'learn.p2':
    "Joriy qadamda o'zgargan o'zgaruvchilar ko'k chiziq bilan belgilanadi. Dastur massiv bo'ylab yurganda, massiv ko'rinishi ishlatilayotgan elementni belgilaydi, sikl kuzatuvchisi esa takrorlanishlarni sanaydi. printf bilan chiqarilgan hamma narsa konsolda paydo bo'ladi. O'z sur'atingizda yurish uchun Keyingi va Oldingi tugmalaridan, avtomatik qadamlash uchun esa Avto ijrodan foydalaning.",
  'learn.p3':
    "CodeVision C tilining kichik bir qismini tushunadi: int va float o'zgaruvchilar, bir o'lchovli massivlar, if / else, for va while sikllari, funksiyalar va printf. Agar dasturingizda bundan tashqaridagi narsa bo'lsa, Ishga tushirish qator raqami va hali qo'llab-quvvatlanmaydigan narsani ko'rsatadi.",
}

const ru: Record<TranslationKey, string> = {
  'nav.playground': 'Песочница',
  'nav.examples': 'Примеры',
  'nav.learn': 'Обучение',
  'settings.language': 'Язык',
  'settings.toDark': 'Включить тёмную тему',
  'settings.toLight': 'Включить светлую тему',

  'button.run': 'Запустить',
  'button.reset': 'Сбросить',
  'button.previous': 'Назад',
  'button.next': 'Далее',
  'button.autoPlay': 'Автошаг',
  'button.pause': 'Пауза',

  'editor.language': 'Язык программирования',

  'panel.execution': 'Выполнение',
  'panel.variables': 'Переменные',
  'panel.console': 'Консоль',
  'panel.loop': 'Цикл',
  'panel.array': 'Массив',
  'execution.stepOf': 'Шаг {current} из {total}',
  'loop.iterationOf': 'Итерация {current} из {total}',
  'console.empty': 'Вывода пока нет',
  'error.unsupported': 'Пока не поддерживается: {construct}',
  'error.codeError': 'В вашем коде есть ошибка',
  'error.line': 'строка {line}',

  // "Строк: 12" avoids Russian plural endings, which depend on the number.
  'examples.meta': 'Строк: {lines} · шагов: {steps}',
  'examples.loaded': 'Загружено',
  'example.sum.title': 'Сумма элементов массива',
  'example.sum.tag': 'Массивы',
  'example.max.title': 'Поиск максимума',
  'example.max.tag': 'Условия',
  'example.factorial.title': 'Факториал',
  'example.factorial.tag': 'Циклы',
  'example.user.title': 'Ваш код',

  'learn.title': 'Как работает CodeVision',
  'learn.p1':
    'CodeVision выполняет короткую программу на C по одному шагу. Начните с одного из Примеров или напишите либо вставьте свою программу в редактор Песочницы и нажмите «Запустить». Каждый шаг — одна строка: редактор подсвечивает её, а панель «Выполнение» простыми словами объясняет, что она сделала.',
  'learn.p2':
    'Переменные, изменившиеся на текущем шаге, обведены синим. Когда программа проходит по массиву, вид массива отмечает используемый элемент, а счётчик цикла считает итерации. Всё, что выведено через printf, появляется в консоли. Переходите по шагам кнопками «Далее» и «Назад» в своём темпе или включите «Автошаг».',
  'learn.p3':
    'CodeVision понимает небольшую часть языка C: переменные int и float, одномерные массивы, if / else, циклы for и while, функции и printf. Если в программе есть что-то другое, «Запустить» покажет сообщение с номером строки и тем, что пока не поддерживается.',
}

export const translations: Record<Locale, Record<TranslationKey, string>> = { en, uz, ru }
