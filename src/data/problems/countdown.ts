import type { Problem } from './types'

export const countdownProblem: Problem = {
  id: 'countdown',
  title: {
    uz: 'Teskari sanash',
    en: 'Countdown',
    ru: 'Обратный отсчёт',
  },
  topic: 'while',
  difficulty: 'easy',
  statement: {
    uz: "Dastur `scanf` bilan bitta butun son `i` ni o'qiydi. `while` siklidan foydalanib, `i` dan `1` gacha bo'lgan sonlarni kamayish tartibida chiqaring, har birini alohida qatorga. `i` 1 dan kichik bo'lsa, hech narsa chiqarmang.\n\nSiklning tanasida `i` ni chiqaring, keyin uni 1 ga kamaytiring.\n\nMasalan, kiritilgan qiymat `5` bo'lsa, natija:\n`5`\n`4`\n`3`\n`2`\n`1`\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi.",
    en: 'The program reads one whole number `i` with `scanf`. Using a `while` loop, print the numbers from `i` down to `1`, each on its own line. If `i` is less than 1, print nothing.\n\nInside the loop body, print `i`, then decrease it by 1.\n\nFor example, if the input is `5`, the output must be:\n`5`\n`4`\n`3`\n`2`\n`1`\n\nCheck runs your program with several different inputs.',
    ru: 'Программа считывает с помощью `scanf` одно целое число `i`. С помощью цикла `while` выведите числа от `i` до `1` по убыванию, каждое на отдельной строке. Если `i` меньше 1, ничего не выводите.\n\nВ теле цикла выведите `i`, затем уменьшите его на 1.\n\nНапример, если ввод `5`, вывод должен быть:\n`5`\n`4`\n`3`\n`2`\n`1`\n\n«Проверить» запускает программу с несколькими разными вводами.',
  },
  starterCode: [
    '#include <stdio.h>',
    '',
    'int main() {',
    '    int i;',
    '    scanf("%d", &i);',
    '',
    '    while (i >= 1) {',
    '',
    '    }',
    '',
    '    return 0;',
    '}',
  ],
  // A few numbers, exactly one, and none at all: a loop that always runs once (or prints a fixed list) fails.
  testCases: [
    { input: '5', expectedOutput: '5\n4\n3\n2\n1\n' },
    { input: '1', expectedOutput: '1\n' },
    { input: '0', expectedOutput: '' },
  ],
}
