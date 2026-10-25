import type { Problem } from './types'

export const absoluteValueProblem: Problem = {
  id: 'absoluteValue',
  title: {
    uz: 'Sonning moduli',
    en: 'Absolute Value',
    ru: 'Модуль числа',
  },
  topic: 'conditions',
  difficulty: 'easy',
  kind: 'write',
  statement: {
    uz: "Dastur `scanf` bilan bitta butun son `n` ni o'qiydi. Uning modulini (ishorasiz qiymatini) chiqaring: agar `n` manfiy bo'lsa, uni musbatga aylantiring, keyin `printf` bilan chiqaring.\n\nMasalan, kiritilgan qiymat `-7` bo'lsa, natija `7` bo'lishi kerak.\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi.",
    en: 'The program reads one whole number `n` with `scanf`. Print its absolute value (the number without its minus sign): if `n` is negative, make it positive, then print it with `printf`.\n\nFor example, if the input is `-7`, the output must be `7`.\n\nCheck runs your program with several different inputs.',
    ru: 'Программа считывает с помощью `scanf` одно целое число `n`. Выведите его модуль (число без знака минус): если `n` отрицательное, сделайте его положительным, затем выведите его с помощью `printf`.\n\nНапример, если ввод `-7`, вывод должен быть `7`.\n\n«Проверить» запускает программу с несколькими разными вводами.',
  },
  starterCode: [
    '#include <stdio.h>',
    '',
    'int main() {',
    '    int n;',
    '    scanf("%d", &n);',
    '',
    '',
    '',
    '    printf("%d\\n", n);',
    '    return 0;',
    '}',
  ],
  // Negative, positive and zero: the starter code alone passes the last two, so only the if makes it pass all three.
  testCases: [
    { input: '-7', expectedOutput: '7\n' },
    { input: '12', expectedOutput: '12\n' },
    { input: '0', expectedOutput: '0\n' },
  ],
}
