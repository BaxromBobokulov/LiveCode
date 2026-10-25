import type { Problem } from './types'

// No starterCode: at medium difficulty the student writes the whole program, scanf included.
export const digitSumProblem: Problem = {
  id: 'digitSum',
  title: {
    uz: "Raqamlar yig'indisi",
    en: 'Sum of Digits',
    ru: 'Сумма цифр',
  },
  topic: 'while',
  difficulty: 'medium',
  kind: 'write',
  statement: {
    uz: "Dastur `scanf` bilan bitta musbat butun son `n` ni o'qiydi. `while` sikli yordamida uning raqamlari yig'indisini toping va chiqaring.\n\nMaslahat: `n % 10` sonning oxirgi raqamini beradi, `n / 10` esa oxirgi raqamni olib tashlaydi. `n` 0 ga teng bo'lguncha takrorlang.\n\nMasalan, kiritilgan qiymat `4728` bo'lsa, natija `21` bo'lishi kerak (4 + 7 + 2 + 8).\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi.",
    en: 'The program reads one positive whole number `n` with `scanf`. Use a `while` loop to find the sum of its digits, and print it.\n\nHint: `n % 10` gives the last digit of a number, and `n / 10` removes the last digit. Repeat until `n` is 0.\n\nFor example, if the input is `4728`, the output must be `21` (4 + 7 + 2 + 8).\n\nCheck runs your program with several different inputs.',
    ru: 'Программа считывает с помощью `scanf` одно положительное целое число `n`. С помощью цикла `while` найдите сумму его цифр и выведите её.\n\nПодсказка: `n % 10` даёт последнюю цифру числа, а `n / 10` отбрасывает последнюю цифру. Повторяйте, пока `n` не станет равным 0.\n\nНапример, если ввод `4728`, вывод должен быть `21` (4 + 7 + 2 + 8).\n\n«Проверить» запускает программу с несколькими разными вводами.',
  },
  // Four digits, a single digit, and zeros in the middle (1 + 0 + 0 + 9).
  testCases: [
    { input: '4728', expectedOutput: '21\n' },
    { input: '5', expectedOutput: '5\n' },
    { input: '1009', expectedOutput: '10\n' },
  ],
}
