import type { Problem } from './types'

// A debug problem: the starter code's loop condition is `i < n`, so it stops one number early and never adds n.
export const sumToNProblem: Problem = {
  id: 'sumToN',
  title: {
    uz: "1 dan n gacha yig'indi",
    en: 'Sum from 1 to n',
    ru: 'Сумма от 1 до n',
  },
  topic: 'for',
  difficulty: 'easy',
  kind: 'debug',
  statement: {
    uz: "Dastur `scanf` bilan bitta musbat butun son `n` ni o'qiydi va `1 + 2 + ... + n` yig'indisini chiqarishi kerak.\n\nMuharrirdagi dastur shuni qilishi kerak, lekin unda xato bor: u noto'g'ri javob chiqaradi. Xatoni toping va tuzating. Ishga tushirishni bosing va dasturni qadamma-qadam kuzating.\n\nMasalan, kiritilgan qiymat `5` bo'lsa, natija `15` bo'lishi kerak.\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi.",
    en: 'The program reads one positive whole number `n` with `scanf` and must print the sum `1 + 2 + ... + n`.\n\nThe program in the editor is meant to do this, but it has a mistake: it prints the wrong answer. Find the mistake and fix it. Press Run and step through the program to watch what it does.\n\nFor example, if the input is `5`, the output must be `15`.\n\nCheck runs your program with several different inputs.',
    ru: 'Программа считывает с помощью `scanf` одно положительное целое число `n` и должна вывести сумму `1 + 2 + ... + n`.\n\nПрограмма в редакторе должна это делать, но в ней есть ошибка: она выводит неправильный ответ. Найдите ошибку и исправьте её. Нажмите «Запустить» и пройдите программу по шагам, чтобы увидеть, что она делает.\n\nНапример, если ввод `5`, вывод должен быть `15`.\n\n«Проверить» запускает программу с несколькими разными вводами.',
  },
  starterCode: [
    '#include <stdio.h>',
    '',
    'int main() {',
    '    int n;',
    '    int sum = 0;',
    '    int i;',
    '    scanf("%d", &n);',
    '',
    '    for (i = 1; i < n; i++) {',
    '        sum += i;',
    '    }',
    '    printf("%d\\n", sum);',
    '',
    '    return 0;',
    '}',
  ],
  // n = 1 is the smallest case, where stopping one number early leaves nothing added at all.
  testCases: [
    { input: '5', expectedOutput: '15\n' },
    { input: '1', expectedOutput: '1\n' },
    { input: '10', expectedOutput: '55\n' },
  ],
}
