import type { Problem } from './types'

// A debug problem: the starter code has a `;` right after `while (i <= n)`, so that `;` is the whole loop
// and the block under it is not part of it. When the condition is true the loop never ends (Run and Check
// stop it at codeError.stepLimit); when it is false the block still runs once, the wrong answer for n = 1.
export const sumOfEvensProblem: Problem = {
  id: 'sumOfEvens',
  title: {
    uz: "Juft sonlar yig'indisi",
    en: 'Sum of Even Numbers',
    ru: 'Сумма чётных чисел',
  },
  topic: 'while',
  difficulty: 'easy',
  kind: 'debug',
  statement: {
    uz: "Dastur `scanf` bilan bitta butun son `n` ni o'qiydi va `while` sikli yordamida 2 dan `n` gacha bo'lgan barcha juft sonlarni qo'shib, yig'indini chiqarishi kerak. Bunday sonlar bo'lmasa, yig'indi 0 ga teng.\n\nMuharrirdagi dastur shuni qilishi kerak, lekin unda xato bor. Xatoni toping va tuzating. Ishga tushirishni bosing va dastur nima qilishini kuzating.\n\nMasalan, kiritilgan qiymat `10` bo'lsa, natija `30` bo'lishi kerak, `1` bo'lsa esa — `0`.\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi.",
    en: 'The program reads one whole number `n` with `scanf` and, using a `while` loop, must add up all the even numbers from 2 to `n` and print the sum. If there are no such numbers, the sum is 0.\n\nThe program in the editor is meant to do this, but it has a mistake. Find the mistake and fix it. Press Run and watch what the program does.\n\nFor example, if the input is `10`, the output must be `30`, and if the input is `1`, it must be `0`.\n\nCheck runs your program with several different inputs.',
    ru: 'Программа считывает с помощью `scanf` одно целое число `n` и с помощью цикла `while` должна сложить все чётные числа от 2 до `n` и вывести сумму. Если таких чисел нет, сумма равна 0.\n\nПрограмма в редакторе должна это делать, но в ней есть ошибка. Найдите ошибку и исправьте её. Нажмите «Запустить» и посмотрите, что делает программа.\n\nНапример, если ввод `10`, вывод должен быть `30`, а если ввод `1` — `0`.\n\n«Проверить» запускает программу с несколькими разными вводами.',
  },
  starterCode: [
    '#include <stdio.h>',
    '',
    'int main() {',
    '    int n;',
    '    int sum = 0;',
    '    int i = 2;',
    '    scanf("%d", &n);',
    '',
    '    while (i <= n);',
    '    {',
    '        sum += i;',
    '        i += 2;',
    '    }',
    '    printf("%d\\n", sum);',
    '',
    '    return 0;',
    '}',
  ],
  // n = 1 is the case that finishes with a wrong answer, so its trace can be stepped through to the mistake.
  // Any n of 2 or more makes the buggy loop run forever.
  testCases: [
    { input: '10', expectedOutput: '30\n' },
    { input: '1', expectedOutput: '0\n' },
    { input: '7', expectedOutput: '12\n' },
  ],
}
