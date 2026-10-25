import type { Problem } from './types'

export const largerOfTwoProblem: Problem = {
  id: 'largerOfTwo',
  title: {
    uz: 'Kattaroq son',
    en: 'The Larger Number',
    ru: 'Большее число',
  },
  topic: 'conditions',
  difficulty: 'easy',
  kind: 'write',
  statement: {
    uz: "Dastur `scanf` bilan ikkita butun son o'qiydi: `a` va `b`. Ulardan kattasini chiqaring. Sonlar teng bo'lsa, shu sonni chiqaring.\n\nMasalan, kiritilgan qiymatlar `3 8` bo'lsa, natija `8` bo'lishi kerak.\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi. O'zingiz sinab ko'rish uchun qiymatlarni muharrir ostidagi Kiritish maydoniga yozing.",
    en: 'The program reads two whole numbers with `scanf`: `a` and `b`. Print the larger one. If they are equal, print that number.\n\nFor example, if the input is `3 8`, the output must be `8`.\n\nCheck runs your program with several different inputs. To try it yourself, type the values into the Input field under the editor.',
    ru: 'Программа считывает с помощью `scanf` два целых числа: `a` и `b`. Выведите большее из них. Если числа равны, выведите это число.\n\nНапример, если ввод `3 8`, вывод должен быть `8`.\n\n«Проверить» запускает программу с несколькими разными вводами. Чтобы попробовать самостоятельно, введите значения в поле «Ввод» под редактором.',
  },
  starterCode: [
    '#include <stdio.h>',
    '',
    'int main() {',
    '    int a, b;',
    '    scanf("%d %d", &a, &b);',
    '',
    '',
    '',
    '    return 0;',
    '}',
  ],
  // The larger number comes second, then first, then they are equal, so an answer that only works one way fails.
  testCases: [
    { input: '3 8', expectedOutput: '8\n' },
    { input: '15 4', expectedOutput: '15\n' },
    { input: '7 7', expectedOutput: '7\n' },
  ],
}
