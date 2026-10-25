import type { Problem } from './types'

// No starterCode: at medium difficulty the student writes the whole program, scanf included.
export const countDigitsProblem: Problem = {
  id: 'countDigits',
  title: {
    uz: 'Raqamlar soni',
    en: 'Count the Digits',
    ru: 'Количество цифр',
  },
  topic: 'while',
  difficulty: 'medium',
  kind: 'write',
  statement: {
    uz: "Dastur `scanf` bilan bitta musbat butun son `n` ni o'qiydi. `while` siklidan foydalanib, unda nechta raqam borligini sanang va chiqaring.\n\nMaslahat: `n / 10` sonning oxirgi raqamini olib tashlaydi. `n` 0 bo'lguncha necha marta bo'lish mumkinligini sanang.\n\nMasalan, kiritilgan qiymat `4728` bo'lsa, natija `4` bo'lishi kerak.\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi.",
    en: 'The program reads one positive whole number `n` with `scanf`. Use a `while` loop to count how many digits it has, and print that count.\n\nHint: `n / 10` removes the last digit of a number. Count how many times you can do that before `n` becomes 0.\n\nFor example, if the input is `4728`, the output must be `4`.\n\nCheck runs your program with several different inputs.',
    ru: 'Программа считывает с помощью `scanf` одно положительное целое число `n`. С помощью цикла `while` посчитайте, сколько в нём цифр, и выведите это количество.\n\nПодсказка: `n / 10` отбрасывает последнюю цифру числа. Посчитайте, сколько раз это можно сделать, пока `n` не станет равным 0.\n\nНапример, если ввод `4728`, вывод должен быть `4`.\n\n«Проверить» запускает программу с несколькими разными вводами.',
  },
  // One digit, four digits, and a number full of zeros, which a digit-by-digit mistake often gets wrong.
  testCases: [
    { input: '4728', expectedOutput: '4\n' },
    { input: '7', expectedOutput: '1\n' },
    { input: '100000', expectedOutput: '6\n' },
  ],
}
