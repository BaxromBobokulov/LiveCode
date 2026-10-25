import type { Problem } from './types'

export const letterGradeProblem: Problem = {
  id: 'letterGrade',
  title: {
    uz: 'Baho harfi',
    en: 'Letter Grade',
    ru: 'Оценка буквой',
  },
  topic: 'conditions',
  difficulty: 'medium',
  kind: 'write',
  statement: {
    uz: "Dastur `scanf` bilan talabaning imtihon balini o'qiydi (`score` o'zgaruvchisi, 0 dan 100 gacha). Ballga qarab bahoni bitta harf bilan chiqaring:\n\n90 va undan yuqori — `A`, 75 dan 89 gacha — `B`, 60 dan 74 gacha — `C`, 60 dan past — `F`.\n\n`if`, `else if` va `else` dan foydalaning. Masalan, kiritilgan qiymat `78` bo'lsa, natija `B` bo'lishi kerak.\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi.",
    en: 'The program reads a student\'s exam score with `scanf` (the `score` variable, from 0 to 100). Print their grade as a single letter:\n\n90 or more — `A`, 75 to 89 — `B`, 60 to 74 — `C`, below 60 — `F`.\n\nUse `if`, `else if` and `else`. For example, if the input is `78`, the output must be `B`.\n\nCheck runs your program with several different inputs.',
    ru: 'Программа считывает с помощью `scanf` экзаменационный балл студента (переменная `score`, от 0 до 100). Выведите его оценку одной буквой:\n\n90 и больше — `A`, от 75 до 89 — `B`, от 60 до 74 — `C`, меньше 60 — `F`.\n\nИспользуйте `if`, `else if` и `else`. Например, если ввод `78`, вывод должен быть `B`.\n\n«Проверить» запускает программу с несколькими разными вводами.',
  },
  starterCode: [
    '#include <stdio.h>',
    '',
    'int main() {',
    '    int score;',
    '    scanf("%d", &score);',
    '',
    '',
    '',
    '    return 0;',
    '}',
  ],
  // One score per grade, so every branch is tested. 60 sits exactly on the C boundary: `>` instead of `>=` fails it.
  testCases: [
    { input: '78', expectedOutput: 'B\n' },
    { input: '95', expectedOutput: 'A\n' },
    { input: '60', expectedOutput: 'C\n' },
    { input: '40', expectedOutput: 'F\n' },
  ],
}
