import type { Problem } from './types'

// A debug problem: the starter code never changes `i` inside the loop, so `i <= 5` stays true and the loop
// never ends. Run and Check stop it at the interpreter's step limit (codeError.stepLimit).
export const timesTableProblem: Problem = {
  id: 'timesTable',
  title: {
    uz: 'Karra jadvali',
    en: 'Times Table',
    ru: 'Таблица умножения',
  },
  topic: 'while',
  difficulty: 'easy',
  kind: 'debug',
  statement: {
    uz: "Dastur `scanf` bilan bitta butun son `n` ni o'qiydi va `while` sikli yordamida uning karra jadvalidagi dastlabki 5 ta sonni chiqarishi kerak: `n * 1`, `n * 2`, ..., `n * 5`, har birini alohida qatorga.\n\nMuharrirdagi dastur shuni qilishi kerak, lekin unda xato bor. Xatoni toping va tuzating. Ishga tushirishni bosing va dastur nima qilishini kuzating.\n\nMasalan, kiritilgan qiymat `3` bo'lsa, natija:\n`3`\n`6`\n`9`\n`12`\n`15`\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi.",
    en: 'The program reads one whole number `n` with `scanf` and, using a `while` loop, must print the first 5 numbers of its times table: `n * 1`, `n * 2`, ..., `n * 5`, each on its own line.\n\nThe program in the editor is meant to do this, but it has a mistake. Find the mistake and fix it. Press Run and watch what the program does.\n\nFor example, if the input is `3`, the output must be:\n`3`\n`6`\n`9`\n`12`\n`15`\n\nCheck runs your program with several different inputs.',
    ru: 'Программа считывает с помощью `scanf` одно целое число `n` и с помощью цикла `while` должна вывести первые 5 чисел его таблицы умножения: `n * 1`, `n * 2`, ..., `n * 5`, каждое на отдельной строке.\n\nПрограмма в редакторе должна это делать, но в ней есть ошибка. Найдите ошибку и исправьте её. Нажмите «Запустить» и посмотрите, что делает программа.\n\nНапример, если ввод `3`, вывод должен быть:\n`3`\n`6`\n`9`\n`12`\n`15`\n\n«Проверить» запускает программу с несколькими разными вводами.',
  },
  starterCode: [
    '#include <stdio.h>',
    '',
    'int main() {',
    '    int n;',
    '    int i = 1;',
    '    scanf("%d", &n);',
    '',
    '    while (i <= 5) {',
    '        printf("%d\\n", n * i);',
    '    }',
    '',
    '    return 0;',
    '}',
  ],
  testCases: [
    { input: '3', expectedOutput: '3\n6\n9\n12\n15\n' },
    { input: '7', expectedOutput: '7\n14\n21\n28\n35\n' },
    { input: '1', expectedOutput: '1\n2\n3\n4\n5\n' },
  ],
}
