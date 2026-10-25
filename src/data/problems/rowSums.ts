import type { Problem } from './types'

// A debug problem: the starter code reads grid[j][i] instead of grid[i][j], so it adds up columns, not rows.
export const rowSumsProblem: Problem = {
  id: 'rowSums',
  title: {
    uz: "Qatorlar yig'indisi",
    en: 'Row Sums',
    ru: 'Суммы строк',
  },
  topic: 'arrays',
  difficulty: 'medium',
  kind: 'debug',
  statement: {
    uz: "Dastur `scanf` bilan 3×3 jadvaldagi 9 ta butun sonni qatorma-qator `grid` massiviga o'qiydi va har bir qatorning yig'indisini alohida qatorga chiqarishi kerak, birinchi qatordan boshlab.\n\nMuharrirdagi dastur shuni qilishi kerak, lekin unda xato bor: u noto'g'ri yig'indilarni chiqaradi. Xatoni toping va tuzating. Ishga tushirishni bosing va dasturni qadamma-qadam kuzating.\n\nMasalan, kiritilgan qiymatlar `1 2 3 4 5 6 7 8 9` bo'lsa, natija:\n`6`\n`15`\n`24`\n\nTekshirish dasturingizni bir nechta har xil qiymatlar bilan ishga tushiradi.",
    en: 'The program reads 9 whole numbers of a 3×3 table into the array `grid` with `scanf`, row by row, and must print the sum of each row on its own line, starting with the first row.\n\nThe program in the editor is meant to do this, but it has a mistake: it prints the wrong sums. Find the mistake and fix it. Press Run and step through the program to watch what it does.\n\nFor example, if the input is `1 2 3 4 5 6 7 8 9`, the output must be:\n`6`\n`15`\n`24`\n\nCheck runs your program with several different inputs.',
    ru: 'Программа считывает с помощью `scanf` 9 целых чисел таблицы 3×3 в массив `grid`, строка за строкой, и должна вывести сумму каждой строки на отдельной строке, начиная с первой.\n\nПрограмма в редакторе должна это делать, но в ней есть ошибка: она выводит неправильные суммы. Найдите ошибку и исправьте её. Нажмите «Запустить» и пройдите программу по шагам, чтобы увидеть, что она делает.\n\nНапример, если ввод `1 2 3 4 5 6 7 8 9`, вывод должен быть:\n`6`\n`15`\n`24`\n\n«Проверить» запускает программу с несколькими разными вводами.',
  },
  starterCode: [
    '#include <stdio.h>',
    '',
    'int main() {',
    '    int grid[3][3];',
    '    int i, j;',
    '',
    '    for (i = 0; i < 3; i++) {',
    '        for (j = 0; j < 3; j++) {',
    '            scanf("%d", &grid[i][j]);',
    '        }',
    '    }',
    '',
    '    for (i = 0; i < 3; i++) {',
    '        int sum = 0;',
    '        for (j = 0; j < 3; j++) {',
    '            sum += grid[j][i];',
    '        }',
    '        printf("%d\\n", sum);',
    '    }',
    '',
    '    return 0;',
    '}',
  ],
  // Tables whose row sums and column sums differ, so adding up columns fails every case.
  testCases: [
    { input: '1 2 3 4 5 6 7 8 9', expectedOutput: '6\n15\n24\n' },
    { input: '5 0 0 1 1 1 2 0 7', expectedOutput: '5\n3\n9\n' },
  ],
}
